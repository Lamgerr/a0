// a0 wing — one OpenAI-compatible gateway over pooled free lanes.
package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/NaveenSingh9999/a0/internal/lane"
	"github.com/NaveenSingh9999/a0/internal/relay"
	"github.com/NaveenSingh9999/a0/internal/server"
)

func main() {
	port := env("A0_PORT", "8082")
	mode := env("A0_MODE", "local")
	lanes, err := lane.Load(env("A0_MODEL_POOL_FILE", "models.json"))
	if err != nil {
		log.Fatalf("lane load: %v", err)
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
