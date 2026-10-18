import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as
  | string
  | undefined;

/**
 * a0 control plane credentials. Supplied at build time by Vercel env vars.
 * Until they exist the dashboard boots in local mode: UI works, data calls
 * are skipped and pages render their empty/demo states.
 */
export const hasSupabaseEnv = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export const supabase = createClient<Database>(
  SUPABASE_URL ?? 'https://placeholder.supabase.local',
  SUPABASE_ANON_KEY ?? 'public-anon-key-placeholder',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  },
);
