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
