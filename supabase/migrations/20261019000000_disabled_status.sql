-- "Terminated" boarders are now called "Disabled".
alter table public.users drop constraint if exists users_status_check;

update public.users set status = 'Disabled' where status = 'Terminated';
update public.users set termination_reason = 'Disabled by admin' where termination_reason = 'Terminated by admin';

alter table public.users add constraint users_status_check check (status in ('Active', 'Disabled'));
