-- Lock the database down so it can ONLY be reached through the Express API.
-- The API uses the Supabase secret (service_role) key, which bypasses RLS and keeps its own grants.
-- The browser never talks to Supabase, but if someone found the project URL + anon key they must get nothing.

-- 1) Row Level Security ON for every table in public (idempotent).
--    With RLS on and NO policies, the anon / authenticated roles can read or write nothing.
do $$
declare r record;
begin
  for r in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', r.tablename);
  end loop;
end $$;

-- 2) Belt and braces: remove every privilege the browser-facing roles have on public objects.
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;

-- 3) Future tables / sequences / functions are private by default too.
alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;
