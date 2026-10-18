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

	"github.com/NaveenSingh9999/a0/internal/lane"
	"github.com/NaveenSingh9999/a0/internal/node"
	"github.com/NaveenSingh9999/a0/internal/relay"
	"github.com/NaveenSingh9999/a0/internal/server"
)

func main() {
	parseEnvFile(".env")
	port := env("A0_PORT", "8082")
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
	if mode == "public" && ctl != nil {
		gate = gateAdapter{node.NewGate(ctl, time.Minute)}
		recorder = node.NewRecorder(256)
	}

	r := relay.New(nil, lanes)
	if recorder != nil {
		r.Usage = func(e relay.UsageEvent) {
			recorder.Append(node.Event{
				KeyID: e.KeyID, Lane: e.Lane, Model: e.Model,
				Status: e.Status, LatencyMs: e.LatencyMs,
			})
		}
	}

	srv := &http.Server{
		Addr:    ":" + port,
		Handler: server.New(r, gate),
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
		runControlPlane(ctx, ctl, lanes, recorder)
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

// gateAdapter adapts node.Gate's full verdict to the server's key-id gate.
type gateAdapter struct{ g *node.Gate }

func (ga gateAdapter) Allow(key string) (string, bool) {
	k, ok := ga.g.Allow(key)
	if !ok {
		return "", false
	}
	return k.KeyID, true
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

// runControlPlane keeps the wing alive in the panel's eyes and drains usage
// events periodically. Heartbeat failures never kill the gateway.
func runControlPlane(ctx context.Context, nc *node.Client, lanes []*lane.Lane, recorder *node.Recorder) {
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
