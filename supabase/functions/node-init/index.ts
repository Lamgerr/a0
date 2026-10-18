// node-init — first contact of a wing.
// Registers/refreshes the node identity (SECURITY DEFINER SQL) and returns the
// runtime lane chain from the control plane's config table (a0_config). Wings
// never hold lane keys locally: .env on the host carries only A0_NODE_ID /
// CONTROL_TOKEN + SUPABASE_URL/ANON_KEY.
import { admin, json, nodeIdentity, preflight } from '../_shared/deno.ts';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

/** Lane chain comes from the control plane (a0_config), env as fallback. */
async function buildChainConfig(adb: SupabaseClient): Promise<unknown> {
  try {
    const { data, error } = await adb
      .from('a0_config')
      .select('value')
      .eq('id', 'lane_chain')
      .maybeSingle();
    if (!error && data?.value) {
      const v = data.value as { chain?: unknown[] };
      return Array.isArray(v?.chain) ? v.chain : (v as unknown) ?? null;
    }
  } catch {
    // fall through to env
  }
  const raw = Deno.env.get('A0_LANE_CHAIN') ?? '';
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : (parsed.chain ?? null);
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  const pf = preflight(req);
  if (pf) return pf;
  if (req.method !== 'POST') return json({ ok: false, reason: 'POST only' }, 405);

  const id = nodeIdentity(req);
  if (!id) return json({ ok: false, reason: 'missing node identity (x-a0-node + Bearer ct-)' }, 401);

  const body = await req.json().catch(() => ({}));
  const adb = admin();
  const { data, error } = await adb.rpc('node_register', {
    p_node_id: id.id,
    p_control_token: id.token,
    p_name: body?.name ?? null,
    p_region: body?.region ?? null,
  });
  if (error) return json({ ok: false, reason: error.message }, 500);
  if (!data?.registered) {
    return json({ ok: false, reason: data?.reason ?? 'rejected' }, 403);
  }

  const cfgResp = await adb.rpc('node_config', {
    p_node_id: id.id,
    p_control_token: id.token,
  });
  if (cfgResp.error || !cfgResp.data?.ok) {
    return json({ ok: false, reason: cfgResp.error?.message ?? cfgResp.data?.reason ?? 'config gate failed' }, 403);
  }

  return json({
    ok: true,
    adopted: data.adopted === true,
    mode: Deno.env.get('A0_PUBLIC_MODE') === '1' ? 'public' : 'local',
    chain: await buildChainConfig(adb),
  });
});
