# a0 — Master Brief

**Build a0 as a local, self-hosted, OpenAI-compatible inference gateway.**
Not an agent. Not a chat UI. Not a hosted service.

## Who it is for

Vibe coders who already use an agentic client — Cline, Roo, Continue, Aider, OpenWebUI —
and do not want to spend their month's budget on inference. They install with npm, answer
two or three setup questions, and never think about providers again.

## The promise

- **$0 by default.** Keyless free lanes work on first run. No signup, no card.
- **Reliable.** A lane dying mid-session is a0's problem, not the user's.
- **Fast enough to feel local.** Terse outputs, few turns, a fast lane for iteration.
- **Better answers than a raw free model.** Routing, grounding, and verification — not magic.

Be honest about the ceiling: a0 cannot make a weak model strong. It can stop wasting strong
models on weak tasks, stop routing to lanes that cannot serve the request, and stop the
client from drowning in prose.

## Non-goals

- No built-in agent loop, no file editing, no tool orchestration of its own. The client does that.
- No hosted instance, no accounts, no auth, no billing, no multi-tenancy.
- No reverse-engineered chatbot lanes. Only official free or anonymous endpoints.
- No long-form chat. a0 is optimized for code, not essays.

## Surface

- `npx a0-gateway` and `npm i -g a0-gateway`. Plain zero-dependency ESM; the package name is
  `a0-gateway` because `a0` is an unrelated npm package. The command is still `a0`.
- First run opens a TUI wizard that recommends legit free keys (Kilo, xKiro, Groq, Z.ai);
  skipping every key leaves the keyless pool as the working default. Writes
  `~/.a0/config.json`; keys stored `0600`, never logged.
- Serves `http://127.0.0.1:8082/v1`. Loopback by default; LAN requires `--host` plus a
  generated token.
- Wire: `/v1/chat/completions` (SSE, tools, vision, JSON mode, usage), `/v1/models`,
  `/healthz`. OpenAI format exactly, no dialects.
- TUI status screen: active lanes, keyed vs anonymous, model counts, recent errors.
- `a0 doctor` for self-diagnosis. `a0 update` checks npm and installs the latest release.
- Per-model selection for keyed lanes; anonymous-pool models stay curated by a0.

## The intelligence layer — this is the product

1. **Capability gating.** A lane is eligible only if it can serve the request: tool calling,
   vision, minimum context, JSON mode. Never route a tool call to a chat-only lane.
2. **Task routing.** Classify the request — code edit, reasoning, vision, long context,
   quick fix — and pick the cheapest lane that clears the bar. Prefer fast lanes for small tasks.
3. **Session stickiness.** One model per session by default: prompt-cache hits, consistent
   behavior, fewer surprises. Swap between sessions, not mid-turn.
4. **Escalation before the first byte.** Stream by default. Detect failure before emitting —
   empty output, malformed tool call, truncation, repetition, refusal — and retry on a stronger
   lane. Never retry after bytes have been sent. Never substitute models inside a turn.
5. **Grounding.** Read before editing. Grep before assuming. Never invent APIs, files, or flags.
   Fewer correct turns beat many speculative ones.
6. **Verification.** After code changes, run the project's typecheck or tests if present. Feed
   failures back once, then stop and report.
7. **Quota awareness.** Track per-lane headroom, steer away from exhausted lanes, honor
   `Retry-After`, and expose the attempt log when something fails.

## Output discipline

Default terse: no preamble, no restating the question, no code echo, no "here is what I did",
no trailing summary unless asked. Diffs over full files. At most one clarifying question, and
only when the task is genuinely ambiguous. Short replies are a feature: less latency, less
quota burned, less noise for the client.

## Agentic skill pack

v0.1 ships the core operating contract (terseness, grounding, one-question limit, tool-call
discipline). The next step is a small, versioned set of markdown skills — plan, debug,
refactor, test, review, scaffold — loaded on demand. Community-contributable, reviewed for
token cost; every skill must earn its tokens. Skills encode procedure, not prose.

## Reliability contract

- Every failure names the lanes tried, their status codes, and the next action.
- Degrade loudly: if only weak lanes remain, say so in the response metadata and the TUI.
- No silent substitution, no silent truncation, no silent downgrade.

## Success metrics — validate, do not assume

- Zero-key first successful completion under 60 seconds after install.
- At least 95% of requests complete without a 429 reaching the client.
- Tool-call validity at least 98% in tool-capable sessions.
- p50 time-to-first-token under 2 seconds on the fast lane.
- Median session cost: $0.

## Build constraints

- Node 18+ ESM, **zero runtime dependencies**. Distribution is a plain npm package with a
  `bin` entry; no platform binaries, no postinstall download.
- The lane registry is data, community-maintained. Code never hardcodes secrets.
- Deterministic config at `~/.a0/config.json` (`0600`); everything overridable by env.
- The old Go gateway and React dashboard are reference only. They are deleted once the Node
  implementation reaches parity.

## Decisions taken (challenge these, do not silently drift)

- Setup leads with **keyed** free-tier providers: Kilo, xKiro, Groq, Z.ai. OpenRouter, MiMo,
  Alibaba, OpenAI, and Gemini are optional and marked not recommended for free use because
  their limits or model access are weaker or less predictable.
- Adding at least one key switches a0 to **keyed mode** and disables the anonymous lanes.
  Keeping them as a fallback is an explicit opt-in. With no keys, a0 runs keyless.
- a0 **does** modify requests: it merges an operating contract into the system message on
  every call, idempotently, and it can be disabled.
- Streaming is the contract. Quality retries happen only before the first token.
- `race=2` by default: two lanes in parallel, first usable byte wins, loser aborted.
- Best-of is available for non-stream calls but defaults to off — it multiplies quota burn.
- Terse by default is non-negotiable — it is both UX and quota strategy.
- Model swapping happens between sessions, not mid-turn.
- Per-model selection is stored as a `disabled` array per provider, only for lanes with a key.
  Anonymous-pool models cannot be selected: the pool is part of the routing brain.
- Updates are check-only by default (once a day, non-blocking). `a0 update` installs; automatic
  install is an explicit opt-in. The updater targets `a0-gateway`, never the unrelated `a0`.
- No auth by default; a token is generated automatically when binding beyond loopback.
- MIT license.
