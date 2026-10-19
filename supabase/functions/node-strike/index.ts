// node-strike — a wing reports abusive traffic it gated (kind + evidence).
// Identity hard-verified in SQL (node_strike); sentences are control-plane
// owned: wing enforcement is local until the 60s key-cache refresh sees it.
import { admin, json, nodeIdentity, preflight } from '../_shared/deno.ts';

Deno.serve(async (req: Request) => {
  const pf = preflight(req);
  if (pf) return pf;
  if (req.method !== 'POST') return json({ ok: false, reason: 'POST only' }, 405);

  const id = nodeIdentity(req);
  if (!id) return json({ ok: false, reason: 'missing node identity' }, 401);

  const body = await req.json().catch(() => null);
  if (!body?.key_id || !body?.kind) {
    return json({ ok: false, reason: 'key_id and kind required' }, 400);
  }
  if (typeof body.key_id !== 'string' || body.key_id.length > 64) {
    return json({ ok: false, reason: 'bad key_id' }, 400);
  }
  if (typeof body.kind !== 'string' || body.kind.length > 32) {
    return json({ ok: false, reason: 'bad kind' }, 400);
  }

  const { data, error } = await admin().rpc('node_strike', {
    p_node_id: id.id,
    p_control_token: id.token,
    p_key_id: body.key_id,
    p_kind: body.kind,
    p_detail: body.detail ?? {},
    p_ip: typeof body.ip === 'string' ? body.ip.slice(0, 64) : null,
  });
  if (error) return json({ ok: false, reason: error.message }, 500);
  return json(data ?? { ok: false });
});
