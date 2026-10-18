package relay

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/NaveenSingh9999/a0/internal/lane"
)

// Lane 1 commits a 200 and streams a chunk, then its TCP conn dies
// (hijacked + closed mid-body). The chain MUST stop there: lane 2's marker
// and the 502 exhaustion body must never be appended to committed bytes.
func TestNoCorruptAppendAfterCommit(t *testing.T) {
	l1 := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hj, ok := w.(http.Hijacker)
		if !ok {
			t.Fatal("no hijack")
		}
		conn, rw, _ := hj.Hijack()
		fmt.Fprint(rw, "HTTP/1.1 200 OK\r\nConnection: close\r\nContent-Type: text/event-stream\r\nContent-Length: 9999\r\n\r\ndata: {\"lane\":1}\n\n")
		rw.Flush()
		conn.Close()
	}))
	defer l1.Close()
	l2 := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		fmt.Fprint(w, `{"lane":2}`)
	}))
	defer l2.Close()

	rel := New(nil, []*lane.Lane{
		{Name: "xkiro", URL: l1.URL, Key: "k", Model: "x"},
		{Name: "llm7", URL: l2.URL, Model: "y"},
	})
	rec := httptest.NewRecorder()
	rel.Chat(rec, []byte(`{"model":"a0/flagship","messages":[]}`))

	body := rec.Body.String()
	if !strings.Contains(body, `{"lane":1}`) {
		t.Fatalf("lane1 chunk missing: %q", body)
	}
	if strings.Contains(body, `{"lane":2}`) {
		t.Fatalf("lane2 appended after lane1 committed: %q", body)
	}
	if strings.Contains(body, "all lanes cooling") {
		t.Fatalf("502 exhaustion body appended after commit: %q", body)
	}
}
