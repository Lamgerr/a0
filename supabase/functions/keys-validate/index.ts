// keys-validate — wing hot path for virtual keys (wings keep a 60s cache).
// Request: POST { key: "sk-a0-…" }  → { ok, key_id, tenant, rpm, daily_cap }
import { admin, json, nodeIdentity, preflight } from '../_shared/deno.ts';

Deno.serve(async (req: Request) => {
  const pf = preflight(req);
  if (pf) return pf;
  if (req.method !== 'POST') return json({ ok: false, reason: 'POST only' }, 405);

  const id = nodeIdentity(req);
  if (!id) return json({ ok: false, reason: 'missing node identity' }, 401);

  const body = await req.json().catch(() => null);
  if (!body?.key) return json({ ok: false, reason: 'key required' }, 400);

  const { data, error } = await admin().rpc('key_validate', { p_key: String(body.key).slice(0, 512) });
  if (error) return json({ ok: false, reason: error.message }, 500);
  // Key verdicts ride a 200 (ok:true/false); 401/400 are reserved for
  // transport-level problems (identity, missing key). The wing caches
  // negatives, so garbage keys cannot hammer the control plane.
  return json(data ?? { ok: false, reason: 'unknown' });
});
