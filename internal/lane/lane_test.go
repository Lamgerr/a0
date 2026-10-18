package lane

import (
	"os"
	"path/filepath"
	"reflect"
	"testing"
)

const fixture = `{
  "chain": [
    {"name": "xkiro", "url": "https://api.xkiro.com/v1", "key": "sk-xt-test",
     "model": "qwen/qwen3.8-max:free", "keys": ["sk-xt-a", "sk-xt-b"],
     "params": {"temperature": 0.7}, "headers": {"X-Tenant": "t1"}, "foo": 1},
    {"name": "llm7", "url": "https://api.llm7.io/v1", "key": "", "model": "glm-5.3"},
    {"name": "openrouter", "url": "https://openrouter.ai/api/v1", "key": "sk-or-t", "model": "openrouter/free"}
  ]
}`

func writeFixture(t *testing.T, s string) string {
	t.Helper()
	p := filepath.Join(t.TempDir(), "models.json")
	if err := os.WriteFile(p, []byte(s), 0o600); err != nil {
		t.Fatal(err)
	}
	return p
}

func TestLoadFixtureDexSchema(t *testing.T) {
	lanes, err := Load(writeFixture(t, fixture))
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if len(lanes) != 3 {
		t.Fatalf("want 3 lanes, got %d", len(lanes))
	}
	x := lanes[0]
	if x.Name != "xkiro" || x.URL != "https://api.xkiro.com/v1" || x.Key != "sk-xt-test" {
		t.Fatalf("xkiro fields: %+v", x)
	}
	if x.Model != "qwen/qwen3.8-max:free" {
		t.Fatalf("xkiro model: %q", x.Model)
	}
	if !reflect.DeepEqual(x.Keys, []string{"sk-xt-a", "sk-xt-b"}) {
		t.Fatalf("xkiro key pool: %v", x.Keys)
	}
	if x.Params["temperature"] != 0.7 {
		t.Fatalf("xkiro params: %v", x.Params)
	}
	if x.Headers["X-Tenant"] != "t1" {
		t.Fatalf("xkiro headers: %v", x.Headers)
	}
	if x.disabled {
		t.Fatalf("lane must not be disabled by load")
	}
}

func TestLoadMissingFileBuiltinChain(t *testing.T) {
	lanes, err := Load(filepath.Join(t.TempDir(), "nope", "models.json"))
	if err != nil {
		t.Fatalf("missing file must fall back to builtin, got err %v", err)
	}
	want := []string{"xkiro", "llm7", "openrouter"}
	for i, nm := range want {
		if lanes[i].Name != nm {
			t.Fatalf("builtin chain[%d] = %s, want %s", i, lanes[i].Name, nm)
		}
	}
	if lanes[1].Key != "" {
		t.Fatalf("builtin llm7 must be keyless, got %q", lanes[1].Key)
	}
}

func TestLoadMalformedFallsBackToBuiltin(t *testing.T) {
	lanes, err := Load(writeFixture(t, "{nope"))
	if err != nil {
		t.Fatalf("malformed file: %v", err)
	}
	if lanes[0].Name != "xkiro" {
		t.Fatalf("malformed file must return builtin chain, got %d lanes", len(lanes))
	}
}

func TestNilChainEntriesFallBackToBuiltin(t *testing.T) {
	for _, raw := range []string{
		`{"chain":[null]}`,
		`[null]`,
		`[null,{"name":"ok","url":"https://up/v1","model":"m"}]`,
	} {
		f := writeFixture(t, raw)
		lanes, err := Load(f)
		if err != nil {
			t.Fatalf("load(%s): %v", raw, err)
		}
		if len(lanes) == 0 {
			t.Fatalf("load(%s): empty chain", raw)
		}
		for _, l := range lanes {
			if l == nil {
				t.Fatalf("load(%s): nil lane leaked", raw)
			}
			if l.Name == "" {
				t.Fatalf("load(%s): unnamed lane", raw)
			}
		}
	}
}
