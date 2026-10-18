package server

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/NaveenSingh9999/a0/internal/alias"
	"github.com/NaveenSingh9999/a0/internal/lane"
	"github.com/NaveenSingh9999/a0/internal/relay"
)

// fakeLanes boots two upstreams: xkiro always 429s, llm7 is healthy and
// serves /models, plain chat JSON and SSE streams.
func fakeLanes(t *testing.T) []*lane.Lane {
	t.Helper()
	fail := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Retry-After", "90")
		http.Error(w, `{"error":"rate limited"}`, http.StatusTooManyRequests)
	}))
	t.Cleanup(fail.Close)

	good := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/models":
			w.WriteHeader(http.StatusOK)
			fmt.Fprint(w, `{"data":[{"id":"deepseek-v4-pro","owned_by":"api","context_length":262144,"access_tier":"free","capabilities":{"tools":true}}]}`)
		default:
			var body struct {
				Stream bool `json:"stream"`
			}
			_ = json.NewDecoder(r.Body).Decode(&body)
			if body.Stream {
				w.Header().Set("Content-Type", "text/event-stream")
				w.WriteHeader(http.StatusOK)
				fmt.Fprint(w, "data: {\"delta\":\"x\"}\n\ndata: [DONE]\n\n")
				return
			}
			w.WriteHeader(http.StatusOK)
			fmt.Fprint(w, `{"id":"chatcmpl-e2e"}`)
		}
	}))
	t.Cleanup(good.Close)

	return []*lane.Lane{
		{Name: "xkiro", URL: fail.URL, Key: "kx", Model: "qwen/qwen3-coder-plus:free"},
		{Name: "llm7", URL: good.URL, Key: "", Model: "deepseek-v4-pro"},
	}
}

func do(h http.Handler, method, path string, body []byte) *httptest.ResponseRecorder {
	var rd io.Reader
	if body != nil {
		rd = strings.NewReader(string(body))
	}
	w := httptest.NewRecorder()
	h.ServeHTTP(w, httptest.NewRequest(method, path, rd))
	return w
}

func TestServerE2E(t *testing.T) {
	lanes := fakeLanes(t)
	h := New(relay.New(http.DefaultClient, lanes), nil)

	t.Run("healthz", func(t *testing.T) {
		w := do(h, "GET", "/healthz", nil)
		var hz struct {
			OK    bool `json:"ok"`
			Lanes int  `json:"lanes"`
		}
		if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &hz) != nil || !hz.OK || hz.Lanes != 2 {
			t.Fatalf("healthz = %d %q", w.Code, w.Body.String())
		}
	})

	t.Run("models lists only categories", func(t *testing.T) {
		w := do(h, "GET", "/v1/models", nil)
		if w.Code != 200 {
			t.Fatalf("models = %d", w.Code)
		}
		var got struct {
			Data []map[string]any `json:"data"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
			t.Fatalf("models json: %v", err)
		}
		if len(got.Data) != len(alias.IDs) {
			t.Fatalf("want %d categories, got %d", len(alias.IDs), len(got.Data))
		}
		for _, m := range got.Data {
			id, _ := m["id"].(string)
			if !strings.HasPrefix(id, "a0/") {
				t.Fatalf("raw id leaked to public surface: %q", id)
			}
		}
	})

	t.Run("unknown model 400 lists categories", func(t *testing.T) {
		w := do(h, "POST", "/v1/chat/completions", []byte(`{"model":"gpt-4o"}`))
		if w.Code != 400 {
			t.Fatalf("code = %d", w.Code)
		}
		for _, id := range alias.IDs {
			if !strings.Contains(w.Body.String(), id) {
				t.Fatalf("400 missing %q: %q", id, w.Body.String())
			}
		}
	})

	t.Run("chat non-stream failover chain", func(t *testing.T) {
		w := do(h, "POST", "/v1/chat/completions", []byte(`{"model":"a0/coder","messages":[{"role":"user","content":"hi"}]}`))
		if w.Code != 200 {
			t.Fatalf("code = %d body=%q", w.Code, w.Body.String())
		}
		if w.Header().Get("X-A0-Lane") != "llm7" {
			t.Fatalf("lane = %q — 429 lane must be skipped", w.Header().Get("X-A0-Lane"))
		}
	})

	t.Run("chat stream through public surface", func(t *testing.T) {
		w := do(h, "POST", "/v1/chat/completions", []byte(`{"model":"a0/fast","stream":true,"messages":[{"role":"user","content":"hi"}]}`))
		if w.Code != 200 {
			t.Fatalf("code = %d", w.Code)
		}
		if !strings.Contains(w.Body.String(), "data: [DONE]") {
			t.Fatalf("stream body = %q", w.Body.String())
		}
	})
}

func TestOversizeBodyRejected(t *testing.T) {
	lanes := fakeLanes(t)
	h := New(relay.New(http.DefaultClient, lanes), nil)
	big := `{"model":"a0/coder","messages":[` + strings.Repeat(`{"role":"user","content":"x"},`, 40_000) + `{"role":"user","content":"y"}]}`
	w := do(h, "POST", "/v1/chat/completions", []byte(big))
	if w.Code != 413 {
		t.Fatalf("oversize body code = %d ( body[:80]=%q )", w.Code, w.Body.String()[:min(80, w.Body.Len())])
	}
}
