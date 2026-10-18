// Package server is the wing's public face: OpenAI-shaped routes over the
// relay, category-only model surface, health endpoint for the panel.
package server

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/NaveenSingh9999/a0/internal/alias"
	"github.com/NaveenSingh9999/a0/internal/lane"
	"github.com/NaveenSingh9999/a0/internal/relay"
)

// New builds the wing's http surface.
//   - GET  /healthz              → {"ok":true,"lanes":N}
//   - GET  /v1/models            → categories only (plus lane ctx/caps metadata)
//   - POST /v1/chat/completions  → relay (errors shaped OpenAI-style)
func New(r *relay.Relay) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, req *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{"ok": true, "lanes": len(r.Lanes)})
	})
	mux.HandleFunc("GET /v1/models", func(w http.ResponseWriter, req *http.Request) {
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
		if rerr := r.Chat(w, body); rerr != nil && !errors.Is(rerr, relay.ErrExhausted) {
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

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, code int, msg string) {
	writeJSON(w, code, map[string]any{"error": map[string]any{"message": msg}})
}
