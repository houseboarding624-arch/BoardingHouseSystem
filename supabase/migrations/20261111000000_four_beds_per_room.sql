-- Every room has exactly 4 beds.
update public.rooms set beds = 4;
alter table public.rooms alter column beds set default 4;
