package alias

import (
	"strings"
	"testing"

	"github.com/NaveenSingh9999/a0/internal/lane"
)

func cfg() []*lane.Lane {
	names := []struct {
		n, m string
	}{
		{"xkiro", "qwen/qwen3.8-max:free"},
		{"llm7", "GLM-5.3-Flash"},
		{"openrouter", "openrouter/free"},
		{"gemini-direct", "gemini-3.8-flash"},
		{"groq", "gpt-oss-120b"},
	}
	var out []*lane.Lane
	for _, e := range names {
		out = append(out, &lane.Lane{Name: e.n, Model: e.m})
	}
	return out
}

func firstChainOf(t *testing.T, cat string) (string, string, int) {
	t.Helper()
	chain, err := Resolve(cat, cfg())
	if err != nil {
		t.Fatalf("Resolve(%q): %v", cat, err)
	}
	return chain[0].L.Name, chain[0].Model, len(chain)
}

func TestResolveCoderLeadsWithXKiro(t *testing.T) {
	laneName, model, n := firstChainOf(t, "a0/coder")
	if laneName != "xkiro" || model != "qwen/qwen3-coder-plus:free" {
		t.Fatalf("a0/coder leads with %s@%s", laneName, model)
	}
	// openrouter in table + config; groq lane present too
	if n < 3 {
		t.Fatalf("a0/coder chain pruned too far: %d", n)
	}
}

func TestReasoningLeadsWithLLM7GLMFlash(t *testing.T) {
	laneName, model, n := firstChainOf(t, "a0/reasoning")
	if laneName != "llm7" || model != "GLM-5.3-Flash" {
		t.Fatalf("a0/reasoning leads with %s@%s", laneName, model)
	}
	if n < 4 {
		t.Fatalf("a0/reasoning chain pruned too far: %d", n)
	}
}

func TestResolvePrunesAbsentLanes(t *testing.T) {
	few := []*lane.Lane{{Name: "llm7", Model: "GLM-5.3-Flash"}}
	chain, err := Resolve("a0/flagship", few)
	if err != nil {
		t.Fatalf("Resolve: %v", err)
	}
	if len(chain) != 1 || chain[0].L.Name != "llm7" || chain[0].Model != "glm-5.3" {
		t.Fatalf("prune failed: %+v", chain)
	}
}

func TestResolveUnknownListsAllCategories(t *testing.T) {
	_, err := Resolve("gpt-4o", cfg())
	if err == nil {
		t.Fatal("unknown id must error")
	}
	for _, id := range IDs {
		if !strings.Contains(err.Error(), id) {
			t.Fatalf("error must list %q: %v", id, err)
		}
	}
}

func TestCategoryCount(t *testing.T) {
	want := []string{"a0/flagship", "a0/reasoning", "a0/coder", "a0/vision", "a0/fast", "a0/omni", "a0/long"}
	if len(IDs) != len(want) {
		t.Fatalf("IDs = %v", IDs)
	}
	for _, id := range want {
		if _, ok := Categories[id]; !ok {
			t.Fatalf("missing category %q", id)
		}
	}
}
