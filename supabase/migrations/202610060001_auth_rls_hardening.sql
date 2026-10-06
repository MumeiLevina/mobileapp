-- Phase A: make ownership guarantees explicit for databases upgraded from the MVP.
-- Rollback: restore the initial owner_read policies. No user data is rewritten.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users(id) values(new.id) on conflict do nothing;
  insert into public.profiles(user_id) values(new.id) on conflict do nothing;
  insert into public.garden_states(user_id) values(new.id) on conflict do nothing;
  insert into public.notification_preferences(user_id) values(new.id) on conflict do nothing;
  return new;
end
$$;

insert into public.users(id) select id from auth.users on conflict do nothing;
insert into public.profiles(user_id) select id from public.users on conflict do nothing;
insert into public.garden_states(user_id) select id from public.users on conflict do nothing;
insert into public.notification_preferences(user_id) select id from public.users on conflict do nothing;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'profiles','conversations','messages','mood_entries','journals','memories',
    'self_care_sessions','garden_states','garden_unlocks','weekly_reflections',
    'notification_preferences','safety_events'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists owner_read on public.%I', table_name);
    execute format(
      'create policy owner_read on public.%I for select to authenticated using ((select auth.uid()) = user_id)',
      table_name
    );
    execute format('revoke insert, update, delete, truncate, references, trigger on public.%I from anon, authenticated', table_name);
    execute format('grant select on public.%I to authenticated', table_name);
  end loop;
end
$$;

alter table public.users enable row level security;
drop policy if exists owner_read on public.users;
create policy owner_read on public.users for select to authenticated using ((select auth.uid()) = id);
revoke insert, update, delete, truncate, references, trigger on public.users from anon, authenticated;
grant select on public.users to authenticated;

revoke all on function public.match_memories(uuid, extensions.vector, int) from public, anon, authenticated;
revoke all on function public.award_growth(uuid, text) from public, anon, authenticated;
revoke all on function public.save_exchange(uuid, uuid, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.save_weekly_reflection(uuid, date, text) from public, anon, authenticated;
grant execute on function public.match_memories(uuid, extensions.vector, int) to service_role;
grant execute on function public.award_growth(uuid, text) to service_role;
grant execute on function public.save_exchange(uuid, uuid, uuid, text, text, text) to service_role;
grant execute on function public.save_weekly_reflection(uuid, date, text) to service_role;
