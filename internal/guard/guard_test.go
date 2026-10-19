package guard

import (
	"net/http"
	"sync"
	"testing"
	"time"
)

// fixed clock so day-roll and retry math are deterministic.
type fakeClock struct{ t time.Time }

func (f *fakeClock) now() time.Time      { return f.t }
func (f *fakeClock) add(d time.Duration) { f.t = f.t.Add(d) }

func newTest(t *testing.T, mut func(*Cfg)) (*Guard, *fakeClock, *[]Strike) {
	t.Helper()
	fc := &fakeClock{t: time.Date(2026, 5, 4, 10, 0, 0, 0, time.UTC)}
	cfg := Cfg{Clock: fc.now}
	if mut != nil {
		mut(&cfg)
	}
	reported := &[]Strike{}
	g := New(cfg, func(s Strike) { *reported = append(*reported, s) })
	return g, fc, reported
}

func pol(rpm, cap, count int) Policy {
	return Policy{KeyID: "k1", RPM: rpm, DayCap: cap, DayCount: count}
}

func TestPerKeyRate(t *testing.T) {
	g, _, _ := newTest(t, nil)
	for i := 0; i < 30; i++ { // burst 30 admitted
		if v := g.AdmitChat("k1", "1.1.1.1", pol(20, 0, 0)); v.Deny {
			t.Fatalf("burst taken early at %d: %+v", i, v)
		}
	}
	if v := g.AdmitChat("k1", "1.1.1.1", pol(20, 0, 0)); !v.Deny || v.HTTP != 429 || v.RetryAfter <= 0 {
		t.Fatalf("expected 429 after burst: %+v", v)
	}
}

func TestPerIPRate(t *testing.T) {
	g, _, _ := newTest(t, func(c *Cfg) {
		c.KeyRPM = 1000000
		c.KeyBurst = 1000000
		c.GlobalRPM = 1000000
		c.GlobalBurst = 1000000
	})
	n := 0
	for i := 0; i < 100; i++ {
		v := g.AdmitChat("kx"+string(rune(i%4+'a')), "9.9.9.9", pol(0, 0, 0))
		if !v.Deny {
			n++
		}
	}
	if v := g.AdmitChat("kz", "9.9.9.9", pol(0, 0, 0)); !v.Deny || v.HTTP != 429 {
		t.Fatalf("ip cap should deny: %+v", v)
	}
	if n != 90 {
		t.Fatalf("want 90 admitted, got %d", n)
	}
}

func TestDayCapSeededFromControlPlane(t *testing.T) {
	g, _, rep := newTest(t, func(c *Cfg) { c.KeyRPM = 100000; c.KeyBurst = 100000 })
	// remote says 1998 already spent of cap 2000
	if v := g.AdmitChat("k1", "3.3.3.3", pol(0, 2000, 1998)); v.Deny {
		t.Fatalf("two left: %+v", v)
	}
	if v := g.AdmitChat("k1", "3.3.3.3", pol(0, 2000, 0)); v.Deny {
		t.Fatalf("one left: %+v", v)
	}
	v := g.AdmitChat("k1", "3.3.3.3", pol(0, 2000, 0))
	if !v.Deny || v.HTTP != 429 || v.Strike != "day" {
		t.Fatalf("cap blown: %+v", v)
	}
	if len(*rep) != 1 || (*rep)[0].Kind != "day" {
		t.Fatalf("no day strike reported: %+v", *rep)
	}
	// held silently after the first strike (10min suppression window)
	if v := g.AdmitChat("k1", "4.4.4.4", pol(0, 2000, 0)); !v.Deny {
		t.Fatalf("cap still on: %+v", v)
	}
	if len(*rep) != 1 {
		t.Fatalf("strike spam: %d", len(*rep))
	}
}

func TestSharedKeyHold(t *testing.T) {
	g, fc, rep := newTest(t, func(c *Cfg) {
		c.KeyRPM = 100000
		c.KeyBurst = 100000
		c.IPRPM = 100000
		c.IPBurst = 100000
		c.MaxIPPerKey = 2
	})
	for _, ip := range []string{"1.0.0.1", "1.0.0.2", "1.0.0.3", "1.0.0.4", "1.0.0.5", "1.0.0.6"} {
		g.AdmitChat("k1", ip, pol(0, 0, 0)) // third distinct ip lights the fuse
	}
	v := g.AdmitChat("k1", "1.0.0.7", pol(0, 0, 0))
	if !v.Deny || v.HTTP != 429 {
		t.Fatalf("shared key must be held: %+v", v)
	}
	if len(*rep) != 1 || (*rep)[0].Kind != "share" {
		t.Fatalf("share strike not reported: %+v", *rep)
	}
	// held for an hour even from the "other" ip
	fc.add(time.Minute)
	if v := g.AdmitChat("k1", "2.2.2.2", pol(0, 0, 0)); !v.Deny || v.HTTP != 429 {
		t.Fatalf("hold missing: %+v", v)
	}
	fc.add(2 * time.Hour)
	if v := g.AdmitChat("k1", "2.2.2.2", pol(0, 0, 0)); v.Deny {
		t.Fatalf("hold should lift: %+v", v)
	}
}

func TestTokenBudget(t *testing.T) {
	g, _, rep := newTest(t, func(c *Cfg) { c.TokenDay = 1000 })
	g.Note("k1", 200, 400, 400) // 800 of 1000
	if v := g.AdmitChat("k1", "5.5.5.5", pol(1000000, 0, 0)); v.Deny {
		t.Fatalf("under budget: %+v", v)
	}
	g.Note("k1", 200, 400, 400) // 1600 → over budget → hold
	v := g.AdmitChat("k1", "5.5.5.5", pol(1000000, 0, 0))
	if !v.Deny {
		t.Fatalf("budget must hold the key: %+v", v)
	}
	if len(*rep) != 1 || (*rep)[0].Kind != "tokens" {
		t.Fatalf("token strike missing: %+v", *rep)
	}
	// failures don't bill tokens
	g.Note("k1", 502, 99999, 99999)
}

func TestStreamCeiling(t *testing.T) {
	g, _, _ := newTest(t, func(c *Cfg) { c.MaxStreams = 2 })
	if v := g.StreamOpen("k1"); v.Deny {
		t.Fatalf("open 1: %+v", v)
	}
	if v := g.StreamOpen("k1"); v.Deny {
		t.Fatalf("open 2: %+v", v)
	}
	if v := g.StreamOpen("k1"); !v.Deny || v.HTTP != 429 {
		t.Fatalf("third stream must deny: %+v", v)
	}
	g.StreamClose("k1")
	g.StreamClose("k1") // idempotent-safe
	g.StreamClose("k1")
	if v := g.StreamOpen("k1"); v.Deny {
		t.Fatalf("all released — open should work: %+v", v)
	}
}

func TestUTCRollover(t *testing.T) {
	g, fc, _ := newTest(t, func(c *Cfg) { c.KeyRPM = 1; c.KeyBurst = 1 })
	if v := g.AdmitChat("k1", "6.6.6.6", pol(0, 0, 0)); v.Deny {
		t.Fatalf("first of day: %+v", v)
	}
	if v := g.AdmitChat("k1", "6.6.6.6", pol(0, 0, 0)); !v.Deny {
		t.Fatalf("same day cap: %+v", v)
	}
	fc.add(25 * time.Hour) // cross UTC midnight
	if v := g.AdmitChat("k1", "6.6.6.6", pol(0, 0, 0)); v.Deny {
		t.Fatalf("next day fresh: %+v", v)
	}
}

func TestGlobalBreakerSharedAcrossKeys(t *testing.T) {
	g, _, _ := newTest(t, func(c *Cfg) {
		c.GlobalRPM = 10
		c.GlobalBurst = 10
		c.KeyRPM = 100000
		c.KeyBurst = 100000
	})
	n := 0
	for i := 0; i < 12; i++ {
		v := g.AdmitChat("k"+string(rune('a'+i)), "0.0.0."+string(rune('0'+i)), pol(0, 0, 0))
		if !v.Deny {
			n++
		}
	}
	if n != 10 {
		t.Fatalf("global breaker took %d of 12", n)
	}
}

func TestClientIP(t *testing.T) {
	r, _ := http.NewRequest("POST", "/v1/chat/completions", nil)
	if got := ClientIP(r); got != "" {
		t.Fatalf("no addr → empty, got %q", got)
	}
	r.RemoteAddr = "203.0.113.7:5555"
	if got := ClientIP(r); got != "203.0.113.7" {
		t.Fatalf("peer fallback: %q", got)
	}
	r.Header.Set("X-Forwarded-For", "198.51.100.9, 10.0.0.2")
	if got := ClientIP(r); got != "198.51.100.9" {
		t.Fatalf("xff leftmost: %q", got)
	}
}

func TestConcurrentAdmission(t *testing.T) {
	g, _, _ := newTest(t, nil)
	var wg sync.WaitGroup
	for i := 0; i < 50; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			g.AdmitChat("kx", "7.7.7.7", pol(20, 0, 0))
			g.Note("kx", 200, 10, 10)
			defer g.StreamClose("kx")
			g.StreamOpen("kx")
		}(i)
	}
	wg.Wait()
}
