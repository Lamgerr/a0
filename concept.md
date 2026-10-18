# a0 — Concept

One OpenAI-compatible gateway that pools the usable free LLM lanes of 2026 behind a single endpoint and a dashboard. Written 2026-10-18.

## Why

Free inference exists, but it is scattered: every lane has different limits, keys, quirks, and dying models. No single free source is big alone. The product *is the pooling*: aggregate ~10 lanes, rotate keys, fail over on 429s, resolve capability to the best free model, and expose ONE endpoint any OpenAI SDK can point at. Plus a dashboard to watch it.

## Goal

- `POST /v1/chat/completions` — OpenAI wire, SSE streaming, tool calls, vision passthrough
- `GET /v1/models` — merged live catalog: friendly aliases + all raw free models
- Failover: 429/5xx/timeout rolls to the next lane honoring Retry-After, with a retry budget logged per attempt
- Key pools per lane: round-robin + 429 cooldown (multiplies free-tier limits)
- Quota ledger: tokens/req/day per lane, prefer lanes with headroom (xKiro 500K tok/day, llm7 500K anon, groq 200K tok/day …)
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

## Architecture

Python 3, FastAPI + httpx, asyncio single process (Termux-friendly), sqlite ledger.

```
a0/
├── gateway/
│   ├── adapters/        # one module per lane; normalizes to one internal request/response shape
│   ├── catalog.py       # probe lane /v1/models, normalize {lane, model, ctx, caps, tier}, cache 1h
│   ├── router.py        # alias resolution + failover chain builder (order: capability match, ctx desc, headroom)
│   ├── keys.py          # key pools per lane, cooldown state
│   ├── ledger.py        # sqlite usage/quota, nightly rollover
│   └── server.py        # FastAPI: /v1/*, /healthz, /admin/*
├── dashboard/           # Vite + React TSX + Tailwind + shadcn/ui (deploys to Vercel)
├── models.json          # runtime lane config, gitignored
├── models.example.json  # schema doc
├── tests/               # pytest; fake-lane e2e (no external nets in CI)
└── concept.md
```

Lane config reuses the dex `models.json` schema exactly (`name/url/key/model/vision/vision_model/stream_only/params/headers`) — dex's existing chain migrates unchanged, and dex's first lane can simply become `http://127.0.0.1:8082/v1` to inherit the whole pool.

Lane set: xkiro (primary, 49 free), llm7 (keyless), openrouter, groq, gemini-direct, kilo (keyless), NVIDIA NIM, gonka. Keyless lanes mean a0 answers even with zero keys.

## Supabase role

Cloud state behind the dashboard: `usage_events` (ts, lane, model, virtual_key, in_tok, out_tok, status, latency), `virtual_keys` (key_hash, name, revoked, rate window), `lane_health` (lane, ts, ok, detail). Gateway writes via service-role key, batched fire-and-forget (5s/50 events) — a Supabase outage never blocks inference. Dashboard reads via anon + RLS. Local sqlite stays the runtime truth; Supabase is the history/mirror the dashboard reads.

Frontend deploys to Vercel, talks to Supabase directly for data, to the gateway's `/v1/*` for playground calls (from the browser only when the gateway has a public hole — optional).

## Decisions already made

By the partner: OpenAI-compatible contract; Python gateway; React/TSX/Tailwind/shadcn/Supabase/Vite dashboard; xKiro key exists; free-first.

By the builder (logged): llm7's closed models (GPT-6/Claude/Grok ids) default OFF behind `A0_EXPERIMENTAL=1` and never in aliases; default port 8082, loopback-only unless given a master key; master key generated on first boot; anthropic-dialect passthrough (`/v1/messages` via xKiro) deferred to phase 2.

## Milestones

1. Gateway core: xkiro+llm7+openrouter adapters, chain failover, SSE streaming, models.json
2. Catalog + aliases + sqlite ledger (+groq, gemini, kilo adapters)
3. Dashboard: health + usage + catalog (read-only)
4. Supabase persistence + virtual keys + dashboard key management
5. Ops: `a0 doctor`, catalog self-heal, NIM/gonka adapters, deploy notes
