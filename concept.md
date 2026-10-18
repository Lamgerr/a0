# a0 — Concept

One OpenAI-compatible gateway that pools the usable free LLM lanes of 2026 behind a single endpoint and a dashboard. **Public multi-tenant service.** Written 2026-10-18, revised for public scope same day.

## Why

Free inference exists, but it is scattered: every lane has different limits, keys, quirks, and dying models. No single free source is big alone. The product *is the pooling*: aggregate ~10 lanes, rotate keys, fail over on 429s, resolve capability to the best free model, and expose ONE endpoint any OpenAI SDK can point at. Plus a dashboard to watch it.

## Goal

- **Categories are the product.** Users never pick raw models — `/v1/models` exposes only a0 categories (`a0/flagship`, `a0/reasoning`, `a0/coder`, `a0/vision`, `a0/fast`, `a0/omni`, `a0/long`); requests with any other model id get 400 + the valid list; each category rides a built-in lane chain (below) where chain order is the failover. Raw `vendor/model` passthrough is admin-key-only.
- `POST /v1/chat/completions` — OpenAI wire, SSE streaming, tool calls, vision passthrough
- `GET /v1/models` — merged live catalog: friendly aliases + all raw free models
- Failover: 429/5xx/timeout rolls to the next lane honoring Retry-After, with a retry budget logged per attempt
- Key pools per lane: round-robin + 429 cooldown (multiplies free-tier limits)
- Quota ledger: tokens/req/day per lane, prefer lanes with headroom (xKiro 500K tok/day, llm7 500K anon, groq 200K tok/day …), per-key caps applied on top
- Keyless mode: works with zero keys (kilo gateway 200 req/hr, llm7 anonymous, pollinations, ovh)
- Self-healing catalog: probes every lane's `/v1/models` hourly, drops retired models silently, surfaces drift in dashboard
- Dashboard: lane health, usage graphs, virtual keys, model catalog, quick playground

## Anti-goals (failure conditions)

- Serving a retired model without notice (catalog drift must be visible)
- A 500 that doesn't say which lanes were tried and why
- Keys committed to git; secrets live in `.env` (gitignored) only

## Non-goals

- No billing, no multi-tenant marketplace, one owner
- No local model hosting — it routes, doesn't run
- No reverse-engineered chatbot lanes — ToS-clean providers only

## The catalog (verified Oct 2026)

xKiro is the spine: 49 free chat models, most at 1M ctx with vision+tools+reasoning.

| Alias | Primary | Fallback chain |
|---|---|---|
| a0/flagship | xkiro `qwen/qwen3.8-max:free` (1M, vision+tools+reasoning) | llm7 `glm-5.3` → openrouter `openrouter/free` |
| a0/reasoning | xkiro `qwen/qwen3.7-max:free` | openrouter `nemotron-3-ultra-550b-a55b:free` (1M) → xkiro `cohere/command-a-reasoning` |
| a0/coder | xkiro `qwen/qwen3-coder-plus:free` (1M coder) | llm7 `deepseek-v4-pro` → groq `qwen/qwen3.8-27b` (2M tok/day) → openrouter `north-mini-code:free` |
| a0/vision | Google direct `gemini-3.8-flash` (1M, multimodal) | xkiro `qwen/qwen3.7-plus:free` → openrouter `nemotron-3.5-super-vl:free` (1M, video) |
| a0/fast | groq `gpt-oss-120b` (30 RPM speed demon) | xkiro `qwen/qwen3.7-flash:free` → llm7 `GLM-5.3-Flash` |
| a0/omni | openrouter `thinkingmachines/inkling:free` (1M, audio-in) | openrouter `nemotron-3-nano-omni-30b` → llm7 Voxtral |

Raw `vendor/model` passthrough always available. Excluded: poolside laguna (dies Oct 31), dots-3-note (Dec 31), llm7's closed models (default off, below).

## Architecture — three tiers, Pterodactyl-style

**Vercel (panel UI) · Supabase (panel brain) · Go gateways (wings).** The panel never proxies inference: wings do the work, the panel manages them. Multiple gateways attach over time without code changes.

- **Frontend on Vercel** — Vite + React TSX + Tailwind + shadcn. Reads/writes Supabase via anon + RLS. Nothing else runs here.
- **Supabase = central control plane** — users (Auth), virtual keys, usage history, quota state, and the **node registry**: which gateways exist, their URLs, heartbeats, lane-pool state, capacity. Panels talks to wings; wings register themselves.
- **Go gateways ("wings")** — N instances, each a single static binary serving `/v1/*` (categories, streaming, failover, key rotation). Holds its own lane secrets in local `models.json`; validates user keys via its 60s cache from Supabase; reports usage/health batched. The dashboard is the only TS in the repo.

**Node attachment flow (add a gateway without hassle):**
1. Dashboard → "Add node" → panel mints `NODE_ID` + one-time `CONTROL_TOKEN`.
2. Run the gateway with those env vars on any box (VPS, Fly.io, Termux).
3. On boot it self-registers: probes lanes, POSTs catalog + capacity to Supabase, heartbeats every 30s.
4. Live in the dashboard. Decommission = revoke node; users barely notice because nodes are interchangeable.

Nodes hold no state except secrets in `models.json` — any node serves any user.

```
a0/
├── gateway/             # Go: adapters/, catalog.go, router/ (alias+failover), keyring.go, ledger.go, server.go
├── dashboard/           # Vite + React TSX + Tailwind + shadcn/ui (deploys to Vercel)
├── models.json          # runtime lane config, gitignored
├── models.example.json  # schema doc
├── tests/               # go test + fake-lane e2e (no external nets in CI)
└── concept.md
```

Lane config reuses the dex `models.json` core schema (`name/url/key/model/vision/...`) plus a0 extensions (`keys: []` pools, `public:` flag, `quota:` constants) — dex's loader whitelists known fields and ignores a0's extras (verified).

Lane set: xkiro (primary, 49 free), llm7 (keyless, local-only), openrouter, groq, gemini-direct, kilo (keyless, local-only), NVIDIA NIM, gonka.

## Public service model

- **Auth: Supabase is runtime truth.** Virtual keys, users, quota all live in Supabase (Postgres + Auth); the gateway keeps an in-memory key cache with 60s TTL, so revocation lags at most a minute and the hot path never blocks on a select.
- **Free tier per key:** ~20 RPM / 2,000 req/day default, tunable per key. Dashboard-only signup (email via Supabase Auth), no anonymous public lane by default.
- **`public:` flag per lane.** Only lanes whose ToS tolerates fronting are served publicly; ToS-fragile lanes (llm7 "experimentation", NIM "prototyping") are owner-key-only. Keyless lanes exist only when running locally (`A0_MODE=local`).
- **Abuse caps:** global circuit breakers per lane (pool daily token budget) so one tenant can't burn the whole free pool; hard stop → 503 with retry-after, dashboard shows pool state.
- **Dex unchanged:** dex's lane 1 keeps pointing at a0, just with a virtual key now.

## Supabase role (-expanded for public)

Cloud state IS the service state: `users` (via Supabase Auth), `virtual_keys` (key_hash, name, revoked, rpm, daily_cap), `usage_events` (ts, lane, model, virtual_key, in_tok, out_tok, status, latency), `lane_health` (lane, ts, ok, detail). Gateway writes usage batched fire-and-forget; reads keys/quota through its in-memory cache. Dashboard (Vercel) talks to Supabase directly via anon + RLS for everything except playground calls, which go to the public `/v1/*`.

## Deploy

Wings = single Go binary/container on any free host (Fly.io free machine, existing bot-hosting VPS, Termux), TLS via host platform. Local mode (`A0_MODE=local`) = same binary on Termux; keyless lanes on; Supabase optional. The first wing IS the dev instance — more attach via the node flow above.

## Decisions (builder — logged, revised for public)

- Go gateway; Python share with dex is dropped — integration is plain HTTP.
- llm7's closed model ids (GPT-6/Claude/Grok) default OFF behind `A0_EXPERIMENTAL=1`, owner-only, never in public aliases.
- Default port 8082; public bind requires a valid Supabase service key present.
- Anthropic-dialect passthrough (`/v1/messages` via xKiro) deferred to phase 2.
- Provider ToS review is a hard gate per lane before flipping `public: true`.

## Open questions resolved (builder round 1)

- **Virtual keys — Supabase is runtime truth** (public scope); request-time validation uses the gateway's 60s in-memory cache, so revocation lags at most a minute and never blocks inference. In local mode, an embedded fallback (sqlite copy) keeps localhost tools working when offline.
- **Dashboard at m3 reads a thin read-only layer over gateway `/admin/*`**; Supabase-backed reads arrive with m4 when public auth ships.
- **models.json stays dex-compatible.** dex's loader (~/dex/config.py `_load_model_pool`) whitelists known fields and silently drops unknown ones — verified — so a0 extends the *same file* with key pools (`keys: [...]`), cooldown and quota constants; dex never chokes on them.
- **xKiro's `/v1/models` is public and probeable** (live-verified 2026-10-18: 49 free chat models with access_tier/capabilities/context) — the hourly self-heal hangs on it as designed. Other lanes' catalogs are normalized the same way.
- **Known quota constants (rpm/rpd/tok-day):** xkiro 500K tok/day (agent-gateway free tier), llm7 500K tok/day anon (1M with free email token), openrouter 20 rpm / 50 rpd (1,000 after one-time $10), groq 30 rpm / 1K rpd / 200K tok-day, kilo ~200 req/hr per IP, NIM up to 40 rpm, gemini unpublished (per-project console). gonka/gemini constants unknown — the ledger learns them empirically at runtime.
- **Keyless lanes are shared per-IP buckets, not multiplied** — kilo/pollinations/ovh/llm7-anon quota is one bucket per machine IP, so key pools only apply to keyed lanes.
- **keys on this machine today:** xKiro (set, in dex config) and OpenRouter (set, in dex config); llm7 works anonymously; groq/gemini/kilo/NIM/gonka absent — their chains validate live during the build, the rest via fake-lane e2e.

## Decisions already made

By the partner: OpenAI-compatible contract; **Go gateway, public service**; React/TSX/Tailwind/shadcn/Supabase/Vite dashboard; xKiro key exists; free-first.

By the builder (logged): llm7's closed models (GPT-6/Claude/Grok ids) default OFF behind `A0_EXPERIMENTAL=1` and never in aliases; default port 8082, loopback-only unless given a master key; master key generated on first boot; anthropic-dialect passthrough (`/v1/messages` via xKiro) deferred to phase 2.

## Milestones

1. Gateway core (Go): xkiro+llm7+openrouter adapters, chain failover, SSE streaming, models.json, local mode
2. Catalog + aliases + in-process usage ledger (+groq, gemini, kilo adapters)
3. Dashboard: health + usage + catalog (read-only, via gateway `/admin` read layer)
4. Node protocol: Supabase control plane + node registry + registration/heartbeat/usage endpoints + key cache
5. Public: Supabase Auth + virtual keys + per-key caps + `public:` lane gating + dashboard deploy
6. Ops: `a0 doctor`, catalog self-heal, NIM/gonka adapters, abuse circuit breakers, deploy notes
