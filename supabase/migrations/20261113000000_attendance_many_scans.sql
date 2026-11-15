
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
