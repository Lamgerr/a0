// node-usage — batched fire-and-forget usage events from wings.
import { admin, json, nodeIdentity, preflight } from '../_shared/deno.ts';

Deno.serve(async (req: Request) => {
  const pf = preflight(req);
  if (pf) return pf;
  if (req.method !== 'POST') return json({ ok: false, reason: 'POST only' }, 405);

  const id = nodeIdentity(req);
  if (!id) return json({ ok: false, reason: 'missing node identity' }, 401);

  const body = await req.json().catch(() => null);
  if (!Array.isArray(body?.events) || body.events.length === 0) {
    return json({ ok: false, reason: 'events[] required' }, 400);
  }
  if (body.events.length > 500) {
    return json({ ok: false, reason: 'batch > 500 events' }, 413);
  }
  // Stamp every event with the verified node identity (0005 schema ships the
  // node column; wings don't sign each event individually).
  const stamped = body.events.map((e: Record<string, unknown>) => ({ ...e, node: id.id }));
  const { data, error } = await admin().rpc('usage_batch', { p_events: stamped });
  if (error) return json({ ok: false, reason: error.message }, 500);
  return json({ ok: true, inserted: data ?? 0 });
});
