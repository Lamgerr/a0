// a0 wing — one OpenAI-compatible gateway over pooled free lanes.
package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/NaveenSingh9999/a0/internal/lane"
	"github.com/NaveenSingh9999/a0/internal/relay"
	"github.com/NaveenSingh9999/a0/internal/server"
)

func main() {
	parseEnvFile(".env")
	port := env("A0_PORT", "8082")
	lanes, err := lane.Load(env("A0_MODEL_POOL_FILE", "models.json"))
	if err != nil {
		log.Fatalf("lane load: %v", err)
	}
	mode := env("A0_MODE", "local")
	lanes = filterForMode(lanes, mode)
	if len(lanes) == 0 {
		log.Fatalf("no lanes enabled in mode=%s (set A0_EXPERIMENTAL=true to force keyless lanes)", mode)
	}
	r := relay.New(nil, lanes)
	srv := &http.Server{
		Addr:    ":" + port,
		Handler: server.New(r),
	}
	go func() {
		log.Printf("a0 wing up — mode=%s lanes=%d port=%s", mode, len(lanes), port)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("listen: %v", err)
		}
	}()
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = srv.Shutdown(ctx)
}

func env(k, def string) string {
	if v, ok := os.LookupEnv(k); ok && v != "" {
		return v
	}
	return def
}

// envTruthy accepts 1/true/t/yes (case-insensitive).
func envTruthy(k string) bool {
	switch strings.ToLower(strings.TrimSpace(os.Getenv(k))) {
	case "1", "true", "t", "yes":
		return true
	}
	return false
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
