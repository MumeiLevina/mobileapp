-- Mori 2.0 Wave 1: evidence-based memory provenance and approval time.
-- Rollback requires dropping memory_sources, approved_at and the composite unique constraint.

alter table public.memories
  add column approved_at timestamptz;

update public.memories
set approved_at = coalesce(updated_at, created_at)
where approved_by_user = true;

alter table public.memories
  add constraint memories_approval_time_check check(
    (approved_by_user = true and approved_at is not null)
    or (approved_by_user = false and approved_at is null)
  ),
  add constraint memories_id_user_unique unique(id, user_id);

create table public.memory_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  memory_id uuid not null,
  source_type text not null check(source_type in ('manual','conversation','journal','mood','weekly_reflection','life_map')),
  source_id uuid,
  reason text not null check(length(reason) between 1 and 240),
  created_at timestamptz not null default now(),
  foreign key(memory_id, user_id) references public.memories(id, user_id) on delete cascade,
  check(
    (source_type = 'manual' and source_id is null)
    or (source_type <> 'manual' and source_id is not null)
  )
);

insert into public.memory_sources(user_id, memory_id, source_type, reason, created_at)
select user_id, id, 'manual', 'Nguồn chưa được ghi lại trong phiên bản trước.', created_at
from public.memories;

create index memory_sources_owner_memory
  on public.memory_sources(user_id, memory_id, created_at);

alter table public.memory_sources enable row level security;
create policy owner_read on public.memory_sources
  for select to authenticated
  using ((select auth.uid()) = user_id);
revoke all on public.memory_sources from anon, authenticated;
grant select on public.memory_sources to authenticated;
grant select, insert, update, delete on public.memory_sources to service_role;
