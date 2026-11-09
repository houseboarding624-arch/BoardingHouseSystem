
insert into public.rooms (room_number, monthly_rate, status, beds)
select n::text, coalesce((select monthly_rate from public.rooms where room_number = '101' limit 1), 0), 'Available', 4
from generate_series(1, 12) as n
on conflict (room_number) do nothing;
