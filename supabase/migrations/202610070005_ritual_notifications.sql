alter table public.notification_preferences
  add column morning_enabled boolean not null default false,
  add column morning_hour integer not null default 8 check (morning_hour between 0 and 23),
  add column morning_minute integer not null default 0 check (morning_minute between 0 and 59),
  add column evening_enabled boolean not null default false,
  add column evening_hour integer not null default 20 check (evening_hour between 0 and 23),
  add column evening_minute integer not null default 0 check (evening_minute between 0 and 59);

-- Preserve existing single-reminder choices when upgrading.
update public.notification_preferences
set
  morning_enabled = period = 'morning',
  morning_hour = case when period = 'morning' then hour else morning_hour end,
  morning_minute = case when period = 'morning' then minute else morning_minute end,
  evening_enabled = period = 'evening',
  evening_hour = case when period = 'evening' then hour else evening_hour end,
  evening_minute = case when period = 'evening' then minute else evening_minute end;
