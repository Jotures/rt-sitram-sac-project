-- Advance retries are accepted only when the authenticated actor and the
-- normalized payload exactly match the original command.

create or replace function public.issue_trip_advance(
  p_trip_id uuid,
  p_driver_id uuid,
  p_delivered_at timestamptz,
  p_amount numeric,
  p_delivery_method text,
  p_concept text,
  p_idempotency_key uuid
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_company_id uuid := private.current_company_id();
  current_actor_id uuid := auth.uid();
  advance_id uuid := gen_random_uuid();
  trip_row public.trips;
  existing_advance public.advances;
  normalized_delivery_method text := trim($5);
  normalized_concept text := nullif(trim($6), '');
begin
  perform private.assert_role(array['management','administration']::public.app_role[]);
  if $4 is null or $4 <= 0 or $7 is null then
    raise exception using
      errcode = '23514',
      message = 'Positive amount and idempotency ID are required';
  end if;
  if length(coalesce(normalized_delivery_method, '')) = 0 then
    raise exception using errcode = '23514', message = 'Delivery method is required';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(current_company_id::text || ':advance:' || $7::text, 0)
  );
  select * into existing_advance
  from public.advances a
  where a.company_id = current_company_id and a.idempotency_key = $7;
  if found then
    if existing_advance.trip_id is distinct from $1
      or existing_advance.driver_id is distinct from $2
      or existing_advance.delivered_at is distinct from $3
      or existing_advance.amount is distinct from $4::numeric(14,2)
      or existing_advance.delivery_method is distinct from normalized_delivery_method
      or existing_advance.concept is distinct from normalized_concept
      or existing_advance.created_by is distinct from current_actor_id
    then
      raise exception using
        errcode = '23505',
        message = 'Idempotency key was already used';
    end if;
    return existing_advance.id;
  end if;

  select * into trip_row
  from public.trips t
  where t.id = $1 and t.company_id = current_company_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Trip not found';
  end if;
  if trip_row.driver_id is distinct from $2 then
    raise exception using
      errcode = '23514',
      message = 'Advance driver must be assigned to the trip';
  end if;
  if trip_row.operational_status in ('draft','approved','cancelled','completed') then
    raise exception using
      errcode = '23514',
      message = 'Trip cannot receive an advance in its current state';
  end if;

  insert into public.advances (
    id, company_id, trip_id, driver_id, delivered_at, amount, currency,
    delivery_method, concept, created_by, idempotency_key
  ) values (
    advance_id, current_company_id, $1, $2, $3, $4, trip_row.currency,
    normalized_delivery_method, normalized_concept, current_actor_id, $7
  );
  perform private.write_audit(
    current_company_id, 'TRIP_ADVANCE_ISSUED', 'advance', advance_id, null,
    (select to_jsonb(a) from public.advances a where a.id = advance_id)
  );
  return advance_id;
end;
$$;

revoke all on function public.issue_trip_advance(uuid,uuid,timestamptz,numeric,text,text,uuid)
  from public, anon, service_role;
grant execute on function public.issue_trip_advance(uuid,uuid,timestamptz,numeric,text,text,uuid)
  to authenticated;
