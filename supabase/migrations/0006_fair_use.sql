-- 0006_fair_use.sql — abuse defense + fair use for a0.
-- Wing does hot-path limiting; the control plane holds authority:
--   * virtual_keys gains a status machine (active → held → banned) the wing
--     picks up on its 60s key-cache refresh;
--   * abuse_events is the forensic ledger the wing (and panel) feed;
--   * key_strike applies the strike decay + escalation policy atomically;
--   * day counters for caps come from usage_events, not trust in wings.

-- ── virtual_keys: status machine ────────────────────────────────
alter table public.virtual_keys
  add column if not exists status text not null default 'active',
  add column if not exists status_until timestamptz,
  add column if not exists strikes int not null default 0,
  add column if not exists last_strike_at timestamptz;

alter table public.virtual_keys
  drop constraint if exists virtual_keys_status_check;
alter table public.virtual_keys
  add constraint virtual_keys_status_check
  check (status in ('active', 'held', 'banned'));

-- only the control plane (service role) may sentence a key. Panel/authed
-- users can mint + revoke their own keys, never un-ban them.
create or replace function public.vk_guard_status()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if ( NEW.status is distinct from OLD.status
    or NEW.strikes   is distinct from OLD.strikes )
    and coalesce(current_setting('request.jwt.claims.role', true), '') <> 'service_role'
  then
    raise exception 'key sentences are control-plane only';
  end if;
  return new;
end $$;

drop trigger if exists vk_guard_status_trg on public.virtual_keys;
create trigger vk_guard_status_trg
  before update on public.virtual_keys
  for each row execute function public.vk_guard_status();

-- users may hold at most 10 live keys (key-farm defense)
drop policy if exists "owner insert own keys" on public.virtual_keys;
create policy "owner insert own keys (max 10 live)" on public.virtual_keys
  for insert with check (
    auth.uid() = user_id
    and (
      select count(*) from public.virtual_keys vk
      where vk.user_id = auth.uid() and not vk.revoked
    ) < 10
  );

-- ── usage_events: IP forensics + cap-friendly indexes ───────────
alter table public.usage_events add column if not exists ip inet;
create index if not exists usage_events_key_day_idx
  on public.usage_events (virtual_key, ts desc);

-- ── abuse_events: forensic ledger ───────────────────────────────
create table if not exists public.abuse_events (
  id uuid primary key default gen_random_uuid(),
  ts timestamptz not null default now(),
  abuse_kind text not null,              -- rate|burst|day|tokens|share|streams|break|manual
  virtual_key uuid references public.virtual_keys(id) on delete set null,
  node text,
  ip inet,
  detail jsonb not null default '{}'
);
create index if not exists abuse_events_key_idx on public.abuse_events (virtual_key, ts desc);
create index if not exists abuse_events_ip_idx  on public.abuse_events (ip, ts desc);
create index if not exists abuse_events_kind_idx on public.abuse_events (abuse_kind, ts desc);

alter table public.abuse_events enable row level security;

-- service (wings via edge fns) writes; owners may read events for own keys.
create policy "service writes abuse events" on public.abuse_events
  for insert with check (true);
create policy "owner reads own abuse events" on public.abuse_events
  for select using (
    exists (
      select 1 from public.virtual_keys vk
      where vk.id = abuse_events.virtual_key and vk.user_id = auth.uid()
    )
  );

-- ── key_validate v2: status-aware + day counters ────────────────
create or replace function public.key_validate(p_key text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$

  declare vk record;
  declare day_count int;
  begin
    if p_key is null or p_key = '' then
      return jsonb_build_object('ok', false, 'reason', 'missing key');
    end if;

    select * into vk from virtual_keys where key_hash = public.sha256_hex(p_key);
    if not found then
      return jsonb_build_object('ok', false, 'reason', 'unknown key');
    end if;

    if vk.revoked then
      return jsonb_build_object('ok', false, 'reason', 'revoked', 'key_id', vk.id);
    end if;

    -- held expired → release (strikes kept; next strike re-escaliates)
    if vk.status = 'held' and vk.status_until is not null and vk.status_until <= now() then
      update virtual_keys
        set status = 'active', status_until = null, last_used_at = now()
        where id = vk.id;
      vk.status := 'active';
    end if;

    if vk.status = 'banned' then
      return jsonb_build_object('ok', false, 'reason', 'banned', 'key_id', vk.id);
    end if;
    if vk.status = 'held' then
      return jsonb_build_object(
        'ok', false, 'reason', 'fair-use hold',
        'key_id', vk.id, 'status', 'held',
        'status_until', to_char(vk.status_until at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'));
    end if;

    select count(*) into day_count
      from usage_events ue
      where ue.virtual_key = vk.id and ue.ts >= date_trunc('day', now());

    update virtual_keys set last_used_at = now() where id = vk.id;

    return jsonb_build_object(
      'ok', true,
      'key_id', vk.id,
      'tenant', vk.user_id,
      'name', vk.name,
      'rpm', vk.rpm,
      'daily_cap', vk.daily_cap,
      'day_count', day_count,
      'strikes', vk.strikes,
      'status', 'active'
    );
  end
$$;

-- ── key_strike: strike decay + escalation (service only) ────────
create or replace function public.key_strike(
  p_key_id uuid,
  p_kind text,
  p_detail jsonb default '{}',
  p_node text default null,
  p_ip text default null
)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
  declare vk record;
  declare hold_hours int := 1;
  begin
    select * into vk from virtual_keys where id = p_key_id;
    if not found then
      return jsonb_build_object('ok', false, 'reason', 'unknown key');
    end if;

    insert into abuse_events (abuse_kind, virtual_key, node, ip, detail)
      values (p_kind, p_key_id, p_node, p_ip, p_detail);

    -- decay: 24h clean slate forgets the priors (except the ban-grade book)
    if vk.last_strike_at is null or vk.last_strike_at < now() - interval '24 hours' then
      update virtual_keys set strikes = 0 where id = p_key_id;
      vk.strikes := 0;
    end if;

    update virtual_keys
      set strikes = strikes + 1, last_strike_at = now()
      where id = p_key_id returning * into vk;

    if vk.strikes >= 9 then
      update virtual_keys set status = 'banned', status_until = null
        where id = p_key_id;
      return jsonb_build_object('ok', true, 'status', 'banned', 'strikes', vk.strikes);
    end if;

    if vk.strikes >= 3 then
      update virtual_keys
        set status = 'held',
            status_until = now() + (hold_hours || ' hours')::interval
        where id = p_key_id;
      return jsonb_build_object(
        'ok', true, 'status', 'held', 'strikes', vk.strikes,
        'status_until', to_char(now() + (hold_hours || ' hours')::interval
                            at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'));
    end if;

    return jsonb_build_object('ok', true, 'status', 'active', 'strikes', vk.strikes);
  end
$$;

revoke execute on function public.key_strike(uuid, text, jsonb, text, text) from anon, authenticated;
revoke execute on function public.key_strike(uuid, text, jsonb, text, text) from public;
grant execute on function public.key_strike(uuid, text, jsonb, text, text) to service_role;

revoke execute on function public.key_validate(text) from anon, authenticated;
revoke execute on function public.key_validate(text) from public;
grant execute on function public.key_validate(text) to service_role;

-- ── node_strike: wing identity wrapper around key_strike (service only) ──
create or replace function public.node_strike(
  p_node_id text, p_control_token text, p_key_id uuid,
  p_kind text, p_detail jsonb default '{}', p_ip text default null
)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
  declare n record;
  begin
    select * into n from nodes
      where id = p_node_id and control_token_hash = public.sha256_hex(p_control_token)
        and status <> 'revoked';
    if not found then
      return jsonb_build_object('ok', false, 'reason', 'unknown node or bad token');
    end if;
    return public.key_strike(p_key_id, p_kind, p_detail, p_node_id, p_ip);
  end
$$;

revoke execute on function public.node_strike(text, text, uuid, text, jsonb, text) from anon, authenticated;
revoke execute on function public.node_strike(text, text, uuid, text, jsonb, text) from public;
grant execute on function public.node_strike(text, text, uuid, text, jsonb, text) to service_role;
