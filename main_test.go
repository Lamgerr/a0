package main

import (
	"os"
	"testing"

	"github.com/NaveenSingh9999/a0/internal/lane"
)

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
