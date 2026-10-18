// Package relay pipes one OpenAI-shaped chat request at the best available
// upstream lane: rename the category to the lane's concrete model, merge the
// lane's configured headers/params, forward bytes verbatim (stream or not),
// and fail over the chain on unavailability.
package relay

import (
	"encoding/json"
	"errors"
	"io"
	"net"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/NaveenSingh9999/a0/internal/alias"
	"github.com/NaveenSingh9999/a0/internal/lane"
)

// lane budgets — one lane can never stall the chain beyond its own slice.
const (
	connectTimeout = 10 * time.Second
	chatTimeout    = 60 * time.Second
	defaultCool    = 30 * time.Second // lane cooldown when upstream gives no Retry-After
	keyCool        = 60 * time.Second // key benched on its own 429
	maxAttempts    = 3                // global constraint: failover caps at 3 lane attempts
	errBody502     = `{"error":{"message":"all lanes cooling, retry later"}}`
)

// ErrExhausted means every available lane failed; the 502 body is already
// written to the response by Chat.
var ErrExhausted = errors.New("all lanes cooling, retry later")

// Relay owns the lane chain and the http client used to reach upstreams.
type Relay struct {
	C     lane.HTTPClient
	Lanes []*lane.Lane
}

// New wires a relay over lanes; c is injectable for tests.
func New(c lane.HTTPClient, lanes []*lane.Lane) *Relay {
	if c == nil {
		c = defaultClient()
	}
	return &Relay{C: c, Lanes: lanes}
}

// Chat serves one /v1/chat/completions request. The model id must be an a0
// category (server validated); the resolved chain is walked — lanes already
// cooling are skipped, each failure benches its lane/key per Retry-After.
// Success forwards upstream bytes verbatim; exhaustion writes the locked 502
// body and returns ErrExhausted for the server layer to account.
func (r *Relay) Chat(w http.ResponseWriter, body []byte) error {
	var req struct {
		Model string `json:"model"`
	}
	if err := json.Unmarshal(body, &req); err != nil {
		return err
	}
	chain, err := alias.Resolve(req.Model, r.Lanes)
	if err != nil {
		return err
	}
	if len(chain) == 0 {
		exhaust(w)
		return ErrExhausted
	}

	attempts := 0
	for _, h := range chain {
		if attempts >= maxAttempts {
			break
		}
		l := h.L
		if !l.Available() {
			continue
		}
		attempts++
		ok := attempt(r.C, w, l, h.Model, body)
		if ok {
			return nil
		}
	}
	exhaust(w)
	return ErrExhausted
}

// exhaust writes the locked 502 body.
func exhaust(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusBadGateway)
	_, _ = w.Write([]byte(errBody502))
}

// attempt sends one request at one lane. True = response fully relayed.
func attempt(c lane.HTTPClient, w http.ResponseWriter, l *lane.Lane, model string, body []byte) bool {
	key := l.NextKey()
	out := rename(body, model, l.Params)
	req, err := http.NewRequest(http.MethodPost,
		strings.TrimSuffix(l.URL, "/")+"/chat/completions", strings.NewReader(string(out)))
	if err != nil {
		return false
	}
	req.Header.Set("Content-Type", "application/json")
	if key != "" {
		req.Header.Set("Authorization", "Bearer "+key)
	}
	for k, v := range l.Headers {
		req.Header.Set(k, v)
	}

	resp, err := c.Do(req)
	if err != nil {
		l.CoolLane(defaultCool)
		return false
	}
	defer resp.Body.Close()

	cool := defaultCool
	if ra := resp.Header.Get("Retry-After"); ra != "" {
		if s, perr := strconv.Atoi(ra); perr == nil && s > 0 {
			cool = time.Duration(s) * time.Second
		}
	}

	if resp.StatusCode == http.StatusTooManyRequests {
		l.CoolKey(key, keyCool)
		l.CoolLane(cool)
		return false
	}
	if resp.StatusCode >= 500 {
		l.CoolLane(cool)
		return false
	}

	for k, vs := range resp.Header {
		for _, v := range vs {
			w.Header().Add(k, v)
		}
	}
	w.Header().Set("X-A0-Lane", l.Name)
	w.WriteHeader(resp.StatusCode)
	flusher, _ := w.(http.Flusher)
	buf := make([]byte, 4096)
	for {
		n, rerr := resp.Body.Read(buf)
		if n > 0 {
			if _, werr := w.Write(buf[:n]); werr != nil {
				return true // client bailed; stop here quietly.
			}
			if flusher != nil {
				flusher.Flush()
			}
		}
		if rerr == io.EOF {
			return true
		}
		if rerr != nil {
			// upstream died mid-body: nothing sensible is written past the
			// partial stream; the chain has consumed its shot.
			l.CoolLane(defaultCool)
			return false
		}
	}
}

// rename swaps the category id for the lane's concrete model and merges the
// lane's configured body params without overwriting anything the caller set.
func rename(body []byte, model string, params map[string]any) []byte {
	var m map[string]any
	if err := json.Unmarshal(body, &m); err != nil {
		return body
	}
	m["model"] = model
	for k, v := range params {
		if _, exists := m[k]; !exists {
			m[k] = v
		}
	}
	out, err := json.Marshal(m)
	if err != nil {
		return body
	}
	return out
}

// defaultClient gets the 10s dial / 60s overall budgets and a sane transport.
func defaultClient() lane.HTTPClient {
	return &http.Client{
		Timeout: chatTimeout,
		Transport: &http.Transport{
			DialContext: (&net.Dialer{Timeout: connectTimeout}).DialContext,
		},
	}
}
