create table public.personal_milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users on delete cascade,
  milestone_key text not null check (milestone_key in (
    'quiet_cottage_appeared', 'reflection_lake_appeared',
    'memory_garden_appeared', 'first_letter', 'wind_chimes_appeared',
    'first_weekly_reflection', 'first_soft_goal', 'moon_hill_appeared'
  )),
  created_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  source_type text,
  source_id uuid,
  unique(user_id, milestone_key)
);

alter table public.personal_milestones enable row level security;
create policy owner_read on public.personal_milestones
  for select to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.personal_milestones from anon, authenticated;
grant select on public.personal_milestones to authenticated;

create index personal_milestones_owner_time
  on public.personal_milestones(user_id, created_at desc);

create function public.record_personal_milestone(
  p_user uuid,
  p_key text,
  p_source_type text default null,
  p_source_id uuid default null
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_key not in (
    'quiet_cottage_appeared', 'reflection_lake_appeared',
    'memory_garden_appeared', 'first_letter', 'wind_chimes_appeared',
    'first_weekly_reflection', 'first_soft_goal', 'moon_hill_appeared'
  ) then
    raise exception 'Invalid personal milestone';
  end if;
  insert into public.personal_milestones(
    user_id, milestone_key, source_type, source_id
  ) values (p_user, p_key, p_source_type, p_source_id)
  on conflict (user_id, milestone_key) do nothing;
end
$$;

revoke all on function public.record_personal_milestone(uuid, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.record_personal_milestone(uuid, text, text, uuid)
  to service_role;
