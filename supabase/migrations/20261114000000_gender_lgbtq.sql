-- Allow LGBTQ+ as a gender choice.
alter table public.users drop constraint if exists users_gender_check;
alter table public.users add constraint users_gender_check
  check (gender is null or gender in ('Male', 'Female', 'LGBTQ+'));
