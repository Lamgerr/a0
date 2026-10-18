/**
 * a0 control-plane schema (handwritten, no codegen dependency).
 * Mirrors supabase/migrations/*.sql — keep both in sync when M2 lands knobs.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      virtual_keys: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          key_hash: string;
          prefix: string;
          rpm: number;
          daily_cap: number;
          revoked: boolean;
          created_at: string;
          last_used_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          key_hash: string;
          prefix: string;
          rpm?: number;
          daily_cap?: number;
          revoked?: boolean;
          created_at?: string;
          last_used_at?: string | null;
        };
        Update: {
          name?: string;
          rpm?: number;
          daily_cap?: number;
          revoked?: boolean;
          last_used_at?: string | null;
        };
        Relationships: [];
      };
      usage_events: {
        Row: {
          id: string;
          ts: string;
          lane: string;
          model: string;
          virtual_key: string | null;
          node: string | null;
          in_tok: number;
          out_tok: number;
          status: number;
          latency_ms: number;
        };
        Insert: {
          id?: string;
          ts?: string;
          lane: string;
          model: string;
          virtual_key?: string | null;
          node?: string | null;
          in_tok?: number;
          out_tok?: number;
          status: number;
          latency_ms?: number;
        };
        Update: { status?: number };
        Relationships: [];
      };
      lane_health: {
        Row: {
          lane: string;
          ts: string;
          ok: boolean;
          detail: string | null;
        };
        Insert: {
          lane: string;
          ts?: string;
          ok: boolean;
          detail?: string | null;
        };
        Update: { detail?: string | null };
        Relationships: [];
      };
      nodes: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          region: string | null;
          control_token_hash: string;
          status: 'pending' | 'online' | 'revoked';
          last_heartbeat_at: string | null;
          lanes_reported: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          region?: string | null;
          control_token_hash: string;
          status?: 'pending' | 'online' | 'revoked';
          last_heartbeat_at?: string | null;
          lanes_reported?: Json | null;
          created_at?: string;
        };
        Update: {
          name?: string;
          status?: 'pending' | 'online' | 'revoked';
          last_heartbeat_at?: string | null;
          lanes_reported?: Json | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

export type VirtualKey = Database['public']['Tables']['virtual_keys']['Row'];
export type NodeRow = Database['public']['Tables']['nodes']['Row'];
