alter table public.conversations add column client_id uuid;
alter table public.conversations
  add constraint conversations_owner_client_unique unique(user_id, client_id);

create function public.save_private_conversation(
  p_user uuid,
  p_client_id uuid,
  p_mode text,
  p_messages jsonb
) returns public.conversations
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved public.conversations;
begin
  if p_mode not in ('listen', 'understand', 'think') then
    raise exception 'Invalid conversation mode';
  end if;
  if jsonb_typeof(p_messages) <> 'array'
    or jsonb_array_length(p_messages) < 2
    or jsonb_array_length(p_messages) > 100 then
    raise exception 'Invalid private conversation messages';
  end if;

  insert into public.conversations(user_id, client_id, mode, title)
  values (
    p_user,
    p_client_id,
    p_mode,
    'Một cuộc trò chuyện riêng đã lưu'
  )
  on conflict (user_id, client_id) do update
    set updated_at = public.conversations.updated_at
  returning * into saved;

  insert into public.messages(
    user_id, conversation_id, role, content, client_id, safety_level
  )
  select
    p_user,
    saved.id,
    item->>'role',
    item->>'content',
    (item->>'id')::uuid,
    'normal'
  from jsonb_array_elements(p_messages) as item
  on conflict (user_id, conversation_id, client_id, role) do nothing;

  return saved;
end
$$;

revoke all on function public.save_private_conversation(uuid, uuid, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.save_private_conversation(uuid, uuid, text, jsonb)
  to service_role;
