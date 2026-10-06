-- Mori 2.0 Wave 1: user-controlled Life Map.
-- Rollback: drop table public.life_map_items.

create table public.life_map_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  type text not null check(type in ('people','goals','values','places','important_events','preferences','helpful_things')),
  title text not null check(length(title) between 1 and 120),
  description text not null default '' check(length(description) <= 2000),
  source_type text check(source_type in ('memory','journal','conversation')),
  source_id uuid,
  approved_by_user boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check((source_type is null) = (source_id is null))
);

create index life_map_owner_type
  on public.life_map_items(user_id, type, created_at desc)
  where deleted_at is null;
create unique index life_map_active_source
  on public.life_map_items(user_id, source_type, source_id)
  where source_id is not null and deleted_at is null;

alter table public.life_map_items enable row level security;
create policy owner_read on public.life_map_items
  for select to authenticated
  using ((select auth.uid()) = user_id);
revoke all on public.life_map_items from anon, authenticated;
grant select on public.life_map_items to authenticated;
grant select, insert, update, delete on public.life_map_items to service_role;
