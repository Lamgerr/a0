package relay

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/NaveenSingh9999/a0/internal/lane"
)

// The wing's usage recorder depends on seeing one UsageEvent per attempt
// with the right lane/model/status attribution.
func TestUsageHookPerAttempt(t *testing.T) {
	limited := func(w http.ResponseWriter) {
		w.WriteHeader(http.StatusTooManyRequests)
		w.Write([]byte(`{"error":"rate limited"}`))
	}
	srvA := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		limited(w)
	}))
	t.Cleanup(srvA.Close)
	srvB := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"id":"ok"}`))
	}))
	t.Cleanup(srvB.Close)

	lanes := []*lane.Lane{
		{Name: "xkiro", URL: srvA.URL, Key: "ka", Model: "ma"},
		{Name: "llm7", URL: srvB.URL, Key: "kb", Model: "mb"},
	}

	var events []UsageEvent
	rel := New(nil, lanes)
	rel.Usage = func(e UsageEvent) { events = append(events, e) }

	w := httptest.NewRecorder()
	if err := rel.ChatMeta(w, []byte(`{"model":"a0/flagship","messages":[]}`),
		Meta{KeyID: "kv-77"}); err != nil {
		t.Fatalf("ChatMeta: %v", err)
	}
	if len(events) != 2 {
		t.Fatalf("expected 2 events, got %d: %+v", len(events), events)
	}
	if events[0].Lane != "xkiro" || events[0].Model != "qwen/qwen3.8-max:free" ||
		events[0].KeyID != "kv-77" || events[0].Status != http.StatusTooManyRequests {
		t.Fatalf("event 0: %+v", events[0])
	}
	if events[1].Lane != "llm7" || events[1].Status != http.StatusOK || events[1].KeyID != "kv-77" {
		t.Fatalf("event 1: %+v", events[1])
	}
	if events[1].LatencyMs < 0 {
		t.Fatalf("latency negative: %d", events[1].LatencyMs)
	}
}

func TestUsageHookNilDoesNotPanic(t *testing.T) {
	rel := New(nil, []*lane.Lane{
		{Name: "llm7", URL: "http://127.0.0.1:1/v1", Key: "k", Model: "m"},
	})
	w := httptest.NewRecorder()
	_ = rel.Chat(w, []byte(`{"model":"a0/fast","messages":[]}`))
}
