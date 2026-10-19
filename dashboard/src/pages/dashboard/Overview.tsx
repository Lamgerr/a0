import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  PageHead,
  Panel,
  Row,
  Stat,
  Stats,
  Pill,
  Dot,
  CodeBlock,
  CopyLine,
  btn,
  Ico,
  SecHead,
  Note,
} from "@/components/custom/squid-app";
import { CATEGORIES, A0_BASE_URL } from "@/lib/a0";
import { FREE_COUNT, fmtCtx, MODELS } from "@/lib/catalog";
import { listVirtualKeys } from "@/hooks/use-api-keys";
import { useAuth } from "@/contexts/AuthContext";
import { supabase, hasSupabaseEnv } from "@/integrations/supabase/client";
import type { NodeRow } from "@/integrations/supabase/types";

const QUICK_START = `from openai import OpenAI

client = OpenAI(
    base_url="${A0_BASE_URL}/v1",
    api_key="sk-a0-…",       # a virtual key from the Keys page
)

r = client.chat.completions.create(
    model="a0/coder",        # categories, never raw models
    messages=[{"role": "user", "content": "refactor this test"}],
)

print(r.choices[0].message.content)`;

/* category → what a caller can rely on, computed from the live free catalog */
const POOL_CHIPS: Record<string, (m: typeof MODELS[number]) => boolean> = {
  "a0/flagship": (m) => m.ctx >= 128_000 && m.tools,
  "a0/reasoning": (m) => m.reasoning,
  "a0/coder": (m) => m.tools,
  "a0/vision": (m) => m.vision,
  "a0/fast": (m) => m.ctx >= 32_000,
  "a0/omni": (m) => m.vision,
  "a0/long": (m) => m.ctx >= 500_000,
};

function poolStats(id: string) {
  const picks = MODELS.filter((m) => POOL_CHIPS[id]?.(m) ?? false);
  const topCtx = picks.reduce((a, m) => Math.max(a, m.ctx), 0);
  return { count: picks.length, topCtx };
}

export default function Overview() {
  const { controlPlaneConfigured } = useAuth();
  const keys = useQuery({ queryKey: ["virtual_keys"], queryFn: listVirtualKeys });
  const nodes = useQuery({
    queryKey: ["nodes_overview"],
    queryFn: async (): Promise<NodeRow[]> => {
      if (!hasSupabaseEnv) return [];
      const { data } = await supabase.from("nodes").select("*");
      return data ?? [];
    },
  });

  const activeKeys = (keys.data ?? []).filter((k) => !k.revoked);
  const nodesList = nodes.data ?? [];
  const online = nodesList.filter((n) => n.status === "online");

  return (
    <div>
      <PageHead
        eyebrow="a0 / console"
        title="Overview"
        desc="Keys, wings and the free pool — one screen."
        actions={
          <>
            <Link to="/dashboard/guide" className={btn("default", "sm")}>
              <Ico.ArrowUpRight size={13} /> Wire it up
            </Link>
            <Link to="/dashboard/keys" className={btn("primary", "sm")}>
              New key <Ico.Arrow size={13} />
            </Link>
          </>
        }
      />

      <Stats>
        <Stat
          label="Active keys"
          value={controlPlaneConfigured ? activeKeys.length : "—"}
          sub={controlPlaneConfigured ? "hashed · 60s edge cache" : "demo store"}
        />
        <Stat
          label="Wings online"
          value={controlPlaneConfigured ? online.length : "—"}
          sub={controlPlaneConfigured ? `${nodesList.length} attached · heartbeat 30s` : "control plane offline"}
        />
        <Stat label="Free models" value={FREE_COUNT} sub="5 labs · resolver picks per request" />
        <Stat label="Failover" value="silent" sub="tiered lanes, no user-visible retries" />
      </Stats>

      {/* endpoint hero */}
      <div style={{ marginTop: 20 }}>
        <Panel flush className="endpoint-hero">
          <div style={{ padding: "18px 20px 16px" }}>
            <div className="lg-text-label" style={{ marginBottom: 10 }}>
              your endpoint — OpenAI-compatible
            </div>
            <CopyLine
              value={`${A0_BASE_URL}/v1`}
              display={`${A0_BASE_URL}/v1`}
            />
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 12 }}>
              <Pill>/v1/chat/completions</Pill>
              <Pill>GET /v1/models</Pill>
              <Pill>7 categories</Pill>
            </div>
          </div>
        </Panel>
      </div>

      {!controlPlaneConfigured && (
        <div style={{ marginTop: 16 }}>
          <Note tone="warn" title="Demo mode.">
            The control plane env is missing from this build — the panel runs
            with an in-memory store so every page stays browsable.
          </Note>
        </div>
      )}

      {/* categories — glanceable cards */}
      <div style={{ marginTop: 28 }}>
        <SecHead
          title="The categories are the product"
          desc="Request a category — a0 resolves the best usable free model at request time."
        />
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
          {CATEGORIES.map((c) => {
            const { count, topCtx } = poolStats(c.id);
            return (
              <Panel key={c.id} flush>
                <div style={{ padding: "15px 16px 13px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <code className="sa-mono" style={{ font: "500 14.5px/1 var(--sa-mono)", color: "var(--sa-text)" }}>
                      {c.id}
                    </code>
                    <Pill title="capable free models in this pool">{count}</Pill>
                  </div>
                  <p style={{ margin: "8px 0 0", fontSize: 12.5, lineHeight: 1.55, color: "var(--sa-text-2)" }}>
                    {c.desc}
                  </p>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 11 }}>
                    {topCtx > 0 && <Pill>up to {fmtCtx(topCtx)} ctx</Pill>}
                    {c.id === "a0/coder" && <Pill>tool calling</Pill>}
                    {(c.id === "a0/vision" || c.id === "a0/omni") && <Pill>image-in</Pill>}
                    {c.id === "a0/reasoning" && <Pill>deep thinking</Pill>}
                    {c.id === "a0/fast" && <Pill>low latency</Pill>}
                  </div>
                </div>
              </Panel>
            );
          })}
        </div>
      </div>

      {/* quick start */}
      <div style={{ marginTop: 28 }}>
        <Panel title="Quick start" desc="Any OpenAI SDK or framework — point it at a wing." flush>
          <div style={{ padding: 16 }}>
            <CodeBlock code={QUICK_START} lang="python" wrap />
          </div>
          <div style={{ padding: "0 16px 16px" }}>
            <Row
              label="Wire a0 anywhere"
              desc="Full recipes, env vars and a copy-paste AI prompt on the Guide page."
              children={
                <Link to="/dashboard/guide" className={btn("ghost", "sm")}>
                  Guide <Ico.Arrow size={12} />
                </Link>
              }
            />
          </div>
        </Panel>
      </div>

      {/* posture glance */}
      <div style={{ marginTop: 24 }}>
        <Panel title="Posture" flush>
          <Row
            label={
              <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                <Dot tone={controlPlaneConfigured ? "ok" : "neutral"} pulse={controlPlaneConfigured} />
                Wings
              </span>
            }
            desc={controlPlaneConfigured ? `${online.length} of ${nodesList.length} online` : "—"}
            children={
              <Link to="/dashboard/nodes" className={btn("ghost", "sm")}>
                Manage <Ico.Arrow size={12} />
              </Link>
            }
          />
          <Row
            label="Keys"
            desc={controlPlaneConfigured ? `${activeKeys.length} active` : "—"}
            children={
              <Link to="/dashboard/keys" className={btn("ghost", "sm")}>
                Manage <Ico.Arrow size={12} />
              </Link>
            }
          />
          <Row
            label="Traffic"
            desc="requests, tokens, lanes"
            children={
              <Link to="/dashboard/usage" className={btn("ghost", "sm")}>
                Usage <Ico.Arrow size={12} />
              </Link>
            }
          />
        </Panel>
      </div>
    </div>
  );
}
