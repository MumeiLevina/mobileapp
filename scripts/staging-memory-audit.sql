-- Owner runs this only after confirming the intended isolated staging project.
-- Metadata only; no user rows, JWTs, keys, writes or provider calls.
begin read only;
set local statement_timeout = '15s';

select current_database() as database_name,
       to_regclass('supabase_migrations.schema_migrations') is not null as migration_ledger_present;
-- If ledger_present=true, run separately in a read-only transaction:
-- select version, name from supabase_migrations.schema_migrations order by version;

select c.relname as table_name, c.relrowsecurity as rls_enabled,
       c.relforcerowsecurity as force_rls
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in ('memories', 'memory_creation_requests');

select a.attname as column_name, format_type(a.atttypid, a.atttypmod) as type,
       a.attnotnull as not_null
from pg_attribute a
where a.attrelid = to_regclass('public.memories') and a.attname = 'client_id' and not a.attisdropped;

select tablename, indexname, indexdef from pg_indexes
where schemaname = 'public' and tablename in ('memories', 'memory_creation_requests')
order by tablename, indexname;

select c.relname as table_name, r.rolname,
       has_table_privilege(r.oid, c.oid, 'SELECT') as can_select,
       has_table_privilege(r.oid, c.oid, 'INSERT') as can_insert,
       has_table_privilege(r.oid, c.oid, 'UPDATE') as can_update,
       has_table_privilege(r.oid, c.oid, 'DELETE') as can_delete
from pg_class c join pg_namespace n on n.oid = c.relnamespace
cross join pg_roles r
where n.nspname = 'public' and c.relname = 'memory_creation_requests'
  and r.rolname in ('anon', 'authenticated', 'service_role');

select p.proname, pg_get_function_identity_arguments(p.oid) as arguments,
       p.prosecdef as security_definer, p.proconfig as function_settings,
       r.rolname, has_function_privilege(r.oid, p.oid, 'EXECUTE') as can_execute
from pg_proc p join pg_namespace n on n.oid = p.pronamespace cross join pg_roles r
where n.nspname = 'public' and p.proname = 'create_manual_memory'
  and r.rolname in ('anon', 'authenticated', 'service_role');

select conname, pg_get_constraintdef(oid) as definition from pg_constraint
where conrelid = to_regclass('public.memory_creation_requests');

select tablename, policyname, roles, cmd, qual, with_check from pg_policies
where schemaname = 'public' and tablename in ('memories', 'memory_creation_requests');
rollback;
