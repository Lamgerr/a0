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
npx a0-gateway  # guided setup on first run, then serves
```

Or install it once:

```sh
npm install -g a0-gateway
a0              # same thing, shorter
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

## Setup: keys first, keyless as the fallback

a0 works with no account at all. But anonymous quota is shared per IP and has tighter
limits, so setup recommends adding **legit free-tier keys** first. If you add at least one
key, a0 runs in **keyed mode** and turns the anonymous lanes off. If you skip every key, it
runs in **keyless mode** with the anonymous pool. Both modes are one setting away in
`a0 config`.

The wizard walks you through each provider, with the key URL and the actual free limits:

### Recommended

| provider | why | get a key |
|---|---|---|
| **Kilo Gateway** | `:free` models, 200 req/hr anonymous, a key raises limits | [app.kilo.ai](https://app.kilo.ai) |
| **xKiro** | 45 free models, 500K tokens/day (1M after Telegram) | [xkiro.com/register](https://xkiro.com/register) |
| **Groq** | free tier, the fastest lane — best upgrade for agentic sessions | [console.groq.com/keys](https://console.groq.com/keys) |
| **Z.ai** | GLM-5.3-Flash: 1M context, vision + tools, strong coding | [z.ai API keys](https://z.ai/manage-apikey/apikey-list) |

### Optional — free tiers exist, but are tighter or less predictable

| provider | caveat | get a key |
|---|---|---|
| OpenRouter | ~50 free requests/day without credit | [openrouter.ai/keys](https://openrouter.ai/keys) |
| MiMo | limited quota; verify the model id | [platform.xiaomimimo.com](https://platform.xiaomimimo.com) |
| Alibaba DashScope | region-limited, expiring free quota | [Bailian console](https://bailian.console.alibabacloud.com/) |
| OpenAI | no free tier | [platform.openai.com](https://platform.openai.com/api-keys) |
| Gemini | free project quotas are opaque and change | [AI Studio](https://aistudio.google.com/apikey) |

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
- **Free first.** Keyless is the default until you add a key; after that, your keyed lanes
  are primary and the anonymous pool is optional fallback.

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

## Pick your models

Every keyed lane exposes its model list in `a0 config` → **Lanes, keys, and models** →
`models <n>`. Toggle individual models, or use `all` / `none`; the choice is stored per lane
as a `disabled` list and survives restarts. Disabled models disappear from `GET /v1/models`
and are never routed to, even when a client names them explicitly.

Anonymous-pool models (LLM7, Pollinations, and Kilo without a key) are curated by a0 and are
not individually selectable. Add a key for a provider that offers one to take control of its
catalog.

## Stay current

Free lanes change fast, so a0 can keep itself current:

```sh
a0 update          # check npm, then install the latest release
a0 update --check  # report only
```

On startup a0 checks npm at most once a day, without delaying the server. It only prints a
notice by default; set `updates.autoInstall` in `a0 config` → **Updates** to install
automatically. Either way, restart the process to run the new version.

## TUI

```sh
a0 setup     # guided key + lane setup
a0 config    # change every setting interactively
a0 doctor    # check which lanes are reachable
a0 models    # list categories and lanes
a0 update    # check for and install a newer release
```

Everything is stored in `~/.a0/config.json` with `0600` permissions. Keys are never logged
and never leave the machine.

## Add your own provider

Any OpenAI-compatible endpoint works. Add it interactively via `a0 config` → **Add provider**,
or by hand in `~/.a0/config.json`:

```json
{
  "providers": {
    "my-lane": {
      "baseUrl": "https://api.example.com/v1",
      "key": "sk-...",
      "tier": "optional",
      "keyless": false,
      "label": "My Lane",
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

You can also add individual models to an existing lane via `a0 config` → **Add model**,
or by appending to the `models` array in the config.

### Built-in providers

a0 ships with 46 providers out of the box, including:

- **Recommended free keys**: Kilo Gateway, xKiro, Groq, Z.ai
- **Optional**: OpenRouter, MiMo, Alibaba DashScope, OpenAI, Gemini, Anthropic, Mistral,
  Cohere, DeepSeek, Together, Fireworks, Perplexity, Cerebras, SambaNova, Novita,
  SiliconFlow, Moonshot, MiniMax, StepFun, NVIDIA NIM, Hyperbolic, DeepInfra, Nebius,
  AI21, Hugging Face, Replicate, Cloudflare, Lepton, Anyscale, xAI, 01.AI, Baichuan,
  InternLM
- **Keyless**: LLM7, Pollinations
- **Local**: Ollama, LM Studio, vLLM, llama.cpp server

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
| `A0_PACKAGE` | npm package used by the updater (default `a0-gateway`) |
| `A0_KILO_KEY` | Kilo Gateway key |
| `A0_XKIRO_KEY` | xKiro key |
| `A0_GROQ_KEY` | Groq key |
| `A0_ZAI_KEY` | Z.ai key |
| `A0_OPENROUTER_KEY` | OpenRouter key |
| `A0_MIMO_KEY` | MiMo key |
| `A0_ALIBABA_KEY` | Alibaba DashScope key |
| `A0_OPENAI_KEY` | OpenAI key |
| `A0_GEMINI_KEY` | Google Gemini key |
| `A0_LLM7_KEY` | optional LLM7 token (raises the anonymous limit) |

## Status

v0.1: gateway, enhancement, routing, race, best-of, guided TUI setup, per-model selection,
self-update, tests. The old Go gateway and React dashboard in this repository are legacy and
will be removed once parity is confirmed.

## License

MIT.
