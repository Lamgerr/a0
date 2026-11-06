# a0 — Master Brief

**Build a0 as a local, free-first, OpenAI-compatible inference gateway with a routing brain.**
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

- `npx a0` and `npm i -g a0`. Thin npm package that fetches the correct platform binary,
  the same pattern opencode and esbuild use.
- First run opens a TUI wizard. Default is the keyless pool. Optional is pasting keys for
  extra or faster lanes. Writes `~/.a0/config.toml`; keys stored `0600`, never logged.
- Serves `http://127.0.0.1:8082/v1`. Loopback by default; LAN requires `--host` plus a
  generated token.
- Wire: `/v1/chat/completions` (SSE, tools, vision, JSON mode, usage), `/v1/models`,
  `/healthz`. OpenAI format exactly, no dialects.
- TUI status screen: active lanes, headroom, latency, recent errors, which model served what.
- `a0 doctor` for self-diagnosis. `a0 update` to refresh the lane registry.

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

Ship a small, versioned set of markdown skills — plan, debug, refactor, test, review, scaffold —
loaded on demand and injected into the request. Community-contributable, reviewed for token
cost; every skill must earn its tokens. Skills encode procedure, not prose.

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

- Reuse a0's Go `internal/relay`, `internal/lane`, `internal/alias`. Delete the dashboard,
  Supabase, node registry, auth, and guard.
- One static binary. No runtime dependency beyond npm for delivery.
- The lane registry is data, community-maintained. Code never hardcodes secrets.
- Deterministic config; everything overridable by environment variables.

## Decisions taken (challenge these, do not silently drift)

- Streaming is the contract. Quality retries happen only before the first token.
- Terse by default is non-negotiable — it is both UX and quota strategy.
- Model swapping happens between sessions, not mid-turn.
- Fast lane first; strong lane on escalation.
