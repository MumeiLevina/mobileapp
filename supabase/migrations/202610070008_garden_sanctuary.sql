alter table public.garden_unlocks
  add column feature_key text,
  add column unlocked_at timestamptz,
  add column source_type text,
  add column source_id uuid;

alter table public.garden_unlocks
  add constraint garden_unlock_feature_valid check (
    feature_key is null or feature_key in (
      'reflection_lake', 'memory_garden', 'letter_tree', 'quiet_cottage',
      'wind_chimes', 'fireflies', 'path_stones', 'moon_hill'
    )
  );

create unique index garden_unlocks_owner_feature
  on public.garden_unlocks(user_id, feature_key)
  where feature_key is not null;

create function public.unlock_garden_area(
  p_user uuid,
  p_feature text,
  p_source_type text,
  p_source_id uuid default null
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_feature not in (
    'reflection_lake', 'memory_garden', 'letter_tree', 'quiet_cottage',
    'wind_chimes', 'fireflies', 'path_stones', 'moon_hill'
  ) then
    raise exception 'Invalid garden feature';
  end if;
  insert into public.garden_unlocks(
    user_id, action_key, feature_key, unlocked_at, source_type, source_id
  ) values (
    p_user, 'area:' || p_feature, p_feature, now(), p_source_type, p_source_id
  ) on conflict (user_id, action_key) do nothing;
end
$$;

revoke all on function public.unlock_garden_area(uuid, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.unlock_garden_area(uuid, text, text, uuid)
  to service_role;
