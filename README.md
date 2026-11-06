# a0

**One OpenAI-compatible endpoint. Pooled free lanes. A routing brain.**

a0 is a local, free-first inference gateway. Install it, point any OpenAI client at it, and
code with the best free models available — no signup, no card, no hosted service. It is not
an agent and it does not ship a chat UI; your client (Cline, Roo, Continue, Aider, OpenWebUI,
the OpenAI SDK) keeps doing that.

```
your client ──► http://127.0.0.1:8082/v1 ──► a0 ──► free lanes
```

## Quick start

```sh
npx a0          # first run opens the setup wizard, then serves
```

Or from source:

```sh
git clone <repo> && cd a0
node bin/a0.js
npm test
```

Then point your client at:

| setting | value |
|---|---|
| Base URL | `http://127.0.0.1:8082/v1` |
| API key | any value (`a0-local` works) |

`GET /v1/models` lists a0's categories plus every enabled raw model.

## What makes it different

A plain proxy tries lane 1, then lane 2. a0 decides before it sends:

- **Prompt enhancement.** Every request gets a short operating contract merged into its
  system message: answer, don't preamble; ground every claim; ask at most one question.
  It is idempotent and can be disabled (`a0 config` → Behaviour).
- **Capability routing.** Tool calls never go to a chat-only lane. Images never go to a
  text-only one. A 200K prompt never goes to a 32K window.
- **Race.** With `race=2`, two lanes are dispatched in parallel and a0 commits to the first
  usable first byte, then aborts the loser. A slow free lane can't stall a session.
- **Best-of.** For non-stream calls, a0 can collect several answers and keep the best by a
  small deterministic rubric (valid tool call, real code, no refusal, not truncated).
- **Cost first.** Keyless lanes are preferred. A keyed free tier is an upgrade, not a
  requirement.

## Categories

| id | use |
|---|---|
| `a0/auto` | let a0 infer the shape of the request |
| `a0/code` | agentic coding; requires tool support |
| `a0/reasoning` | hard problems; prefers the highest-quality lane |
| `a0/vision` | image input |
| `a0/fast` | short tasks; prefers low-latency lanes |
| `a0/long` | large contexts |
| `a0/cheap` | keyless lanes only |

A raw model id (for example `gpt-oss-120b`) is also accepted when that lane is enabled.

## Lanes

Keyless lanes are on by default. Keyed lanes stay off until you add a key.

| lane | default | notes |
|---|---|---|
| LLM7 | keyless | anonymous tier, ~500K tokens/day |
| Pollinations | keyless | fully keyless, text + tools |
| OpenRouter | key | free models with a free account key |
| Groq | key | free tier, very fast — the best upgrade for agentic sessions |
| Gemini | key | free project quota, best vision option |
| xKiro | key | 500K tokens/day, flagship free models |

Free lanes change and die. a0 treats the lane list as data: update it without touching code.

## TUI

```sh
a0 setup     # first-run wizard
a0 config    # change every setting interactively
a0 doctor    # check which lanes are reachable
a0 models    # list categories and lanes
```

Everything is stored in `~/.a0/config.json` with `0600` permissions. Keys are never logged
and never leave the machine.

## Add your own provider

Any OpenAI-compatible endpoint works. Add it to `~/.a0/config.json`:

```json
{
  "providers": {
    "my-lane": {
      "baseUrl": "https://api.example.com/v1",
      "key": "sk-...",
      "models": [
        {
          "id": "my-model",
          "context": 128000,
          "tools": true,
          "vision": false,
          "quality": 4,
          "fast": true
        }
      ]
    }
  }
}
```

`quality` is 1–5 relative to the free pool. `tools` and `vision` are hard capability gates —
mark them honestly or agentic clients will break.

## Security

- Binds `127.0.0.1` by default. Binding a public interface requires a token; a0 generates
  one on first launch and prints it.
- No telemetry, no accounts, no remote control plane.
- Provider terms are your responsibility. a0 only ships lanes with official free or
  anonymous endpoints, and it never proxies a reverse-engineered chatbot.

## Environment

| variable | meaning |
|---|---|
| `A0_PORT`, `A0_HOST` | listen address |
| `A0_TOKEN` | require this bearer token |
| `A0_ENHANCE` | `off` disables prompt enhancement |
| `A0_RACE` | lanes raced in parallel (1–4) |
| `A0_BEST_OF` | non-stream answers to compare (1–4) |
| `A0_LLM7_KEY`, `A0_OPENROUTER_KEY`, `A0_GROQ_KEY`, `A0_GEMINI_KEY`, `A0_XKIRO_KEY` | lane keys |

## Status

v0.1: gateway, enhancement, routing, race, best-of, TUI, tests. The old Go gateway and React
dashboard in this repository are legacy and will be removed once parity is confirmed.

## License

MIT.
