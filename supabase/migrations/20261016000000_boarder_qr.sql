-- Personal QR code per user. The kiosk scanner on the home page reads this token
-- and records Time In / Time Out without anyone logging in.
alter table public.users add column if not exists qr_token varchar(80);

alter table public.users
    alter column qr_token set default
    ('BHU-' || replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''));

update public.users
   set qr_token = 'BHU-' || replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
 where qr_token is null;

create unique index if not exists idx_users_qr_token on public.users(qr_token);
