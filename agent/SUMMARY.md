# a0 — what happened while you were away (2026-10-18)

## DONE
- **M1 complete.** Branch `m1-core` (pushed, tag `m1-core` @ bd52ad6). Go gateway boots, serves the public surface, and survive-tested against real upstreams.
  - `internal/lane` — models.json loader (dex-compatible, missing/malformed → builtin xkiro→llm7→openrouter), key-pool rotation with per-key cooldowns, /models catalog probe with 500ms lane timeout.
  - `internal/alias` — category table (a0/flagship, a0/reasoning, a0/coder, a0/vision, a0/fast, a0/omni, a0/long); users never see raw model ids.
  - `internal/relay` — category→concrete-model rename, params/headers merge, key injection, unbuffered SSE, ≤3 lane attempts, 30s lane / 60s key cooldowns, byte-exact 502 on exhaustion.
  - `internal/server` + `main.go` — /healthz, /v1/models (categories only), /v1/chat/completions (400 on unknown model w/ category list, 413 over 1MB), dotenv, A0_MODE=local defaults, graceful shutdown.
- **Live smoke passed** on-device: 3 lanes up, real xkiro chat (`a0/coder` → qwen3-coder-plus:free, `X-A0-Lane: xkiro`), SSE streaming works end-to-end.
- **Fresh-context review applied:** fixed the two majors (corrupt-append after committed stream; unbounded request body) and five minors. Deferred list in `.superpowers/sdd/plan/progress.md` (probe caching, inbound ctx cancel, Retry-After polish).
- All work committed + pushed. Backlog (agent/backlog.md) carries M2 next-steps.

## IN-PROGRESS
- Nothing mid-flight.

## BLOCKED — needs a decision
- **Merge `m1-core` → `main`?** Branch is green + tagged; say the word and I merge.
- **M2 direction** (Supabase wiring start vs run the deferred review fixes first) — your call.

## QUEUED NEXT
1. Merge m1-core → main.
2. M2 plan: Supabase runtime truth (users, virtual keys, quota), key-cache on wings, node registry scaffolding.
3. Fold review deferred items (#7 #8 #9 #10 #13 #14) into M2 backlog entries.
4. CI with `-race` (unsupported locally on android/arm64).
