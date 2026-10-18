-- a0 control plane v1 — users/auth come from Supabase Auth (auth.users).
-- Apply via supabase CLI or SQL editor. Idempotent: guarded by doc-SQL comments.

-- ─────────────────────────── virtual keys ───────────────────────────
create table if not exists public.virtual_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'default',
  key_hash text not null unique,          -- sha256 of the raw secret; raw shown once
  prefix text not null,                   -- display slice only
  rpm int not null default 20,            -- ~20 RPM free tier per key
  daily_cap int not null default 2000,    -- 2,000 req/day default, tunable per key
  revoked boolean not null default false,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists virtual_keys_user_idx on public.virtual_keys (user_id);

alter table public.virtual_keys enable row level security;

create policy "owner read own keys" on public.virtual_keys
  for select using (auth.uid() = user_id);
create policy "owner insert own keys" on public.virtual_keys
  for insert with check (auth.uid() = user_id);
create policy "owner update own keys" on public.virtual_keys
  for update using (auth.uid() = user_id);
create policy "owner delete own keys" on public.virtual_keys
  for delete using (auth.uid() = user_id);

-- ─────────────────────────── usage events ───────────────────────────
create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  ts timestamptz not null default now(),
  lane text not null,
  model text not null,
  virtual_key uuid references public.virtual_keys(id) on delete set null,
  in_tok int not null default 0,
  out_tok int not null default 0,
  status int not null,
  latency_ms int not null default 0
);

create index if not exists usage_events_ts_idx on public.usage_events (ts desc);
create index if not exists usage_events_lane_idx on public.usage_events (lane);

alter table public.usage_events enable row level security;

-- wings write batched events with the service role (bypasses RLS).
-- tenants may only read events referencing their own keys (lane-level aggregation
-- is derived via views/dashboard rpc in a later migration).
create policy "tenant read usage of own keys" on public.usage_events
  for select using (
    exists (
      select 1 from public.virtual_keys vk
      where vk.id = usage_events.virtual_key and vk.user_id = auth.uid()
    )
  );

-- ─────────────────────────── lane health ───────────────────────────
create table if not exists public.lane_health (
  lane text not null,
  ts timestamptz not null default now(),
  ok boolean not null,
  detail text,
  primary key (lane, ts)
);

alter table public.lane_health enable row level security;

create policy "anyone reads lane health" on public.lane_health
  for select using (true);

-- ─────────────────────────── node registry ───────────────────────────
create table if not exists public.nodes (
  id text primary key,                    -- nd-XXXXXXXX, minted by the panel
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  region text,
  control_token_hash text not null unique -- one-time boot token, hashed
  ,
  status text not null default 'pending' check (status in ('pending','online','revoked')),
  last_heartbeat_at timestamptz,
  lanes_reported jsonb,
  created_at timestamptz not null default now()
);

create index if not exists nodes_owner_idx on public.nodes (owner_id);
create index if not exists nodes_status_idx on public.nodes (status);

alter table public.nodes enable row level security;

create policy "owner manages own nodes" on public.nodes
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
