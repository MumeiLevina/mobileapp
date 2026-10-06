-- Phase C: verified crisis resource directory. No unverified resource is seeded.
-- Rollback: drop public.crisis_resources and safety_events.classifier_status.

create table public.crisis_resources (
  id uuid primary key default gen_random_uuid(),
  country_code text check(country_code is null or country_code ~ '^[A-Z]{2}$'),
  region text check(region is null or length(region) <= 120),
  resource_type text not null check(resource_type in ('emergency','crisis_line','hospital','support_service')),
  name text not null check(length(name) between 1 and 160),
  phone text check(phone is null or length(phone) between 3 and 40),
  url text check(url is null or url ~ '^https://'),
  available_hours text check(available_hours is null or length(available_hours) <= 160),
  language text not null check(length(language) between 2 and 35),
  verified_at timestamptz not null,
  source_url text not null check(source_url ~ '^https://'),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(phone is not null or url is not null)
);

create index crisis_resources_lookup
  on public.crisis_resources(country_code, language, resource_type)
  where enabled = true;

alter table public.crisis_resources enable row level security;
revoke all on public.crisis_resources from anon, authenticated;
grant select on public.crisis_resources to service_role;

alter table public.safety_events
  add column classifier_status text not null default 'classified'
  check(classifier_status in ('classified','unavailable'));
