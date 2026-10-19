import { Link } from "react-router-dom";
import {
  PageHead,
  Panel,
  Row,
  Pill,
  Note,
  CodeBlock,
  CopyLine,
  SecHead,
  btn,
  Ico,
} from "@/components/custom/squid-app";
import { CATEGORIES, A0_BASE_URL } from "@/lib/a0";
import { FREE_COUNT } from "@/lib/catalog";

const ENDPOINT = A0_BASE_URL;

/* ── Recipe TODOs — every block is one tap from the clipboard ── */

const CURL = `curl ${ENDPOINT}/v1/chat/completions \\
  -H "Authorization: Bearer $A0_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "a0/coder",
    "messages": [{"role": "user", "content": "refactor this test"}]
  }'`;

const PY = `from openai import OpenAI

client = OpenAI(
    base_url="${ENDPOINT}/v1",
    api_key="$A0_API_KEY",
)

r = client.chat.completions.create(
    model="a0/coder",
    messages=[{"role": "user", "content": "refactor this test"}],
)
print(r.choices[0].message.content)`;

const TS = `import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "${ENDPOINT}/v1",
  apiKey: process.env.A0_API_KEY,
});

const r = await client.chat.completions.create({
  model: "a0/coder",
  messages: [{ role: "user", content: "refactor this test" }],
});
console.log(r.choices[0]?.message.content);`;

const LANGCHAIN = `from langchain_openai import ChatOpenAI

llm = ChatOpenAI(
    base_url="${ENDPOINT}/v1",
    api_key="$A0_API_KEY",
    model="a0/reasoning",
)`;

const ENV = `export OPENAI_BASE_URL="${ENDPOINT}/v1"
export OPENAI_API_KEY="sk-a0-…"`;

const AI_PROMPT = `Use a0 as the only AI gateway for this project.

Endpoint (OpenAI-compatible): ${ENDPOINT}/v1
API key: read from env A0_API_KEY (also try OPENAI_API_KEY);
       if unset, ask me once and store it in .env.local.

How to call
- POST {endpoint}/chat/completions with Authorization: Bearer <A0_API_KEY>
- "model" is an a0 category — exactly one of:
  a0/flagship · a0/reasoning · a0/coder · a0/vision · a0/fast · a0/omni · a0/long
- GET {endpoint}/models lists the live categories; check before guessing.

Category chooser (cheapest fitting one wins)
- everyday code or tool use            → a0/coder
- hard multi-step / deep questions     → a0/reasoning
- screenshots or images as input       → a0/vision, a0/omni for mixed media
- whole-file or repo-scale context     → a0/long
- quick drafts and chit-chat           → a0/fast
- no better fit                        → a0/flagship

Rules
- Never call another model provider directly; a0 is the single AI endpoint.
- Standard OpenAI SDK shapes work: OPENAI_BASE_URL / OPENAI_API_KEY are valid.
- On 429 or 5xx: retry once with model a0/fast, then surface the error to me.
- Never print the API key in logs, commits or responses.`;

/* ── Universal-app note ── */
const UNIVERSAL = [
  "Cursor / Continue / Cline — Base URL + API key in model settings",
  "LM Studio / ChatBox / AnythingLLM — custom OpenAI endpoint",
  "VS Code extensions — set baseUrl + apiKey in settings.json",
  "Zed, aider, repopack agents — OPENAI_BASE_URL env var",
];

export default function Guide() {
  return (
    <div>
      <PageHead
        eyebrow="a0 / guide"
        title="Use a0 anywhere"
        desc={`One OpenAI-compatible endpoint, ${FREE_COUNT} free models, any stack. Mint a key, point at the URL — done.`}
        actions={
          <Link to="/dashboard/keys" className={btn("primary", "sm")}>
            Mint a key <Ico.Arrow size={13} />
          </Link>
        }
      />

      {/* 1 — key */}
      <SecHead title="1 · Mint a key" desc="Keys are shown once — copy immediately." />
      <Panel flush>
        <Row label="Keys → New API key" desc="Name it, mint it, copy it." />
        <Row
          label={<code className="sa-mono">A0_API_KEY</code>}
          desc="Store it in your env — every recipe below reads this."
        />
        <Row
          label={<code className="sa-mono">{ENDPOINT}/v1</code>}
          desc="The only base URL you'll ever need."
        />
      </Panel>

      {/* 2 — stacks */}
      <SecHead title="2 · Point your stack at a0" desc="Pick your flavor — every block is one tap from the clipboard." />
      <div style={{ display: "grid", gap: 14 }}>
        <CopyLine value={ENV} display="env vars — works for any OpenAI-compatible tool" />
        <Panel title="curl" flush>
          <div style={{ padding: 14 }}>
            <CodeBlock code={CURL} lang="bash" />
          </div>
        </Panel>
        <Panel title="Python — OpenAI SDK" flush>
          <div style={{ padding: 14 }}>
            <CodeBlock code={PY} lang="python" />
          </div>
        </Panel>
        <Panel title="TypeScript — openai npm" flush>
          <div style={{ padding: 14 }}>
            <CodeBlock code={TS} lang="typescript" />
          </div>
        </Panel>
        <Panel title="LangChain" flush>
          <div style={{ padding: 14 }}>
            <CodeBlock code={LANGCHAIN} lang="python" />
          </div>
        </Panel>
      </div>

      <div style={{ marginTop: 12 }}>
        <Note tone="info" title="Any app that speaks OpenAI">
          <span style={{ display: "block", marginTop: 4 }}>
            {UNIVERSAL.join("  ·  ")}
          </span>
        </Note>
      </div>

      {/* 3 — prompt */}
      <SecHead
        title="3 · The prompt"
        desc="Paste this into any AI assistant — Cursor, Claude, ChatGPT, Cline — and it wires everything it does to a0."
      />
      <Panel flush>
        <div style={{ padding: 14 }}>
          <CodeBlock code={AI_PROMPT} lang="prompt" wrap />
        </div>
      </Panel>
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 10 }}>
        <Pill>no flagging</Pill>
        <Pill>no telemetry</Pill>
        <Pill>categories only</Pill>
        <Pill>silent failover</Pill>
      </div>

      {/* 4 — categories */}
      <SecHead title="4 · Pick a category" desc="Never a provider name — request the category, a0 resolves the rest." />
      <Panel flush>
        {CATEGORIES.map((c) => (
          <Row key={c.id} label={<code className="sa-mono">{c.id}</code>} desc={c.desc} />
        ))}
        <Row
          label={<code className="sa-mono">GET /v1/models</code>}
          desc="lists the live categories, always current"
        />
      </Panel>
    </div>
  );
}
