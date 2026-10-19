package relay

import (
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/NaveenSingh9999/a0/internal/lane"
)

func timeout(d time.Duration) lane.HTTPClient { return &http.Client{Timeout: d} }

func okLane(t *testing.T, hits func(r *http.Request)) *lane.Lane {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if hits != nil {
			hits(r)
		}
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"id":"ok"}`))
	}))
	t.Cleanup(srv.Close)
	return &lane.Lane{Name: "llm7", URL: srv.URL, Key: "kb", Model: "mb"}
}

// T1: lane-a 429s with Retry-After 90 → lane-b serves; a request inside the
// 90s window must skip lane-a entirely (Review Focus 2).
func TestFailoverHonorsRetryAfter(t *testing.T) {
	var aHits int
	var mu sync.Mutex
	srvA := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		aHits++
		n := aHits
		mu.Unlock()
		if n == 1 {
			w.Header().Set("Retry-After", "90")
			w.WriteHeader(http.StatusTooManyRequests)
			w.Write([]byte(`{"error":"rate limited"}`))
			return
		}
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"id":"a"}`))
	}))
	defer srvA.Close()

	req := []byte(chatBody)
	rel := New(timeout(300*time.Millisecond), []*lane.Lane{
		&lane.Lane{Name: "xkiro", URL: srvA.URL, Key: "ka", Model: "ma"},
		okLane(t, nil),
	})
	w := httptest.NewRecorder()
	if err := rel.Chat(w, req); err != nil {
		t.Fatalf("Chat: %v", err)
	}
	if w.Header().Get("X-A0-Lane") != "Tier 2" {
		t.Fatalf("first attempt must fail over to b, served by %q", w.Header().Get("X-A0-Lane"))
	}

	w2 := httptest.NewRecorder()
	if err := rel.Chat(w2, req); err != nil {
		t.Fatalf("Chat 2: %v", err)
	}
	mu.Lock()
	defer mu.Unlock()
	if aHits != 1 {
		t.Fatalf("lane a hit %d times; cooled lane must be skipped", aHits)
	}
}

// T2: a hung lane (conn refused + injected dial timeout) must not stall the
// chain beyond its own budget — chain still completes on lane b (Focus 3).
func TestFailoverDeadLaneDoesNotStallChain(t *testing.T) {
	rel := New(timeout(300*time.Millisecond), []*lane.Lane{
		&lane.Lane{Name: "a", URL: "http://127.0.0.1:1/v1", Key: "", Model: "ma"},
		okLane(t, nil),
	})
	w := httptest.NewRecorder()
	start := time.Now()
	if err := rel.Chat(w, []byte(chatBody)); err != nil {
		t.Fatalf("Chat: %v", err)
	}
	if d := time.Since(start); d > 3*time.Second {
		t.Fatalf("chain took %v; hung lane must not stall it", d)
	}
	if w.Body.String() != `{"id":"ok"}` {
		t.Fatalf("body = %q", w.Body.String())
	}
}

// T3: every lane already benched → locked 502, exact body (pinned by plan).
func TestAllLanesCooledExact502(t *testing.T) {
	a := &lane.Lane{Name: "xkiro", URL: "http://127.0.0.1:1/v1", Key: "ka"}
	a.CoolLane(30 * time.Second)
	b := okLane(t, nil)
	b.CoolLane(30 * time.Second)
	rel := New(http.DefaultClient, []*lane.Lane{a, b})

	w := httptest.NewRecorder()
	if err := rel.Chat(w, []byte(chatBody)); err == nil {
		t.Fatal("expect exhaustion error")
	}
	if w.Code != http.StatusBadGateway {
		t.Fatalf("code = %d want 502", w.Code)
	}
	if got := w.Body.String(); got != `{"error":{"message":"all lanes cooling, retry later"}}` {
		t.Fatalf("502 body = %q", got)
	}
}
