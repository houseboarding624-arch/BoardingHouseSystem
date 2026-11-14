-- A boarder can now Time In / Time Out many times in one day (until 10:00 PM), so a day may have several attendance
-- rows per boarder. Remove the old "one row per boarder per day" rule.
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.attendance'::regclass and contype = 'u'
  loop
    execute format('alter table public.attendance drop constraint %I', c.conname);
  end loop;
end $$;
