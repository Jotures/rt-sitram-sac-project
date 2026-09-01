-- A real trip starts with its first load. Keep both inserts in one authoritative
-- transaction so the product cannot create an incomplete trip shell.

create function public.create_trip_with_load(
  client_id uuid,
  origin text,
  destination text,
  scheduled_at timestamptz,
  freight_amount numeric,
  cargo_description text,
  cargo_tons numeric
)
returns public.trips
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_company_id uuid := private.current_company_id();
  actor_id uuid := auth.uid();
  client_row public.clients;
  trip_row public.trips;
  load_row public.loads;
  trip_id uuid := gen_random_uuid();
  year_part text;
  code_prefix text;
  next_trip_number bigint;
  trip_code text;
begin
  perform private.assert_role(array['management','administration']::public.app_role[]);
  if $1 is null or $4 is null then
    raise exception using errcode = '23514', message = 'Client and scheduled time are required';
  end if;
  if length(trim(coalesce($2, ''))) = 0
     or length(trim(coalesce($3, ''))) = 0
     or length(trim(coalesce($6, ''))) = 0 then
    raise exception using errcode = '23514', message = 'Origin, destination, and cargo description are required';
  end if;
  if $5 is null or $5 < 0 then
    raise exception using errcode = '23514', message = 'Freight amount cannot be negative';
  end if;
  if $7 is not null and $7 <= 0 then
    raise exception using errcode = '23514', message = 'Cargo tons must be positive when provided';
  end if;

  select * into client_row
  from public.clients c
  where c.id = $1 and c.company_id = current_company_id and c.active;
  if not found then
    raise exception using errcode = '23514', message = 'An active client from the authenticated company is required';
  end if;

  year_part := extract(year from $4)::integer::text;
  code_prefix := 'RT-' || year_part || '-';
  perform pg_advisory_xact_lock(
    hashtextextended(current_company_id::text || ':trip-code:' || year_part, 0)
  );
  select coalesce(max(substring(t.code from length(code_prefix) + 1)::bigint), 0) + 1
    into next_trip_number
  from public.trips t
  where t.company_id = current_company_id
    and t.code ~ ('^' || code_prefix || '[0-9]+$');
  trip_code := code_prefix || lpad(next_trip_number::text, 4, '0');

  insert into public.trips (
    id, company_id, code, client_id, origin, destination, scheduled_at,
    freight_amount, created_by
  ) values (
    trip_id, current_company_id, trip_code, client_row.id, trim($2), trim($3), $4,
    $5, actor_id
  ) returning * into trip_row;

  insert into public.loads (company_id, trip_id, description, tons)
  values (current_company_id, trip_id, trim($6), $7)
  returning * into load_row;

  perform private.write_audit(
    current_company_id,
    'TRIP_CREATED',
    'trip',
    trip_id,
    null,
    jsonb_build_object('trip', to_jsonb(trip_row), 'initial_load', to_jsonb(load_row))
  );
  return trip_row;
end;
$$;

-- RLS remains a second boundary, but no authenticated client may bypass the
-- atomic command by inserting a bare trip directly.
revoke insert on table public.trips from authenticated;
drop policy if exists trips_staff_insert on public.trips;

revoke all on function public.create_trip_with_load(uuid,text,text,timestamptz,numeric,text,numeric) from public, anon;
grant execute on function public.create_trip_with_load(uuid,text,text,timestamptz,numeric,text,numeric) to authenticated, service_role;
