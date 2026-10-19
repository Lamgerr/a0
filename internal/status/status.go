// Package status is a tiny leaf both main and the server can import to
// reflect wing-side counters in /healthz without wiring plumbing.
package status

import "sync"

var (
	mu          sync.Mutex
	heartbeats  int // successful control-plane heartbeats
	usageFlush  int // usage batches shipped
	strikesSent int // abuse strikes reported
	bootAt      string
)

func Heartbeat(ok bool) {
	mu.Lock()
	defer mu.Unlock()
	if ok {
		heartbeats++
	}
}

func UsageFlush() {
	mu.Lock()
	defer mu.Unlock()
	usageFlush++
}

func StrikeSent() {
	mu.Lock()
	defer mu.Unlock()
	strikesSent++
}

func Boot(name string) {
	mu.Lock()
	defer mu.Unlock()
	bootAt = name
}

// Snapshot is safe for the healthz handler; empty map = never booted.
func Snapshot() map[string]any {
	mu.Lock()
	defer mu.Unlock()
	return map[string]any{
		"heartbeats": heartbeats,
		"usage":      usageFlush,
		"strikes":    strikesSent,
		"boot":       bootAt,
	}
}
