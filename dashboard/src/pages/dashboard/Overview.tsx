import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  PageHead,
  Panel,
  Row,
  Stat,
  Stats,
  Pill,
  Note,
  CodeBlock,
  btn,
  Ico,
  SecHead,
} from "@/components/custom/squid-app";
import { CATEGORIES, A0_BASE_URL } from "@/lib/a0";
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
        desc="Gateway posture at a glance — keys, wings, and the free pool."
        actions={
          <>
            <Link to="/dashboard/nodes" className={btn("default", "sm")}>
              Attach a wing
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
          value={activeKeys.length}
          sub={controlPlaneConfigured ? "hashed · shown once · 60s edge cache" : "demo store"}
        />
        <Stat
          label="Wings online"
          value={controlPlaneConfigured ? online.length : "—"}
          sub={
            controlPlaneConfigured
              ? `${nodesList.length} attached · heartbeat 30s`
              : "control plane offline"
          }
        />
        <Stat
          label="Endpoint"
          value={<span className="sa-num">{A0_BASE_URL}</span>}
          sub="OpenAI-compatible · /v1/chat/completions"
        />
        <Stat label="Free pool" value="3 lanes" sub="xkiro · llm7 · openrouter" />
      </Stats>

      {!controlPlaneConfigured && (
        <div style={{ marginTop: 16 }}>
          <Note tone="warn" title="Demo mode.">
            The control plane env is missing from this build — the panel runs
            with an in-memory store so every page stays browsable.
          </Note>
        </div>
      )}

      <div style={{ marginTop: 24 }}>
        <Panel title="Quick start" desc="Any OpenAI SDK or framework — point it at a wing." flush>
          <div style={{ padding: 16 }}>
            <CodeBlock code={QUICK_START} lang="python" wrap />
          </div>
        </Panel>
      </div>

      <SecHead
        title="The categories are the product"
        desc="Request a category — the chain resolves to the best usable free model at request time."
      />
      <Panel flush>
        {CATEGORIES.map((c) => (
          <Row
            key={c.id}
            label={<code className="sa-mono">{c.id}</code>}
            desc={c.desc}
          />
        ))}
      </Panel>
    </div>
  );
}
