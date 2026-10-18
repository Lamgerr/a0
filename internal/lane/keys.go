package lane

import "time"

// Keyring state lives on the lane: pointer cycle + cooldown deadlines.
// No global state; every lane carries its own clock so tests can freeze time.

// withLock runs f under the lane mutex.
func (l *Lane) withLock(f func()) {
	l.mu.Lock()
	defer l.mu.Unlock()
	f()
}

// nowish is l.clock with a safe default (lanes built inline in tests).
func (l *Lane) nowish() time.Time {
	if l.clock == nil {
		return time.Now()
	}
	c := l.clock
	return c()
}

// NextKey returns the next usable key, skipping cooled ones; cycles the pool
// deterministically. Empty pool falls back to the single Key.
func (l *Lane) NextKey() string {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := l.nowish()
	pool := l.Keys
	if len(pool) == 0 {
		pool = []string{l.Key}
	}
	for i := 0; i < len(pool); i++ {
		k := pool[(l.next+uint64(i))%uint64(len(pool))]
		if until, cooled := l.keyCool[k]; cooled && until.After(now) {
			continue
		}
		l.next = (l.next + uint64(i) + 1) % uint64(len(pool))
		return k
	}
	return ""
}

// CoolKey benches one key for d.
func (l *Lane) CoolKey(key string, d time.Duration) {
	l.withLock(func() {
		if l.keyCool == nil {
			l.keyCool = map[string]time.Time{}
		}
		l.keyCool[key] = l.nowish().Add(d)
	})
}

// CoolLane benches the whole lane for d.
func (l *Lane) CoolLane(d time.Duration) {
	l.withLock(func() { l.laneCool = l.nowish().Add(d) })
}

// Available reports whether the lane may be attempted right now.
func (l *Lane) Available() bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	u := l.untilLocked()
	if u.IsZero() {
		return true
	}
	return !l.nowish().Before(u)
}

// Until is the max lane/key cooldown deadline; zero time when nothing is cooled.
func (l *Lane) Until() time.Time {
	l.mu.Lock()
	defer l.mu.Unlock()
	return l.untilLocked()
}

func (l *Lane) untilLocked() time.Time {
	latest := l.laneCool
	for _, until := range l.keyCool {
		if until.After(latest) {
			latest = until
		}
	}
	return latest
}

// WithClock swaps the lane's clock (tests inject frozen time).
func (l *Lane) WithClock(fn func() time.Time) *Lane {
	l.withLock(func() { l.clock = fn })
	return l
}
