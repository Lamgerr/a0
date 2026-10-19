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
import { poolModels } from "@/lib/pools";
import { LabLogo, labTitle } from "@/components/custom/lab-logos";
import { hasSupabaseEnv, supabase } from "@/integrations/supabase/client";

/* Pool concept chips — capability language only, no infrastructure. */
const POOL_META: Record<
  string,
  { chips: string[]; blurb: string }
> = {
  "a0/flagship": {
    chips: ["1M ctx", "tools", "general"],
    blurb: "Go-to pool for everyday work — the strongest usable free round-trip.",
  },
  "a0/reasoning": {
    chips: ["thinking", "multi-step"],
    blurb: "Effort-controlled deep thinking for hard problems.",
  },
  "a0/coder": {
    chips: ["tool calling", "code"],
    blurb: "Tool-calling-first lanes tuned for repo work and diffs.",
  },
  "a0/vision": {
    chips: ["image-in"],
    blurb: "Accepts images inline — screenshots, scans, diagrams.",
  },
  "a0/fast": {
    chips: ["low latency", "drafting"],
    blurb: "Snappiest free lanes for chat and drafts.",
  },
  "a0/omni": {
    chips: ["text + image", "omni"],
    blurb: "Mixed-input lanes; image can ride along with text.",
  },
  "a0/long": {
    chips: ["1M ctx", "big docs"],
    blurb: "Longest-context lanes for whole-codebase or book-scale docs.",
  },
};

/* ── Lab marks: real brand marks, monogram fallback where none exists ── */

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

  /* Lane probes → tier pills (provider names never surface; lane_status view) */
  const health = useQuery({
    queryKey: ["lane_health_models"],
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

      {lanes.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 22 }}>
          {lanes.map((l) => (
            <Pill
              key={l.tier}
              tone={l.ok ? "ok" : "err"}
              title={l.ok ? "responding to probes" : "failing probes — traffic moved off it"}
            >
              <Dot tone={l.ok ? "ok" : "err"} pulse={l.ok} />
              {l.tier}
            </Pill>
          ))}
        </div>
      )}

      {view === "pools" ? (
        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
          {CATEGORIES.map((c) => {
            const meta = POOL_META[c.id]!;
            const picks = poolModels(c.id);
            return (
              <Panel key={c.id} flush className="pool-card">
                <div style={{ padding: "18px 18px 14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <code className="sa-mono" style={{ font: "500 15px/1 var(--sa-mono)", color: "var(--sa-text)" }}>
                      {c.id}
                    </code>
                    <Pill title="best models first; resolver falls through on degradation">{picks.length || "—"}</Pill>
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
                    resolution order — best first
                  </div>
                  <div style={{ display: "grid", gap: 8 }}>
                    {picks.map((m, i) => (
                      <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                        <LabLogo lab={m.lab} size={22} tile />
                        <span style={{ fontSize: 12.5, color: "var(--sa-text)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {m.name}
                        </span>
                        <span style={{ marginLeft: "auto", flex: "none", display: "inline-flex", gap: 4, alignItems: "center" }}>
                          <Pill title="context">{fmtCtx(m.ctx)}</Pill>
                          <Pill tone={i === 0 ? "ok" : "neutral"} title={i === 0 ? "primary host" : `fallback #${i}`}>{i === 0 ? "lead" : i}</Pill>
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
                <LabLogo lab={l} size={16} />
                {labTitle(l)}
              </button>
            ))}
          </div>

          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(330px, 1fr))" }}>
            {models.map((m) => (
              <Panel key={m.id} flush>
                <div style={{ display: "flex", gap: 11, padding: "13px 14px", alignItems: "center" }}>
                  <LabLogo lab={m.lab} />
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
