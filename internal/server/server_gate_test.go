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
// Denies a second key shape (held/coded verdicts are also exercised).
type fakeGate struct{ calls, catalogs, opens, dones int }

func (f *fakeGate) Allow(key, ip string) (KeyInfo, bool) {
	f.calls++
	if key == "sk-a0-good" {
		return KeyInfo{ID: "kv-1", RPM: 20}, true
	}
	if key == "sk-a0-held" {
		return KeyInfo{ID: "kv-2", HTTP: http.StatusTooManyRequests,
			Reason: "key held for fair use — try again later", Retry: 3600}, true
	}
	return KeyInfo{}, false
}

func (f *fakeGate) Verify(key string) (KeyInfo, bool) {
	if key == "sk-a0-good" {
		return KeyInfo{ID: "kv-1"}, true
	}
	return KeyInfo{}, false
}

func (f *fakeGate) Catalog(ip string) (int, int) {
	f.catalogs++
	return 0, 0
}

func (f *fakeGate) StreamOpen(keyID string) (int, int) {
	f.opens++
	return 0, 0
}

func (f *fakeGate) StreamDone(keyID string) { f.dones++ }

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
	if gate.calls != 0 {
		// identity is resolved before the gate: garbage headers never
		// cost a control-plane touch.
		t.Fatalf("gate calls = %d, want 0", gate.calls)
	}
}

func TestPublicGateDeniesBadKey(t *testing.T) {
	h, _ := gatedServer(t)
	w := authedChat(t, h, map[string]string{"Authorization": "Bearer sk-a0-bogus"})
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("code = %d, want 401", w.Code)
	}
}

func TestFairUseDenyShapes(t *testing.T) {
	// held key → shaped 403/429 with Retry-After, never the 401 realm
	h, _ := gatedServer(t)
	w := authedChat(t, h, map[string]string{"Authorization": "Bearer sk-a0-held"})
	if w.Code != http.StatusTooManyRequests {
		t.Fatalf("held code = %d, want 429: %s", w.Code, w.Body)
	}
	if ra := w.Header().Get("Retry-After"); ra == "" {
		t.Fatalf("Retry-After missing on fair-use deny")
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
