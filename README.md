# a0

## The problem

You use a coding agent — Cline, Roo, Continue, Aider, or the OpenAI SDK.
Every agent needs an LLM behind it, and you hit the same wall every time:

- **It costs money.** A real coding session burns through API credit fast.
- **You need an account.** Every provider wants a signup, a card, or both.
- **No single provider is good at everything.** One is fast, one is smart, one takes images, one has a big context window. You end up picking one and living with its limits.
- **Free tiers break.** Rate limits, dead endpoints, models that vanish overnight. Your session stops in the middle of a task.
- **You manage it by hand.** You decide which model to use, and when it fails, you switch by hand.

a0 exists to remove all of that.

## What a0 is

a0 is a small server you run on your own machine. It takes requests from your coding agent, decides which LLM provider should answer, sends the request there, and streams the answer back.

```
your agent ──► http://127.0.0.1:8082/v1 ──► a0 ──► 46+ providers
```

Your agent does not talk to OpenAI, Groq, or anyone else directly. It talks to a0. a0 talks to everyone else.

It is not an agent, not a chat app, and not a hosted service. It is the piece between your agent and the models.

## Install

```sh
npm install -g a0-gateway
a0
```

First run opens a setup wizard. It asks which providers you want and walks you through getting free keys. Skip everything and a0 still works with no keys at all.

Then point your agent at:

| setting  | value                          |
|----------|--------------------------------|
| Base URL | `http://127.0.0.1:8082/v1`     |
| API key  | any value, for example `a0-local` |

That is the whole setup. Works on Linux, macOS, and Windows. Needs Node 18 or newer. Zero npm dependencies.

## Features

### One endpoint that picks the model for you

Ask for the model named `a0` and a0 looks at your request and picks a lane:

- Is it a coding request with tool calls? It picks a model that supports tools.
- Is there an image? It picks a vision model.
- Is the context huge? It picks a model with a big window.
- Is it a one-line question? It picks the fastest model it has.

You can also force it: `a0/code`, `a0/reasoning`, `a0/vision`, `a0/fast`, `a0/long`, `a0/cheap`. Or name a specific model to pin it.

### Works with no keys

Two providers (LLM7 and Pollinations) work with no account, no key, no signup. Install and it runs. The limits are lower, but it is a working default.

The setup wizard also suggests free keys from Kilo, xKiro, Groq, and Z.ai — all have real free tiers and no card required. Add one key and a0 switches to keyed mode and uses your keys.

### 46 providers built in

Free and anonymous: LLM7, Pollinations, Kilo, xKiro, Groq, Z.ai, OpenRouter, and more.

Paid if you want them: OpenAI, Anthropic, Mistral, DeepSeek, Together, Fireworks, xAI, Cohere, and 20 others.

Local: Ollama, LM Studio, vLLM, llama.cpp. If you run a model on your own machine, a0 can use it too.

You can add any OpenAI-compatible endpoint that is not in the list.

### It sends to several providers at once

With `race=2` (the default), a0 sends your request to two providers at the same time and uses whichever answers first. The loser is cancelled. If one provider is slow or down, you do not wait for it.

### It recovers from failure

- If a provider fails five times in a row, a0 stops sending to it for a minute (circuit breaker).
- It tracks which providers are healthy and which are slow, and prefers the healthy ones.
- If the first provider fails before answering, a0 tries the next one.
- Rate limits are tracked per provider so a0 does not hammer a lane that is already full.

### It makes the model behave better for coding

Every request gets a short set of instructions added: answer directly, no preamble, do not invent APIs, ask at most one question. This cuts down the filler that free models love to output and saves tokens. It is on by default and can be turned off.

### It watches for new models

Free providers add and remove models all the time. Every 12 hours, a0 checks each provider's model list in the background and adds new ones. It never removes models that ship with a0 — only ones it discovered itself.

### It runs in the background

```sh
a0 start    # start the daemon
a0 stop     # stop it
a0 status   # check if it's running
```

No terminal window needed. Logs go to `~/.a0/a0.log`.

### Terminal UI

Run `a0` with no arguments for a full-screen terminal UI. From there you can:

- See which providers are active and how they are doing
- Add providers and keys
- Turn individual models on or off
- Change settings
- Run diagnostics

### Security

- Listens on `127.0.0.1` by default. Nothing outside your machine can reach it.
- If you bind it to a network address, a0 generates an auth token automatically.
- Keys are stored in `~/.a0/config.json` with restricted permissions. They are never logged and never sent anywhere except the provider they belong to.
- No telemetry. No accounts. Nothing phones home except the model requests you make.

## How it works

Every request goes through five steps:

1. **Analyze.** a0 reads the request: is it code? does it need tools? is there an image? how long is the context? This is cheap text matching — no model call, no delay.

2. **Route.** a0 picks which models can serve the request. A tool call never goes to a model without tool support. An image never goes to a text-only model. A 200,000-token prompt never goes to a 32K model. Then it ranks the eligible models by quality, speed, and health.

3. **Enhance.** a0 adds its instructions to the system message: be direct, no filler, ground your claims.

4. **Send.** a0 sends the request to the top provider — or to two at once if racing is on. If the first one fails before answering, it tries the next.

5. **Stream.** The answer streams back to your agent as soon as the first byte arrives.

## Commands

```sh
a0               # terminal UI
a0 start         # start the background server
a0 stop          # stop it
a0 restart       # restart it
a0 status        # is it running?
a0 setup         # guided setup wizard
a0 config        # change settings
a0 doctor        # check which providers are reachable
a0 models        # list models and categories
a0 update        # check for a newer version and install it
a0 passwd        # set or change the auth key
```

## Limits

- a0 cannot make a weak model strong. Free models are free models. What a0 does is stop wasting them on the wrong tasks and stop your session from dying when one fails.
- Anonymous (keyless) providers share their quota across all users. A free key is always better.
- Streaming is the main path. Retries only happen before the first token is sent — once bytes are flowing, a0 commits.
- Free providers change their models and limits without warning. The 12-hour model check helps, but a provider can still disappear overnight.

## License

MIT. Free to use, free to modify.

</content>