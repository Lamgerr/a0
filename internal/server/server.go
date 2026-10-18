// Package server is the wing's public face: OpenAI-shaped routes over the
// relay, category-only model surface, health endpoint for the panel.
package server

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/NaveenSingh9999/a0/internal/alias"
	"github.com/NaveenSingh9999/a0/internal/lane"
	"github.com/NaveenSingh9999/a0/internal/relay"
)

// KeyGate answers public-mode auth questions; nil disables gating (local
// mode). Allow returns "" ok=false when the key is missing or invalid.
type KeyGate interface {
	Allow(key string) (keyID string, ok bool)
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
		writeJSON(w, http.StatusOK, map[string]any{"ok": true, "lanes": len(r.Lanes)})
	})
	mux.HandleFunc("GET /v1/models", func(w http.ResponseWriter, req *http.Request) {
		if gate != nil {
			if _, ok := auth(req, gate); !ok {
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
		// Auth before rate-limit body reads: garbage keys shouldn't cost I/O.
		var keyID string
		if gate != nil {
			id, ok := auth(req, gate)
			if !ok {
				writeErr(w, http.StatusUnauthorized, "invalid or missing api key")
				return
			}
			keyID = id
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
			Model string `json:"model"`
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
		if rerr := r.ChatMeta(w, body, relay.Meta{KeyID: keyID}); rerr != nil && !errors.Is(rerr, relay.ErrExhausted) {
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

// auth extracts the virtual key from `Authorization: Bearer …` / `x-api-key`
// and asks the gate. gate == nil means local mode: allowed, empty id.
func auth(r *http.Request, gate KeyGate) (string, bool) {
	if gate == nil {
		return "", true
	}
	key := r.Header.Get("x-api-key")
	if key == "" {
		if h := r.Header.Get("Authorization"); h != "" {
			key = strings.TrimPrefix(h, "Bearer ")
		}
	}
	key = strings.TrimSpace(key)
	id, ok := gate.Allow(key)
	return id, ok
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, code int, msg string) {
	writeJSON(w, code, map[string]any{"error": map[string]any{"message": msg}})
}
