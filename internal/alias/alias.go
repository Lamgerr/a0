// Package alias is the product surface: a0 serves CATEGORIES, never raw model
// picks. Each category resolves to a pinned pool-chain; admins may shrink a
// chain (missing lanes are pruned) but never grow it beyond this table.
package alias

import (
	"fmt"
	"strings"

	"github.com/NaveenSingh9999/a0/internal/lane"
)

// chain entry: laneName@model. Parsed into (lane, concrete model) pairs.
var Categories = map[string][]string{
	"a0/flagship": {
		"xkiro@qwen/qwen3.8-max:free",
		"llm7@glm-5.3",
		"openrouter@openrouter/free",
	},
	"a0/reasoning": {
		"xkiro@qwen/qwen3.7-max:free",
		"openrouter@nvidia/nemotron-3-ultra-550b-a55b:free",
		"xkiro@cohere/command-a-reasoning",
	},
	"a0/coder": {
		"xkiro@qwen/qwen3-coder-plus:free",
		"llm7@deepseek-v4-pro",
		"groq@qwen/qwen3.8-27b",
		"openrouter@cohere/north-mini-code:free",
	},
	"a0/vision": {
		"gemini-direct@gemini-3.8-flash",
		"xkiro@qwen/qwen3.7-plus:free",
		"openrouter@nvidia/nemotron-3.5-super-vl:free",
	},
	"a0/fast": {
		"groq@gpt-oss-120b",
		"xkiro@qwen/qwen3.7-flash:free",
		"llm7@GLM-5.3-Flash",
	},
	"a0/omni": {
		"openrouter@thinkingmachines/inkling:free",
	},
	"a0/long": {
		"xkiro@qwen/qwen3.8-max:free",
		"llm7@glm-5.3",
	},
}

// IDs is the display list for /v1/models and unknown-id errors.
var IDs = []string{
	"a0/flagship", "a0/reasoning", "a0/coder", "a0/vision", "a0/fast", "a0/omni", "a0/long",
}

// ResolvedLane pairs a configured lane with the concrete model id it serves
// for a category.
type ResolvedLane struct {
	L     *lane.Lane
	Model string
}

// ErrUnknown is returned for any model id outside the category table.
type ErrUnknown struct{ ID string }

func (e ErrUnknown) Error() string {
	return fmt.Sprintf("unknown model %q — valid models: %s", e.ID, strings.Join(IDs, ", "))
}

// Resolve returns the lane chain for cat, keeping only lanes present in the
// wing's config (shrink-only). Unknown ids err with the full valid list.
func Resolve(cat string, lanes []*lane.Lane) ([]ResolvedLane, error) {
	entries, ok := Categories[cat]
	if !ok {
		return nil, ErrUnknown{ID: cat}
	}
	byName := map[string]*lane.Lane{}
	for _, l := range lanes {
		byName[l.Name] = l
	}
	var out []ResolvedLane
	for _, e := range entries {
		laneName, model, _ := strings.Cut(e, "@")
		l, ok := byName[laneName]
		if !ok {
			continue
		}
		out = append(out, ResolvedLane{L: l, Model: model})
	}
	return out, nil
}
