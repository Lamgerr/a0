# a0 Gateway M1 — Go Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A running Go gateway that serves OpenAI-shaped `/v1/chat/completions` (SSE + JSON) and `/v1/models` by pooling configured lanes (xKiro, LLM7, OpenRouter) with failover and key rotation, in local mode.

**Architecture:** Thin pass-through relay over lane configs: normalize each lane to one internal shape (`lane.Model`), stream upstream → downstream without re-parsing SSE, fail over the chain on 429/5xx/timeout, rotate keys per lane with cooldown. Fallback builtin chain when `models.json` is absent (works with zero keys on llm7).

**Tech Stack:** Go 1.27 (present on device: go1.27.1 android/arm64), stdlib only (`net/http`, `encoding/json`, `time`), stdlib `testing` + `httptest`.

**Spec:** `concept.md` (M1 milestone + architecture + lane schema).

## Global Constraints

- Go 1.27, module path `github.com/a0/gateway` — no third-party deps in M1.
- Default port `8082` (env `A0_PORT`), local mode default (`A0_MODE=local`).
- Lane config = dex `models.json` schema, fields: `name url key model vision vision_model stream_only vision(params headers)` + a0 extras `keys public quota` parsed-yes-used-later; unknown fields ignored silently.
- Chat upstream: request timeout 60s total, connect timeout 10s; failover = max 3 lane attempts then 502 with body `{"error":{"message":"no lane available"}}`.
- A lane that returned 429/5xx is cooled 30s (hard), honoring upstream `Retry-After` when larger; key in pool that hit 429 cooled 60s.
- Secrets only via `.env` (gitignored); nothing hardcoded in source. `.env.example` lists variable names.
- Every commit green: `go test ./... && go vet ./...`.

## Review Focus

1. **SSE chunk-boundary preservation:** bytes arriving mid-chunk must be forwarded unbuffered in order — proxy must never wait for a full SSE event. Test: upstream emits two deltas split across TCP segments; downstream sees identical chunk order. (Task 5)
2. **Retry-After honored above hardcoded cooldowns.** Test: upstream returns 429 with `Retry-After: 90`; same next request inside 90s picks the *next lane*, not the cooled one. (Task 6)
3. **Timeout lane isolation:** one dead lane must never stall the chain beyond its own timeouts (10s connect/60s stream) — other lanes still answer. Test: fake lane with `time.Sleep`, assert fallback path succeeds. (Task 6)
4. **`models.json` unknown-field tolerance:** dex-shaped file with extra keys must parse byte-identical to today's chain. Test: fixture with junk fields parses. (Task 1)
5. **Unknown model id rejected with category list:** body model `gpt-4o` → 400 containing all seven `a0/*` ids — no silent remap. Test: server-level (Task 8).
6. **Keyless lane with empty key:** chain must still attempt llm7-anon lane and succeed. Test: lane with `key:""`, upstream accepts, forwarded without `Authorization`. (Task 4)

---

### Task 1: Module scaffold + lane config loader

**Files:**
- Create: `go.mod`, `internal/lane/lane.go`
- Create: `models.example.json`, `.env.example`
- Test: `internal/lane/lane_test.go`

**Interfaces:**
- Produces:
  - `type Lane struct { Name, URL, Key, Model string; Keys []string; Vision bool; VisionModel string; StreamOnly bool; Params map[string]any; Headers map[string]string; Public *bool; disabled bool }`
  - `func Load(path string) ([]Lane, error)` — file or builtin if missing/malformed
  - `type HTTPClient interface { Do(*http.Request) (*http.Response, error) }` (mockable everywhere)

- [ ] **Step 1: Write the failing test** — fixture JSON (dex schema + junk fields `foo: 1`, `keys: ["a","b"]`) asserts: fields land, junk ignored, `disabled` false; missing file returns builtin chain (xkiro → llm7(keyless) → openrouter).
- [ ] **Step 2: Run `go test ./internal/lane/ -v` — expect FAIL (no module).**
- [ ] **Step 3: Implement** `Load` using strict-allowed decoding (unknown fields silent).
- [ ] **Step 4: Run test — PASS.**
- [ ] **Step 5: Commit** `feat(lane): dex-compatible models.json loader with builtin chain`.

### Task 2: Key pool rotation + cooldown

**Files:**
- Create: `internal/lane/keys.go`
- Test: `internal/lane/keys_test.go`

**Interfaces:**
- Produces: `func (l *Lane) NextKey() string` (cycles `Keys` else `Key`), `func (l *Lane) CoolKey(key string, d time.Duration)`, `func (l *Lane) CoolLane(d time.Duration)`, `func (l *Lane) Available() bool`, `func (l *Lane) Until() time.Time` (max of lane/key cooldowns; time-mockable via clock injected in constructor `lane.WithClock(c clockFn)`).

- [ ] **Step 1: Failing test** — 3 keys rotate in order; `CoolKey(k0, 60s)` inside window skips k0; `CoolLane(90s)` makes `Available()` false; expired cooldowns restore.
- [ ] **Step 2: Run — FAIL.**
- [ ] **Step 3: Implement** with `sync.Mutex` + deadline map.
- [ ] **Step 4: Run — PASS.**
- [ ] **Step 5: Commit** `feat(lane): key pool rotation with cooldowns`.

### Task 3: Catalog probe + merge

**Files:**
- Create: `internal/lane/catalog.go`
- Test: `internal/lane/catalog_test.go`

**Interfaces:**
- Produces:
  - `type Model struct { ID, Lane, Owner string; Ctx int; Vision, Tools, Reasoning bool; Tier string }`
  - `func Probe(c HTTPClient, lanes []Lane) []Model` — GET `<URL>/models` per lane (`Authorization: Bearer <key>` present only when set), normalizes OpenAI model-list `{data:[{id,owned_by,...}]}`, 500ms-limited race per lane, missing/bad lanes skipped.
  - `func (m Model) JSON()` name/shape as `/v1/models` merged object.

- [ ] **Step 1: Failing test** — two fake lanes (one with key → assert no auth header on keyless one), ids merged and prefixed by lane field; dead lane ignored.
- [ ] **Step 2: Run — FAIL.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run — PASS.**
- [ ] **Step 5: Commit** `feat(catalog): probe lane /v1/models and merge`.

### Task 4: Category table + resolution

**Files:**
- Create: `internal/alias/alias.go`
- Test: `internal/alias/alias_test.go`

**Interfaces:**
- Consumes: `lane.Load` output.
- Produces:
  - `var Categories = map[string][]string` — id → lane-chain, pinned to concept.md table: flagship `[xkiro@qwen/qwen3.8-max:free, llm7@glm-5.3, openrouter@openrouter/free]`, reasoning `[xkiro@qwen/qwen3.7-max:free, openrouter@nemotron-3-ultra-550b-a55b:free, xkiro@cohere/command-a-reasoning]`, coder `[xkiro@qwen/qwen3-coder-plus:free, llm7@deepseek-v4-pro, groq@qwen/qwen3.8-27b, openrouter@cohere/north-mini-code:free]`, vision `[gemini-direct@gemini-3.8-flash, xkiro@qwen/qwen3.7-plus:free, openrouter@nvidia/nemotron-3.5-super-vl:free]`, fast `[groq@gpt-oss-120b, xkiro@qwen/qwen3.7-flash:free, llm7@GLM-5.3-Flash]`, omni `[openrouter@thinkingmachines/inkling:free]`, long `[xkiro@qwen/qwen3.8-max:free, llm7@glm-5.3]`.
  - `func Resolve(cat string, lanes []Lane) ([]ResolvedLane, error)` — `type ResolvedLane{ L Lane; Model string }`, lanes missing from the config pruned (admins can shrink, not grow); unknown → `ErrUnknown` (message lists all valid ids).
  - `var IDs []string` (display list for /v1/models + 400 body).

- [ ] **Step 1: Failing test** — `Resolve("a0/coder", cfg)` → first element is xkiro + `qwen/qwen3-coder-plus` and skips absent lanes; `Resolve("gpt-4o", _)` errors with all seven names in message.
- [ ] **Step 2: FAIL.**
- [ ] **Step 3: Implement** table + resolution.
- [ ] **Step 4: PASS.**
- [ ] **Step 5: Commit** `feat(alias): category table is the only public model surface`.

### Task 5: Relay — single-lane non-stream passthrough

**Files:**
- Create: `internal/relay/relay.go`
- Test: `internal/relay/relay_test.go`

**Interfaces:**
- Consumes: `Lane`, `lane.HTTPClient`, `alias.Resolve`+`alias.ErrUnknown`.
- Produces:
  - `type Relay struct { C HTTPClient; Lanes []Lane; Log *log.Logger }`
  - `func (r *Relay) Chat(w http.ResponseWriter, body []byte) error` — resolves request `model` via `alias.Resolve` (server pre-validated), iterates the resolved chain rewriting `model` to the lane's concrete id, injects key/extra headers/body params, forwards upstream response verbatim (status+body); writes `X-A0-Lane: <name>`; returns the error for the server layer to render 400/502.
  - `func forward(t *http.Request, l *Lane) (*http.Response, error)` unexported.

- [ ] **Step 1: Failing test** — upstream `httptest` returns 200 JSON; assert passthrough equality + `X-A0-Lane` header + `Bearer key` sent when set, absent when keyless (Review Focus 5).
- [ ] **Step 2: FAIL → implement → PASS → commit** `feat(relay): single-lane chat passthrough`.

### Task 6: SSE streaming passthrough

**Files:**
- Modify: `internal/relay/relay.go` (add `stream` branch)
- Test: `internal/relay/relay_test.go`

**Interfaces:**
- Produces: request with `"stream": true` → status 200, `Content-Type: text/event-stream`, chunks copied via `io.Copy`-equivalent byte streaming (no full-body read); flush after each read (≥512B or newline boundary via `http.Flusher`); identical chunk sequence to upstream.
- Test: upstream `Flush` with partial event then second shot tcp-split event; downstream httptest client records bytes in order — assert byte-identical (Review Focus 1).

- [ ] Failing test → FAIL → implement (single `bufio`-free `io.Copy(w, resp.Body)` with per-read `Flusher.Flush`) → PASS → commit `feat(relay): sse streaming without buffering`.

### Task 7: Catch and failover

**Files:**
- Modify: `internal/relay/relay.go` (chain loop + cooldown calls)
- Test: `internal/relay/relay_test.go`

**Interfaces:**
- Produces: `Relay.Chat` iteration: for each lane with `Available()`, one attempt; on 429/5xx/timeout/conn-refused → `CoolLane(retryAfterOr30s)`, `CoolKey(k,60s)` if 429, next lane; success returns immediately; exhausted → 502 locked body. Lane `Model` renamed into chat bodies only when request model equals lane.Model or empty.
- Tests (three):
  1. first lane 429 `Retry-After: 90` → second lane serves; then within-90s request skips first lane (cooldown key set to `Until()` so `Available()` false) — Review Focus 2;
  2. first lane sleep-2s (client ctx canceled after 10s) → chain still succeeds, second lane latency < 3s — Review Focus 3;
  3. all lanes cooled → 502 exact body `{"error":{"message":"all lanes cooling, retry later"}}`.

- [ ] Failing tests → FAIL → implement → PASS ×3 → commit `feat(relay): lane failover with retry-after cooldowns`.

### Task 8: Server routes + main + e2e

**Files:**
- Create: `internal/server/server.go`, `main.go`
- Test: `internal/server/server_test.go`

**Interfaces:**
- Consumes: `relay.Relay`, `lane.Load`, `lane.Probe`.
- Produces:
  - `func New(r *relay.Relay) http.Handler` — routes: `POST /v1/chat/completions` → alias-validate (`ErrUnknown` → 400 JSON listing `alias.IDs`) → relay; `GET /v1/models` → category list only (ids + primary-lane ctx/caps); `GET /healthz` → `{"ok":true,"lanes":N}`.
  - `main.go`: read `A0_PORT/A0_MODE`, build lanes, start `ListenAndServe`, graceful shutdown on SIGINT.
- e2e test: full server behind `httptest`, fake upstream lanes wired programmatically (serving both `/models` and `/chat/completions`), one 429-lane first, stream and non-stream both asserted through the public surface.

- [ ] Failing e2e test → FAIL → implement server+main → PASS → `go vet ./...` clean → commit `feat(server): routes, healthz, main bootstrap, e2e`.

### Task 9: Config glue + local lane wiring

**Files:**
- Create/Modify: `models.example.json` (final dex-schema + a0-extension example), `.env.example`
- Modify: `main.go` (parse `.env` via stdlib file scan, `A0_MODE` gates keyless lanes, unknown mode = local)
- Test: add to `internal/server/server_test.go` — env-missing default works, example JSON parses via `lane.Load`.

- [ ] Failing test → FAIL → implement → PASS → commit `feat(config): env defaults and example chain`.

### Task 10: Live smoke (device)

**Files:** none new — `docs`-less per preference, output only.

- [ ] Run `go run . &` with real builtin chain; `curl /healthz` (lanes≥3), `curl /v1/models | jq length > 0` (xkiro key from `.env` if user pastes; otherwise keyless llm7 only).
- [ ] Stop process, keep tree green (`go test ./...`), commit any fix discovered.
- [ ] Final commit + tag `m1-core`.

## Self-review notes

- Every lane is data (models.json) — M2 aliases/catalog cache bolt onto `Model` without touching relay.
- Byte-level SSE passthrough chosen over SSE re-serialization: zero re-parse bugs, provider quirks free such as reasoning deltas and tool-call chunks; streaming-body branch is the only place touching bytes so hot path stays one `io.Copy`.
- No global state: `Relay` and `Lane` carry their own clocks/mutexes; tests inject fake upstreams via `HTTPClient`.
