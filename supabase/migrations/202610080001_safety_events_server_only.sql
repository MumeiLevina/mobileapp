-- Safety classifications are operational metadata and are never a direct
-- browser/mobile data surface. Application access remains server-side.
drop policy if exists owner_read on public.safety_events;
revoke all on public.safety_events from anon, authenticated;
grant select, insert, update, delete on public.safety_events to service_role;
