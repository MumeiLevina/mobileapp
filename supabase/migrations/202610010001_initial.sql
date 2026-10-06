create extension if not exists vector with schema extensions;
create table public.users (id uuid primary key references auth.users(id) on delete cascade, created_at timestamptz not null default now());
create table public.profiles (
 user_id uuid primary key references public.users on delete cascade,
 display_name text not null default 'Bạn' check(length(display_name)<=60), goals text[] not null default '{}',
 companion_style text not null default 'gentle' check(companion_style in ('gentle','close_friend','calm')),
 locale text not null default 'vi' check(locale in ('vi','en')), onboarded boolean not null default false,
 weekly_reflection_enabled boolean not null default false, updated_at timestamptz not null default now()
);
create table public.conversations (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.users on delete cascade,
 title text not null default 'Một khoảng lắng nghe', mode text not null default 'listen' check(mode in ('listen','understand','think')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
 unique(id,user_id)
);
create table public.messages (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.users on delete cascade,
 conversation_id uuid not null, role text not null check(role in ('user','assistant')), content text not null check(length(content)<=12000),
 client_id uuid, safety_level text not null default 'normal' check(safety_level in ('normal','distress','elevated','crisis')), created_at timestamptz not null default now(),
 foreign key(conversation_id,user_id) references public.conversations(id,user_id) on delete cascade,
 unique(user_id,conversation_id,client_id,role)
);
create table public.mood_entries (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.users on delete cascade,
 mood text not null check(mood in ('joyful','good','okay','low','overwhelmed')), intensity real not null check(intensity between 0 and 1),
 tags text[] not null default '{}', optional_note text not null default '' check(length(optional_note)<=2000), client_id uuid not null,
 created_at timestamptz not null default now(), unique(user_id,client_id)
);
create table public.journals (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.users on delete cascade,
 title text not null check(length(title) between 1 and 120), content text not null check(length(content) between 1 and 20000),
 source text not null check(source in ('manual','conversation','reflection')), client_id uuid not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
 unique(user_id,client_id)
);
create table public.memories (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.users on delete cascade,
 content text not null check(length(content) between 1 and 600), category text not null check(category in ('preference','life_event','relationship','goal','self_care_preference','communication_preference')),
 embedding extensions.vector(1536), confidence real not null default 1 check(confidence between 0 and 1), approved_by_user boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);
create table public.self_care_activities (
 id text primary key, title text not null, description text not null, duration integer not null check(duration>0), category text not null,
 steps jsonb not null, difficulty text not null default 'easy', energy_level text not null default 'low', time_of_day text[] not null default '{any}', enabled boolean not null default true
);
create table public.self_care_sessions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.users on delete cascade,
 activity_id text not null references public.self_care_activities, created_at timestamptz not null default now(), completed_at timestamptz
);
create table public.garden_states (
 user_id uuid primary key references public.users on delete cascade, growth_points integer not null default 0 check(growth_points>=0),
 tree_level integer not null default 1, unlocked_items text[] not null default '{plants}', last_updated timestamptz not null default now()
);
create table public.garden_unlocks (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.users on delete cascade,
 action_key text not null, created_at timestamptz not null default now(), unique(user_id,action_key)
);
create table public.weekly_reflections (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.users on delete cascade,
 week_start date not null, content text not null, created_at timestamptz not null default now(), unique(user_id,week_start)
);
create table public.notification_preferences (
 user_id uuid primary key references public.users on delete cascade, period text not null default 'off' check(period in ('off','morning','evening','custom')),
 hour integer not null default 20 check(hour between 0 and 23), minute integer not null default 0 check(minute between 0 and 59), timezone text not null default 'Asia/Ho_Chi_Minh'
);
create table public.safety_events (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.users on delete cascade,
 level text not null check(level in ('normal','distress','elevated','crisis')), requires_escalation boolean not null, created_at timestamptz not null default now()
);

create function public.handle_new_user() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.users(id) values(new.id);
 insert into public.profiles(user_id) values(new.id);
 insert into public.garden_states(user_id) values(new.id);
 insert into public.notification_preferences(user_id) values(new.id);
 return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

do $$ declare t text; begin
 foreach t in array array['profiles','conversations','messages','mood_entries','journals','memories','self_care_sessions','garden_states','garden_unlocks','weekly_reflections','notification_preferences','safety_events'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('create policy owner_read on public.%I for select to authenticated using (user_id = (select auth.uid()))',t);
  -- API is the only write surface: validates ownership, schemas and growth rules.
  execute format('revoke all on public.%I from anon, authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
 end loop;
end $$;
alter table public.users enable row level security;
create policy owner_read on public.users for select to authenticated using(id=(select auth.uid()));
revoke all on public.users from anon, authenticated;
grant select on public.users to authenticated;
alter table public.self_care_activities enable row level security;
create policy enabled_read on public.self_care_activities for select to authenticated using(enabled=true);
revoke all on public.self_care_activities from anon,authenticated;
grant select on public.self_care_activities to authenticated;
create index conversations_owner_time on public.conversations(user_id,created_at desc) where deleted_at is null;
create index messages_owner_conversation on public.messages(user_id,conversation_id,created_at);
create index moods_owner_time on public.mood_entries(user_id,created_at desc);
create index journals_owner_time on public.journals(user_id,created_at desc) where deleted_at is null;
create index memories_owner_approved on public.memories(user_id,approved_by_user) where deleted_at is null;
create index memories_embedding on public.memories using hnsw(embedding extensions.vector_cosine_ops) where approved_by_user=true and deleted_at is null;
create index sessions_owner on public.self_care_sessions(user_id,created_at desc);
create index safety_owner on public.safety_events(user_id,created_at desc);

create function public.match_memories(p_user uuid, query_embedding extensions.vector(1536), match_count int default 4)
returns table(id uuid,user_id uuid,content text,category text,approved_by_user boolean,confidence real,created_at timestamptz)
language sql stable set search_path=public,extensions as $$
 select m.id,m.user_id,m.content,m.category,m.approved_by_user,m.confidence,m.created_at from memories m
 where m.user_id=p_user and m.approved_by_user=true and m.deleted_at is null and m.embedding is not null
 order by m.embedding <=> query_embedding limit least(greatest(match_count,1),5)
$$;
revoke all on function public.match_memories(uuid,extensions.vector,int) from public,anon,authenticated;
grant execute on function public.match_memories(uuid,extensions.vector,int) to service_role;

create function public.award_growth(p_user uuid,p_action text) returns void language plpgsql security definer set search_path='' as $$
declare inserted integer; p integer;
begin
 insert into public.garden_unlocks(user_id,action_key) values(p_user,p_action) on conflict do nothing;
 get diagnostics inserted = row_count;
 if inserted=0 then return; end if;
 update public.garden_states set growth_points=growth_points+1,last_updated=now() where user_id=p_user returning growth_points into p;
 update public.garden_states set tree_level=least(5,1+p/5),unlocked_items=array['plants'] || case when p>=5 then array['flowers'] else array[]::text[] end || case when p>=12 then array['fireflies','lake'] else array[]::text[] end || case when p>=25 then array['bench','moon'] else array[]::text[] end where user_id=p_user;
end $$;
revoke all on function public.award_growth(uuid,text) from public,anon,authenticated;
grant execute on function public.award_growth(uuid,text) to service_role;

create function public.save_exchange(p_user uuid,p_conversation uuid,p_client uuid,p_input text,p_output text,p_level text default 'normal')
returns setof public.messages language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.conversations where id=p_conversation and user_id=p_user and deleted_at is null) then raise exception 'Conversation not found'; end if;
 insert into public.messages(user_id,conversation_id,client_id,role,content,safety_level) values(p_user,p_conversation,p_client,'user',p_input,p_level),(p_user,p_conversation,p_client,'assistant',p_output,p_level) on conflict do nothing;
 return query select * from public.messages where user_id=p_user and conversation_id=p_conversation and client_id=p_client and role='assistant';
end $$;
revoke all on function public.save_exchange(uuid,uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.save_exchange(uuid,uuid,uuid,text,text,text) to service_role;

create function public.save_weekly_reflection(p_user uuid,p_week date,p_content text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.profiles where user_id=p_user and weekly_reflection_enabled=true) then raise exception 'Reflection is disabled'; end if;
 insert into public.weekly_reflections(user_id,week_start,content) values(p_user,p_week,p_content) on conflict(user_id,week_start) do update set content=excluded.content;
 perform public.award_growth(p_user,'weekly:'||p_week::text);
end $$;
revoke all on function public.save_weekly_reflection(uuid,date,text) from public,anon,authenticated;
grant execute on function public.save_weekly_reflection(uuid,date,text) to service_role;
grant usage on schema public,extensions to service_role;
grant all on all tables in schema public to service_role;

-- Existing Auth users also receive application records when this migration is added.
insert into public.users(id) select id from auth.users on conflict do nothing;
insert into public.profiles(user_id) select id from public.users on conflict do nothing;
insert into public.garden_states(user_id) select id from public.users on conflict do nothing;
insert into public.notification_preferences(user_id) select id from public.users on conflict do nothing;
