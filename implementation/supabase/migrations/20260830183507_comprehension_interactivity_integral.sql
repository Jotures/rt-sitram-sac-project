-- Human-first administrative experience.
--
-- The application may make capture easier, but PostgreSQL continues to be the
-- authority for business totals, master-data changes, availability and the
-- document audit trail.  Every function below derives the company from the
-- authenticated session rather than accepting it from the client.

create type public.freight_pricing_mode as enum ('total', 'per_ton');

alter table public.trips
  add column freight_pricing_mode public.freight_pricing_mode not null default 'total',
  add column freight_rate_per_ton numeric(14,4);

alter table public.trips
  add constraint trips_freight_pricing_shape check (
    (freight_pricing_mode = 'total' and freight_rate_per_ton is null)
    or (
      freight_pricing_mode = 'per_ton'
      and freight_rate_per_ton is not null
      and freight_rate_per_ton > 0
      and freight_rate_per_ton <> 'NaN'::numeric
    )
  );

comment on column public.trips.freight_pricing_mode is
  'Commercial capture mode. total stores an agreed total; per_ton is recalculated by the authoritative trip command.';
comment on column public.trips.freight_rate_per_ton is
  'Quoted rate per canonical load ton. Present only when freight_pricing_mode is per_ton.';

-- Keep the deployed seven-argument command working, while adding an explicit
-- nine-argument entry point for the flexible capture.  The new function does
-- not trust a total supplied by the browser in per-ton mode.
create function public.create_trip_with_load(
  client_id uuid,
  origin text,
  destination text,
  scheduled_at timestamptz,
  freight_amount numeric,
  cargo_description text,
  cargo_tons numeric,
  freight_pricing_mode public.freight_pricing_mode,
  freight_rate_per_ton numeric
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
  calculated_freight numeric(14,2);
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
  if $7 is null or $7 <= 0 or $7 = 'NaN'::numeric then
    raise exception using errcode = '23514', message = 'Cargo tons must be positive';
  end if;
  if $8 = 'per_ton' then
    if $9 is null or $9 <= 0 or $9 = 'NaN'::numeric then
      raise exception using errcode = '23514', message = 'Freight rate per ton must be positive';
    end if;
    calculated_freight := round($7 * $9, 2);
  elsif $8 = 'total' then
    if $5 is null or $5 < 0 or $5 = 'NaN'::numeric then
      raise exception using errcode = '23514', message = 'Freight amount cannot be negative';
    end if;
    if $9 is not null then
      raise exception using errcode = '23514', message = 'A total freight amount cannot include a rate per ton';
    end if;
    calculated_freight := round($5, 2);
  else
    raise exception using errcode = '23514', message = 'Unsupported freight pricing mode';
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
    freight_amount, freight_pricing_mode, freight_rate_per_ton, created_by
  ) values (
    trip_id, current_company_id, trip_code, client_row.id, trim($2), trim($3), $4,
    calculated_freight, $8, case when $8 = 'per_ton' then round($9, 4) else null end, actor_id
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

create or replace function public.create_trip_with_load(
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
  -- Preserve the already published contract exactly: historic callers could
  -- omit the optional tonnage and must not gain a new validation failure.
  perform private.assert_role(array['management','administration']::public.app_role[]);
  if $1 is null or $4 is null then
    raise exception using errcode = '23514', message = 'Client and scheduled time are required';
  end if;
  if length(trim(coalesce($2, ''))) = 0
     or length(trim(coalesce($3, ''))) = 0
     or length(trim(coalesce($6, ''))) = 0 then
    raise exception using errcode = '23514', message = 'Origin, destination, and cargo description are required';
  end if;
  if $5 is null or $5 < 0 or $5 = 'NaN'::numeric then
    raise exception using errcode = '23514', message = 'Freight amount cannot be negative';
  end if;
  if $7 is not null and ($7 <= 0 or $7 = 'NaN'::numeric) then
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
    freight_amount, freight_pricing_mode, freight_rate_per_ton, created_by
  ) values (
    trip_id, current_company_id, trip_code, client_row.id, trim($2), trim($3), $4,
    round($5, 2), 'total', null, actor_id
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

revoke all on function public.create_trip_with_load(uuid,text,text,timestamptz,numeric,text,numeric,public.freight_pricing_mode,numeric)
  from public, anon;
grant execute on function public.create_trip_with_load(uuid,text,text,timestamptz,numeric,text,numeric,public.freight_pricing_mode,numeric)
  to authenticated, service_role;
revoke all on function public.create_trip_with_load(uuid,text,text,timestamptz,numeric,text,numeric)
  from public, anon;
grant execute on function public.create_trip_with_load(uuid,text,text,timestamptz,numeric,text,numeric)
  to authenticated, service_role;

-- The direct CRUD grant predates auditable masters.  Master changes now use
-- narrow commands so a browser cannot change an odometer or derived state.
revoke update on table public.clients, public.suppliers, public.vehicles, public.drivers, public.documents
  from authenticated;

create function public.update_client_master(
  p_client_id uuid,
  p_expected_updated_at timestamptz,
  p_legal_name text,
  p_trade_name text,
  p_tax_id text,
  p_phone text,
  p_address text,
  p_payment_terms_days integer,
  p_relationship_type public.client_relationship_type,
  p_active boolean,
  p_notes text
)
returns public.clients
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_company_id uuid := private.current_company_id();
  old_row public.clients;
  new_row public.clients;
begin
  perform private.assert_role(array['management','administration']::public.app_role[]);
  if length(trim(coalesce(p_legal_name, ''))) = 0 then
    raise exception using errcode = '23514', message = 'Client legal name is required';
  end if;
  if p_payment_terms_days is null or p_payment_terms_days < 0 then
    raise exception using errcode = '23514', message = 'Payment terms cannot be negative';
  end if;
  select * into old_row from public.clients c
  where c.id = p_client_id and c.company_id = current_company_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Client not found'; end if;
  if p_expected_updated_at is null or old_row.updated_at is distinct from p_expected_updated_at then
    raise exception using errcode = '40001', message = 'Client changed while updating';
  end if;
  update public.clients c
  set legal_name = trim(p_legal_name),
      trade_name = nullif(trim(coalesce(p_trade_name, '')), ''),
      tax_id = nullif(trim(coalesce(p_tax_id, '')), ''),
      phone = nullif(trim(coalesce(p_phone, '')), ''),
      address = nullif(trim(coalesce(p_address, '')), ''),
      payment_terms_days = p_payment_terms_days,
      relationship_type = p_relationship_type,
      active = coalesce(p_active, true),
      notes = nullif(trim(coalesce(p_notes, '')), '')
  where c.id = old_row.id and c.company_id = current_company_id
  returning * into new_row;
  perform private.write_audit(current_company_id, 'CLIENT_MASTER_UPDATED', 'client', old_row.id,
    to_jsonb(old_row), to_jsonb(new_row));
  return new_row;
end;
$$;

create function public.update_vehicle_master(
  p_vehicle_id uuid,
  p_expected_updated_at timestamptz,
  p_plate text,
  p_make text,
  p_model text,
  p_model_year integer,
  p_capacity_tons numeric,
  p_ownership_type public.vehicle_ownership_type,
  p_owner_name text,
  p_active boolean,
  p_notes text
)
returns public.vehicles
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_company_id uuid := private.current_company_id();
  old_row public.vehicles;
  new_row public.vehicles;
begin
  perform private.assert_role(array['management','administration']::public.app_role[]);
  if length(trim(coalesce(p_plate, ''))) = 0 then
    raise exception using errcode = '23514', message = 'Vehicle plate is required';
  end if;
  if p_model_year is not null and p_model_year not between 1900 and 2200 then
    raise exception using errcode = '23514', message = 'Vehicle model year is invalid';
  end if;
  if p_capacity_tons is not null and (p_capacity_tons <= 0 or p_capacity_tons = 'NaN'::numeric) then
    raise exception using errcode = '23514', message = 'Vehicle capacity must be positive';
  end if;
  select * into old_row from public.vehicles v
  where v.id = p_vehicle_id and v.company_id = current_company_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Vehicle not found'; end if;
  if p_expected_updated_at is null or old_row.updated_at is distinct from p_expected_updated_at then
    raise exception using errcode = '40001', message = 'Vehicle changed while updating';
  end if;
  if coalesce(p_active, true) = false and exists (
    select 1 from public.trips t
    where t.company_id = current_company_id and t.vehicle_id = old_row.id
      and t.operational_status in ('scheduled','loading','in_transit','unloading')
  ) then
    raise exception using errcode = '23514', message = 'Vehicle with an active trip cannot be deactivated';
  end if;
  update public.vehicles v
  set plate = upper(trim(p_plate)),
      make = nullif(trim(coalesce(p_make, '')), ''),
      model = nullif(trim(coalesce(p_model, '')), ''),
      model_year = p_model_year,
      capacity_tons = p_capacity_tons,
      ownership_type = p_ownership_type,
      owner_name = nullif(trim(coalesce(p_owner_name, '')), ''),
      active = coalesce(p_active, true),
      notes = nullif(trim(coalesce(p_notes, '')), '')
  where v.id = old_row.id and v.company_id = current_company_id
  returning * into new_row;
  perform private.write_audit(current_company_id, 'VEHICLE_MASTER_UPDATED', 'vehicle', old_row.id,
    to_jsonb(old_row), to_jsonb(new_row));
  return new_row;
end;
$$;

create function public.update_driver_master(
  p_driver_id uuid,
  p_expected_updated_at timestamptz,
  p_display_name text,
  p_document_type text,
  p_document_number text,
  p_phone text,
  p_license_number text,
  p_license_expires_on date,
  p_contract_type text,
  p_contract_started_on date,
  p_contract_ended_on date,
  p_usual_vehicle_id uuid,
  p_active boolean,
  p_notes text
)
returns public.drivers
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_company_id uuid := private.current_company_id();
  old_row public.drivers;
  new_row public.drivers;
begin
  perform private.assert_role(array['management','administration']::public.app_role[]);
  if length(trim(coalesce(p_display_name, ''))) = 0 then
    raise exception using errcode = '23514', message = 'Driver display name is required';
  end if;
  if p_contract_ended_on is not null and p_contract_started_on is not null
     and p_contract_ended_on < p_contract_started_on then
    raise exception using errcode = '23514', message = 'Driver contract dates are invalid';
  end if;
  if p_usual_vehicle_id is not null and not exists (
    select 1 from public.vehicles v
    where v.id = p_usual_vehicle_id and v.company_id = current_company_id
  ) then
    raise exception using errcode = '23514', message = 'Usual vehicle must belong to the authenticated company';
  end if;
  select * into old_row from public.drivers d
  where d.id = p_driver_id and d.company_id = current_company_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Driver not found'; end if;
  if p_expected_updated_at is null or old_row.updated_at is distinct from p_expected_updated_at then
    raise exception using errcode = '40001', message = 'Driver changed while updating';
  end if;
  if coalesce(p_active, true) = false and exists (
    select 1 from public.trips t
    where t.company_id = current_company_id and t.driver_id = old_row.id
      and t.operational_status in ('scheduled','loading','in_transit','unloading')
  ) then
    raise exception using errcode = '23514', message = 'Driver with an active trip cannot be deactivated';
  end if;
  update public.drivers d
  set display_name = trim(p_display_name),
      document_type = nullif(trim(coalesce(p_document_type, '')), ''),
      document_number = nullif(trim(coalesce(p_document_number, '')), ''),
      phone = nullif(trim(coalesce(p_phone, '')), ''),
      license_number = nullif(trim(coalesce(p_license_number, '')), ''),
      license_expires_on = p_license_expires_on,
      contract_type = nullif(trim(coalesce(p_contract_type, '')), ''),
      contract_started_on = p_contract_started_on,
      contract_ended_on = p_contract_ended_on,
      usual_vehicle_id = p_usual_vehicle_id,
      active = coalesce(p_active, true),
      notes = nullif(trim(coalesce(p_notes, '')), '')
  where d.id = old_row.id and d.company_id = current_company_id
  returning * into new_row;
  perform private.write_audit(current_company_id, 'DRIVER_MASTER_UPDATED', 'driver', old_row.id,
    to_jsonb(old_row), to_jsonb(new_row));
  return new_row;
end;
$$;

create function public.set_driver_availability(
  p_driver_id uuid,
  p_expected_updated_at timestamptz,
  p_status public.driver_status,
  p_reason text default null
)
returns public.drivers
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_company_id uuid := private.current_company_id();
  old_row public.drivers;
  new_row public.drivers;
begin
  perform private.assert_role(array['management','administration']::public.app_role[]);
  if p_status not in ('available','rest','vacation','leave','unavailable') then
    raise exception using errcode = '23514', message = 'Unsupported manual driver availability';
  end if;
  if p_status <> 'available' and length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception using errcode = '23514', message = 'A reason is required for this driver availability';
  end if;
  select * into old_row from public.drivers d
  where d.id = p_driver_id and d.company_id = current_company_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Driver not found'; end if;
  if not old_row.active then
    raise exception using errcode = '23514', message = 'Inactive driver availability cannot be changed';
  end if;
  if p_expected_updated_at is null or old_row.updated_at is distinct from p_expected_updated_at then
    raise exception using errcode = '40001', message = 'Driver changed while updating';
  end if;
  if exists (
    select 1 from public.trips t
    where t.company_id = current_company_id and t.driver_id = old_row.id
      and t.operational_status in ('scheduled','loading','in_transit','unloading')
  ) then
    raise exception using errcode = '23514', message = 'Driver availability is derived while an active trip exists';
  end if;
  update public.driver_availability da
  set ended_at = now()
  where da.company_id = current_company_id and da.driver_id = old_row.id and da.ended_at is null;
  insert into public.driver_availability (company_id, driver_id, status, reason, recorded_by)
  values (current_company_id, old_row.id, p_status, nullif(trim(coalesce(p_reason, '')), ''), auth.uid());
  update public.drivers d
  set current_status = p_status
  where d.id = old_row.id and d.company_id = current_company_id
  returning * into new_row;
  perform private.write_audit(current_company_id, 'DRIVER_AVAILABILITY_SET', 'driver', old_row.id,
    to_jsonb(old_row), to_jsonb(new_row), nullif(trim(coalesce(p_reason, '')), ''));
  return new_row;
end;
$$;

create function public.create_supplier(
  p_legal_name text,
  p_trade_name text,
  p_tax_id text,
  p_supplier_type text,
  p_phone text,
  p_address text,
  p_notes text
)
returns public.suppliers
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_company_id uuid := private.current_company_id();
  new_row public.suppliers;
  normalized_type text := lower(trim(coalesce(p_supplier_type, '')));
begin
  perform private.assert_role(array['management','administration']::public.app_role[]);
  if length(trim(coalesce(p_legal_name, ''))) = 0 then
    raise exception using errcode = '23514', message = 'Supplier name is required';
  end if;
  if normalized_type not in ('grifo','taller','repuestos','otro') then
    raise exception using errcode = '23514', message = 'Unsupported supplier type';
  end if;
  insert into public.suppliers (
    company_id, legal_name, trade_name, tax_id, supplier_type, phone, address, notes
  ) values (
    current_company_id,
    trim(p_legal_name),
    nullif(trim(coalesce(p_trade_name, '')), ''),
    nullif(trim(coalesce(p_tax_id, '')), ''),
    normalized_type,
    nullif(trim(coalesce(p_phone, '')), ''),
    nullif(trim(coalesce(p_address, '')), ''),
    nullif(trim(coalesce(p_notes, '')), '')
  ) returning * into new_row;
  perform private.write_audit(current_company_id, 'SUPPLIER_CREATED', 'supplier', new_row.id,
    null, to_jsonb(new_row));
  return new_row;
end;
$$;

create function public.update_supplier_master(
  p_supplier_id uuid,
  p_expected_updated_at timestamptz,
  p_legal_name text,
  p_trade_name text,
  p_tax_id text,
  p_supplier_type text,
  p_phone text,
  p_address text,
  p_active boolean,
  p_notes text
)
returns public.suppliers
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_company_id uuid := private.current_company_id();
  old_row public.suppliers;
  new_row public.suppliers;
  normalized_type text := lower(trim(coalesce(p_supplier_type, '')));
begin
  perform private.assert_role(array['management','administration']::public.app_role[]);
  if length(trim(coalesce(p_legal_name, ''))) = 0 then
    raise exception using errcode = '23514', message = 'Supplier name is required';
  end if;
  if normalized_type not in ('grifo','taller','repuestos','otro') then
    raise exception using errcode = '23514', message = 'Unsupported supplier type';
  end if;
  select * into old_row from public.suppliers s
  where s.id = p_supplier_id and s.company_id = current_company_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Supplier not found'; end if;
  if p_expected_updated_at is null or old_row.updated_at is distinct from p_expected_updated_at then
    raise exception using errcode = '40001', message = 'Supplier changed while updating';
  end if;
  update public.suppliers s
  set legal_name = trim(p_legal_name),
      trade_name = nullif(trim(coalesce(p_trade_name, '')), ''),
      tax_id = nullif(trim(coalesce(p_tax_id, '')), ''),
      supplier_type = normalized_type,
      phone = nullif(trim(coalesce(p_phone, '')), ''),
      address = nullif(trim(coalesce(p_address, '')), ''),
      active = coalesce(p_active, true),
      notes = nullif(trim(coalesce(p_notes, '')), '')
  where s.id = old_row.id and s.company_id = current_company_id
  returning * into new_row;
  perform private.write_audit(current_company_id, 'SUPPLIER_MASTER_UPDATED', 'supplier', old_row.id,
    to_jsonb(old_row), to_jsonb(new_row));
  return new_row;
end;
$$;

create function public.attach_document_file(
  p_document_id uuid,
  p_file_id uuid,
  p_expected_updated_at timestamptz
)
returns public.documents
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_company_id uuid := private.current_company_id();
  old_row public.documents;
  new_row public.documents;
begin
  perform private.assert_role(array['management','administration']::public.app_role[]);
  select * into old_row from public.documents d
  where d.id = p_document_id and d.company_id = current_company_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Document not found'; end if;
  if p_expected_updated_at is null or old_row.updated_at is distinct from p_expected_updated_at then
    raise exception using errcode = '40001', message = 'Document changed while attaching a file';
  end if;
  if not exists (
    select 1 from public.files f
    where f.id = p_file_id and f.company_id = current_company_id
  ) then
    raise exception using errcode = '23514', message = 'Document file must belong to the authenticated company';
  end if;
  update public.documents d
  set file_id = p_file_id
  where d.id = old_row.id and d.company_id = current_company_id
  returning * into new_row;
  perform private.write_audit(current_company_id, 'DOCUMENT_FILE_ATTACHED', 'document', old_row.id,
    to_jsonb(old_row), to_jsonb(new_row));
  return new_row;
end;
$$;

revoke all on function public.update_client_master(uuid,timestamptz,text,text,text,text,text,integer,public.client_relationship_type,boolean,text)
  from public, anon;
revoke all on function public.update_vehicle_master(uuid,timestamptz,text,text,text,integer,numeric,public.vehicle_ownership_type,text,boolean,text)
  from public, anon;
revoke all on function public.update_driver_master(uuid,timestamptz,text,text,text,text,text,date,text,date,date,uuid,boolean,text)
  from public, anon;
revoke all on function public.set_driver_availability(uuid,timestamptz,public.driver_status,text)
  from public, anon;
revoke all on function public.create_supplier(text,text,text,text,text,text,text)
  from public, anon;
revoke all on function public.update_supplier_master(uuid,timestamptz,text,text,text,text,text,text,boolean,text)
  from public, anon;
revoke all on function public.attach_document_file(uuid,uuid,timestamptz)
  from public, anon;

grant execute on function public.update_client_master(uuid,timestamptz,text,text,text,text,text,integer,public.client_relationship_type,boolean,text)
  to authenticated, service_role;
grant execute on function public.update_vehicle_master(uuid,timestamptz,text,text,text,integer,numeric,public.vehicle_ownership_type,text,boolean,text)
  to authenticated, service_role;
grant execute on function public.update_driver_master(uuid,timestamptz,text,text,text,text,text,date,text,date,date,uuid,boolean,text)
  to authenticated, service_role;
grant execute on function public.set_driver_availability(uuid,timestamptz,public.driver_status,text)
  to authenticated, service_role;
grant execute on function public.create_supplier(text,text,text,text,text,text,text)
  to authenticated, service_role;
grant execute on function public.update_supplier_master(uuid,timestamptz,text,text,text,text,text,text,boolean,text)
  to authenticated, service_role;
grant execute on function public.attach_document_file(uuid,uuid,timestamptz)
  to authenticated, service_role;
