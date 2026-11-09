-- New boarder registrations wait for the admin to approve or decline them before they can log in.
alter table public.users drop constraint if exists users_status_check;
alter table public.users add constraint users_status_check
  check (status in ('Active', 'Disabled', 'Pending', 'Declined'));
