-- The boarding house has Room 1 to Room 12 (4 beds each). Add the ones that are missing so boarders can pick them
-- when they register. New rooms use the same monthly rate as Room 101 (or 0 if there is none): set the real rate in
-- the Admin dashboard, Rooms & Beds.
insert into public.rooms (room_number, monthly_rate, status, beds)
select n::text, coalesce((select monthly_rate from public.rooms where room_number = '101' limit 1), 0), 'Available', 4
from generate_series(1, 12) as n
on conflict (room_number) do nothing;
