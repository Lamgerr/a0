package relay

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/NaveenSingh9999/a0/internal/lane"
)

// The upstream writes chunk1, flushes it onto the wire, and only then waits
// for the reader's signal before writing chunk2. If a0 buffered SSE bodies
// (waited for upstream EOF), chunk1 would never reach the reader while the
// upstream held the door — the upstream's 1s guard times out, the response
// client dies, and the reader asserts fail on the missing chunks.
func TestChatStreamsSSEUnbuffered(t *testing.T) {
	const (
		chunk1 = "data: {\"delta\":\"a\"}\n\n"
		chunk2 = "data: {\"delta\":\"b\"}\n\n" + "data: [DONE]\n\n"
	)
	readerSawChunk1 := make(chan struct{})
	up := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(chunk1))
		w.(http.Flusher).Flush()
		select {
		case <-readerSawChunk1: // reader has chunk1 on the wire already
		case <-time.After(1 * time.Second):
			// a0 buffered; tell the reader by stalling forever.
			<-time.After(5 * time.Second)
		}
		w.Write([]byte(chunk2))
	}))
	defer up.Close()

	l := &lane.Lane{Name: "xkiro", URL: up.URL, Key: "k", Model: "qwen/qwen3-coder-plus:free"}
	rel := New(http.DefaultClient, []*lane.Lane{l})
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if err := rel.Chat(w, []byte(`{"model":"a0/coder","stream":true,"messages":[{"role":"user","content":"hi"}]}`)); err != nil {
			http.Error(w, err.Error(), http.StatusBadGateway)
		}
	}))
	defer srv.Close()

	resp, err := http.Get(srv.URL)
	if err != nil {
		t.Fatalf("downstream GET: %v", err)
	}
	defer resp.Body.Close()
	if ct := resp.Header.Get("Content-Type"); !strings.Contains(ct, "text/event-stream") {
		t.Fatalf("downstream content-type = %q", ct)
	}
	if laneName := resp.Header.Get("X-A0-Lane"); laneName != "xkiro" {
		t.Fatalf("X-A0-Lane = %q", laneName)
	}

	buf := make([]byte, 4096)
	// First read must yield exactly chunk1 — one false pass guard: if a0
	// buffered the SSE body, this read blocks until upstream EOF and returns
	// chunk1+chunk2 (65B) together, tripping the n!=len(chunk1) check.
	start := time.Now()
	n, err := resp.Body.Read(buf)
	elapsed := time.Since(start)
	if err != nil {
		t.Fatalf("first read err: %v", err)
	}
	if elapsed > 900*time.Millisecond {
		t.Fatalf("chunk1 took %v to arrive — streaming buffered", elapsed)
	}
	if string(buf[:n]) != chunk1 {
		t.Fatalf("first read = %q (n=%d), want chunk1 alone %q", string(buf[:n]), n, chunk1)
	}
	close(readerSawChunk1)

	all := new(strings.Builder)
	all.Write(buf[:n])
	if _, err := io.Copy(all, resp.Body); err != nil && err != io.EOF {
		t.Fatalf("drain: %v", err)
	}
	if all.String() != chunk1+chunk2 {
		t.Fatalf("downstream stream = %q, want %q", all.String(), chunk1+chunk2)
	}
}
