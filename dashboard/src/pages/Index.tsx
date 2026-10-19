import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  AppShell,
  TopBar,
  Panel,
  Row,
  CodeBlock,
  CopyLine,
  btn,
  Ico,
  Pill,
  Dot,
  Note,
  Stats,
  Stat,
} from "@/components/custom/squid-app";
import { LabLogo, SERVED_LABS } from "@/components/custom/lab-logos";
import { CATEGORIES, A0_BASE_URL } from "@/lib/a0";
import { FREE_COUNT } from "@/lib/catalog";
import { useAuth } from "@/contexts/AuthContext";
import { hasSupabaseEnv, supabase } from "@/integrations/supabase/client";

const curl = `curl ${A0_BASE_URL}/v1/chat/completions \\
  -H "Authorization: Bearer $A0_KEY" \\
  -d '{
    "model": "a0/coder",
    "stream": true,
    "messages": [{"role": "user", "content": "hi"}]
  }'`;

const ENV = `export OPENAI_BASE_URL="${A0_BASE_URL}/v1"
export OPENAI_API_KEY="sk-a0-…"`;

function timeAgo(ts: string): string {
  const s = Math.max(0, Math.round((Date.now() - new Date(ts).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  return `${Math.round(s / 3600)}h ago`;
}

/* ── live lane board — the hero visual. Tiers only; provider plumbing never
       leaves the wing (lane_health is anon-locked, lane_status is the view). ── */
function LaneBoard() {
  const health = useQuery({
    queryKey: ["lane_status_index"],
    queryFn: async () => {
      if (!hasSupabaseEnv) return [];
      const { data } = await supabase
        .from("lane_status")
        .select("tier, ok, ts, pos")
        .order("pos", { ascending: true });
      return (data ?? []) as Array<{ tier: string; ok: boolean; ts: string; pos: number }>;
    },
    staleTime: 10_000,
    refetchInterval: 30_000,
  });

  const lanes = health.data ?? [];
  const live = lanes.length > 0;
  const okCount = lanes.filter((l) => l.ok).length;
  const allOk = live && okCount === lanes.length;

  return (
    <Panel flush>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "13px 16px", borderBottom: "1px solid var(--sa-line)" }}>
        <span className="lg-text-label">lane status</span>
        {live ? (
          <Pill tone={allOk ? "ok" : "warn"} title="probed every minute; traffic falls through on failure">
            <Dot tone={allOk ? "ok" : "warn"} pulse /> {okCount}/{lanes.length} up
          </Pill>
        ) : (
          <Pill>demo</Pill>
        )}
        <span style={{ marginLeft: "auto", font: "400 10.5px/1 var(--sa-mono)", letterSpacing: "0.08em", color: "var(--sa-dim)", textTransform: "uppercase" }}>
          {live && lanes[0] ? timeAgo(lanes[0].ts) : "—"}
        </span>
      </div>
      <div>
        {lanes.map((l, i) => (
          <div
            key={l.tier + i}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderTop: i === 0 ? "none" : "1px solid var(--sa-line)" }}
          >
            <Dot tone={l.ok ? "ok" : "err"} pulse={l.ok} />
            <span className="sa-mono" style={{ font: "500 12.5px/1 var(--sa-mono)", color: "var(--sa-text)", letterSpacing: "0.02em" }}>
              {l.tier}
            </span>
            <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--sa-dim)" }}>
              {l.ok ? "serving" : "failing — traffic moved off"}
            </span>
          </div>
        ))}
      </div>
      <div style={{ padding: "10px 16px 12px", borderTop: "1px solid var(--sa-line)" }}>
        <span style={{ fontSize: 12, lineHeight: 1.5, color: "var(--sa-mute)" }}>
          Every request walks this chain until a lane answers. You never see the walk.
        </span>
      </div>
    </Panel>
  );
}

const INDEX_CSS = `
.ix-hero { max-width: 1160px; margin: 0 auto; padding: clamp(48px, 9vh, 96px) var(--sa-gut) 60px;
  display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.9fr); gap: clamp(28px, 4vw, 56px); align-items: center; }
.ix-eyebrow { font: 400 11px/1 var(--sa-mono); letter-spacing: 0.14em; text-transform: uppercase; color: var(--sa-mute); }
.ix-h1 { margin: 18px 0 0; font: 300 clamp(36px, 5.4vw, 58px)/1.06 var(--sa-f); letter-spacing: -0.035em; color: var(--sa-text); }
.ix-h1 em { font-style: normal; color: var(--sa-mute); }
.ix-sub { margin: 20px 0 0; max-width: 52ch; font-size: 15.5px; line-height: 1.65; color: var(--sa-text-2); }
.ix-cta { margin-top: 30px; display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
.ix-meta { margin-top: 20px; display: flex; gap: 18px; flex-wrap: wrap;
  font: 400 10.5px/1 var(--sa-mono); letter-spacing: 0.1em; text-transform: uppercase; color: var(--sa-dim); }
.ix-in { animation: sa-in 0.32s var(--sa-ease) both; }

.ix-sec { max-width: 1120px; margin: 0 auto; padding: 0 var(--sa-gut); }
.ix-rule { border-top: 1px solid var(--sa-line); }
.ix-pad { padding-top: 56px; padding-bottom: 60px; }
.ix-h2 { margin: 0; font: 400 clamp(20px, 2.6vw, 26px)/1.25 var(--sa-f); letter-spacing: -0.02em; color: var(--sa-text); }
.ix-h2sub { margin: 10px 0 0; max-width: 58ch; font-size: 14px; line-height: 1.6; color: var(--sa-text-2); }

.ix-labs { display: flex; align-items: center; gap: clamp(24px, 4vw, 48px); flex-wrap: wrap; margin-top: 32px; }
.ix-lab { color: var(--sa-mute); transition: color 0.15s; display: inline-flex; }
.ix-lab:hover { color: var(--sa-text); }

.ix-step { display: grid; grid-template-columns: 56px minmax(0, 1fr) auto; gap: 16px; align-items: center; padding: 16px; }
.ix-step-n { font: 300 20px/1 var(--sa-mono); color: var(--sa-dim); }
.ix-step-t { font-size: 14.5px; color: var(--sa-text); }
.ix-step-d { margin: 5px 0 0; font-size: 13px; line-height: 1.55; color: var(--sa-text-2); max-width: 56ch; }

.ix-cat { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 1px; background: var(--sa-line); border: 1px solid var(--sa-line); }
.ix-cat > div { background: var(--sa-bg-2); padding: 15px 16px; }
.ix-cat code { font: 500 13px/1 var(--sa-mono); letter-spacing: -0.005em; color: var(--sa-text); }
.ix-cat p { margin: 6px 0 0; font-size: 12.5px; line-height: 1.5; color: var(--sa-mute); }

.ix-grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; align-items: start; }
@media (max-width: 960px) { .ix-hero { grid-template-columns: 1fr; } .ix-grid-2 { grid-template-columns: 1fr; } .ix-step { grid-template-columns: 40px minmax(0, 1fr); } .ix-step > div:last-child { display: none; } }

.ix-faq-q { font-size: 13.5px; color: var(--sa-text); }
.ix-foot { border-top: 1px solid var(--sa-line); max-width: 1120px; margin: 0 auto; padding: 26px var(--sa-gut) 46px;
  display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap;
  font: 400 10.5px/1.6 var(--sa-mono); letter-spacing: 0.08em; text-transform: uppercase; color: var(--sa-dim); }
.ix-foot a { color: var(--sa-mute); text-decoration: none; }
.ix-foot a:hover { color: var(--sa-text); }
@media (prefers-reduced-motion: reduce) { .ix-in { animation: none; } }
`;

const STEPS = [
  {
    n: "01",
    t: "Mint a key",
    d: "One click, no card. The key is shown once — it stays in your env, not our database.",
    artifact: "sk-a0-…",
  },
  {
    n: "02",
    t: "Point your stack at a0",
    d: "One base URL, the OpenAI wire format. curl, any SDK, Cursor, LangChain — they all just work.",
    artifact: "/v1/chat/completions",
  },
  {
    n: "03",
    t: "Ask for a category",
    d: "a0/flagship, a0/coder, a0/vision… a0 picks the model, rotates keys and fails over silently.",
    artifact: "a0/coder",
  },
];

const FAQ = [
  {
    q: "Is it really free?",
    a: "Yes. a0 pools the usable free tiers of real labs — nothing reverse-engineered, nothing that breaks a lab's terms. Your key gets ~20 requests/min and 2,000 requests/day.",
  },
  {
    q: "Why categories instead of model names?",
    a: "Model names rot monthly; the work doesn't. a0 remaps every category to the strongest live models and keeps your code untouched.",
  },
  {
    q: "What happens when a lane goes down?",
    a: "Traffic moves to the next tier automatically. The request in flight fails over — you get your answer, not an error page.",
  },
  {
    q: "Does it work with my tools?",
    a: "Anything that speaks OpenAI: the Python and JS SDKs, Cursor, Cline, LangChain, LM Studio — set the base URL and key, done.",
  },
];

export default function Index() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <AppShell grain>
      <style>{INDEX_CSS}</style>
      <TopBar home="/" crumbs={[{ label: "a0" }]}>
        <button
          type="button"
          className={btn("default", "sm")}
          onClick={() => navigate(user ? "/dashboard" : "/auth")}
        >
          {user ? "Console" : "Sign in"} <Ico.Arrow size={12} />
        </button>
      </TopBar>

      {/* ── hero ── */}
      <section className="ix-hero">
        <div>
          <div className="ix-eyebrow ix-in">a0 · AI inference by squidcloud</div>
          <h1 className="ix-h1 ix-in" style={{ animationDelay: "40ms" }}>
            Every good free model. <em>One endpoint.</em>
          </h1>
          <p className="ix-sub ix-in" style={{ animationDelay: "80ms" }}>
            a0 pools usable free lanes from Qwen, Mistral, Cohere, LongCat and
            more behind one OpenAI-compatible API — with silent failover.
          </p>
          <div className="ix-cta ix-in" style={{ animationDelay: "80ms" }}>
            <button
              type="button"
              className={btn("primary", "lg")}
              onClick={() => navigate(user ? "/dashboard/keys" : "/auth")}
            >
              Get a free key <Ico.Arrow size={14} />
            </button>
            <Link to="/dashboard/models" className={btn("default", "lg")}>
              See the models
            </Link>
          </div>
          <div className="ix-meta ix-in" style={{ animationDelay: "80ms" }}>
            <span>{FREE_COUNT} free models</span>
            <span>7 categories</span>
            <span>7 lanes</span>
            <span>$0, no card</span>
          </div>
        </div>
        <div className="ix-in" style={{ animationDelay: "120ms" }}>
          <LaneBoard />
        </div>
      </section>

      {/* ── labs served ── */}
      <section className="ix-sec ix-rule ix-pad">
        <h2 className="ix-h2">One key. Seven labs.</h2>
        <p className="ix-h2sub">
          a0 reaches the strongest free tiers in the industry and keeps them
          behind one endpoint. No paid upstreams, ever.
        </p>
        <div className="ix-labs">
          {SERVED_LABS.map((lab) => (
            <span key={lab} className="ix-lab" title={lab === "api" ? "Cohere" : lab === "opencode-zen" ? "LongCat" : undefined}>
              <LabLogo lab={lab} size={26} />
            </span>
          ))}
        </div>
      </section>

      {/* ── how it works ── */}
      <section className="ix-sec ix-rule ix-pad">
        <h2 className="ix-h2">Three steps. Then never think about models again.</h2>
        <p className="ix-h2sub">
          a0 hides the provider layer completely: you keep one key, one URL and
          one vocabulary.
        </p>
        <div style={{ marginTop: 28 }}>
          <Panel flush>
            {STEPS.map((s, i) => (
              <div key={s.n} className="ix-step" style={{ borderTop: i === 0 ? "none" : "1px solid var(--sa-line)" }}>
                <span className="ix-step-n">{s.n}</span>
                <div>
                  <div className="ix-step-t">{s.t}</div>
                  <p className="ix-step-d">{s.d}</p>
                </div>
                <Pill tone="solid">{s.artifact}</Pill>
              </div>
            ))}
          </Panel>
        </div>
      </section>

      {/* ── categories ── */}
      <section className="ix-sec ix-rule ix-pad">
        <h2 className="ix-h2">The categories are the product</h2>
        <p className="ix-h2sub">
          Model names change; what you need doesn't. Request a category and a0
          resolves it to the best live model at request time.
        </p>
        <div style={{ marginTop: 28 }}>
          <Panel flush>
            <div className="ix-cat" style={{ border: "none" }}>
              {CATEGORIES.map((c) => (
                <div key={c.id}>
                  <code>{c.id}</code>
                  <p>{c.desc}</p>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </section>

      {/* ── quickstart ── */}
      <section className="ix-sec ix-rule ix-pad">
        <div className="ix-grid-2">
          <div>
            <h2 className="ix-h2">Runs everywhere OpenAI does</h2>
            <p className="ix-h2sub">
              Swap the base URL, keep your code. curl, the OpenAI SDKs,
              LangChain, Cursor, aider — all of them.
            </p>
            <div style={{ marginTop: 18 }}>
              <CopyLine value={ENV} display="env vars — any OpenAI-compatible tool" />
            </div>
          </div>
          <Panel title="first request" flush>
            <div style={{ padding: 14 }}>
              <CodeBlock lang="bash" code={curl} wrap />
            </div>
          </Panel>
        </div>
      </section>

      {/* ── free tier, honestly ── */}
      <section className="ix-sec ix-rule ix-pad">
        <h2 className="ix-h2">The free tier, in plain numbers</h2>
        <div style={{ marginTop: 24 }}>
          <Stats>
            <Stat label="Price" value="$0" sub="no card, no trial countdown" />
            <Stat label="Rate" value="20 rpm" sub="per key, sustained" />
            <Stat label="Daily" value="2,000" sub="requests per key" />
            <Stat label="Guard" value="burst 429" sub="fair-use shield for shared lanes" />
          </Stats>
        </div>
        <div style={{ marginTop: 16 }}>
          <Note tone="info" title="How it stays free.">
            When someone hammers a lane past its burst budget, extra requests
            get a 429 instead of quietly degrading everyone. That guard is why
            the free tier holds up at all.
          </Note>
        </div>
      </section>

      {/* ── faq ── */}
      <section className="ix-sec ix-rule ix-pad">
        <h2 className="ix-h2">Short answers</h2>
        <div style={{ marginTop: 24 }}>
          <Panel flush>
            {FAQ.map((f) => (
              <Row key={f.q} label={f.q} desc={f.a} />
            ))}
          </Panel>
        </div>
      </section>

      <footer className="ix-foot">
        <span>a0 — a squidcloud product</span>
        <span style={{ display: "inline-flex", gap: 18 }}>
          <Link to="/dashboard/models">models</Link>
          <Link to="/dashboard/guide">guide</Link>
          <Link to="/dashboard">console</Link>
        </span>
      </footer>
    </AppShell>
  );
}
