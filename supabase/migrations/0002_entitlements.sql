-- ReadMEAPP — Phase 0.5a: entitlements
-- Unified billing: Stripe (web) and Apple IAP (iOS) both write rows here.
-- Exactly one of user_id or workspace_id is set (personal vs team plan).

create type billing_source as enum ('stripe', 'apple_iap', 'none');
create type plan_tier as enum ('personal_free', 'personal_pro', 'team_free', 'team_pro');

create table public.entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  plan plan_tier not null,
  source billing_source not null default 'none',
  external_id text,
  active boolean not null default true,
  current_period_end timestamptz,
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((user_id is not null) != (workspace_id is not null))
);

create index on public.entitlements (user_id) where user_id is not null;
create index on public.entitlements (workspace_id) where workspace_id is not null;

-- Only one active entitlement per user and per workspace.
create unique index entitlements_user_active_uniq
  on public.entitlements (user_id) where active and user_id is not null;
create unique index entitlements_workspace_active_uniq
  on public.entitlements (workspace_id) where active and workspace_id is not null;

alter table public.entitlements enable row level security;

create policy "entitlements_read_scoped" on public.entitlements
  for select using (
    (user_id is not null and user_id = auth.uid())
    or (workspace_id is not null and public.is_workspace_member(workspace_id))
  );

-- Writes are server-only (service role bypasses RLS). No client-side write policy.
