package node

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/NaveenSingh9999/a0/internal/lane"
)

const (
	testNode  = "nd-abcdef123456"
	testToken = "ct-deadbeef"
	testAnon  = "sb_publishable_x"
)

// fakeControl serves canned JSON per path and records inbound requests.
type fakeControl struct {
	paths map[string]fakeRoute
	got   []captured
}

type fakeRoute struct {
	status int
	body   string
}

type captured struct {
	path   string
	header http.Header
	body   map[string]any
}

func (f *fakeControl) Do(req *http.Request) (*http.Response, error) {
	c := captured{path: req.URL.Path, header: req.Header}
	raw, _ := io.ReadAll(req.Body)
	_ = json.Unmarshal(raw, &c.body)
	f.got = append(f.got, c)
	route, ok := f.paths[req.URL.Path]
	if !ok {
		route = fakeRoute{status: 404, body: `{"ok":false,"reason":"no route"}`}
	}
	_ = req.Body.Close()
	return &http.Response{
		StatusCode: route.status,
		Header:     http.Header{"Content-Type": []string{"application/json"}},
		Body:       io.NopCloser(strings.NewReader(route.body)),
	}, nil
}

func (f *fakeControl) calls(path string) int {
	n := 0
	for _, c := range f.got {
		if c.path == path {
			n++
		}
	}
	return n
}

func newClient(c lane.HTTPClient) *Client {
	return New("https://supabase.test", testAnon, testNode, testToken, c)
}

func TestInit(t *testing.T) {
	body := `{"ok":true,"adopted":false,"mode":"local","chain":[
		{"name":"xkiro","url":"https://api.xkiro.com/v1","key":"k1","model":"m1"}
	]}`
	fc := &fakeControl{paths: map[string]fakeRoute{
		"/functions/v1/node-init": {status: 200, body: body},
	}}
	init, err := newClient(fc).Init(context.Background(), "wing-a", "sg")
	if err != nil {
		t.Fatalf("Init: %v", err)
	}
	if !init.OK || init.Adopted || init.Mode != "local" {
		t.Fatalf("bad init: %+v", init)
	}
	if len(init.Chain) != 1 || init.Chain[0].Name != "xkiro" || init.Chain[0].Key != "k1" {
		t.Fatalf("chain not decoded: %+v", init.Chain)
	}
	if len(fc.got) != 1 {
		t.Fatalf("expected 1 request, got %d", len(fc.got))
	}
	g := fc.got[0]
	if g.header.Get("x-a0-node") != testNode {
		t.Fatalf("x-a0-node: %q", g.header.Get("x-a0-node"))
	}
	if g.header.Get("Authorization") != "Bearer "+testToken {
		t.Fatalf("auth header: %q", g.header.Get("Authorization"))
	}
	if g.header.Get("apikey") != testAnon {
		t.Fatalf("apikey header: %q", g.header.Get("apikey"))
	}
	if g.body["name"] != "wing-a" || g.body["region"] != "sg" {
		t.Fatalf("init body: %+v", g.body)
	}
}

func TestInitRejectionIsError(t *testing.T) {
	fc := &fakeControl{paths: map[string]fakeRoute{
		"/functions/v1/node-init": {status: 403, body: `{"ok":false,"reason":"node revoked"}`},
	}}
	if _, err := newClient(fc).Init(context.Background(), "", ""); err == nil {
		t.Fatal("want error on init rejection")
	}
}

func TestHeartbeatAndUsage(t *testing.T) {
	fc := &fakeControl{paths: map[string]fakeRoute{
		"/functions/v1/node-heartbeat": {status: 200, body: `{"ok":true}`},
		"/functions/v1/node-usage":     {status: 200, body: `{"ok":true,"inserted":2}`},
	}}
	n := newClient(fc)
	err := n.Heartbeat(context.Background(), []Health{{Lane: "xkiro", OK: true, Detail: "202"}})
	if err != nil {
		t.Fatalf("Heartbeat: %v", err)
	}
	got, err := n.Usage(context.Background(), []Event{
		{Lane: "xkiro", Model: "m1", Status: 200, LatencyMs: 42},
		{Lane: "llm7", Model: "m2", Status: 0, InTok: 1},
	})
	if err != nil {
		t.Fatalf("Usage: %v", err)
	}
	if got != 2 {
		t.Fatalf("inserted = %d, want 2", got)
	}
	if len(fc.got) != 2 {
		t.Fatalf("expected 2 requests, got %d", len(fc.got))
	}
}

func TestValidateKey(t *testing.T) {
	fc := &fakeControl{paths: map[string]fakeRoute{
		"/functions/v1/keys-validate": {status: 200, body: `{"ok":true,"key_id":"kv1","tenant":"tu1","name":"smoke","rpm":60,"daily_cap":100}`},
	}}
	k, err := newClient(fc).Validate(context.Background(), "sk-a0-abc")
	if err != nil || !k.OK || k.KeyID != "kv1" || k.Tenant != "tu1" || k.RPM != 60 || k.DailyCap != 100 {
		t.Fatalf("Validate: %+v err=%v", k, err)
	}
}

func TestGateAllowsAndCaches(t *testing.T) {
	fc := &fakeControl{paths: map[string]fakeRoute{
		"/functions/v1/keys-validate": {status: 200, body: `{"ok":true,"key_id":"kv1","tenant":"tu1","name":"smoke","rpm":60,"daily_cap":100}`},
	}}
	g := NewGate(newClient(fc), time.Minute)
	for i := 0; i < 5; i++ {
		k, ok := g.Allow("sk-a0-abc")
		if !ok || !k.OK || k.KeyID != "kv1" {
			t.Fatalf("allow %d: %+v ok=%v", i, k, ok)
		}
	}
	if calls := fc.calls("/functions/v1/keys-validate"); calls != 1 {
		t.Fatalf("network calls = %d, want 1", calls)
	}
}

func TestGateNegativeCaches(t *testing.T) {
	fc := &fakeControl{paths: map[string]fakeRoute{
		"/functions/v1/keys-validate": {status: 200, body: `{"ok":false,"reason":"unknown key"}`},
	}}
	g := NewGate(newClient(fc), time.Minute)
	for i := 0; i < 50; i++ {
		if _, ok := g.Allow("sk-a0-bad"); ok {
			t.Fatal("bad key allowed")
		}
	}
	if calls := fc.calls("/functions/v1/keys-validate"); calls != 1 {
		t.Fatalf("negative cache misses: %d network calls, want 1", calls)
	}
}

func TestGateCacheExpiry(t *testing.T) {
	fc := &fakeControl{paths: map[string]fakeRoute{
		"/functions/v1/keys-validate": {status: 200, body: `{"ok":true,"key_id":"kv1"}`},
	}}
	now := time.Now()
	g := NewGate(newClient(fc), 10*time.Second)
	g.Clock = func() time.Time {
		now = now.Add(time.Duration(nowFreq(int64(0))) * time.Second)
		return now
	}
	g.Allow("sk-a0-abc") // fills cache
	for i := 0; i < 9; i++ {
		g.Allow("sk-a0-abc") // within TTL
	}
	if calls := fc.calls("/functions/v1/keys-validate"); calls != 1 {
		t.Fatalf("calls before expiry = %d, want 1", calls)
	}
	g.Allow("sk-a0-expired") // exceeds TTL
	if calls := fc.calls("/functions/v1/keys-validate"); calls != 2 {
		t.Fatalf("calls after expiry = %d, want 2", calls)
	}
}

func nowFreq(int64) int64 { return 0 }

func TestRecorderBatchesAndDropsOldest(t *testing.T) {
	r := NewRecorder(2)
	r.Append(Event{Lane: "a"})
	r.Append(Event{Lane: "b"})
	r.Append(Event{Lane: "c"}) // drops "a"
	evs := r.Take()
	if len(evs) != 2 || evs[0].Lane != "b" || evs[1].Lane != "c" {
		t.Fatalf("ring behavior: %+v", evs)
	}
	if rest := r.Take(); len(rest) != 0 {
		t.Fatalf("Take not draining: %+v", rest)
	}
}
