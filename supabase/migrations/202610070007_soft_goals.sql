create table public.soft_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users on delete cascade,
  title text not null check (length(title) between 1 and 160),
  note text not null default '' check (length(note) <= 2000),
  status text not null default 'active' check (status in ('active', 'completed', 'archived')),
  source_type text not null default 'manual' check (source_type in ('manual', 'conversation')),
  source_id uuid,
  client_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  archived_at timestamptz,
  unique(user_id, client_id),
  check ((status = 'completed') = (completed_at is not null)),
  check ((status = 'archived') = (archived_at is not null))
);

alter table public.soft_goals enable row level security;
create policy owner_read on public.soft_goals
  for select to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.soft_goals from anon, authenticated;
grant select on public.soft_goals to authenticated;

create index soft_goals_owner_status on public.soft_goals(user_id, status);
create index soft_goals_owner_time on public.soft_goals(user_id, created_at desc);
