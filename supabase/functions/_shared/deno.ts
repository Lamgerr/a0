// Shared helpers for a0 node-protocol edge functions.
// Thin by design: all real logic lives in SECURITY DEFINER SQL (migrations
// 0001/0002). These adapters only parse the request, pick the right role
// and shape responses.

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, x-a0-node, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

export function preflight(req: Request): Response | null {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  return null;
}

/** Admin client — bypasses RLS; the platform injects the secret key. */
export function admin(): SupabaseClient {
  let key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!key) {
    try {
      const dict = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}');
      key = dict['default'] ?? '';
    } catch {
      key = '';
    }
  }
  return createClient(Deno.env.get('SUPABASE_URL') ?? '', key || 'none', {
    auth: { persistSession: false },
  });
}

/**
 * Node identity: the wing proves itself with a one-time minted pair.
 *   x-a0-node: <node id>
 *   Authorization: Bearer ct-…
 */
export function nodeIdentity(req: Request): { id: string; token: string } | null {
  const id = req.headers.get('x-a0-node') ?? '';
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!id.startsWith('nd-') || !token.startsWith('ct-')) return null;
  return { id, token };
}
