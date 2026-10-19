import { Link, useNavigate } from "react-router-dom";
import {
  AppShell,
  TopBar,
  Panel,
  SecHead,
  CodeBlock,
  btn,
  Ico,
  Pill,
  Note,
} from "@/components/custom/squid-app";
import { CATEGORIES, A0_BASE_URL } from "@/lib/a0";
import { useAuth } from "@/contexts/AuthContext";
import { hasSupabaseEnv } from "@/integrations/supabase/client";

const curl = `curl ${A0_BASE_URL}/v1/chat/completions \\
  -H "Authorization: Bearer $A0_KEY" \\
  -d '{
    "model": "a0/coder",
    "stream": true,
    "messages": [{"role": "user", "content": "hi"}]
  }'`;

const INDEX_CSS = `
.ix-hero { padding: clamp(56px, 10vh, 112px) var(--sa-gut) 40px; text-align: center; position: relative; }
.ix-hero::before { content: ""; position: absolute; inset: -120px 0 auto -10%; height: 480px; pointer-events: none;
  background: radial-gradient(52% 62% at 50% 0%, rgba(255,255,255,0.055), transparent 70%); }
.ix-eyebrow { font: 400 11px/1 var(--sa-mono); letter-spacing: 0.14em; text-transform: uppercase; color: var(--sa-mute); }
.ix-h1 { margin: 18px auto 0; max-width: 18ch; font: 300 clamp(38px, 6.4vw, 64px)/1.05 var(--sa-f); letter-spacing: -0.035em; color: var(--sa-text); }
.ix-sub { margin: 20px auto 0; max-width: 56ch; font-size: 15.5px; line-height: 1.6; color: var(--sa-text-2); }
.ix-cta { margin-top: 32px; display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
.ix-meta { margin-top: 22px; display: flex; gap: 22px; justify-content: center; flex-wrap: wrap;
  font: 400 10.5px/1 var(--sa-mono); letter-spacing: 0.1em; text-transform: uppercase; color: var(--sa-mute); }
.ix-meta span { display: inline-flex; align-items: center; gap: 7px; }
.ix-section { max-width: 1120px; margin: 0 auto; padding: 0 var(--sa-gut); }
.ix-grid-3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
.ix-grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; align-items: start; }
.ix-cat { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1px; background: var(--sa-line); }
.ix-cat > div { background: var(--sa-bg-2); padding: 16px; min-height: 84px; }
.ix-cat code { font: 500 13px/1 var(--sa-mono); letter-spacing: -0.005em; color: var(--sa-text); }
.ix-cat p { margin: 7px 0 0; font-size: 12.5px; line-height: 1.5; color: var(--sa-mute); }
.ix-foot { border-top: 1px solid var(--sa-line); margin-top: 56px; padding: 28px var(--sa-gut) 48px;
  display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap;
  font: 400 10.5px/1.6 var(--sa-mono); letter-spacing: 0.08em; text-transform: uppercase; color: var(--sa-dim); }
.ix-stat-line { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--sa-text-2); }
@media (max-width: 900px) { .ix-grid-3, .ix-grid-2 { grid-template-columns: 1fr; } }
`;

const FEATURES = [
  {
    t: "Failover built in",
    b: "429s and dead lanes roll over in-flight — chain order is the SLA, retries are invisible.",
  },
  {
    t: "Virtual keys",
    b: "Revoke in a second; wings drop it from cache in 60s and raters keep their quota sides sane.",
  },
  {
    t: "ToS-clean lanes only",
    b: "Usable free providers, no reverse-engineered bots, rot on drift — probed every hour.",
  },
];

export default function Index() {
  const { user, controlPlaneConfigured } = useAuth();
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

      <section className="ix-hero">
        <div className="ix-eyebrow">pooled free inference · squidcloud</div>
        <h1 className="ix-h1">
          One endpoint.{" "}
          <span style={{ color: "var(--sa-mute)" }}>Zero model roulette.</span>
        </h1>
        <p className="ix-sub">
          a0 pools the usable free lanes of 2026 behind an OpenAI-compatible API.
          You ask for a category — flagships, coders, vision — and the wings
          route, rotate keys and fail over. Never speak to a provider again.
        </p>
        <div className="ix-cta">
          <button
            type="button"
            className={btn("primary", "lg")}
            onClick={() => navigate(user ? "/dashboard/keys" : "/auth")}
          >
            {user ? "Mint a key" : "Get a key"} <Ico.Arrow size={14} />
          </button>
          <button
            type="button"
            className={btn("default", "lg")}
            onClick={() => navigate("/dashboard")}
          >
            Open console
          </button>
        </div>
        <div className="ix-meta" aria-hidden="true">
          <span>OpenAI-compatible</span>
          <span>·</span>
          <span>7 categories</span>
          <span>·</span>
          <span>4-lane failover</span>
          <span>·</span>
          <span>free tier ~20 RPM</span>
        </div>
      </section>

      <div className="ix-section">
        <div className="ix-grid-3">
          <Panel flush>
            {FEATURES.map((f) => (
              <div key={f.t} className="sa-row top" style={{ gridTemplateColumns: "1fr", textAlign: "left" }}>
                <div>
                  <div className="sa-row-t">{f.t}</div>
                  <div className="sa-row-d">{f.b}</div>
                </div>
              </div>
            ))}
          </Panel>
        </div>

        <div style={{ height: 48 }} />

        <SecHead
          title="The categories are the product"
          desc="Model names rot monthly. Categories don't. a0 remaps them under the surface."
        />
        <Panel flush>
          <div className="ix-cat">
            {CATEGORIES.map((c) => (
              <div key={c.id}>
                <code>{c.id}</code>
                <p>{c.desc}</p>
              </div>
            ))}
          </div>
        </Panel>

        <div style={{ height: 48 }} />

        <div className="ix-grid-2">
          <Panel title="Any OpenAI SDK works" desc={`Point base_url at a wing — ${A0_BASE_URL} in dev.`} flush>
            <div style={{ padding: 16 }}>
              <CodeBlock lang="bash" code={curl} wrap />
            </div>
          </Panel>
          <Panel
            title={hasSupabaseEnv ? "Signup is open" : "Signup is not wired yet"}
            desc={
              hasSupabaseEnv
                ? "SquidCloud SSO, free tier ~20 RPM / 2k req/day. Keys, quota and nodes attach to your identity."
                : "The panel browses in demo mode; minting goes live once control-plane env lands."
            }
            flush
          >
            <div style={{ padding: 16, display: "grid", gap: 14 }}>
              <div className="ix-stat-line">
                {hasSupabaseEnv ? <Pill tone="ok">signup open</Pill> : <Pill tone="warn">demo mode</Pill>}
                <span className="sa-mute" style={{ fontSize: 12.5 }}>
                  {hasSupabaseEnv
                    ? "one SquidCloud identity across keys, quota and wings"
                    : "build-time env VITE_SUPABASE_URL missing on this deploy"}
                </span>
              </div>
              <Note tone={hasSupabaseEnv ? "ok" : "warn"}>
                {hasSupabaseEnv
                  ? "Sign in once — no new passwords land on a0 itself."
                  : "Every page stays browsable with demo data until it is."}
              </Note>
              <button
                type="button"
                className={btn("primary", "md")}
                onClick={() =>
                  navigate(hasSupabaseEnv ? (user ? "/dashboard" : "/auth") : "/dashboard")
                }
                style={{ justifyContent: "center" }}
              >
                {hasSupabaseEnv ? (user ? "Open console" : "Continue with SquidCloud") : "Browse the panel"}
                <Ico.Arrow size={14} />
              </button>
            </div>
          </Panel>
        </div>
      </div>

      <footer className="ix-foot">
        <span>a0 — a squidcloud product</span>
        <span>categories, not model roulette</span>
      </footer>
    </AppShell>
  );
}
