// a0 wing — one OpenAI-compatible gateway over pooled free lanes.
package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/NaveenSingh9999/a0/internal/guard"
	"github.com/NaveenSingh9999/a0/internal/lane"
	"github.com/NaveenSingh9999/a0/internal/node"
	"github.com/NaveenSingh9999/a0/internal/relay"
	"github.com/NaveenSingh9999/a0/internal/server"
)

func main() {
	parseEnvFile(".env")
	port := env("A0_PORT", env("SERVER_PORT", env("PORT", "8082")))
	mode := env("A0_MODE", "local")
	nodeID, token := env("A0_NODE_ID", ""), env("A0_CONTROL_TOKEN", "")
	ctlURL, anonKey := env("A0_SUPABASE_URL", ""), env("A0_SUPABASE_ANON_KEY", "")
	wired := nodeID != "" && token != "" && ctlURL != "" && anonKey != ""

	var ctl *node.Client
	if wired {
		ctl = node.New(ctlURL, anonKey, nodeID, token, nil)
	}

	lanes := loadLanes(ctl, nodeID, token)
	lanes = filterForMode(lanes, mode)
	if len(lanes) == 0 {
		log.Fatalf("no lanes enabled in mode=%s (set A0_EXPERIMENTAL=true to force keyless lanes)", mode)
	}

	var gate server.KeyGate
	var recorder *node.Recorder
	var gr *guard.Guard
	strikes := make(chan node.Strike, 256)
	var frames = func(k guard.Strike) {
		select {
		case strikes <- node.Strike{KeyID: k.KeyID, Kind: k.Kind, IP: k.IP}:
		default: // buffer full — local enforcement still holds the line
		}
	}
	if mode == "public" && ctl != nil {
		rg := node.NewGate(ctl, time.Minute)
		gr = guard.New(guard.Cfg{
			KeyRPM:      envInt("A0_KEY_RPM_DEF", 0),
			KeyBurst:    envInt("A0_KEY_BURST", 0),
			IPRPM:       envInt("A0_IP_RPM", 0),
			IPBurst:     envInt("A0_IP_BURST", 0),
			GlobalRPM:   envInt("A0_GLOBAL_RPM", 0),
			TokenDay:    envInt("A0_TOKEN_DAY", 0),
			MaxStreams:  envInt("A0_MAX_STREAMS", 0),
			MaxIPPerKey: envInt("A0_MAX_IP_PER_KEY", 0),
		}, frames)
		gate = publicGate{rg: rg, gr: gr}
		recorder = node.NewRecorder(256)
	}

	r := relay.New(nil, lanes)
	if recorder != nil && gr != nil {
		r.Usage = func(e relay.UsageEvent) {
			recorder.Append(node.Event{
				KeyID: e.KeyID, Lane: e.Lane, Model: e.Model,
				Status: e.Status, LatencyMs: e.LatencyMs,
				InTok: e.InTok, OutTok: e.OutTok, IP: e.IP,
			})
			gr.Note(e.KeyID, e.Status, e.InTok, e.OutTok) // fair-use budget
		}
	}

	srv := &http.Server{
		Addr:              ":" + port,
		Handler:           server.New(r, gate),
		ReadHeaderTimeout: 30 * time.Second, // slowloris ceiling
		IdleTimeout:       120 * time.Second,
	}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)

	go func() {
		log.Printf("a0 wing up — mode=%s lanes=%d port=%s (node=%s wired=%v)",
			mode, len(lanes), port, nodeID, wired)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("listen: %v", err)
		}
	}()

	if ctl != nil {
		runControlPlane(ctx, ctl, lanes, recorder, strikes)
	}

	<-stop
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()
	_ = srv.Shutdown(shutdownCtx)
}

func env(k, def string) string {
	if v, ok := os.LookupEnv(k); ok && v != "" {
		return v
	}
	return def
}

// publicGate is the full public-mode facade over the control-plane verdict
// cache (node.Gate) and the wing's fair-use core (guard.Guard).
type publicGate struct {
	rg *node.Gate
	gr *guard.Guard
}

func (p publicGate) mapKey(k node.Key, ok bool) (server.KeyInfo, bool) {
	if !ok {
		return server.KeyInfo{}, false
	}
	if k.Status == "banned" {
		return server.KeyInfo{ID: k.KeyID, HTTP: http.StatusForbidden,
			Reason: "key banned for fair-use abuse"}, true
	}
	if k.Status == "held" {
		// authoritative control-plane hold; expiry is released by
		// key_validate, picked up on the next 60s cache refresh
		return server.KeyInfo{ID: k.KeyID, HTTP: http.StatusForbidden,
			Reason: "key held for fair use — try again later"}, true
	}
	return server.KeyInfo{
		ID: k.KeyID, RPM: k.RPM, DayCap: k.DailyCap, DayCount: k.DayCount,
	}, true
}

func (p publicGate) Allow(key, ip string) (server.KeyInfo, bool) {
	k, ok := p.rg.Allow(key)
	info, kept := p.mapKey(k, ok)
	if !kept || info.HTTP != 0 {
		return info, kept
	}
	// fair-use verdict on top of validity
	v := p.gr.AdmitChat(info.ID, ip, guard.Policy{
		KeyID: info.ID, RPM: info.RPM, DayCap: info.DayCap, DayCount: info.DayCount,
	})
	if v.Deny {
		return server.KeyInfo{ID: info.ID, HTTP: v.HTTP, Reason: v.Reason, Retry: v.RetryAfter}, true
	}
	return info, true
}

func (p publicGate) Verify(key string) (server.KeyInfo, bool) {
	k, ok := p.rg.Allow(key)
	info, kept := p.mapKey(k, ok)
	info.RPM, info.DayCap, info.DayCount = 0, 0, 0
	return info, kept && info.HTTP == 0
}

func (p publicGate) Catalog(ip string) (int, int) {
	if v := p.gr.AdmitModels(ip); v.Deny {
		return v.HTTP, v.RetryAfter
	}
	return 0, 0
}

func (p publicGate) StreamOpen(keyID string) (int, int) {
	if v := p.gr.StreamOpen(keyID); v.Deny {
		return v.HTTP, v.RetryAfter
	}
	return 0, 0
}

func (p publicGate) StreamDone(keyID string) { p.gr.StreamClose(keyID) }

// envInt parses an int env knob; bad/missing values fall back to def.
func envInt(k string, def int) int {
	v := strings.TrimSpace(os.Getenv(k))
	if v == "" {
		return def
	}
	n := 0
	for _, r := range v {
		if r < '0' || r > '9' {
			return def
		}
		n = n*10 + int(r-'0')
	}
	return n
}

// envTruthy accepts 1/true/t/yes (case-insensitive).
func envTruthy(k string) bool {
	switch strings.ToLower(strings.TrimSpace(os.Getenv(k))) {
	case "1", "true", "t", "yes":
		return true
	}
	return false
}

// loadLanes: with a live control-plane client, pull the runtime chain from
// control (fatal when registration or delivery fails — a public wing without
// lanes serves nothing); otherwise boot from local models.json.
func loadLanes(ctl *node.Client, nodeID, token string) []*lane.Lane {
	if ctl != nil {
		init, err := ctl.Init(context.Background(),
			env("A0_NODE_NAME", "wing"), env("A0_REGION", "sg"))
		if err != nil {
			log.Fatalf("node init: %v", err)
		}
		if len(init.Chain) == 0 {
			log.Fatalf("control plane returned no lanes for node %s", nodeID)
		}
		log.Printf("control plane chain: %d lanes (adopted=%v)", len(init.Chain), init.Adopted)
		return lane.Prepare(init.Chain)
	}
	lanes, err := lane.Load(env("A0_MODEL_POOL_FILE", "models.json"))
	if err != nil {
		log.Fatalf("lane load: %v", err)
	}
	return lanes
}

// runControlPlane keeps the wing alive in the panel's eyes, drains usage
// events periodically, and ships abuse strikes. Heartbeat failures never
// kill the gateway.
func runControlPlane(ctx context.Context, nc *node.Client, lanes []*lane.Lane, recorder *node.Recorder, strikes <-chan node.Strike) {
	beat := func() {
		h := make([]node.Health, 0, len(lanes))
		for _, l := range lanes {
			ok := l.Available()
			detail := "ready"
			if !ok {
				detail = fmt.Sprintf("cooling until %s", l.Until().UTC().Format(time.RFC3339))
			}
			h = append(h, node.Health{Lane: l.Name, OK: ok, Detail: detail})
		}
		if err := nc.Heartbeat(ctx, h); err != nil {
			log.Printf("heartbeat failed (continuing): %v", err)
		}
	}
	beat()
	go func() {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				beat()
			case <-ctx.Done():
				return
			}
		}
	}()

	if recorder != nil {
		go func() {
			ticker := time.NewTicker(20 * time.Second)
			defer ticker.Stop()
			for {
				select {
				case <-ticker.C:
					if err := recorder.Flush(ctx, nc); err != nil {
						log.Printf("usage flush failed (buffer retained): %v", err)
					}
				case <-ctx.Done():
					return
				}
			}
		}()
	}

	if strikes != nil {
		go func() {
			ticker := time.NewTicker(20 * time.Second)
			defer ticker.Stop()
			for {
				select {
				case <-ticker.C:
					drained, s := 0, true
					for s {
						select {
						case st := <-strikes:
							drained++
							sctx, cancel := context.WithTimeout(ctx, 15*time.Second)
							if err := nc.Strike(sctx, st); err != nil {
								log.Printf("strike report failed kind=%s: %v", st.Kind, err)
							}
							cancel()
							if drained >= 50 {
								s = false
							}
						default:
							s = false
						}
					}
				case <-ctx.Done():
					return
				}
			}
		}()
	}
}

// parseEnvFile loads KEY=VALUE lines from a dotenv file without clobbering
// the real environment; missing files are ignored. Values may be double-
// quoted; inline comments after a space are stripped.
func parseEnvFile(path string) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return
	}
	for _, line := range strings.Split(string(raw), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		line = strings.TrimPrefix(line, "export ")
		key, val, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		key = strings.TrimSpace(key)
		val = strings.TrimSpace(val)
		if len(val) >= 2 && (val[0] == '"' && val[len(val)-1] == '"' || val[0] == '\'' && val[len(val)-1] == '\'') {
			val = val[1 : len(val)-1]
		}
		if i := strings.Index(val, " #"); i >= 0 {
			val = strings.TrimSpace(val[:i])
		}
		if key == "" || val == "" || os.Getenv(key) != "" {
			continue
		}
		_ = os.Setenv(key, val)
	}
}

// filterForMode gates keyless lanes: local (and unknown modes — the safe
// default) keeps everything; "public" drops lanes with no credentials to
// conserve anonymous-jail quotas, unless A0_EXPERIMENTAL=1 forces them in.
func filterForMode(lanes []*lane.Lane, mode string) []*lane.Lane {
	if mode != "public" || envTruthy("A0_EXPERIMENTAL") {
		return lanes
	}
	out := lanes[:0:0]
	for _, l := range lanes {
		if l.HasKey() {
			out = append(out, l)
		}
	}
	return out
}
