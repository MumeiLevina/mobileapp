-- Guided sessions are curated client-side and become ordinary private journals
-- only after the user reviews and explicitly saves them.
alter table public.journals drop constraint if exists journals_source_check;
alter table public.journals
  add constraint journals_source_check
  check (source in ('manual', 'conversation', 'reflection', 'guided'));
