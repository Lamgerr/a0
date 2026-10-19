import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  PageHead,
  Panel,
  Pill,
  Empty,
  Note,
  CodeBlock,
  btn,
  Ico,
} from "@/components/custom/squid-app";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import {
  createVirtualKey,
  listVirtualKeys,
  revokeVirtualKey,
} from "@/hooks/use-api-keys";
import { hasSupabaseEnv } from "@/integrations/supabase/client";

export default function Keys() {
  const { user, controlPlaneConfigured } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [secret, setSecret] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const rows = useQuery({
    queryKey: ["virtual_keys"],
    queryFn: listVirtualKeys,
  });

  const create = useMutation({
    mutationFn: () => createVirtualKey(user?.id ?? null, name.trim() || "default"),
    onSuccess: ({ secret, error }) => {
      if (error) return toast.error(error);
      setSecret(secret);
      setOpen(false);
      setName("");
      qc.invalidateQueries({ queryKey: ["virtual_keys"] });
      toast.success("Key created — copy it now, it is shown once.");
    },
  });

  const revoke = useMutation({
    mutationFn: revokeVirtualKey,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["virtual_keys"] });
      setConfirmId(null);
      toast.success("Key revoked — a0 drops it within 60s.");
    },
  });

  const keys = rows.data ?? [];
  const activeCount = keys.filter((k) => !k.revoked).length;

  return (
    <div>
      <PageHead
        eyebrow="a0 / console"
        title="API Keys"
        desc="Virtual keys hash to the control plane — the panel keeps a hash and a prefix only."
        actions={
          <button type="button" className={btn("primary", "sm")} onClick={() => setOpen(true)}>
            <Ico.Lock size={13} /> New key
          </button>
        }
      />

      {keys.length > 0 && (
        <Panel flush>
          <div className="sa-tablewrap">
            <table className="sa-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Prefix</th>
                  <th>Limits</th>
                  <th>Created</th>
                  <th style={{ width: 90 }} />
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <tr key={k.id} style={k.revoked ? { opacity: 0.5 } : undefined}>
                    <td className="k">
                      {k.name}
                      {k.revoked && (
                        <span style={{ marginLeft: 8 }}>
                          <Pill title="revoked — a0 stops accepting it within 60s">
                            revoked
                          </Pill>
                        </span>
                      )}
                    </td>
                    <td>
                      <code className="sa-mono">{k.prefix}…</code>
                    </td>
                    <td>
                      <span className="sa-num">
                        {k.rpm} rpm · {k.daily_cap.toLocaleString()}/day
                      </span>
                    </td>
                    <td>{new Date(k.created_at).toLocaleDateString()}</td>
                    <td>
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                        {k.revoked ? (
                          <span className="sa-mute" style={{ fontSize: 12 }}>
                            revoked
                          </span>
                        ) : confirmId === k.id ? (
                          <button
                            type="button"
                            className={btn("danger", "sm")}
                            onClick={() => revoke.mutate(k.id)}
                            onBlur={() => setConfirmId(null)}
                          >
                            Confirm revoke
                          </button>
                        ) : (
                          <button
                            type="button"
                            className={btn("ghost", "sm")}
                            onClick={() => {
                              setConfirmId(k.id);
                              window.setTimeout(
                                () => setConfirmId((c) => (c === k.id ? null : c)),
                                4000,
                              );
                            }}
                          >
                            Revoke
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {rows.isSuccess && keys.length === 0 && (
        <Panel flush>
          <Empty
            icon={<Ico.Lock size={16} />}
            title="No keys yet"
            body={
              hasSupabaseEnv
                ? "Mint one to hit the gateway — every key is scoped to your identity."
                : "The endpoint answers without a key while the control plane is offline."
            }
            action={
              <button type="button" className={btn("primary", "sm")} onClick={() => setOpen(true)}>
                <Ico.Lock size={13} /> Mint a key
              </button>
            }
          />
        </Panel>
      )}

      {keys.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <Note tone={controlPlaneConfigured ? "info" : "warn"} title={controlPlaneConfigured ? `${activeCount} active.` : "Demo store."}>
            {controlPlaneConfigured
              ? "Keys are hashed server-side; the shown secret never lands anywhere else. Revoked keys drop out of route caches in 60s."
              : "Minted keys live in this browser's memory only — wire the control plane env for real keys."}
          </Note>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md" style={{ color: "var(--sa-text)" }}>
          <DialogHeader>
            <DialogTitle style={{ color: "var(--sa-text)" }}>Mint a virtual key</DialogTitle>
          </DialogHeader>
          <div style={{ display: "grid", gap: 16 }}>
            <div>
              <label className="sa-label" htmlFor="key-name">
                Name
              </label>
              <input
                id="key-name"
                className="sa-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="dex, babysitter, hackathon…"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !create.isPending) create.mutate();
                }}
              />
              <p className="sa-hint">Default limits: 20 rpm · 2,000 req/day per key.</p>
            </div>
            <button type="button" className={btn("primary", "md")} onClick={() => create.mutate()} disabled={create.isPending}>
              {create.isPending ? "Minting…" : "Create key"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(secret)} onOpenChange={(o) => !o && setSecret(null)}>
        <DialogContent className="sm:max-w-lg" style={{ color: "var(--sa-text)" }}>
          <DialogHeader>
            <DialogTitle style={{ color: "var(--sa-text)" }}>Your new key</DialogTitle>
          </DialogHeader>
          <CodeBlock
            lang="bearer token"
            code={secret ?? ""}
            copyText={secret ?? ""}
            wrap
          />
          <Note tone="warn" title="Shown once.">
            The panel only stores a hash + prefix. If you lose it, revoke and mint a new one.
          </Note>
          <Pill tone="info">send as: Authorization: Bearer &lt;key&gt;</Pill>
        </DialogContent>
      </Dialog>
    </div>
  );
}
