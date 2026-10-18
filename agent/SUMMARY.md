# a0 — what happened while you were away (2026-10-18)

## DONE
- **M1 merged to main** (7b0bef5) — Go gateway: lane/alias/relay/server, review fixes, tag `m1-core`.
- **Dashboard transplanted to the SquidCloud design system** per your call: copied the cloudbliss UI shell (Lovable stack — Vite + React + Tailwind + shadcn + react-query + recharts), stripped all its pages/business components (kept the 66-piece `components/ui` + motion kit), and built a0 on top:
  - Landing (`/`) — hero, categories grid, copyable curl, "a0 — a squidcloud product"
  - Auth (`/auth`) — Supabase email signin/signup
  - Control panel (`/dashboard/*`) — Overview, API Keys (mint/revoke, secret shown once, hashed at rest), Usage (charts), Models (category chains), Nodes (mint one-time NODE_ID + CONTROL_TOKEN env for wing bootstrap)
  - Env-gated Supabase client: no creds yet → everything stays browsable with demo data instead of crashing
- **Supabase migration ready**: `supabase/migrations/0001_control_plane.sql` — virtual_keys (sha256+prefix), usage_events (tenant-scoped RLS), lane_health (public read), node registry. 
- All pushed to main: `080f06d`, `b66eb2c`. `tsc` clean, production build green, dev server verified on :8080.

## BLOCKED — needs a decision/input
- **Supabase project unreachable via my MCP tools (0 orgs / 0 projects visible).** To wire the control plane live I need either: (a) the URL + anon key of your `a00` project (paste or set as Vercel env), and/or (b) access/invitation to that project's organization. The SQL migration then applies in one step. No money needs to be spent unless you want me to create a new project.

## QUEUED NEXT
1. Apply `0001_control_plane.sql` to a reachable Supabase project; set `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.
2. M4: node registry wiring (panel heartbeat endpoints) + gateway auth-side 60s key cache from Supabase.
3. Vercel deploy of `dashboard/`.
4. M2 leftovers deferred from the review list (probe caching, ctx cancel, Retry-After polish).
