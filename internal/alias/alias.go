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
//
// Order = product SLA: the heads mirror the curated best-first sequence shown
// in the dashboard (capability coverage > generation > size > context), and
// every chain ends with cross-lane tails that only fire after the curated
// heads are exhausted, keeping a lane outage from becoming a category outage.
var Categories = map[string][]string{
	"a0/flagship": {
		"xkiro@qwen/qwen3.8-max:free",
		"xkiro@qwen/qwen3.7-plus:free",
		"xkiro@mistralai/mistral-large-4-0",
		"xkiro@cohere/command-a-plus",
		"xkiro@stealth/space-bunny-alpha:free",
		"llm7@glm-5.3",
		"openrouter@openrouter/free",
		"kilo@nvidia/nemotron-3-ultra-550b-a55b:free",
		"ovh@gpt-oss-120b",
	},
	"a0/reasoning": {
		"llm7@GLM-5.3-Flash",
		"xkiro@qwen/qwen3.8-max:free",
		"xkiro@cohere/command-a-reasoning",
		"xkiro@mistralai/mistral-large-4-0",
		"xkiro@qwen/qwen3.6-max-preview:free",
		"xkiro@stealth/big-pickle",
		"kilo@nvidia/nemotron-3-ultra-550b-a55b:free",
		"kilo2@nvidia/nemotron-3-ultra-550b-a55b:free",
		"ovh@gpt-oss-120b",
		"openrouter@nvidia/nemotron-3-ultra-550b-a55b:free",
	},
	"a0/coder": {
		"xkiro@qwen/qwen3-coder-plus:free",
		"xkiro@mistralai/devstral-medium",
		"xkiro@mistralai/codestral-2508",
		"xkiro@cohere/north-mini-code",
		"xkiro@qwen/qwen3.8-max:free",
		"llm7@deepseek-v4-pro",
		"kilo@cohere/north-mini-code:free",
		"kilo2@cohere/north-mini-code:free",
		"openrouter@cohere/north-mini-code:free",
		"gonka@deepseek-v4-flash-0731",
	},
	"a0/vision": {
		"xkiro@qwen/qwen3-vl-plus:free",
		"xkiro@mistralai/mistral-large-4-0",
		"xkiro@cohere/command-a-vision",
		"xkiro@qwen/qwen3.5-omni-plus:free",
		"xkiro@qwen/qwen3-omni-flash:free",
		"gemini-direct@gemini-3.8-flash",
		"openrouter@nvidia/nemotron-3.5-super-vl:free",
		"kilo@nvidia/nemotron-3.5-super-vl:free",
		"kilo2@nvidia/nemotron-3.5-super-vl:free",
		"ovh@Qwen2.5-VL-72B-Instruct",
	},
	"a0/fast": {
		"xkiro@qwen/qwen3.7-flash:free",
		"xkiro@qwen/qwen3.5-flash:free",
		"xkiro@qwen/qwen3.8-omni-flash:free",
		"xkiro@mistralai/ministral-8b",
		"xkiro@mistralai/mistral-small-2603",
		"groq@gpt-oss-120b",
		"llm7@GLM-5.3-Flash",
		"openrouter@openrouter/free",
		"kilo@kilo-auto/free",
		"ovh@gpt-oss-20b",
	},
	"a0/omni": {
		"xkiro@qwen/qwen3.8-omni-flash:free",
		"xkiro@qwen/qwen3.5-omni-plus:free",
		"xkiro@qwen/qwen3-omni-flash:free",
		"xkiro@cohere/command-a-vision",
		"xkiro@qwen/qwen3-vl-plus:free",
		"openrouter@thinkingmachines/inkling:free",
		"kilo@nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
	},
	"a0/long": {
		"xkiro@qwen/qwen3-coder-plus:free",
		"xkiro@qwen/qwen3.5-plus:free",
		"xkiro@stealth/space-bunny-alpha:free",
		"xkiro@meituan/longcat-2.5-preview:free",
		"xkiro@qwen/qwen3.7-flash:free",
		"llm7@glm-5.3",
		"openrouter@openrouter/free",
		"kilo@poolside/laguna-s-2.1:free",
		"ovh@gpt-oss-120b",
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
