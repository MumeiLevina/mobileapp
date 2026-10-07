create table public.letters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users on delete cascade,
  title text not null check (length(title) between 1 and 120),
  content text not null check (length(content) between 1 and 20000),
  open_at timestamptz not null,
  opened_at timestamptz,
  deleted_at timestamptz,
  client_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, client_id)
);

alter table public.letters enable row level security;
create policy owner_read on public.letters
  for select to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.letters from anon, authenticated;
grant select on public.letters to authenticated;

create index letters_owner_open_time
  on public.letters(user_id, open_at)
  where deleted_at is null;
