package relay

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"

	"github.com/NaveenSingh9999/a0/internal/lane"
)

const chatBody = `{"model":"a0/coder","messages":[{"role":"user","content":"hi"}]}`

const laneBody = `{"model":"qwen/qwen3-coder-plus:free","messages":[{"role":"user","content":"hi"}],"temperature":0.7}`

func TestChatSingleLaneRenamesMergesForwards(t *testing.T) {
	var gotBody, gotAuth, gotHdr, gotContentType string
	up := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		b, _ := io.ReadAll(r.Body)
		gotBody, gotAuth = string(b), r.Header.Get("Authorization")
		gotHdr = r.Header.Get("X-Tenant")
		gotContentType = r.Header.Get("Content-Type")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"id":"chatcmpl-1"}`))
	}))
	defer up.Close()

	l := &lane.Lane{
		Name: "xkiro", URL: up.URL, Key: "sk-xt-test",
		Model:   "qwen/qwen3-coder-plus:free",
		Params:  lane.Params{"temperature": 0.7},
		Headers: map[string]string{"X-Tenant": "t1"},
	}
	rel := New(http.DefaultClient, []*lane.Lane{l})
	w := httptest.NewRecorder()

	if err := rel.Chat(w, []byte(chatBody)); err != nil {
		t.Fatalf("Chat: %v", err)
	}

	if gotAuth != "Bearer sk-xt-test" {
		t.Fatalf("upstream auth = %q", gotAuth)
	}
	if gotHdr != "t1" {
		t.Fatalf("extra header not merged: %q", gotHdr)
	}
	if !strings.Contains(gotContentType, "application/json") {
		t.Fatalf("upstream content-type = %q", gotContentType)
	}
	var sent map[string]any
	if err := json.Unmarshal([]byte(gotBody), &sent); err != nil {
		t.Fatalf("upstream body not json: %v", err)
	}
	wantBody := map[string]any{
		"model":       "qwen/qwen3-coder-plus:free",
		"temperature": 0.7,
		"messages":    []any{map[string]any{"role": "user", "content": "hi"}},
	}
	var got map[string]any = sent
	for k, want := range wantBody {
		if !reflect.DeepEqual(got[k], want) {
			t.Fatalf("upstream body[%q] = %v, want %v", k, got[k], want)
		}
	}
	if len(got) != len(wantBody) {
		t.Fatalf("upstream body has %d keys, want %d: %v", len(got), len(wantBody), got)
	}
	if w.Code != http.StatusOK {
		t.Fatalf("downstream code = %d", w.Code)
	}
	if w.Header().Get("X-A0-Lane") != "Tier 1" {
		t.Fatalf("X-A0-Lane = %q", w.Header().Get("X-A0-Lane"))
	}
	if w.Body.String() != `{"id":"chatcmpl-1"}` {
		t.Fatalf("passthrough body = %q", w.Body.String())
	}
}
