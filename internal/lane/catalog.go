package lane

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"sync"
	"time"
)

// Model is one normalized catalog entry across lanes.
type Model struct {
	ID        string `json:"id"`
	Lane      string `json:"lane"`
	Owner     string `json:"owned_by,omitempty"`
	Ctx       int    `json:"context_length,omitempty"`
	Vision    bool   `json:"vision,omitempty"`
	Tools     bool   `json:"tools,omitempty"`
	Reasoning bool   `json:"reasoning,omitempty"`
	Tier      string `json:"access_tier,omitempty"`
}

type rawModel struct {
	ID            string `json:"id"`
	OwnedBy       string `json:"owned_by"`
	ContextLength int    `json:"context_length"`
	AccessTier    string `json:"access_tier"`
	Capabilities  struct {
		Vision    bool `json:"vision"`
		Tools     bool `json:"tools"`
		Reasoning bool `json:"reasoning"`
	} `json:"capabilities"`
}

// probeTimeout bounds one lane's /models fetch — a slow catalog can't stall merge.
const probeTimeout = 500 * time.Millisecond

// Probe fetches every lane's /v1/models concurrently, normalizes each entry,
// skips dead/500/bad-json lanes, and merges results in lane order.
func Probe(c HTTPClient, lanes []*Lane) []Model {
	out := make([][]Model, len(lanes))
	var wg sync.WaitGroup
	for i, l := range lanes {
		wg.Add(1)
		go func(i int, l *Lane) {
			defer wg.Done()
			out[i] = probeOne(c, l)
		}(i, l)
	}
	wg.Wait()
	var merged []Model
	for _, ms := range out {
		merged = append(merged, ms...)
	}
	return merged
}

func probeOne(c HTTPClient, l *Lane) []Model {
	ctx, cancel := context.WithTimeout(context.Background(), probeTimeout)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet,
		strings.TrimSuffix(l.URL, "/")+"/models", nil)
	if err != nil {
		return nil
	}
	if l.Key != "" {
		req.Header.Set("Authorization", "Bearer "+l.Key)
	}
	resp, err := c.Do(req)
	if err != nil || resp.StatusCode != http.StatusOK {
		return nil
	}
	defer resp.Body.Close()
	var list struct {
		Data []rawModel `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&list); err != nil {
		return nil
	}
	models := make([]Model, 0, len(list.Data))
	for _, m := range list.Data {
		models = append(models, Model{
			ID: m.ID, Lane: l.Name, Owner: m.OwnedBy,
			Ctx: m.ContextLength, Vision: m.Capabilities.Vision,
			Tools: m.Capabilities.Tools, Reasoning: m.Capabilities.Reasoning,
			Tier: m.AccessTier,
		})
	}
	return models
}
