package lane

import (
	"testing"
	"time"
)

func newTestLane(keys []string, now time.Time) (*Lane, *time.Time) {
	l := &Lane{Keys: keys}
	var t time.Time = now
	l.clock = func() time.Time { return t }
	return l, &t
}

func TestNextKeyCycles(t *testing.T) {
	now := time.Now()
	l, _ := newTestLane([]string{"a", "b", "c"}, now)
	for _, want := range []string{"a", "b", "c", "a"} {
		if got := l.NextKey(); got != want {
			t.Fatalf("NextKey() = %q, want %q", got, want)
		}
	}
}

func TestNextKeyFallsBackToSingle(t *testing.T) {
	l, _ := newTestLane([]string{}, time.Now())
	if l.Key != "" {
		t.Fatal("setup")
	}
	l.Key = "solo"
	if got := l.NextKey(); got != "solo" {
		t.Fatalf("NextKey() = %q, want solo", got)
	}
}

func TestCoolKeySkipsInsideWindow(t *testing.T) {
	now := time.Now()
	l, tt := newTestLane([]string{"k0", "k1"}, now)
	l.CoolKey("k0", 60*time.Second)
	if got := l.NextKey(); got != "k1" {
		t.Fatalf("cooled k0, NextKey() = %q, want k1", got)
	}
	*tt = tt.Add(61 * time.Second)
	if got := l.NextKey(); got != "k0" {
		t.Fatalf("after expiry NextKey() = %q, want k0", got)
	}
}

func TestCoolLaneBlocksAvailability(t *testing.T) {
	now := time.Now()
	l, tt := newTestLane([]string{"k"}, now)
	l.CoolLane(90 * time.Second)
	if l.Available() {
		t.Fatal("lane must be unavailable inside cooldown")
	}
	if !l.Until().Equal(now.Add(90 * time.Second)) {
		t.Fatalf("Until() = %v, want %v", l.Until(), now.Add(90*time.Second))
	}
	*tt = tt.Add(91 * time.Second)
	if !l.Available() {
		t.Fatal("lane must recover after cooldown")
	}
}

func TestCoolKeyWinsOverLaneUntil(t *testing.T) {
	now := time.Now()
	l, _ := newTestLane([]string{}, now)
	l.CoolLane(30 * time.Second)
	l.CoolKey("k", 120*time.Second)
	if want := now.Add(120 * time.Second); !l.Until().Equal(want) {
		t.Fatalf("Until() = %v, want max cooldown %v", l.Until(), want)
	}
}

func TestAvailableAnyFreshKey(t *testing.T) {
	var l = &Lane{Keys: []string{"A", "B"}}
	frozen := time.Date(2026, 10, 18, 12, 0, 0, 0, time.UTC)
	l = l.WithClock(func() time.Time { return frozen })
	l.CoolKey("A", time.Minute)
	if !l.Available() {
		t.Fatal("one benched pool key must not take down the lane while B is fresh")
	}
	l.CoolKey("B", time.Minute)
	if l.Available() {
		t.Fatal("all keys benched -> lane unavailable")
	}
	l.CoolLane(2 * time.Minute)
	if l.Available() {
		t.Fatal("lane cooldown dominates")
	}
}
