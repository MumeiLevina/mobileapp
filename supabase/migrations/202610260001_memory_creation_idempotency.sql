-- Additive, local-reviewed contract. Apply before deploying the new API/client.
-- Existing/manual and AI candidate rows retain NULL identities. No backfill of
-- private payloads. Keep a payload-free tombstone after a memory is forgotten,
-- so a delayed retry cannot resurrect deleted content. Account deletion clears it.
alter table public.memories add column client_id uuid;
alter table public.memories
  add constraint memories_owner_client_unique unique(user_id, client_id);

create table public.memory_creation_requests (
  user_id uuid not null references public.users(id) on delete cascade,
  client_id uuid not null,
  fingerprint text not null check(length(fingerprint) = 64),
  memory_id uuid references public.memories(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key(user_id, client_id)
);
alter table public.memory_creation_requests enable row level security;
revoke all on public.memory_creation_requests from public, anon, authenticated;
grant select, insert, update, delete on public.memory_creation_requests to service_role;

create function public.create_manual_memory(
  p_user uuid,
  p_client_id uuid,
  p_content text,
  p_category text,
  p_embedding extensions.vector(1536)
) returns public.memories
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved public.memories;
  previous public.memory_creation_requests;
  fingerprint text;
begin
  if p_user is null or p_client_id is null or p_embedding is null
    or p_content is null or length(btrim(p_content)) not between 1 and 600
    or p_category is null or p_category not in (
      'preference', 'life_event', 'relationship', 'goal',
      'self_care_preference', 'communication_preference'
    ) then
    raise exception 'Invalid manual memory';
  end if;
  fingerprint := encode(sha256(convert_to(
    jsonb_build_object('content', btrim(p_content), 'category', p_category)::text, 'UTF8'
  )), 'hex');

  -- Serialize identical owner/UUID requests, including overlapping retries.
  -- This also avoids no-op UPDATE triggers modifying existing edited memories.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user::text || ':' || p_client_id::text, 0)
  );
  select * into previous from public.memory_creation_requests
    where user_id = p_user and client_id = p_client_id;
  if found then
    if previous.fingerprint <> fingerprint or previous.memory_id is null then
      raise exception 'Memory creation identity already used';
    end if;
    select * into saved from public.memories
      where id = previous.memory_id and user_id = p_user and deleted_at is null;
    if not found then
      raise exception 'Memory no longer available';
    end if;
    return saved;
  end if;

  insert into public.memories(
    user_id, client_id, content, category,
    approved_by_user, approved_at, confidence, embedding
  ) values (
    p_user, p_client_id, btrim(p_content), p_category,
    true, now(), 1, p_embedding
  ) returning * into saved;
  insert into public.memory_sources(user_id, memory_id, source_type, reason)
    values (p_user, saved.id, 'manual', 'Được bạn trực tiếp thêm vào ký ức của Mori.');
  perform public.unlock_garden_area(p_user, 'memory_garden', 'memory', saved.id);
  perform public.record_personal_milestone(p_user, 'memory_garden_appeared', 'memory', saved.id);
  insert into public.memory_creation_requests(user_id, client_id, fingerprint, memory_id)
    values(p_user, p_client_id, fingerprint, saved.id);
  return saved;
end
$$;

revoke all on function public.create_manual_memory(uuid, uuid, text, text, extensions.vector)
  from public, anon, authenticated;
grant execute on function public.create_manual_memory(uuid, uuid, text, text, extensions.vector)
  to service_role;
