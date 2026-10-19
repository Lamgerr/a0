// Package guard is a0's fair-use core: token buckets per key and per IP,
// per-key day caps keyed off the control plane's own counts, a token budget,
// a key-sharing detector, concurrent-stream ceilings and a global circuit
// breaker. Expectations from the rest of the wing:
//   - server calls AdmitChat/AdmitModels before any body work;
//   - server opens/closes a slot per streamed completion (StreamOpen/Close);
//   - relay's usage hook calls Note with the (approximated) token cost.
//
// Every function is safe for concurrent use.
package guard

import (
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

// Default limits. Adjust via env in main.go; the shipped values are the
// landing-page promise (free tier ~20 RPM / 2k req/day) tightened to protect
// the pooled upstreams.
const (
	DefaultKeyRPM      = 20  // per-key rate when the key has no custom rpm
	DefaultKeyBurst    = 30  // per-key bucket burst
	DefaultIPRPM       = 60  // per-IP rate (NAT-friendly-ish, still bounded)
	DefaultIPBurst     = 90  // per-IP burst
	DefaultGlobalRPM   = 240 // whole-wing intake ceiling for chat
	DefaultGlobalBurst = 60
	DefaultTokenDay    = 250_000 // ≈ tokens (in+out) per key per UTC day
	DefaultMaxStreams  = 2       // concurrent streamed completions per key
	DefaultMaxIPPerKey = 5       // distinct src IPs per key per UTC day
	DefaultModelRPM    = 30      // /v1/models per IP (cheap, but bounded)

	// Strike policy mirrors key_strike in the control plane:
	StrikeHold   = 3 // strikes in a 24h window → 1h hold (status held)
	StrikeBan    = 9 // strikes → banned (control plane sentences)
	HoldDuration = time.Hour
	StrikeDecay  = 24 * time.Hour
)

// Verdict is Admit*'s answer. Deny=false → proceed.
type Verdict struct {
	Deny       bool
	HTTP       int // 429 or 403
	Reason     string
	RetryAfter int    // seconds (0 = none)
	Strike     string // abuse kind to report ("", or kind when this gate produced a strike)
}

// Policy is the control plane's current view of the key (from key_validate).
type Policy struct {
	KeyID    string
	RPM      int // 0 → DefaultKeyRPM
	DayCap   int // 0 → unlimited locally (control plane still counts)
	DayCount int // requests already spent per the control plane
}

// Strike is one abuse event handed to the async reporter (node-strike edge).
type Strike struct {
	KeyID  string
	Kind   string
	IP     string
	Detail string
}

// Cfg is the tunable set; zero fields take their defaults.
type Cfg struct {
	KeyRPM, KeyBurst       int
	IPRPM, IPBurst         int
	GlobalRPM, GlobalBurst int
	TokenDay               int
	MaxStreams             int
	MaxIPPerKey            int
	ModelRPM               int
	Clock                  func() time.Time
}

func (c Cfg) withDefaults() Cfg {
	if c.KeyRPM <= 0 {
		c.KeyRPM = DefaultKeyRPM
	}
	if c.KeyBurst <= 0 {
		c.KeyBurst = DefaultKeyBurst
	}
	if c.IPRPM <= 0 {
		c.IPRPM = DefaultIPRPM
	}
	if c.IPBurst <= 0 {
		c.IPBurst = DefaultIPBurst
	}
	if c.GlobalRPM <= 0 {
		c.GlobalRPM = DefaultGlobalRPM
	}
	if c.GlobalBurst <= 0 {
		c.GlobalBurst = DefaultGlobalBurst
	}
	if c.TokenDay <= 0 {
		c.TokenDay = DefaultTokenDay
	}
	if c.MaxStreams <= 0 {
		c.MaxStreams = DefaultMaxStreams
	}
	if c.MaxIPPerKey <= 0 {
		c.MaxIPPerKey = DefaultMaxIPPerKey
	}
	if c.ModelRPM <= 0 {
		c.ModelRPM = DefaultModelRPM
	}
	if c.Clock == nil {
		c.Clock = time.Now
	}
	return c
}

// Guard holds all state; all access is under mu (global breakers are cheap
// enough not to need sharding at a0's scale).
type Guard struct {
	cfg    Cfg
	report func(Strike)

	mu      sync.Mutex
	global  bucket
	keyB    map[string]bucket
	ipB     map[string]bucket
	day     map[string]*dayUse
	hold    map[string]time.Time
	streams map[string]int
}

type bucket struct {
	tok  float64
	last time.Time
}

type dayUse struct {
	day      string // UTC yyyy-mm-dd
	count    int
	tokens   int // in+out approximation
	ips      map[string]struct{}
	strikeAt map[string]time.Time // abuse kind → last strike issued while denied
}

// New builds a guard. report may be nil (no remote sentencing).
func New(cfg Cfg, report func(Strike)) *Guard {
	cfg = cfg.withDefaults()
	return &Guard{
		cfg:     cfg,
		report:  report,
		keyB:    map[string]bucket{},
		ipB:     map[string]bucket{},
		day:     map[string]*dayUse{},
		hold:    map[string]time.Time{},
		streams: map[string]int{},
	}
}

// ── admission ──────────────────────────────────────────────────

// AdmitChat runs the complete chat gate in order: global breaker → hold →
// per-IP → per-key → day cap → sharing detector. ip must be sanitized by
// the caller (ClientIP).
func (g *Guard) AdmitChat(keyID, ip string, p Policy) Verdict {
	now := g.cfg.Clock()
	g.mu.Lock()
	defer g.mu.Unlock()
	return g.admitChatLocked(now, keyID, ip, p)
}

func (g *Guard) admitChatLocked(now time.Time, keyID, ip string, p Policy) Verdict {
	// 1. global cement breaker — protect the pooled upstreams first
	if !g.global.take(now, float64(g.cfg.GlobalRPM)/60.0, float64(g.cfg.GlobalBurst)) {
		return Verdict{Deny: true, HTTP: 429,
			Reason: "fair-use zone busy — pooled capacity is saturated", RetryAfter: 60}
	}

	// 2. local hold (strike sentence, or share hold)
	if until, ok := g.hold[keyID]; ok {
		if now.Before(until) {
			return Verdict{Deny: true, HTTP: 429,
				Reason:     "key held for fair use — try again later",
				RetryAfter: secs(until.Sub(now))}
		}
		delete(g.hold, keyID)
		// sentence served: purge the suspicion list so continued normal
		// use isn't instantly re-held; fresh sharing re-triggers.
		if du := g.day[keyID]; du != nil {
			du.ips = map[string]struct{}{}
		}
	}

	// 3. per-IP bucket
	if ip != "" && !g.takeMap(&g.ipB, ip, now, float64(g.cfg.IPRPM)/60.0, float64(g.cfg.IPBurst)) {
		return Verdict{Deny: true, HTTP: 429, Reason: "too many requests from this IP",
			RetryAfter: retryFor(now, g.cfg.IPRPM)}
	}

	// 4. day ledger (seeded from the control plane's own counts)
	du := g.dayOf(keyID, now)
	if p.DayCount > du.count {
		du.count = p.DayCount // reconcile multi-wing / leaked-event views
	}
	if p.DayCap > 0 && du.count >= p.DayCap {
		g.strikeLocked(keyID, "day", ip, du)
		return Verdict{Deny: true, HTTP: 429, Reason: "daily cap reached",
			RetryAfter: retryAtUTCmidnight(now), Strike: "day"}
	}

	// 5. per-key bucket (custom rpm wins, floored by the default)
	rate := float64(p.RPM)
	if rate <= 0 {
		rate = float64(g.cfg.KeyRPM)
	}
	if rate > float64(g.cfg.KeyRPM)*3 {
		rate = float64(g.cfg.KeyRPM) * 3 // no single key escapes the floor
	}
	if !g.takeMap(&g.keyB, keyID, now, rate/60.0, float64(g.cfg.KeyBurst)) {
		g.strikeLocked(keyID, "rate", ip, du)
		return Verdict{Deny: true, HTTP: 429, Reason: "key rate limit",
			RetryAfter: retryFor(now, int(rate)), Strike: "rate"}
	}

	// 6. sharing detector: too many distinct source IPs in one UTC day
	if ip != "" {
		du.ips[ip] = struct{}{}
		if len(du.ips) > g.cfg.MaxIPPerKey {
			g.strikeLocked(keyID, "share", ip, du)
			g.hold[keyID] = now.Add(HoldDuration) // hard stop, one hour
			return Verdict{Deny: true, HTTP: 429,
				Reason:     "key appears to be shared — held for fair use",
				RetryAfter: int(HoldDuration.Seconds()), Strike: "share"}
		}
	}

	du.count++
	return Verdict{}
}

// AdmitModels bounds the catalog endpoint per IP (cheap but bounded).
func (g *Guard) AdmitModels(ip string) Verdict {
	now := g.cfg.Clock()
	g.mu.Lock()
	defer g.mu.Unlock()
	if ip != "" && !g.takeMap(&g.ipB, ip, now, float64(g.cfg.ModelRPM)/60.0, float64(g.cfg.ModelRPM)*2) {
		return Verdict{Deny: true, HTTP: 429, Reason: "too many catalog requests",
			RetryAfter: retryFor(now, g.cfg.ModelRPM)}
	}
	return Verdict{}
}

// SetDay seeds/reconciles the local day ledger with the control plane's
// count (multiple wings, unflushed events). Monotonic max.
func (g *Guard) SetDay(keyID string, remoteCount int) {
	now := g.cfg.Clock()
	g.mu.Lock()
	defer g.mu.Unlock()
	du := g.dayOf(keyID, now)
	if remoteCount > du.count {
		du.count = remoteCount
	}
}

// Note applies token accounting for one usage event (success only: the
// upstream actually charged quota). Fails the key's budget with a strike.
func (g *Guard) Note(keyID string, status int, inTok, outTok int) {
	if status != 200 || keyID == "" {
		return
	}
	now := g.cfg.Clock()
	g.mu.Lock()
	defer g.mu.Unlock()
	du := g.dayOf(keyID, now)
	du.tokens += inTok + outTok
	if du.tokens >= g.cfg.TokenDay {
		g.strikeLocked(keyID, "tokens", "", du)
		g.hold[keyID] = now.Add(HoldDuration)
	}
}

// StreamOpen claims a concurrent-stream slot for a streamed completion.
func (g *Guard) StreamOpen(keyID string) Verdict {
	g.mu.Lock()
	defer g.mu.Unlock()
	if g.streams[keyID] >= g.cfg.MaxStreams {
		return Verdict{Deny: true, HTTP: 429,
			Reason: "too many concurrent streams for this key"}
	}
	g.streams[keyID]++
	return Verdict{}
}

// StreamClose releases the slot (idempotent-safe).
func (g *Guard) StreamClose(keyID string) {
	g.mu.Lock()
	defer g.mu.Unlock()
	if n := g.streams[keyID]; n > 1 {
		g.streams[keyID] = n - 1
	} else {
		delete(g.streams, keyID)
	}
}

// ── internals ──────────────────────────────────────────────────

func (g *Guard) takeMap(m *map[string]bucket, key string, now time.Time, rate, burst float64) bool {
	b, ok := (*m)[key]
	if !ok {
		if len(*m) > 32768 {
			*m = map[string]bucket{}
		}
		(*m)[key] = bucket{tok: burst - 1, last: now}
		return true
	}
	if !b.take(now, rate, burst) {
		(*m)[key] = b
		return false
	}
	(*m)[key] = b
	return true
}

// take consumes one token, refilling lazily. The zero bucket is fresh.
func (b *bucket) take(now time.Time, rate, burst float64) bool {
	if b.tok == 0 && b.last.IsZero() {
		b.tok = burst - 1
		b.last = now
		return true
	}
	elapsed := now.Sub(b.last).Seconds()
	if elapsed > 0 {
		b.tok = min64(burst, b.tok+elapsed*rate)
		b.last = now
	}
	if b.tok < 1 {
		return false
	}
	b.tok--
	return true
}

func (g *Guard) dayOf(keyID string, now time.Time) *dayUse {
	du, ok := g.day[keyID]
	day := now.UTC().Format("2006-01-02")
	if !ok || du.day != day {
		du = &dayUse{day: day, ips: map[string]struct{}{}, strikeAt: map[string]time.Time{}}
		g.day[keyID] = du
		if len(g.day) > 16384 {
			g.day = map[string]*dayUse{}
		}
	}
	return du
}

// strikeLocked records one abuse event toward the local sentence and fires
// the async reporter (rate-limited per kind per day-use so dogpiling keys
// cannot spam the control plane).
func (g *Guard) strikeLocked(keyID, kind, ip string, du *dayUse) {
	if last, ok := du.strikeAt[kind]; ok && g.cfg.Clock().Sub(last) < 10*time.Minute {
		return
	}
	du.strikeAt[kind] = g.cfg.Clock()
	if g.report != nil {
		g.report(Strike{KeyID: keyID, Kind: kind, IP: ip})
	}
}

func secs(d time.Duration) int {
	if d < time.Second {
		return 1
	}
	return int(d.Seconds()) + 1
}

func retryFor(now time.Time, perMinute int) int {
	if perMinute <= 0 {
		return 60
	}
	return secs(time.Duration(float64(time.Minute) / float64(perMinute)))
}

func retryAtUTCmidnight(now time.Time) int {
	n := now.UTC()
	next := time.Date(n.Year(), n.Month(), n.Day(), 0, 0, 0, 0, time.UTC).
		Add(24 * time.Hour)
	return secs(next.Sub(n))
}

func min64(a, b float64) float64 {
	if a < b {
		return a
	}
	return b
}

// ── client identity ────────────────────────────────────────────

// ClientIP resolves the request's source address for fair-use accounting.
// Vercel (and most fronting LBs) overwrite X-Forwarded-For with their view
// of the client, so the leftmost entry is the real client; a bare TCP peer
// is used otherwise.
func ClientIP(r *http.Request) string {
	if v := strings.TrimSpace(r.Header.Get("X-Forwarded-For")); v != "" {
		host := strings.TrimSpace(strings.SplitN(v, ",", 2)[0])
		if host != "" {
			return host
		}
	}
	if h, _, err := net.SplitHostPort(r.RemoteAddr); err == nil {
		return h
	}
	return r.RemoteAddr
}
