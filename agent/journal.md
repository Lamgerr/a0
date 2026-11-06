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

**Next.** Session stickiness, persisted lane health, community skill pack, npm publish prep,
then delete legacy Go/dashboard. Blocked: npm account/name and real provider keys.
