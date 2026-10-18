// Package lane holds the wings' lane sheet: one OpenAI-compatible upstream
// (a "lane") per entry, loaded from a dex-compatible models.json.
package lane

import (
	"encoding/json"
	"net/http"
	"os"
)

// HTTPClient is the seam every network-touching component depends on.
type HTTPClient interface {
	Do(req *http.Request) (*http.Response, error)
}

// Params is a shorthand for the raw body-merge maps in models.json.
type Params map[string]any

// Lane is one upstream provider card.
type Lane struct {
	Name        string `json:"name"`
	URL         string `json:"url"`
	Key         string `json:"key"`
	Keys        []string
	Model       string `json:"model"`
	VisionModel string `json:"vision_model"`
	Vision      bool
	StreamOnly  bool `json:"stream_only"`
	Params      Params
	Headers     map[string]string
	Public      *bool
	disabled    bool
}

// builtin chain when no models.json exists: xkiro -> llm7 (keyless) -> openrouter.
// API keys come from the environment at load time; nothing is hardcoded.
func builtin() []Lane {
	xkiro := Lane{Name: "xkiro", URL: "https://api.xkiro.com/v1",
		Key: os.Getenv("A0_XKIRO_API_KEY"), Model: "qwen/qwen3.8-max:free", Vision: true}
	llm7 := Lane{Name: "llm7", URL: "https://api.llm7.io/v1",
		Key: os.Getenv("A0_LLM7_API_KEY"), Model: "GLM-5.3-Flash"}
	openrouter := Lane{Name: "openrouter", URL: "https://openrouter.ai/api/v1",
		Key: os.Getenv("A0_OPENROUTER_API_KEY"), Model: "openrouter/free", Vision: true}
	return []Lane{xkiro, llm7, openrouter}
}

// Load reads models.json from path; a missing or malformed file yields the
// builtin chain (never an error) so the gateway always boots. Unknown JSON
// fields are ignored silently — dex compatibility. Accepts either a bare
// chain array (dex-native shape) or {"chain": [...]}.
func Load(path string) ([]Lane, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return builtin(), nil
	}
	if lanes, err := decode(raw); err == nil && len(lanes) > 0 {
		return lanes, nil
	}
	return builtin(), nil
}

func decode(raw []byte) ([]Lane, error) {
	var arr []Lane
	if err := json.Unmarshal(raw, &arr); err == nil && len(arr) > 0 {
		return arr, nil
	}
	var file struct {
		Chain []Lane `json:"chain"`
	}
	if err := json.Unmarshal(raw, &file); err == nil {
		return file.Chain, nil
	}
	return nil, os.ErrNotExist
}
