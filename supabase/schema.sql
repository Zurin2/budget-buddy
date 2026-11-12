-- Budget Buddy — Supabase schema
-- Run once in the Supabase SQL Editor of a fresh project.
--
-- Per-account isolation is enforced by RLS alone (same policy style as riff):
--   * every row is stamped with user_id via a DB default (auth.uid())
--   * every policy requires user_id = auth.uid()

create extension if not exists pgcrypto;

-- ── categories (wallet balances per category) ────────────────────────────
create table if not exists public.categories (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name          text not null,
  gcash_balance numeric not null default 0,
  cash_balance  numeric not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ── budget_plans (exactly one per user) ──────────────────────────────────
create table if not exists public.budget_plans (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null default auth.uid() references auth.users (id) on delete cascade,
  total_gcash_budget numeric not null default 0,
  total_cash_budget  numeric not null default 0,
  allocations        jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create unique index if not exists budget_plans_user_uniq on public.budget_plans (user_id);

-- ── action_logs (one-click undo feed) ────────────────────────────────────
create table if not exists public.action_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  message     text not null,
  action_type text not null default 'other'
              check (action_type in ('add','subtract','transfer','remove_category','auto_add','other')),
  action_data jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

-- ── notes (quick scratchpad) ─────────────────────────────────────────────
create table if not exists public.notes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  content    text not null,
  pinned     boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── RLS: owner-only, no admin bypass ─────────────────────────────────────
alter table public.categories   enable row level security;
alter table public.budget_plans enable row level security;
alter table public.action_logs  enable row level security;
alter table public.notes        enable row level security;

create policy "categories owner select"   on public.categories   for select to authenticated using (user_id = auth.uid());
create policy "categories owner insert"   on public.categories   for insert to authenticated with check (user_id = auth.uid());
create policy "categories owner update"   on public.categories   for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "categories owner delete"   on public.categories   for delete to authenticated using (user_id = auth.uid());

create policy "budget_plans owner select" on public.budget_plans for select to authenticated using (user_id = auth.uid());
create policy "budget_plans owner insert" on public.budget_plans for insert to authenticated with check (user_id = auth.uid());
create policy "budget_plans owner update" on public.budget_plans for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "budget_plans owner delete" on public.budget_plans for delete to authenticated using (user_id = auth.uid());

create policy "action_logs owner select"  on public.action_logs  for select to authenticated using (user_id = auth.uid());
create policy "action_logs owner insert"  on public.action_logs  for insert to authenticated with check (user_id = auth.uid());
create policy "action_logs owner update"  on public.action_logs  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "action_logs owner delete"  on public.action_logs  for delete to authenticated using (user_id = auth.uid());

create policy "notes owner select"        on public.notes        for select to authenticated using (user_id = auth.uid());
create policy "notes owner insert"        on public.notes        for insert to authenticated with check (user_id = auth.uid());
create policy "notes owner update"        on public.notes        for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notes owner delete"        on public.notes        for delete to authenticated using (user_id = auth.uid());

-- ── updated_at bookkeeping ───────────────────────────────────────────────
create or replace function public.set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists categories_updated_at   on public.categories;
create trigger categories_updated_at   before update on public.categories   for each row execute function public.set_updated_at();

drop trigger if exists budget_plans_updated_at on public.budget_plans;
create trigger budget_plans_updated_at before update on public.budget_plans for each row execute function public.set_updated_at();

drop trigger if exists notes_updated_at        on public.notes;
create trigger notes_updated_at        before update on public.notes        for each row execute function public.set_updated_at();

-- ── read-performance indexes ─────────────────────────────────────────────
create index if not exists categories_user_name_idx   on public.categories   (user_id, lower(name));
create index if not exists categories_user_updated_idx on public.categories  (user_id, updated_at desc);
create index if not exists action_logs_user_created_idx on public.action_logs (user_id, created_at desc);
create index if not exists notes_user_created_idx     on public.notes        (user_id, created_at desc);
