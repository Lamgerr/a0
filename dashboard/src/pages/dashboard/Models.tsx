import {
  PageHead,
  Panel,
  Pill,
  useHashState,
  Seg,
} from "@/components/custom/squid-app";
import { CATEGORIES } from "@/lib/a0";
import { hasSupabaseEnv, supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

/* Chain order shown per category — mirrors the wing's alias chains.
   The chain is the SLA: first lane that answers wins. */
const CHAIN_PREVIEW: Record<string, string> = {
  "a0/flagship": "xkiro@qwen3.8-max → llm7@glm-5.3 → openrouter/free",
  "a0/reasoning": "xkiro@deepseek-r-style → llm7 → openrouter",
  "a0/coder": "xkiro@qwen3-coder → llm7@deepseek-v4 → openrouter",
  "a0/vision": "xkiro@(vision) → openrouter/free",
  "a0/fast": "xkiro@qwen3.7-flash → llm7 → openrouter",
  "a0/omni": "xkiro → openrouter (image-in chains)",
  "a0/long": "xkiro@1M-ctx → openrouter/free",
};

type View = "flat" | "chains";

export default function Models() {
  const [view, setView] = useHashState<View>("view", "chains", ["flat", "chains"]);

  /* Lane health rows stream in from wings every 30s/60s heartbeats —
     they tell you which link of each chain is currently the hot one. */
  const health = useQuery({
    queryKey: ["lane_health_models"],
    queryFn: async () => {
      if (!hasSupabaseEnv) return [];
      const { data } = await supabase
        .from("lane_health")
        .select("lane, ts, ok, detail")
        .order("ts", { ascending: false })
        .limit(20);
      return (data ?? []) as Array<{ lane: string; ts: string; ok: boolean; detail: string | null }>;
    },
    staleTime: 10_000,
    refetchInterval: 30_000,
  });

  const freshest = new Map<string, { ok: boolean; ts: string; detail: string | null }>();
  for (const h of health.data ?? []) {
    if (!freshest.has(h.lane)) freshest.set(h.lane, h);
  }

  return (
    <div>
      <PageHead
        eyebrow="a0 / console"
        title="Models"
        desc="The public surface exposes categories only — chains resolve to the best free model at request time. Failure rolls over in-flight; chain order is the SLA."
        actions={
          <Seg<View>
            value={view}
            onChange={setView}
            options={[
              { value: "chains", label: "Chains" },
              { value: "flat", label: "Flat list" },
            ]}
          />
        }
      />

      {freshest.size > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
          {[...freshest.entries()].map(([lane, h]) => (
            <Pill key={lane} tone={h.ok ? "ok" : "err"} title={h.detail ?? undefined}>
              <span
                className="sa-dot"
                style={{ background: h.ok ? "var(--sa-ok)" : "var(--sa-err)" }}
              />
              {lane}
            </Pill>
          ))}
        </div>
      )}

      {view === "chains" ? (
        <Panel flush>
          {CATEGORIES.map((c) => (
            <div
              key={c.id}
              className="sa-row"
              style={{ alignItems: "start", gridTemplateColumns: "minmax(0,1fr)" }}
            >
              <div className="sa-row-l">
                <div className="sa-row-t" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <code className="sa-mono">{c.id}</code>
                </div>
                <div className="sa-row-d">{c.desc}</div>
                <div style={{ marginTop: 8, overflowX: "auto" }}>
                  <code
                    className="sa-mono"
                    style={{
                      fontSize: 11.5,
                      color: "var(--sa-text-2)",
                      background: "var(--sa-bg-3)",
                      border: "1px solid var(--sa-line)",
                      borderRadius: 4,
                      padding: "5px 8px",
                      display: "inline-block",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {CHAIN_PREVIEW[c.id] ?? "lane chain defined at build time"}
                  </code>
                </div>
              </div>
            </div>
          ))}
        </Panel>
      ) : (
        <Panel flush>
          <div className="sa-tablewrap">
            <table className="sa-table">
              <thead>
                <tr>
                  <th>Public name</th>
                  <th>Purpose</th>
                </tr>
              </thead>
              <tbody>
                {CATEGORIES.map((c) => (
                  <tr key={c.id}>
                    <td className="k">
                      <code className="sa-mono">{c.id}</code>
                    </td>
                    <td>{c.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}
