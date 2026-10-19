package relay

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/NaveenSingh9999/a0/internal/lane"
)

func TestRewriteAddsReasoningContent(t *testing.T) {
	line := "data: {\"choices\":[{\"delta\":{\"reasoning\":\"step one\"}}]}\n"
	out := rewriteReasonLine([]byte(line))
	want := "data: {\"choices\":[{\"delta\":{\"reasoning\":\"step one\",\"reasoning_content\":\"step one\"}}]}\n"
	if string(out) != want {
		t.Fatalf("got  %s\nwant %s", out, want)
	}
}

func TestRewriteLeavesAlrightLinesAlone(t *testing.T) {
	cases := []string{
		"data: {\"choices\":[{\"delta\":{\"reasoning_content\":\"already\"}}]}\n",
		"data: {\"choices\":[{\"delta\":{\"reasoning\":{}}}]}\n",
		"data: {\"choices\":[{\"delta\":{\"reasoning\":\"\"}}]}\n",
		"data: [DONE]\n",
		": ping\n",
		"event: other\n",
		"data: notjson\n",
	}
	for _, c := range cases {
		if string(rewriteReasonLine([]byte(c))) != c {
			t.Fatalf("mutated a verbatim line: %q -> %q", c, rewriteReasonLine([]byte(c)))
		}
	}
}

func TestRewriteMessageSlotPollinationsStyle(t *testing.T) {
	line := "data: {\"choices\":[{\"message\":{\"reasoning\":\"why\"}}]}\n"
	out := rewriteReasonLine([]byte(line))
	want := "data: {\"choices\":[{\"message\":{\"reasoning\":\"why\",\"reasoning_content\":\"why\"}}]}\n"
	if string(out) != want {
		t.Fatalf("got  %s\nwant %s", out, want)
	}
}

func TestShimCarriesSplitLines(t *testing.T) {
	var b bytes.Buffer
	s := newReasonShim(&b)
	first := `data: {"choices":[{"delta":{"reason`
	second := `ing":"tail"}}]}` + "\ndone\n"
	if n, err := s.Write([]byte(first)); n != len(first) || err != nil {
		t.Fatalf("first write: %d %v", n, err)
	}
	if b.Len() != 0 {
		t.Fatalf("partial line must be held, got %q", b.String())
	}
	if _, err := s.Write([]byte(second)); err != nil {
		t.Fatalf("second: %v", err)
	}
	got := b.String()
	want := "data: {\"choices\":[{\"delta\":{\"reasoning\":\"tail\",\"reasoning_content\":\"tail\"}}]}\n" + "done\n"
	if got != want {
		t.Fatalf("got  %q\nwant %q", got, want)
	}
}

func TestShimCloseFlushesCarryover(t *testing.T) {
	var b bytes.Buffer
	s := newReasonShim(&b)
	if _, err := s.Write([]byte("half")); err != nil {
		t.Fatal(err)
	}
	s.Close()
	if b.String() != "half" {
		t.Fatalf("carryover lost: %q", b.String())
	}
}

// upstream streams reasoning in kilo/nemotron style; the client must see the
// deepseek-style alias too, and the attempt must count as relayed.
func TestAttemptShimsReasoningEndToEnd(t *testing.T) {
	up := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		w.WriteHeader(200)
		_, _ = w.Write([]byte("data: {\"choices\":[{\"delta\":{\"reasoning\":\"thinking\"}}]}\n\n"))
		_, _ = w.Write([]byte("data: {\"choices\":[{\"delta\":{\"content\":\"answer\"}}]}\n\n"))
		_, _ = w.Write([]byte("data: [DONE]\n\n"))
	}))
	defer up.Close()

	l := &lane.Lane{Name: "kilo", URL: up.URL + "/x", Model: "m"}
	rr := httptest.NewRecorder()
	ok, status := attempt(up.Client(), rr, l, "m", []byte(`{"model":"a0/x"}`))
	if !ok || status != 200 {
		t.Fatalf("ok=%v status=%d", ok, status)
	}
	body := rr.Body.String()
	if !strings.Contains(body, "\"reasoning_content\":\"thinking\"") {
		t.Fatalf("alias missing: %s", body)
	}
	if rr.Header().Get("X-A0-Lane") != "kilo" {
		t.Fatalf("lane header missing")
	}

	// non-SSE bodies stay verbatim
	raw := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"reasoning":"keep"}`))
	}))
	defer raw.Close()
	rr2 := httptest.NewRecorder()
	ok, _ = attempt(raw.Client(), rr2, &lane.Lane{Name: "o", URL: raw.URL + "/x", Model: "m"}, "m", []byte(`{"model":"a0/x"}`))
	if !ok || rr2.Body.String() != `{"reasoning":"keep"}` {
		t.Fatalf("non-SSE body mutated: %s", rr2.Body.String())
	}
}
