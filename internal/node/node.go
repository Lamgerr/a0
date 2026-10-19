// Package node is the wing's control-plane client: it proves the wing's
// identity to a0's edge functions (node-init gives the chain, heartbeat and
// usage feed the panel, keys-validate gates public traffic) and never leaks
// lane keys — config comes down from the control plane, not local files.
package node

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/NaveenSingh9999/a0/internal/lane"
)

// Client talks to the a0 control plane's node-protocol edge functions.
type Client struct {
	base   string // SUPABASE_URL, no trailing slash
	anon   string // publishable key
	nodeID string // nd-…
	token  string // ct-…
	c      lane.HTTPClient
}

// New wires a control client; c is injectable for tests.
func New(base, anon, nodeID, token string, c lane.HTTPClient) *Client {
	if c == nil {
		c = &http.Client{Timeout: 30 * time.Second}
	}
	return &Client{
		base:   strings.TrimSuffix(base, "/"),
		anon:   anon,
		nodeID: nodeID,
		token:  token,
		c:      c,
	}
}

// Init is the wing's first contact: register (or adopt) the identity and
// fetch the runtime lane chain from the control plane.
type Init struct {
	OK      bool
	Adopted bool
	Mode    string
	Chain   []*lane.Lane
}

// initReply mirrors the edge function response wire shape.
type initReply struct {
	OK      bool         `json:"ok"`
	Adopted bool         `json:"adopted"`
	Mode    string       `json:"mode"`
	Chain   []*lane.Lane `json:"chain"`
}

func (c *Client) Init(ctx context.Context, name, region string) (*Init, error) {
	body := map[string]string{"name": name, "region": region}
	var reply initReply
	if err := c.call(ctx, "node-init", body, &reply); err != nil {
		return nil, err
	}
	if !reply.OK {
		return nil, fmt.Errorf("node-init rejected")
	}
	return &Init{OK: true, Adopted: reply.Adopted, Mode: reply.Mode, Chain: reply.Chain}, nil
}

// Health is one lane's liveness for the panel.
type Health struct {
	Lane   string `json:"lane"`
	OK     bool   `json:"ok"`
	Detail string `json:"detail,omitempty"`
}

func (c *Client) Heartbeat(ctx context.Context, lanes []Health) error {
	var reply struct {
		OK bool `json:"ok"`
	}
	body := map[string]any{}
	if lanes != nil {
		body["lanes"] = lanes
	}
	err := c.call(ctx, "node-heartbeat", body, &reply)
	if err == nil && !reply.OK {
		err = fmt.Errorf("node-heartbeat rejected")
	}
	return err
}

// Event is one relayed request for the usage ledger.
type Event struct {
	KeyID     string `json:"key_id,omitempty"`
	Lane      string `json:"lane"`
	Model     string `json:"model,omitempty"`
	InTok     int    `json:"in_tok,omitempty"`
	OutTok    int    `json:"out_tok,omitempty"`
	Status    int    `json:"status,omitempty"`
	LatencyMs int    `json:"latency_ms,omitempty"`
	IP        string `json:"ip,omitempty"` // fair-use forensics
}

func (c *Client) Usage(ctx context.Context, events []Event) (int, error) {
	// The edge fn injects node identity (it verifies headers) — wings don't
	// sign each event.
	raw, _ := json.Marshal(map[string]any{"events": events})
	var reply struct {
		Inserted int `json:"inserted"`
	}
	if err := c.raw(ctx, "node-usage", raw, &reply); err != nil {
		return 0, err
	}
	return reply.Inserted, nil
}

// Key is the control plane's verdict on one virtual key.
type Key struct {
	OK       bool
	Reason   string
	KeyID    string
	Tenant   string
	Name     string
	RPM      int
	DailyCap int
	DayCount int    // requests already spent this UTC day (control-plane view)
	Status   string // active / held / banned ("" = active)
	Strikes  int    // rolling 24h abuse strikes
}

func (c *Client) Validate(ctx context.Context, key string) (*Key, error) {
	var reply struct {
		OK       bool   `json:"ok"`
		Reason   string `json:"reason"`
		KeyID    string `json:"key_id"`
		Tenant   string `json:"tenant"`
		Name     string `json:"name"`
		RPM      int    `json:"rpm"`
		DailyCap int    `json:"daily_cap"`
		DayCount int    `json:"day_count"`
		Status   string `json:"status"`
		Strikes  int    `json:"strikes"`
	}
	if err := c.call(ctx, "keys-validate", map[string]any{"key": key}, &reply); err != nil {
		return nil, err
	}
	return &Key{
		OK: reply.OK, Reason: reply.Reason, KeyID: reply.KeyID,
		Tenant: reply.Tenant, Name: reply.Name, RPM: reply.RPM,
		DailyCap: reply.DailyCap, DayCount: reply.DayCount,
		Status: reply.Status, Strikes: reply.Strikes,
	}, nil
}

// Strike is one fair-use abuse event reported to the control plane; the
// control plane owns the sentence (hold/ban) — wings only witness.
type Strike struct {
	KeyID string `json:"key_id"` // empty when the key never validated
	Key   string `json:"key,omitempty"`
	Kind  string `json:"kind"` // share / rate / day / tokens / ...
	IP    string `json:"ip,omitempty"`
}

// Strike reports abuse from this node. Fire-and-forget is fine — the wing
// keeps enforcing locally regardless of the reply.
func (c *Client) Strike(ctx context.Context, s Strike) error {
	var reply struct {
		OK bool `json:"ok"`
	}
	if err := c.call(ctx, "node-strike", s, &reply); err != nil {
		return err
	}
	if !reply.OK {
		return fmt.Errorf("node-strike rejected")
	}
	return nil
}

// call marshals body and decodes the reply JSON.
func (c *Client) call(ctx context.Context, fn string, body any, out any) error {
	raw, err := json.Marshal(body)
	if err != nil {
		return err
	}
	return c.raw(ctx, fn, raw, out)
}

func (c *Client) raw(ctx context.Context, fn string, payload []byte, out any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		c.base+"/functions/v1/"+fn, bytes.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-a0-node", c.nodeID)
	req.Header.Set("Authorization", "Bearer "+c.token)
	if c.anon != "" {
		req.Header.Set("apikey", c.anon)
	}
	resp, err := c.c.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	rawReply, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return err
	}
	if resp.StatusCode >= 400 {
		return fmt.Errorf("%s: HTTP %d: %s", fn, resp.StatusCode, strings.TrimSpace(string(rawReply)))
	}
	return json.Unmarshal(rawReply, out)
}

// Gate validates virtual keys for public-mode requests with a short-lived
// cache — one wing stays cozy with the control plane under burst load.
type Gate struct {
	C     *Client
	TTL   time.Duration
	Clock func() time.Time

	mu    sync.Mutex
	cache map[string]gateEntry
}

// gateEntry caches the verdict (positive OR negative) until a deadline.
type gateEntry struct {
	k     Key
	until time.Time
}

// NewGate builds a gate with a default wall clock.
func NewGate(c *Client, ttl time.Duration) *Gate {
	return &Gate{C: c, TTL: ttl, Clock: time.Now, cache: map[string]gateEntry{}}
}

// Allow reports whether key is valid now. Unknown/invalid keys are cached
// too, so garbage can't hammer the control plane.
func (g *Gate) Allow(key string) (Key, bool) {
	if key == "" {
		return Key{}, false
	}
	g.mu.Lock()
	defer g.mu.Unlock()
	now := g.Clock()
	if e, ok := g.cache[key]; ok && now.Before(e.until) {
		return e.k, e.k.OK
	}
	k, err := g.C.Validate(context.Background(), key)
	if err != nil || k == nil {
		// control unreachable: fail closed
		return Key{Reason: "key service unavailable"}, false
	}
	if len(g.cache) > 4096 {
		g.cache = map[string]gateEntry{}
	}
	g.cache[key] = gateEntry{k: *k, until: now.Add(g.TTL)}
	return *k, k.OK
}

// Recorder buffers relay usage events and hands them out in batches for the
// background flusher. Drops the OLDEST entries when full (ring memory).
type Recorder struct {
	mu   sync.Mutex
	ring []Event
	n    int // total appended (monotonic)
	cap  int
}

// NewRecorder builds a recorder holding at most cap events.
func NewRecorder(capacity int) *Recorder {
	if capacity <= 0 {
		capacity = 256
	}
	return &Recorder{ring: make([]Event, 0, capacity), cap: capacity}
}

// Append queues one event; the oldest is dropped when full.
func (r *Recorder) Append(e Event) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if len(r.ring) == r.cap {
		copy(r.ring, r.ring[1:])
		r.ring = r.ring[:r.cap-1]
	}
	r.ring = append(r.ring, e)
	r.n++
}

// Take drains the buffer.
func (r *Recorder) Take() []Event {
	r.mu.Lock()
	defer r.mu.Unlock()
	if len(r.ring) == 0 {
		return nil
	}
	out := r.ring
	r.ring = make([]Event, 0, r.cap)
	return out
}

// Flush pushes one batch upstream; retrotech errors are ignored here — the
// caller decides retry policy.
func (r *Recorder) Flush(ctx context.Context, c *Client) error {
	evs := r.Take()
	if len(evs) == 0 {
		return nil
	}
	_, err := c.Usage(ctx, evs)
	return err
}
