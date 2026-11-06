# a0 — Summary (run of 2026-11-06)

## Done this run
- Guided setup wizard now leads with legit free keys (Kilo, xKiro, Groq, Z.ai) and offers
  OpenRouter, MiMo, Alibaba, OpenAI, Gemini as optional, each with its key URL and steps.
- `applySetupMode`: keyless default when no keys; adding any key switches to keyed mode and
  disables the anonymous lanes; keeping them as fallback is an explicit opt-in.
- Per-model selection on keyed lanes: `cfg.providers[id].disabled` array, honoured by
  `shape()`, `activeProviders`, `catalog`, `findModel`, and the router pool. TUI
  `modelMenu` (toggle/all/none) wired as `models <n>` in the lane menu; anonymous-pool
  lanes are blocked from selection. `a0 models` and `capLine` show enabled/total counts.
- Self-updater: `src/update.js` + `a0 update [--check]` + non-blocking daily check on
  `serve` + setup/settings prompts + help text. Tests inject fetch/spawn fakes.
- Renamed the npm package from `a0` to `a0-gateway` (the `a0` name is an unrelated web
  framework on npm). Command stays `a0`.
- Rewrote TUI input as a shared line queue so pasted multi-line input is not dropped.
- Healthz now reports per-model enabled flags.
- README.md and docs/a0-brief.md updated.
- 50 tests, all green (was 32).

## In progress
- None. The agreed scope for this run is complete.

## Blocked — needs a decision
- npm publish needs a human (account access, final name confirmation for `a0-gateway`).
- Real keyed-lane verification needs the user's keys (Groq, xKiro, Z.ai, Kilo).

## Queued next
- Community skill pack (plan/debug/refactor/test/review/scaffold) as versioned markdown.
- Session stickiness keyed by client/session id.
- Lane health probing + cooldown persistence.
- Delete the legacy Go gateway and React dashboard once parity is confirmed.