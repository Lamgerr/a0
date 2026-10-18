import { useQuery } from "@tanstack/react-query";
import {
  PageHead,
  Panel,
  Pill,
  Dot,
  Empty,
  Note,
  CodeBlock,
  Stat,
  Stats,
} from "@/components/custom/squid-app";
import { hasSupabaseEnv, supabase } from "@/integrations/supabase/client";
import type { NodeRow } from "@/integrations/supabase/types";

const STALE_MS = 2 * 60 * 1000;

async function fetchNodes(): Promise<NodeRow[]> {
  if (!hasSupabaseEnv) return [];
  const { data } = await supabase
    .from("nodes")
    .select("id,owner_id,name,region,control_token_hash,status,last_heartbeat_at,lanes_reported,created_at");
  return (data ?? []) as NodeRow[];
}

function ago(iso: string | null): string {
  if (!iso) return "never";
  const s = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 1000));
  if (s < 90) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function lanesOf(n: NodeRow): string[] {
  const r = n.lanes_reported;
  if (Array.isArray(r)) return r.map(String);
  if (r && typeof r === "object") return Object.keys(r);
  return [];
}

const ATTACH_ENV = `# on the wing host (any box with go 1.24+)
A0_NODE_ID=<provisioned node id>
A0_CONTROL_TOKEN=<provisioned control token>
A0_SUPABASE_URL=https://<project>.supabase.co
A0_SUPABASE_ANON_KEY=<publishable key>
A0_MODE=public
A0_PORT=8082

go run . # binary self-registers, then heartbeats every 30s`;

export default function Nodes() {
  const nodes = useQuery({
    queryKey: ["nodes"],
    queryFn: fetchNodes,
    refetchInterval: 20_000,
    staleTime: 15_000,
  });

  const real = hasSupabaseEnv;
  const list = nodes.data ?? [];
  const online = list.filter(
    (n) => n.status === "online" && n.last_heartbeat_at && Date.now() - Date.parse(n.last_heartbeat_at) < STALE_MS,
  );
  const stale = list.filter((n) => online.indexOf(n) === -1);

  function statusOf(n: NodeRow): { tone: "ok" | "warn" | "err" | "neutral"; label: string } {
    if (n.status === "revoked") return { tone: "err", label: "revoked" };
    if (n.status === "pending") return { tone: "neutral", label: "pending" };
    if (n.last_heartbeat_at && Date.now() - Date.parse(n.last_heartbeat_at) < STALE_MS)
      return { tone: "ok", label: "online" };
    return { tone: "warn", label: "stale" };
  }

  return (
    <div>
      <PageHead
        eyebrow="a0 / console"
        title="Nodes"
        desc="Wings self-register and heartbeat every 30s. Attach as many as you like — chain order is the SLA."
      />

      <Stats>
        <Stat label="Online" value={real ? online.length : "—"} sub="recent heartbeat" />
        <Stat label="Registered" value={real ? list.length : "—"} sub="total attached wings" />
        <Stat
          label="Lanes reported"
          value={real ? Math.max(0, ...list.map((n) => lanesOf(n).length)) : "—"}
          sub="per-wing pools"
        />
      </Stats>

      <div style={{ marginTop: 24 }}>
        {nodes.isLoading ? (
          <Panel flush>
            <Empty title="Loading nodes…" />
          </Panel>
        ) : !real ? (
          <Panel flush>
            <Empty
              title="Control plane offline"
              body="Wire the a00 env to list real wings. Node registration happens server-side on first boot."
            />
          </Panel>
        ) : list.length === 0 ? (
          <Panel flush>
            <Empty
              title="No wings attached"
              body="Run the wing on any box (Termux, a VPS, your laptop) — it appears here after its first heartbeat."
            />
          </Panel>
        ) : (
          <Panel flush>
            <div className="sa-tablewrap">
              <table className="sa-table">
                <thead>
                  <tr>
                    <th>Node</th>
                    <th>Region</th>
                    <th>Status</th>
                    <th>Heartbeat</th>
                    <th>Pool</th>
                    <th>Attached</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((n) => {
                    const s = statusOf(n);
                    const lanes = lanesOf(n);
                    return (
                      <tr key={n.id}>
                        <td className="k">
                          {n.name}
                          <span style={{ marginLeft: 8 }}>
                            <code className="sa-mono" style={{ fontSize: 11, color: "var(--sa-mute)" }}>
                              {n.id}
                            </code>
                          </span>
                        </td>
                        <td>{n.region ?? "—"}</td>
                        <td>
                          <Pill tone={s.tone === "neutral" ? "neutral" : s.tone}>
                            <Dot tone={s.tone === "neutral" ? "neutral" : s.tone} pulse={s.tone === "ok"} />
                            {s.label}
                          </Pill>
                        </td>
                        <td>{ago(n.last_heartbeat_at)}</td>
                        <td>
                          {lanes.length ? (
                            <span style={{ display: "inline-flex", gap: 5, flexWrap: "wrap" }}>
                              {lanes.map((l) => (
                                <Pill key={l}>{l}</Pill>
                              ))}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td>{new Date(n.created_at).toLocaleDateString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
        )}

        {real && stale.length > 0 && online.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <Note tone="warn" title={`${stale.length} stale node${stale.length > 1 ? "s" : ""}.`}>
              No heartbeat in the last 2 minutes — offline wings fall out of the chain automatically.
            </Note>
          </div>
        )}
      </div>

      <div style={{ marginTop: 24 }}>
        <Panel
          title="Attach a wing"
          desc="The env contract a registered wing consumes. Control tokens are provisioned operator-side for now — self-serve minting lands next."
          flush
        >
          <div style={{ padding: 16 }}>
            <CodeBlock lang="env" code={ATTACH_ENV} wrap />
          </div>
        </Panel>
      </div>
    </div>
  );
}
