## 2026-10-18
- Cold start on a0 (new project). User: OpenAI-compatible inference provider over free providers.
- Requested deep recon: verified vs cheahjs list, OmniRoute FREE_TIERS, gravity.fast, freellm.net. Graveyard noted (GitHub Models retired 2026-07, chutes free ended, glhf/kluster/phind dead, cerebras now trial-only).
- User set up xKiro (api.xkiro.com, key in ~/dex). Probed live: 49 free chat models, 1M ctx, vision+tools+reasoning. dex config.py already runs a 4-lane chain (xkiro->llm7->openrouter->gonka) — a0 generalizes it.
- Curated catalog per role (flagship/reasoning/coder/vision/fast/omni) with fallback chains; exclusions logged (soon-retiring models; llm7 closed models default-off is my call).
- User picked: Python gateway + Vite React TSX Tailwind shadcn Supabase dashboard; "no docs, only a single concept.md".
- Wrote concept.md. Next: builder-check subagent, then approval gate.
## 2026-10-18 (M1 finish)
- Task 8: rebuilt server_test.go cleanly (fakeLanes 429+ok upstreams, do() helper), server.go (mux pattern routes, category-only /v1/models with primary ctx/caps, unknown model -> 400 w/ category list, 404 fallback), main.go bootstrap + graceful shutdown. healthz key-order lesson: parse JSON not string-compare. 6/6 pass. main.go commit split (routes vs bootstrap).
- Task 9: caught schema drift — example "parameters" vs loader Params (untagged). Standardized on lowercase dex-style json tags everywhere. Then found Task 9 under-implemented: added parseEnvFile (existing environ wins, quoted values, inline comments) + A0_MODE gating with HasKey; test taught me unknown-mode-must-be-local, so gate only applies for known "public" mode; A0_EXPERIMENTAL truthy.
- Task 10 live smoke (device): wrote .env (gitignored) with xkiro key from dex config. go build + run: healthz {"lanes":3,"ok":true}, 7 categories, unknown->400, real chat via a0/coder -> qwen3-coder-plus:free reply "wing-live-ok" X-A0-Lane:xkiro, SSE stream ok via a0/fast -> qwen3.7-flash:free. Tagged m1-core.
- Fresh-context review: FIX FIRST. Biggest: attempt() returned false mid-committed-stream → chain appended lane2/502 into live 200. Now: after commit, always consume-the-shot (true). Body cap 1MB + 413. Null chain entries -> sanitize (namesake malformed -> builtin contract upheld). Per-key availability (max-of-cools bug defeated key pool). resp.Close on Do-error path. rename() UseNumber. Clock race closed transitively (all nowish() call sites hold mu now).
- Debug lesson: httptest hijack-fake-die test — must Hijack FIRST and raw-write; a pre-hijack WriteHeader frames raw bytes inside the managed response ("invalid byte in chunk length").
- Hydra terminals: tag name == branch name m1-core → ambiguous refname; pushed refs/heads and refs/tags explicitly; remote tag points at bd52ad6.
- Ledger note: -race impossible here (android/arm64); pinned as CI-only check. progress.md carries the full deferred list for M2 backlog.

## 2026-10-18 (M2 start — dashboard on squidcloud design system)
- M1 merged to main (7b0bef5), tag m1-core stays for the review-fix point.
- User directive: skip docs, copy ~/cloudbliss-storage-fresh-main UI shell (squidcloud/Lovable stack: Vite+React18+Tailwind3+shadcn+supabase+react-query+recharts+framer-motion), strip pages/business, build a0 frontend on top. a0 is a squidcloud product.
- Transplant: copied whole src + configs → deleted all pages/, domain components (kept ui/ 66 comps + motion + ErrorBoundary/Loader/ThemeToggle), contexts (kept ThemeContext only), hooks (kept 5 generic), libs (utils/motion/icon-map).
- Rewrote: main.tsx, App.tsx (router: / /auth /dashboard{,keys,usage,models,nodes} auth-gated via ProtectedLayout), AuthContext (supabase auth, env-gated), integrations/supabase client+types (handwritten a0 schema, no codegen).
- a0 pages: landing (hero/endpoint/categories), auth (signin/signup), overview (stats+snippet), keys (mint/revoke, secret shown once, hashing), usage (recharts demo series), models (category chains), nodes (mint NODE_ID+CONTROL_TOKEN env, M4 wiring pending). Footer: "a0 — a squidcloud product".
- Portability traps on android/aarch64: @swc/core has no native binding → swapped to @vitejs/plugin-react (babel); plugin-react v5 needs vite>=6 → pinned 4.7.0. tsc --noEmit clean immediately; production build green (bundle 1GB → gzip 315KB).
- Committed 080f06d + b66eb2c (migrations + env), pushed main. dist/node_modules gitignored.
- Supabase MCP still shows 0 orgs / 0 projects → cannot create or wire a project from here; migration wait: 0001_control_plane.sql (virtual_keys w/ sha256+prefix+RLS, usage_events tenant-scoped reads, lane_health public-read, nodes registry). Once user supplies VITE_SUPABASE_URL/ANON (Vercel env or .env.local) the panel goes live against "a00" or new project.
- Dev server verified: http://localhost:8080 200.
## 2026-10-18 (MCP unlocked → a00 wired)
- MCP finally sees "NaveenSingh9999's Org" + project a00 (opcslzfwreblnrszvgii, ap-northeast-1, PG17, created today). Also inflatestore (old, untouched).
- Applied 0001_control_plane.sql via MCP (virtual_keys/usage_events/lane_health/nodes + RLS). URL https://opcslzfwreblnrszvgii.supabase.co; publishable anon key captured.
- Security lints: pre-existing rls_auto_enable() SECURITY DEFINER callable by anon/authenticated → revoked EXECUTE from anon+authenticated, kept postgres/service_role. Panels lint re-run for confirmation later.
- dashboard/.env.local with VITE_SUPABASE_* → build bakes URL (ENV_BAKED_OK). .gitignore now covers **/.env.local (!.env.example). Pushed 5d1f74e6.
- TODO: create a test user via auth signup to validate RLS policies round-trip; supabase auth email templates still default.

## 2026-11-06 — pivot: provider, not agent; Node rewrite; v0.1 runs

**What changed.** The user rejected the terminal-agent reading and re-scoped a0 to a local,
free-first OpenAI-compatible provider with a TUI setup screen, distributed via npm, no auth,
no hosted instance. Then asked to start coding. `docs/a0-brief.md` is the canonical brief.

**Why Node, not Go.** `go` is not installed in this environment, and npm is the stated
delivery channel. A Go core behind an npm wrapper would need a platform-binary matrix and
could not be built or tested here. Zero-dependency ESM on Node 18+ ships as plain JS, runs
from `npx`, and lets the TUI be trivial. The old Go relay/lane/alias logic was used as a
reference for semantics, not copied.

**What was built.** config, provider registry, request classifier, idempotent prompt
enhancer, capability router, racing relay (stream race + non-stream best-of + failover),
OpenAI-wire HTTP server, TUI, CLI, tests, README, MIT license. 28 tests pass.

**Calls I made (challenge if wrong).**
- Enhancement is on by default and merges into the first system message; idempotent via a
  marker. This is the answer to the earlier "transparent proxy?" question: a0 does modify.
- `race=2` by default: two lanes in parallel, first usable first byte wins, loser aborted.
  Best-of defaults to 1 because fan-out multiplies free-tier quota burn.
- Capability gates are hard. No tool call to a chat-only lane; no image to a text-only lane.
  If nothing eligible exists, return a named error that tells the user which key to add.
- Streaming is the contract. No retry after bytes are sent; in-band error if a stream breaks.
- Terse output is enforced by the contract and a conservative non-stream cleaner.
- Loopback default; a token is generated automatically when binding beyond loopback.
- MIT for adoption. Package name still unresolved (npm `a0` may be taken).

**Verified.** Unit + fake-upstream e2e tests; live keyless smoke against LLM7 (non-stream
completion ~2.8s, SSE streaming passthrough for `a0/code`); CLI help/models/version.

## 2026-11-06 — guided setup, per-model selection, self-updater, package rename

**What changed.** Finished the three items left open in the previous entry:

1. Guided setup now leads with legit free keys (Kilo, xKiro, Groq, Z.ai) and offers
   OpenRouter/MiMo/Alibaba/OpenAI/Gemini as optional, each with its key URL and steps.
   `applySetupMode` (in src/setup.js) switches to keyed mode when any key is added and
   disables the anonymous lanes; keeping them as fallback is an explicit opt-in. With no
   keys, a0 runs keyless. `preferKeyless` defaults to false now.

2. Per-model selection. `cfg.providers[id].disabled` (array of model ids) is applied in
   `shape()` → `model.enabled`. `activeProviders`, `catalog`, `findModel`, and the router
   `pool` all skip disabled models. `src/tui.js` gained `modelMenu(cfg, p)` (toggle/all/none,
   with a guard against disabling the last model on a keyed lane) wired into providerMenu as
   `models <n>`; anonymous-pool lanes (keyless without a key) are blocked with a message.
   `capLine` and `a0 models` show enabled/total counts and mark disabled models.

3. Self-updater. `src/update.js`: `compareVersions`, `checkLatest`, `installLatest`,
   `maybeCheck` (daily, non-blocking). CLI gained `a0 update [--check]`; `serve` runs
   `maybeCheck` in the background; setup and settings menus prompt for auto-check /
   auto-install; help documents it. Tests inject fetch/spawn fakes.

**Discovery during the run.** `a0` is already an unrelated web framework on npm (v1.0.0).
Installing or updating would have pulled the wrong package. Renamed the npm package to
`a0-gateway` (still free on npm, 404 confirmed) while keeping the command `a0`. Updated
`PACKAGE` default, package.json, README, and the brief. The updater now targets
`a0-gateway` exclusively.

**TUI fix.** The per-question readline approach dropped buffered lines when each interface
closed, so pasted multi-line scripts only ran the first line. Replaced it with a single
readline interface feeding a line queue (`ensureReader`/`readLine`), which works for both
interactive typing and piped input. `promptSecret` pauses/closes the reader for raw mode and
reopens it after.

**Verification.** `npm test` → 50 pass (was 32). PTY-driven end-to-end test: toggled a
Groq model off via `models 5` → `toggle 1`, persisted `disabled: ["gpt-oss-120b"]`,
confirmed the anonymous-pool block for Kilo, and `a0 models` renders it as `(off)`.
Serve smoke: `/healthz` 200 with 11 lanes. `a0 update --check` now targets `a0-gateway`
and fails gracefully (404) until published.

**Calls I made (challenge if wrong).**
- Package name `a0-gateway` over `a0-llm-gateway`/`a0-inference`: shorter, matches the
  product, and the command stays `a0`.
- Model selection is allowed only on lanes with a key; anonymous-pool lanes are curated by
  a0. This matches the user's "except anonymous pool models" rule and keeps the pool as
  the routing brain.
- Disabling all models on a keyed lane is blocked in the TUI (would make the lane dead);
  the underlying config still allows it for power users.
- Updates are check-only by default and never auto-install unless opted in, because
  replacing a running global npm install mid-session is surprising.
- Did not publish or touch prod; npm publish still needs a human.

**Next.** Publish prep (account/name), community skill pack, session stickiness keyed by
client id, lane health persistence, then delete the legacy Go gateway and React dashboard.
Blocked: npm account access and the user's real provider keys.
