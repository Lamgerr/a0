import { useAuth } from "@/contexts/AuthContext";
import {
  hasSupabaseEnv,
  supabase,
} from "@/integrations/supabase/client";
import type { VirtualKey } from "@/integrations/supabase/types";

export interface KeyState {
  rows: VirtualKey[];
  loading: boolean;
  demo: boolean;
}

export async function createVirtualKey(
  userId: string | null,
  name: string,
): Promise<{ secret: string; error: string | null }> {
  if (!hasSupabaseEnv) {
    const secret = `sk-a0-demo-${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
    demoKeys.unshift({
      id: secret,
      user_id: "demo",
      name,
      key_hash: "demo-hash",
      prefix: secret.slice(0, 12),
      rpm: 20,
      daily_cap: 2000,
      revoked: false,
      created_at: new Date().toISOString(),
      last_used_at: null,
    });
    return { secret, error: null };
  }
  const secret = `sk-a0-${crypto.randomUUID().replace(/-/g, "")}`;
  const hash = await sha256(secret);
  const { error } = await supabase.from("virtual_keys").insert({
    user_id: userId!,
    name,
    key_hash: hash,
    prefix: secret.slice(0, 12),
    rpm: 20,
    daily_cap: 2000,
  });
  return { secret, error: error?.message ?? null };
}

export async function listVirtualKeys(): Promise<VirtualKey[]> {
  if (!hasSupabaseEnv) return demoKeys;
  const { data } = await supabase
    .from("virtual_keys")
    .select("*")
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function revokeVirtualKey(id: string): Promise<string | null> {
  if (!hasSupabaseEnv) {
    demoKeys = demoKeys.filter((k) => k.id !== id);
    return null;
  }
  const { error } = await supabase
    .from("virtual_keys")
    .update({ revoked: true })
    .eq("id", id);
  return error?.message ?? null;
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

let demoKeys: VirtualKey[] = [];
