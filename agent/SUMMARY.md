# a0 — what happened while you were away (2026-11-06)

## DONE

**The pivot is real and v0.1 runs.** a0 is now a local, free-first, OpenAI-compatible
inference gateway — a provider, not an agent, not a hosted service.

- **Zero-dependency Node 18+ ESM package.** Go toolchain isn't installed here, and npm is the
  delivery target, so rewriting the core in Node was the only path that could actually be
  built and tested. Old Go gateway + React dashboard are untouched legacy, to delete at parity.
- **Shipped modules:** `config` (0600 JSON), `registry` (lanes as data), `classify` (vision /
  tools / long-context / difficulty), `enhance` (idempotent operating contract on every
  request), `router` (hard capability gates + scoring + provider diversity), `relay`
  (streaming race + non-stream best-of + failover), `server` (OpenAI wire, SSE, CORS,
  optional token), `tui` (setup / settings / lanes / doctor), `cli`.
- **28 tests green**, including fake-upstream failover, streaming race, best-of selection,
  enhancement idempotency, capability routing, auth, and config permissions.
- **Live smoke passed:** keyless default pool returned a completion in ~2.8s through LLM7;
  `a0/code` SSE streaming passed through chunk-by-chunk.
- **Docs:** `README.md`, `docs/a0-brief.md`, MIT `LICENSE`.

## IN PROGRESS

- Session stickiness (one model per client session) is a config flag, not yet enforced.
- Lane health/cooldown is per-process only; nothing persists between runs.

## BLOCKED — needs a human

- **npm publish.** Needs account access and a final name. `a0` is short and likely taken;
  decide between the bare name, `a0-cli`, or a scope.
- **Keyed lanes.** Groq / Gemini / OpenRouter / xKiro are wired but unverified without keys.

## QUEUED NEXT

1. Community skill pack (plan, debug, refactor, test, review, scaffold), loaded on demand.
2. Session stickiness + persisted lane health/cooldown.
3. Live status view in the TUI while the server runs.
4. Parity check, then delete the legacy Go/dashboard tree.
5. Publish to npm with a one-command `npx a0` install.
