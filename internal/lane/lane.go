// Package lane holds the wings' lane sheet: one OpenAI-compatible upstream
// (a "lane") per entry, loaded from a dex-compatible models.json.
package lane

import (
	"encoding/json"
	"net/http"
	"os"
	"sync"
	"time"
)

// HTTPClient is the seam every network-touching component depends on.
type HTTPClient interface {
	Do(req *http.Request) (*http.Response, error)
}

// Params is a shorthand for the raw body-merge maps in models.json.
type Params map[string]any

// Clock returns the current time for cooldown math; injectable in tests.
type Clock func() time.Time

// Lane is one upstream provider card.
type Lane struct {
	Name        string            `json:"name"`
	URL         string            `json:"url"`
	Key         string            `json:"key"`
	Keys        []string          `json:"keys"`
	Model       string            `json:"model"`
	VisionModel string            `json:"vision_model"`
	Vision      bool              `json:"vision"`
	StreamOnly  bool              `json:"stream_only"`
	Params      Params            `json:"params"`
	Headers     map[string]string `json:"headers"`
	Public      *bool             `json:"public"`
	disabled    bool

	mu       sync.Mutex
	next     uint64
	laneCool time.Time
	keyCool  map[string]time.Time
	clock    Clock
}

// HasKey reports whether the lane carries any credential (single key or pool).
func (l *Lane) HasKey() bool {
	return l.Key != "" || len(l.Keys) > 0
}

// builtin chain when no models.json exists: xkiro -> llm7 (keyless) -> openrouter.
// API keys come from the environment at load time; nothing is hardcoded.
func builtin() []*Lane {
	xkiro := &Lane{Name: "xkiro", URL: "https://api.xkiro.com/v1",
		Key: os.Getenv("A0_XKIRO_API_KEY"), Model: "qwen/qwen3.8-max:free", Vision: true}
	llm7 := &Lane{Name: "llm7", URL: "https://api.llm7.io/v1",
		Key: os.Getenv("A0_LLM7_API_KEY"), Model: "GLM-5.3-Flash"}
	openrouter := &Lane{Name: "openrouter", URL: "https://openrouter.ai/api/v1",
		Key: os.Getenv("A0_OPENROUTER_API_KEY"), Model: "openrouter/free", Vision: true}
	return []*Lane{newLane(xkiro), newLane(llm7), newLane(openrouter)}
}

func newLane(l *Lane) *Lane {
	l.keyCool = map[string]time.Time{}
	if l.clock == nil {
		l.clock = time.Now
	}
	return l
}

// Load reads models.json from path; a missing or malformed file yields the
// builtin chain (never an error) so the gateway always boots. Unknown JSON
// fields are ignored silently — dex compatibility. Accepts either a bare
// chain array (dex-native shape) or {"chain": [...]}. Null entries in a
// crafted-but-decodable file also fall back to builtin (a chain of nils is
// malformed for all practical purposes).
func Load(path string) ([]*Lane, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return builtin(), nil
	}
	lanes, derr := decode(raw)
	if derr != nil || len(lanes) == 0 {
		return builtin(), nil
	}
	for _, l := range lanes {
		newLane(l)
	}
	return lanes, nil
}

func decode(raw []byte) ([]*Lane, error) {
	clean := func(arr []*Lane) []*Lane {
		out := arr[:0:0]
		for _, l := range arr {
			if l != nil && l.Name != "" && l.URL != "" && l.Model != "" {
				out = append(out, l)
			}
		}
		return out
	}
	var arr []*Lane
	if err := json.Unmarshal(raw, &arr); err == nil {
		return clean(arr), nil
	}
	var file struct {
		Chain []*Lane `json:"chain"`
	}
	if err := json.Unmarshal(raw, &file); err == nil {
		return clean(file.Chain), nil
	}
	return nil, os.ErrNotExist
}
