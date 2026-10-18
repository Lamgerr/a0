package main

import (
	"os"
	"testing"

	"github.com/NaveenSingh9999/a0/internal/lane"
)

func TestParseEnvFile(t *testing.T) {
	dir := t.TempDir()
	path := dir + "/.env"
	os.WriteFile(path, []byte("# comment\nA0_PORT=9099\n\nQUOTED=\"a b\"\nEMPTY=\n"), 0o600)
	t.Setenv("A0_PORT", "KEEP") // existing environ must win
	parseEnvFile(path)
	if got := os.Getenv("A0_PORT"); got != "KEEP" {
		t.Fatalf("existing env overwritten: %q", got)
	}
	if got := os.Getenv("QUOTED"); got != "a b" {
		t.Fatalf("quoted value = %q", got)
	}
	if v, ok := os.LookupEnv("EMPTY"); ok {
		t.Fatalf("empty assignment leaked: %q", v)
	}
	parseEnvFile(dir + "/missing.env") // must not panic or set anything
}

func TestModeGateKeylessLanes(t *testing.T) {
	lanes := []*lane.Lane{
		{Key: "sk-xt-secret"},
		{Keys: []string{"sk-xt-secret"}},
		{},
	}
	local := filterForMode(lanes, "local")
	public := filterForMode(lanes, "public")
	if len(local) != 3 || len(public) != 2 {
		t.Fatalf("len(local)=%d len(public)=%d", len(local), len(public))
	}
	if len(filterForMode(lanes, "nonsense")) != 3 {
		t.Fatalf("unknown mode must fall back to local")
	}
	filtered := filterForMode(lanes, "public")
	if len(filtered) != 2 || !filtered[0].HasKey() || !filtered[1].HasKey() {
		t.Fatalf("public gate kept the wrong lanes")
	}
}

func TestEnvDefaultsAndOverrides(t *testing.T) {
	os.Unsetenv("A0_PORT")
	if got := env("A0_PORT", "8082"); got != "8082" {
		t.Fatalf("default port = %q", got)
	}
	t.Setenv("A0_PORT", "9123")
	if got := env("A0_PORT", "8082"); got != "9123" {
		t.Fatalf("override port = %q", got)
	}
	t.Setenv("A0_PORT", "")
	if got := env("A0_PORT", "8082"); got != "8082" {
		t.Fatalf("empty override must fall back, got %q", got)
	}
}

func TestExampleChainParsesViaLoader(t *testing.T) {
	lanes, err := lane.Load("models.example.json")
	if err != nil {
		t.Fatalf("example chain: %v", err)
	}
	names := map[string]bool{}
	for _, l := range lanes {
		names[l.Name] = true
		if l.URL == "" || l.Model == "" {
			t.Fatalf("lane %q missing url/model", l.Name)
		}
		if l.Key != "" && len(l.Key) < 8 {
			t.Fatalf("lane %q key looks like a placeholder stub: %q", l.Name, l.Key)
		}
	}
	if !names["xkiro"] || !names["llm7"] {
		t.Fatalf("example chain missing xkiro/llm7: %v", names)
	}
}

func TestExperimentalTruthy(t *testing.T) {
	t.Setenv("A0_MODE", "public")
	t.Setenv("A0_EXPERIMENTAL", "true")
	lanes := []*lane.Lane{{Key: ""}}
	if got := filterForMode(lanes, "public"); len(got) != 1 {
		t.Fatalf("A0_EXPERIMENTAL=true must keep keyless lanes in")
	}
}
