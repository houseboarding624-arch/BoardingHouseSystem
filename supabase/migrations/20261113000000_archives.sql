-- Boarders who moved out or transferred to another boarding house are archived.
-- Archived accounts cannot log in or scan, no longer hold a bed, and can be restored (enabled) later.
alter table public.users add column if not exists archived_at timestamptz;
alter table public.users add column if not exists archive_type varchar(20);
alter table public.users add column if not exists archive_reason varchar(255);

alter table public.users drop constraint if exists users_archive_type_check;
alter table public.users add constraint users_archive_type_check
  check (archive_type is null or archive_type in ('Moved out', 'Transferred'));

alter table public.users drop constraint if exists users_status_check;
alter table public.users add constraint users_status_check
  check (status in ('Active', 'Disabled', 'Pending', 'Declined', 'Archived'));

create index if not exists idx_users_status on public.users(status);
