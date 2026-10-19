import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  PageHead,
  Panel,
  Pill,
  Dot,
  Seg,
  useHashState,
  Empty,
  btn,
  Ico,
  useSearchShortcut,
} from "@/components/custom/squid-app";
import { CATEGORIES } from "@/lib/a0";
import { MODELS, LABS, FREE_COUNT, fmtCtx, type CatalogModel } from "@/lib/catalog";
import { laneLabel } from "@/lib/lane-label";
import { hasSupabaseEnv, supabase } from "@/integrations/supabase/client";

/* Pool concept chips — capability language only, no infrastructure. */
const POOL_META: Record<
  string,
  { chips: string[]; blurb: string; pick: (m: CatalogModel) => boolean }
> = {
  "a0/flagship": {
    chips: ["1M ctx", "tools", "general"],
    blurb: "Go-to pool for everyday work — the strongest usable free round-trip.",
    pick: (m) => m.ctx >= 128_000 && m.tools,
  },
  "a0/reasoning": {
    chips: ["thinking", "multi-step"],
    blurb: "Prefers lanes that expose effort-controlled deep thinking.",
    pick: (m) => m.reasoning,
  },
  "a0/coder": {
    chips: ["tool calling", "code"],
    blurb: "Tool-calling-first lanes tuned for repo work and diffs.",
    pick: (m) => m.tools,
  },
  "a0/vision": {
    chips: ["image-in"],
    blurb: "Accepts images inline — screenshots, scans, diagrams.",
    pick: (m) => m.vision,
  },
  "a0/fast": {
    chips: ["low latency", "drafting"],
    blurb: "Snappiest free lanes for chat and drafts.",
    pick: (m) => m.ctx >= 32_000,
  },
  "a0/omni": {
    chips: ["text + image", "omni"],
    blurb: "Mixed-input chains; image can ride along with text.",
    pick: (m) => (m.vision && m.modality !== "chat") || (m.vision && m.id.includes("omni")),
  },
  "a0/long": {
    chips: ["1M ctx", "big docs"],
    blurb: "Longest-context lanes for whole-codebase or book-scale docs.",
    pick: (m) => m.ctx >= 500_000,
  },
};

/* ── Lab marks: letter tiles with a per-lab accent ring ── */
const LAB_ACCENT: Record<string, number> = {
  anthropic: 24, openai: 210, google: 0, qwen: 200, mistral: 32,
  deepseek: 192, nvidia: 100, minimax: 280, mimo: 42, grok: 330,
  kimi: 262, tencent: 160, meituan: 12, stealth: 0, api: 220,
  "opencode-zen": 84,
};
const LAB_MARK: Record<string, string> = {
  anthropic: "A", openai: "O", google: "G", qwen: "Q", mistral: "M",
  deepseek: "D", nvidia: "N", minimax: "X", mimo: "m", grok: "X",
  kimi: "K", tencent: "T", meituan: "L", stealth: "S", api: "C",
  "opencode-zen": "Z",
};
function labName(lab: string): string {
  if (lab === "api") return "Cohere";
  if (lab === "opencode-zen") return "LongCat";
  return lab.charAt(0).toUpperCase() + lab.slice(1).replace(/ai$/, "AI");
}

function LabMark({ lab, size = 30 }: { lab: string; size?: number }) {
  const accent = LAB_ACCENT[lab] ?? 220;
  return (
    <span
      aria-hidden="true"
      className="sa-mono"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        flex: "none",
        borderRadius: Math.round(size * 0.24),
        background: "var(--sa-bg-3)",
        border: "1px solid var(--sa-line-2)",
        boxShadow: `inset 0 0 0 1.5px hsl(${accent} 55% 62% / 0.35)`,
        color: `hsl(${accent} 30% 85%)`,
        font: `500 ${Math.round(size * 0.44)}px/1 var(--sa-mono)`,
        letterSpacing: 0,
      }}
    >
      {LAB_MARK[lab] ?? lab[0].toUpperCase()}
    </span>
  );
}

function CapChips({ m, compact }: { m: CatalogModel; compact?: boolean }) {
  const chips: string[] = [];
  if (m.reasoning) chips.push("think");
  if (m.tools) chips.push("tools");
  if (m.vision) chips.push("vision");
  return (
    <span style={{ display: "inline-flex", gap: 4, flexWrap: "wrap" }}>
      {chips.map((c) => (
        <Pill key={c} title={c}>
          {compact ? c[0].toUpperCase() : c}
        </Pill>
      ))}
      {m.ctx > 0 && (
        <Pill title="context window">
          {fmtCtx(m.ctx)} ctx
        </Pill>
      )}
    </span>
  );
}

type View = "pools" | "catalog";

export default function Models() {
  const [view, setView] = useHashState<View>("view", "pools", ["pools", "catalog"]);
  const [lab, setLab] = useHashState<string>("lab", "all");
  const [q, setQ] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  useSearchShortcut(searchRef);

  /* Lane probes → tier pills (provider names never surface) */
  const health = useQuery({
    queryKey: ["lane_health_models"],
    queryFn: async () => {
      if (!hasSupabaseEnv) return [];
      const { data } = await supabase
        .from("lane_health")
        .select("lane, ts, ok, detail")
        .order("ts", { ascending: false })
        .limit(24);
      return (data ?? []) as Array<{ lane: string; ts: string; ok: boolean; detail: string | null }>;
    },
    staleTime: 10_000,
    refetchInterval: 30_000,
  });
  const freshest = new Map<string, { ok: boolean; detail: string | null }>();
  for (const h of health.data ?? []) if (!freshest.has(h.lane)) freshest.set(h.lane, h);

  const models = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return MODELS.filter(
      (m) =>
        (lab === "all" || m.lab === lab) &&
        (!ql || m.id.toLowerCase().includes(ql) || m.name.toLowerCase().includes(ql) || m.lab.includes(ql)),
    );
  }, [q, lab]);

  return (
    <div>
      <PageHead
        eyebrow="a0 / models"
        title="Models"
        desc={`${FREE_COUNT} free models reachable. Resolver picks per request, failover is silent — you never see the machinery.`}
        actions={
          <Seg<View>
            value={view}
            onChange={setView}
            options={[
              { value: "pools", label: "Pools" },
              { value: "catalog", label: `Catalog · ${FREE_COUNT}` },
            ]}
          />
        }
      />

      {freshest.size > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 22 }}>
          {[...freshest.entries()].map(([lane, h]) => (
            <Pill
              key={lane}
              tone={h.ok ? "ok" : "err"}
              title={h.ok ? "responding to probes" : "failing probes — traffic moved off it"}
            >
              <Dot tone={h.ok ? "ok" : "err"} pulse={h.ok} />
              {laneLabel(lane)}
            </Pill>
          ))}
        </div>
      )}

      {view === "pools" ? (
        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
          {CATEGORIES.map((c) => {
            const meta = POOL_META[c.id]!;
            const picks = MODELS.filter((m) => meta.pick(m)).slice(0, 3);
            return (
              <Panel key={c.id} flush className="pool-card">
                <div style={{ padding: "18px 18px 14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <code className="sa-mono" style={{ font: "500 15px/1 var(--sa-mono)", color: "var(--sa-text)" }}>
                      {c.id}
                    </code>
                  </div>
                  <p style={{ margin: "9px 0 0", fontSize: 13, lineHeight: 1.55, color: "var(--sa-text-2)", minHeight: 40 }}>
                    {meta.blurb}
                  </p>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 12 }}>
                    {meta.chips.map((chip) => (
                      <Pill key={chip} tone="solid">{chip}</Pill>
                    ))}
                  </div>
                </div>
                <div style={{ borderTop: "1px solid var(--sa-line)", padding: "12px 18px 14px" }}>
                  <div
                    className="lg-text-label"
                    style={{ marginBottom: 9 }}
                  >
                    currently resolving to
                  </div>
                  <div style={{ display: "grid", gap: 8 }}>
                    {picks.map((m) => (
                      <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                        <LabMark lab={m.lab} size={22} />
                        <span style={{ fontSize: 12.5, color: "var(--sa-text)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {m.name}
                        </span>
                        <span style={{ marginLeft: "auto", flex: "none" }}>
                          <Pill title="context">{fmtCtx(m.ctx)}</Pill>
                        </span>
                      </div>
                    ))}
                    {picks.length === 0 && (
                      <span style={{ fontSize: 12, color: "var(--sa-mute)" }}>resolves at request time</span>
                    )}
                  </div>
                </div>
              </Panel>
            );
          })}
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
            <div className="sa-field-wrap" style={{ minWidth: 250, flex: "1 1 260px", maxWidth: 420 }}>
              <Ico.Search size={14} />
              <input
                ref={searchRef}
                className="sa-input"
                placeholder="Search free models…  (press /)"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                aria-label="Search models"
              />
            </div>
          </div>

          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 20 }}>
            <button type="button" className={btn(lab === "all" ? "default" : "ghost", "sm")} onClick={() => setLab("all")}>
              All labs
            </button>
            {LABS.map((l) => (
              <button
                key={l}
                type="button"
                className={btn(lab === l ? "default" : "ghost", "sm")}
                onClick={() => setLab(lab === l ? "all" : l)}
              >
                <LabMark lab={l} size={16} />
                {labName(l)}
              </button>
            ))}
          </div>

          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(330px, 1fr))" }}>
            {models.map((m) => (
              <Panel key={m.id} flush>
                <div style={{ display: "flex", gap: 11, padding: "13px 14px", alignItems: "center" }}>
                  <LabMark lab={m.lab} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--sa-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {m.name}
                    </div>
                    <div className="sa-mono" style={{ fontSize: 10.5, color: "var(--sa-mute)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {m.id}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", padding: "0 14px 13px" }}>
                  <CapChips m={m} />
                  {m.max_out > 0 && <Pill title="max output">{fmtCtx(m.max_out)} out</Pill>}
                  {m.efforts.length > 0 && (
                    <Pill title={`reasoning efforts: ${m.efforts.join(", ")}`}>
                      effort · {m.efforts.length}
                    </Pill>
                  )}
                </div>
              </Panel>
            ))}
          </div>

          {models.length === 0 && (
            <Panel flush>
              <Empty
                icon={<Ico.Search size={16} />}
                title="No models match"
                body="Loosen the lab filter, or clear the search."
                action={
                  <button type="button" className={btn("default", "sm")} onClick={() => { setQ(""); setLab("all"); }}>
                    Reset filters
                  </button>
                }
              />
            </Panel>
          )}
        </>
      )}
    </div>
  );
}
