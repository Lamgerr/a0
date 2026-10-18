package server

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/NaveenSingh9999/a0/internal/relay"
)

// fakeGate allows exactly one key ("sk-a0-good") and reports its id.
type fakeGate struct{ calls int }

func (f *fakeGate) Allow(key string) (string, bool) {
	f.calls++
	if key == "sk-a0-good" {
		return "kv-1", true
	}
	return "", false
}

func gatedServer(t *testing.T) (http.Handler, *fakeGate) {
	t.Helper()
	lanes := fakeLanes(t)
	g := &fakeGate{}
	return New(relay.New(http.DefaultClient, lanes), g), g
}

func authedChat(t *testing.T, h http.Handler, hdr map[string]string) *httptest.ResponseRecorder {
	t.Helper()
	body := `{"model":"a0/fast","messages":[{"role":"user","content":"hi"}]}`
	req := httptest.NewRequest(http.MethodPost, "/v1/chat/completions", strings.NewReader(body))
	for k, v := range hdr {
		req.Header.Set(k, v)
	}
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	return w
}

func TestPublicGateDeniesMissingKey(t *testing.T) {
	h, gate := gatedServer(t)
	w := authedChat(t, h, nil)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("code = %d, want 401: %s", w.Code, w.Body)
	}
	var err struct {
		Errmap struct {
			Message string `json:"message"`
		} `json:"error"`
	}
	_ = json.Unmarshal(w.Body.Bytes(), &err)
	if !strings.Contains(err.Errmap.Message, "api key") {
		t.Fatalf("message: %q", err.Errmap.Message)
	}
	if gate.calls != 1 {
		t.Fatalf("gate calls = %d", gate.calls)
	}
}

func TestPublicGateDeniesBadKey(t *testing.T) {
	h, _ := gatedServer(t)
	w := authedChat(t, h, map[string]string{"Authorization": "Bearer sk-a0-bogus"})
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("code = %d, want 401", w.Code)
	}
}

func TestBearerKeyAccepted(t *testing.T) {
	h, _ := gatedServer(t)
	w := authedChat(t, h, map[string]string{"Authorization": "Bearer sk-a0-good"})
	if w.Code != http.StatusOK {
		t.Fatalf("code = %d, want 200: %s", w.Code, w.Body)
	}
}

func TestXApiKeyAccepted(t *testing.T) {
	h, _ := gatedServer(t)
	w := authedChat(t, h, map[string]string{"x-api-key": "sk-a0-good"})
	if w.Code != http.StatusOK {
		t.Fatalf("code = %d, want 200", w.Code)
	}
}

func TestNilGateLocalOpen(t *testing.T) {
	h := New(relay.New(http.DefaultClient, fakeLanes(t)), nil)
	if w := authedChat(t, h, nil); w.Code != http.StatusOK {
		t.Fatalf("local mode should be open; code = %d", w.Code)
	}
}

func TestModelsGatedInPublic(t *testing.T) {
	h, _ := gatedServer(t)
	req := httptest.NewRequest(http.MethodGet, "/v1/models", nil)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("models open in public mode: %d", w.Code)
	}
	req = httptest.NewRequest(http.MethodGet, "/v1/models", nil)
	req.Header.Set("Authorization", "Bearer sk-a0-good")
	w = httptest.NewRecorder()
	h.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("models blocked with key: %d", w.Code)
	}
}

func TestHealthzOpenInPublic(t *testing.T) {
	h, _ := gatedServer(t)
	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("healthz gated: %d", w.Code)
	}
}
