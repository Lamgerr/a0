// node-heartbeat — wings call every 30s; optional lane health snapshot lands
// in lane_health (SECURITY DEFINER SQL).
import { admin, json, nodeIdentity, preflight } from '../_shared/deno.ts';

Deno.serve(async (req: Request) => {
  const pf = preflight(req);
  if (pf) return pf;
  if (req.method !== 'POST') return json({ ok: false, reason: 'POST only' }, 405);

  const id = nodeIdentity(req);
  if (!id) return json({ ok: false, reason: 'missing node identity' }, 401);

  const body = await req.json().catch(() => ({}));
  const { data, error } = await admin().rpc('node_heartbeat', {
    p_node_id: id.id,
    p_control_token: id.token,
    p_lanes: body?.lanes ?? null,
  });
  if (error) return json({ ok: false, reason: error.message }, 500);
  return json(data ?? { ok: false });
});
