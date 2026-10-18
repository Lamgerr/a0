// Package relay pipes one OpenAI-shaped chat request at the best available
// upstream lane: rename the category to the lane's concrete model, merge the
// lane's configured headers/params, forward bytes verbatim (stream or not),
// and fail over the chain on unavailability.
package relay

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/NaveenSingh9999/a0/internal/alias"
	"github.com/NaveenSingh9999/a0/internal/lane"
)

// timeouts — one lane can never stall the chain beyond its own budget.
const chatTimeout = 60 * time.Second

// Relay owns the lane chain and the http client used to reach upstreams.
type Relay struct {
	C     lane.HTTPClient
	Lanes []*lane.Lane
}

// New wires a relay over lanes; c is injectable for tests.
func New(c lane.HTTPClient, lanes []*lane.Lane) *Relay {
	return &Relay{C: c, Lanes: lanes}
}

// Chat serves one /v1/chat/completions request. The model id must be an a0
// category (server validated); the chain rides ResolvedLane order. Response
// bytes from the winning upstream are forwarded verbatim. Returned error is
// for the server layer to shape into 400/502.
func (r *Relay) Chat(w http.ResponseWriter, body []byte) error {
	var req struct {
		Model  string          `json:"model"`
		Stream bool            `json:"stream"`
		Extra  map[string]any  `json:"-"`
		Raw    json.RawMessage `json:"-"`
	}
	if err := json.Unmarshal(body, &req); err != nil {
		return err
	}
	chain, err := alias.Resolve(req.Model, r.Lanes)
	if err != nil {
		return err
	}
	if len(chain) == 0 {
		return errNoLane{}
	}

	// Task 5: single-lane passthrough. Failover loop arrives with Task 7.
	head := chain[0]
	l := head.L
	key := l.NextKey()

	out := rename(body, head.Model, l.Params)
	httpReq, err := http.NewRequest(strings.ToUpper(http.MethodPost),
		strings.TrimSuffix(l.URL, "/")+"/chat/completions", strings.NewReader(string(out)))
	if err != nil {
		return err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	if key != "" {
		httpReq.Header.Set("Authorization", "Bearer "+key)
	}
	for k, v := range l.Headers {
		httpReq.Header.Set(k, v)
	}

	c := r.C
	if tc, ok := c.(*http.Client); ok {
		clone := *tc
		clone.Timeout = chatTimeout
		c = &clone
	}
	resp, err := c.Do(httpReq)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

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
		n, err := resp.Body.Read(buf)
		if n > 0 {
			if _, werr := w.Write(buf[:n]); werr != nil {
				return nil // client bailed; upstream teardown below.
			}
			if flusher != nil {
				flusher.Flush()
			}
		}
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}
	}
	return nil
}

// rename swaps the category id for the lane's concrete model and merges the
// lane's configured body params, preserving field order where Go's map
// randomization allows (JSON decoders upstream don't care).
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

type errNoLane struct{}

func (errNoLane) Error() string { return "no lane configured" }
