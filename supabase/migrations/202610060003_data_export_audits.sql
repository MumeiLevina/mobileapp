-- Phase E: content-free audit metadata for synchronous account exports.
-- Rollback: drop table public.data_export_audits.

create table public.data_export_audits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  format text not null default 'json' check(format in ('json')),
  status text not null check(status in ('processing','completed','failed')),
  record_counts jsonb not null default '{}'::jsonb,
  requested_at timestamptz not null default now(),
  completed_at timestamptz
);

create index data_export_audits_owner_time
  on public.data_export_audits(user_id, requested_at desc);

alter table public.data_export_audits enable row level security;
revoke all on public.data_export_audits from anon, authenticated;
grant select, insert, update on public.data_export_audits to service_role;
