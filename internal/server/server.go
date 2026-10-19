// Package server is the wing's public face: OpenAI-shaped routes over the
// relay, category-only model surface, health endpoint for the panel.
package server

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/NaveenSingh9999/a0/internal/alias"
	"github.com/NaveenSingh9999/a0/internal/guard"
	"github.com/NaveenSingh9999/a0/internal/lane"
	"github.com/NaveenSingh9999/a0/internal/relay"
)

// KeyInfo is the admission verdict for one (key, request) pair.
// HTTP != 0 means deny with that status code; ok=false convenience for the
// plain 401 realm case.
type KeyInfo struct {
	ID       string
	RPM      int
	DayCap   int
	DayCount int
	HTTP     int // deny code (401/403/429); 0 = allowed
	Reason   string
	Retry    int // retry-after seconds when 429
}

// KeyGate answers public-mode auth + fair-use questions; nil disables
// gating (local mode). ip is the sanitized client address.
type KeyGate interface {
	Allow(key, ip string) (KeyInfo, bool)
	// Verify checks key validity + status only, no fair-use accounting
	// (used by cheap surfaces like /v1/models). ok=false → 401.
	Verify(key string) (KeyInfo, bool)
	// Catalog bounds /v1/models per IP: (denyHTTP, retryAfter); 0 = allow.
	Catalog(ip string) (int, int)
	// StreamOpen claims a concurrent-stream slot (chat, streaming only).
	// (denyHTTP, retryAfter); 0 = allow.
	StreamOpen(keyID string) (int, int)
	// StreamDone releases the slot.
	StreamDone(keyID string)
}

// New builds the wing's http surface.
//   - GET  /healthz              → {"ok":true,"lanes":N}
//   - GET  /v1/models            → categories only (plus lane ctx/caps metadata)
//   - POST /v1/chat/completions  → relay (errors shaped OpenAI-style)
//
// In public mode (gate != nil) every /v1 route requires a valid virtual key
// via `Authorization: Bearer sk-a0-…` or `x-api-key`.
func New(r *relay.Relay, gate KeyGate) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, req *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{"ok": true, "lanes": len(r.Lanes), "build": "fairuse-1"})
	})
	mux.HandleFunc("GET /v1/models", func(w http.ResponseWriter, req *http.Request) {
		if gate != nil {
			if code, retry := gate.Catalog(clientIP(req)); code != 0 {
				writeLimit(w, code, retry, "too many requests")
				return
			}
			if _, ok := rawKey(req); !ok {
				writeErr(w, http.StatusUnauthorized, "invalid or missing api key")
				return
			} else if _, ok := gate.Verify(keyOf(req)); !ok {
				writeErr(w, http.StatusUnauthorized, "invalid or missing api key")
				return
			}
		}
		var data []map[string]any
		for _, id := range alias.IDs {
			entry := map[string]any{
				"id": id, "object": "model",
				"owned_by": "a0", "access_tier": "free",
			}
			if ctx, caps := headInfo(r.C, id, r.Lanes); ctx > 0 {
				entry["context_length"] = ctx
				if caps != (capsInfo{}) {
					entry["capabilities"] = caps
				}
			}
			data = append(data, entry)
		}
		writeJSON(w, http.StatusOK, map[string]any{"object": "list", "data": data})
	})
	mux.HandleFunc("POST /v1/chat/completions", func(w http.ResponseWriter, req *http.Request) {
		// Resolve identity first (headers only): garbage keys shouldn't cost I/O.
		ip := clientIP(req)
		keyID := ""
		if gate != nil {
			key, ok := rawKey(req)
			if !ok {
				writeErr(w, http.StatusUnauthorized, "invalid or missing api key")
				return
			}
			info, allowed := gate.Allow(key, ip)
			if info.HTTP != 0 {
				writeLimit(w, info.HTTP, info.Retry, info.Reason)
				return
			}
			if !allowed {
				writeErr(w, http.StatusUnauthorized, "invalid or missing api key")
				return
			}
			keyID = info.ID
		}
		req.Body = http.MaxBytesReader(w, req.Body, 1<<20)
		var body json.RawMessage
		if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
			var mbe *http.MaxBytesError
			if errors.As(err, &mbe) {
				writeJSON(w, http.StatusRequestEntityTooLarge,
					map[string]any{"error": map[string]any{"message": "request body too large"}})
				return
			}
			writeErr(w, http.StatusBadRequest, "invalid JSON body")
			return
		}
		var probe struct {
			Model  string `json:"model"`
			Stream bool   `json:"stream"`
		}
		if err := json.Unmarshal(body, &probe); err != nil {
			writeErr(w, http.StatusBadRequest, "invalid JSON body")
			return
		}
		if _, rerr := alias.Resolve(probe.Model, r.Lanes); rerr != nil {
			var uk alias.ErrUnknown
			if errors.As(rerr, &uk) {
				writeErr(w, http.StatusBadRequest, uk.Error())
				return
			}
			writeErr(w, http.StatusInternalServerError, rerr.Error())
			return
		}
		// Concurrent-stream ceiling, only for streamed completions.
		if probe.Stream && gate != nil {
			if code, retry := gate.StreamOpen(keyID); code != 0 {
				writeLimit(w, code, retry, "too many concurrent streams for this key")
				return
			}
			defer gate.StreamDone(keyID)
		}
		if rerr := r.ChatMeta(w, body, relay.Meta{KeyID: keyID, IP: ip}); rerr != nil && !errors.Is(rerr, relay.ErrExhausted) {
			// relay already streams on success and wrote the 502 on exhaustion;
			// anything else is a client-format problem we have not yet touched w for.
			writeErr(w, http.StatusBadRequest, rerr.Error())
		}
	})
	mux.HandleFunc("/", func(w http.ResponseWriter, req *http.Request) {
		writeErr(w, http.StatusNotFound, "unknown route")
	})
	return mux
}

// capsInfo mirrors xKiro-style capability metadata for /v1/models rows.
type capsInfo struct {
	Vision    bool `json:"vision,omitempty"`
	Tools     bool `json:"tools,omitempty"`
	Reasoning bool `json:"reasoning,omitempty"`
}

// headInfo probes the primary catalog (cheap, lane-bounded) and returns
// the primary lane's context/caps for a category. Empty when offline.
func headInfo(c lane.HTTPClient, cat string, lanes []*lane.Lane) (int, capsInfo) {
	chain, err := alias.Resolve(cat, lanes)
	if err != nil || len(chain) == 0 {
		return 0, capsInfo{}
	}
	primary := chain[0].L
	models := lane.Probe(c, []*lane.Lane{primary})
	for _, m := range models {
		if m.ID == chain[0].Model {
			return m.Ctx, capsInfo{Vision: m.Vision, Tools: m.Tools, Reasoning: m.Reasoning}
		}
	}
	return 0, capsInfo{}
}

// rawKey extracts the virtual key from `Authorization: Bearer …` /
// `x-api-key` (present = ok). gate == nil → local mode, allowed, empty id.
func rawKey(r *http.Request) (string, bool) {
	key := r.Header.Get("x-api-key")
	if key == "" {
		if h := r.Header.Get("Authorization"); h != "" {
			key = strings.TrimPrefix(h, "Bearer ")
		}
	}
	key = strings.TrimSpace(key)
	return key, key != ""
}

func keyOf(r *http.Request) string { k, _ := rawKey(r); return k }

// clientIP resolves the request's source address (leftmost XFF under a
// fronting load balancer, else the TCP peer) — delegated to fair guard.
func clientIP(r *http.Request) string {
	return guard.ClientIP(r)
}

// writeLimit emits the fair-use denial bodies with the OpenAI error shape.
func writeLimit(w http.ResponseWriter, code, retry int, reason string) {
	if retry > 0 {
		w.Header().Set("Retry-After", strconv.Itoa(retry))
	}
	w.Header().Set("X-A0-FairUse", "1")
	writeErr(w, code, reason)
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, code int, msg string) {
	writeJSON(w, code, map[string]any{"error": map[string]any{"message": msg}})
}
