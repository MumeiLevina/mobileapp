create table public.ritual_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users on delete cascade,
  type text not null check (type in ('morning', 'evening')),
  desired_feeling text check (
    desired_feeling is null or
    desired_feeling in ('peaceful', 'focused', 'gentle', 'brave')
  ),
  small_intention text not null default '' check (length(small_intention) <= 1000),
  reflection text not null default '' check (length(reflection) <= 4000),
  client_id uuid not null,
  created_at timestamptz not null default now(),
  unique(user_id, client_id),
  check (type <> 'morning' or desired_feeling is not null)
);

alter table public.ritual_entries enable row level security;
create policy owner_read on public.ritual_entries
  for select to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.ritual_entries from anon, authenticated;
grant select on public.ritual_entries to authenticated;

create index ritual_entries_owner_time
  on public.ritual_entries(user_id, created_at desc);
