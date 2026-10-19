import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  PageHead,
  Panel,
  Stat,
  Stats,
  Empty,
  Note,
  Pill,
  SkelRows,
  Seg,
  useHashState,
} from "@/components/custom/squid-app";
import { hasSupabaseEnv, supabase } from "@/integrations/supabase/client";
import { laneLabel } from "@/lib/lane-label";

interface UsageRow {
  ts: string;
  lane: string;
  in_tok: number;
  out_tok: number;
  status: number;
  latency_ms: number;
  node: string | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

async function fetchUsage(): Promise<UsageRow[]> {
  if (!hasSupabaseEnv) return [];
  const { data, error } = await supabase
    .from("usage_events")
    .select("ts, lane, in_tok, out_tok, status, latency_ms, node")
    .gte("ts", new Date(Date.now() - DAY_MS).toISOString())
    .order("ts", { ascending: false })
    .limit(5000);
  if (error) throw new Error(error.message);
  return (data ?? []) as UsageRow[];
}

/* Demo series — same shape as the real aggregate, shown until the
   control plane is wired. */
const DEMO_SERIES = Array.from({ length: 24 }, (_, h) => ({
  tokens: Math.round(
    2000 + 9000 * Math.abs(Math.sin(h * 0.9)) + (h > 6 && h < 22 ? 4200 : 0),
  ),
}));

type Range = "1h" | "6h" | "24h";

export default function Usage() {
  const [range, setRange] = useHashState<Range>("range", "24h", ["1h", "6h", "24h"]);
  const windowMs = range === "1h" ? 60 * 60 * 1000 : range === "6h" ? 6 * 60 * 60 * 1000 : DAY_MS;
  const real = hasSupabaseEnv;

  const events = useQuery({
    queryKey: ["usage_events"],
    queryFn: fetchUsage,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const series = useMemo(() => {
    const bucketCount = range === "1h" ? 12 : range === "6h" ? 18 : 24;
    const bucketMs = windowMs / bucketCount;
    const start = Date.now() - windowMs;

    const agg = Array.from({ length: bucketCount }, (_, i) => ({
      t: start + (i + 1) * bucketMs,
      tokens: 0,
      reqs: 0,
      errors: 0,
    }));

    const rows = real
      ? (events.data ?? []).filter((r) => Date.parse(r.ts) >= start)
      : [];

    if (real) {
      for (const r of rows) {
        const idx = Math.min(
          bucketCount - 1,
          Math.max(0, Math.floor((Date.parse(r.ts) - start) / bucketMs)),
        );
        agg[idx].tokens += r.in_tok + r.out_tok;
        agg[idx].reqs += 1;
        if (r.status >= 400) agg[idx].errors += 1;
      }
    } else {
      for (let i = 0; i < bucketCount; i++) {
        const s = DEMO_SERIES[(i * 3 + 5) % DEMO_SERIES.length];
        agg[i].tokens = s.tokens;
        agg[i].reqs = Math.round(s.tokens / 900);
      }
    }

    const fmtTime = (t: number) =>
      new Date(t).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });

    const items = agg.map((a) => ({
      hour: fmtTime(a.t),
      tokens: Math.round(a.tokens),
      reqs: a.reqs,
    }));

    const totals = rows.reduce(
      (a, r) => {
        a.inTok += r.in_tok;
        a.outTok += r.out_tok;
        a.reqs += 1;
        if (r.status >= 400) a.errors += 1;
        a.lat += r.latency_ms;
        return a;
      },
      { inTok: 0, outTok: 0, reqs: 0, errors: 0, lat: 0 },
    );
    if (!real) {
      totals.reqs = items.reduce((a, i) => a + i.reqs, 0);
      totals.errors = 2;
      for (const p of items) totals.inTok += Math.round(p.tokens * 0.7);
      totals.outTok = items.reduce((a, p) => a + p.tokens, 0);
    }

    const lanes = new Map<string, { reqs: number; tokens: number }>();
    for (const r of rows) {
      const l = lanes.get(r.lane) ?? { reqs: 0, tokens: 0 };
      l.reqs += 1;
      l.tokens += r.in_tok + r.out_tok;
      lanes.set(r.lane, l);
    }

    const lats = rows.map((r) => r.latency_ms).sort((a, b) => a - b);
    const medLat = lats.length ? lats[Math.floor(lats.length / 2)] : real ? 0 : 142;

    return { items, totals, lanes, medLat, rows };
  }, [events.data, events.isLoading, windowMs, range, real]);

  const { totals, lanes, medLat } = series;
  const totalTokens = totals.inTok + totals.outTok;

  return (
    <div>
      <PageHead
        eyebrow="a0 / console"
        title="Usage"
        desc={
          real
            ? "Tokens and requests across lanes, fed by gateway usage events."
            : "Demo series until the control plane is wired."
        }
        actions={
          <Seg<Range>
            value={range}
            onChange={setRange}
            options={[
              { value: "1h", label: "1h" },
              { value: "6h", label: "6h" },
              { value: "24h", label: "24h" },
            ]}
          />
        }
      />

      <Stats>
        <Stat label="Requests" value={totals.reqs.toLocaleString()} sub={real ? "in selected window" : "demo"} />
        <Stat
          label="Tokens"
          value={fmtK(totalTokens)}
          sub={`${fmtK(totals.inTok)} in · ${fmtK(totals.outTok)} out`}
        />
        <Stat
          label="Errors"
          value={totals.errors.toLocaleString()}
          sub={totals.reqs ? `${((totals.errors / totals.reqs) * 100).toFixed(1)}% of calls` : "—"}
        />
        <Stat
          label="Median latency"
          value={medLat ? `${medLat.toLocaleString()}ms` : "—"}
          sub="end-to-end, all lanes"
        />
      </Stats>

      <div style={{ marginTop: 24 }}>
        <Panel
          title={`Tokens · last ${range === "24h" ? "24 hours" : range === "6h" ? "6 hours" : "hour"}`}
          desc="in + out, all lanes"
          flush
        >
          <div style={{ height: 288, padding: 16 }}>
            {events.isLoading ? (
              <SkelRows rows={5} />
            ) : real && (events.data ?? []).length === 0 ? (
              <Empty
                title="No traffic yet"
                body="Usage events appear the moment a key routes a request through a wing."
              />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series.items} margin={{ left: -6, right: 8, top: 8 }}>
                  <defs>
                    <linearGradient id="tok" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--foreground))" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="hsl(var(--foreground))" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="hour"
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                    interval="preserveStartEnd"
                    minTickGap={28}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => fmtK(v)}
                    width={44}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                      color: "hsl(var(--popover-foreground))",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="tokens"
                    stroke="hsl(var(--foreground))"
                    strokeWidth={1.5}
                    fill="url(#tok)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Panel>
      </div>

      {real && lanes.size > 0 && (
        <div style={{ marginTop: 24 }}>
          <Panel title="Lanes in window" desc="which pool served which share of traffic" flush>
            <div className="sa-tablewrap">
              <table className="sa-table">
                <thead>
                  <tr>
                    <th>Lane</th>
                    <th>Requests</th>
                    <th>Tokens</th>
                    <th style={{ width: "30%" }}>Share</th>
                  </tr>
                </thead>
                <tbody>
                  {[...lanes.entries()]
                    .sort((a, b) => b[1].tokens - a[1].tokens)
                    .map(([lane, l]) => {
                      const total = [...lanes.values()].reduce((a, x) => a + x.tokens, 0) || 1;
                      const pct = Math.round((l.tokens / total) * 100);
                      return (
                        <tr key={lane}>
                          <td className="k">
                            <Pill tone="solid">{laneLabel(lane)}</Pill>
                          </td>
                          <td className="sa-num">{l.reqs.toLocaleString()}</td>
                          <td className="sa-num">{fmtK(l.tokens)}</td>
                          <td>
                            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                              <div className="sa-meter" style={{ width: "100%" }} role="presentation">
                                <i style={{ width: `${pct}%` }} />
                              </div>
                              <span style={{ fontSize: 11, color: "var(--sa-mute)" }}>{pct}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      )}

      {!real && (
        <div style={{ marginTop: 16 }}>
          <Note tone="warn" title="Demo series.">
            Pending control-plane env, the chart renders synthesized traffic so
            the surface stays testable.
          </Note>
        </div>
      )}
    </div>
  );
}

function fmtK(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(Math.round(n));
}
