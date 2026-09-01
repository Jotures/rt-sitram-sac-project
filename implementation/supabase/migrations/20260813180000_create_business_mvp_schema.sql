-- R&T SITRAM business MVP schema. All business relationships carry company_id.

create type public.vehicle_status as enum ('available', 'scheduled', 'in_trip', 'waiting_load', 'returning_empty', 'preventive_maintenance', 'repair', 'waiting_workshop', 'without_driver', 'blocked', 'immobilized', 'out_of_service');
create type public.driver_status as enum ('available', 'assigned', 'in_trip', 'rest', 'vacation', 'leave', 'unavailable', 'inactive');
create type public.trip_operational_status as enum ('draft', 'approved', 'scheduled', 'loading', 'in_transit', 'unloading', 'completed', 'cancelled');
create type public.trip_administrative_status as enum ('not_required', 'settlement_pending', 'settlement_review', 'settlement_observed', 'settlement_closed');
create type public.trip_financial_status as enum ('unbilled', 'billed', 'partially_paid', 'paid', 'financially_closed');
create type public.return_status as enum ('unidentified', 'probable', 'confirmed', 'completed', 'empty_return');
create type public.operational_cycle_status as enum ('planned', 'active', 'completed', 'cancelled');
create type public.validation_status as enum ('pending_review', 'validated', 'observed', 'rejected');
create type public.assignment_type as enum ('trip', 'vehicle', 'general');
create type public.advance_status as enum ('delivered', 'partially_settled', 'settled', 'cancelled');
create type public.settlement_status as enum ('pending', 'under_review', 'observed', 'approved', 'closed', 'cancelled');
create type public.work_order_status as enum ('scheduled', 'waiting_workshop', 'in_workshop', 'in_progress', 'waiting_part', 'finished', 'cancelled');
create type public.document_status as enum ('valid', 'expiring', 'expired', 'replaced', 'cancelled');
create type public.incident_status as enum ('open', 'in_progress', 'resolved', 'closed');
create type public.incident_severity as enum ('low', 'medium', 'high', 'critical');
create type public.invoice_status as enum ('draft', 'issued', 'partial', 'paid', 'overdue', 'cancelled');
create type public.alert_status as enum ('new', 'seen', 'in_progress', 'resolved', 'dismissed');
create type public.client_relationship_type as enum ('direct', 'intermediary', 'third_party');
create type public.vehicle_ownership_type as enum ('owned', 'leased', 'third_party');

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete restrict,
  actor_id uuid,
  action text not null check (length(trim(action)) > 0),
  entity_type text not null check (length(trim(entity_type)) > 0),
  entity_id uuid not null,
  before_data jsonb,
  after_data jsonb,
  reason text,
  occurred_at timestamptz not null default now(),
  constraint audit_events_actor_fk foreign key (company_id, actor_id) references public.profiles (company_id, id) on delete restrict,
  constraint audit_events_company_id_id_unique unique (company_id, id)
);
create index audit_events_entity_idx on public.audit_events (company_id, entity_type, entity_id, occurred_at desc);

create table public.clients (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies (id) on delete restrict,
  legal_name text not null check (length(trim(legal_name)) > 0), trade_name text, tax_id text,
  relationship_type public.client_relationship_type,
  phone text, address text, payment_terms_days integer not null default 0 check (payment_terms_days >= 0),
  active boolean not null default true, notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint clients_company_tax_unique unique (company_id, tax_id),
  constraint clients_company_id_id_unique unique (company_id, id)
);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies (id) on delete restrict,
  legal_name text not null check (length(trim(legal_name)) > 0), trade_name text, tax_id text, supplier_type text not null,
  phone text, address text, active boolean not null default true, notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint suppliers_company_tax_unique unique (company_id, tax_id),
  constraint suppliers_company_id_id_unique unique (company_id, id)
);

create table public.expense_categories (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies (id) on delete restrict,
  code text not null check (length(trim(code)) > 0), name text not null check (length(trim(name)) > 0),
  active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint expense_categories_company_code_unique unique (company_id, code),
  constraint expense_categories_company_id_id_unique unique (company_id, id)
);

create table public.routes (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies (id) on delete restrict,
  name text not null, origin text not null, destination text not null,
  reference_distance_km numeric(12,2) check (reference_distance_km is null or reference_distance_km >= 0),
  active boolean not null default true, notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint routes_company_name_unique unique (company_id, name), constraint routes_company_id_id_unique unique (company_id, id)
);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies (id) on delete restrict,
  plate text not null check (length(trim(plate)) > 0), make text, model text, model_year integer check (model_year is null or model_year between 1900 and 2200),
  ownership_type public.vehicle_ownership_type, owner_name text,
  capacity_tons numeric(10,3) check (capacity_tons is null or capacity_tons > 0),
  current_status public.vehicle_status not null default 'available', current_odometer_km numeric(14,2) not null default 0 check (current_odometer_km >= 0),
  active boolean not null default true, notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint vehicles_company_plate_unique unique (company_id, plate), constraint vehicles_company_id_id_unique unique (company_id, id)
);

create table public.drivers (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies (id) on delete restrict,
  profile_id uuid, display_name text not null check (length(trim(display_name)) > 0), document_type text, document_number text,
  phone text, license_number text, license_expires_on date, contract_type text, contract_started_on date, contract_ended_on date,
  usual_vehicle_id uuid, current_status public.driver_status not null default 'available', active boolean not null default true, notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint drivers_profile_fk foreign key (company_id, profile_id) references public.profiles (company_id, id) on delete restrict,
  constraint drivers_usual_vehicle_fk foreign key (company_id, usual_vehicle_id) references public.vehicles (company_id, id) on delete restrict,
  constraint drivers_contract_dates check (contract_ended_on is null or contract_started_on is null or contract_ended_on >= contract_started_on),
  constraint drivers_company_profile_unique unique (company_id, profile_id),
  constraint drivers_company_document_unique unique (company_id, document_type, document_number),
  constraint drivers_company_id_id_unique unique (company_id, id)
);

create table public.vehicle_status_history (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies (id) on delete restrict,
  vehicle_id uuid not null, status public.vehicle_status not null, started_at timestamptz not null default now(), ended_at timestamptz,
  reason text, recorded_by uuid not null,
  constraint vehicle_status_vehicle_fk foreign key (company_id, vehicle_id) references public.vehicles (company_id, id) on delete restrict,
  constraint vehicle_status_actor_fk foreign key (company_id, recorded_by) references public.profiles (company_id, id) on delete restrict,
  constraint vehicle_status_dates check (ended_at is null or ended_at >= started_at),
  constraint vehicle_status_company_id_id_unique unique (company_id, id)
);
create unique index vehicle_one_open_status_idx on public.vehicle_status_history (company_id, vehicle_id) where ended_at is null;

create table public.driver_availability (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies (id) on delete restrict,
  driver_id uuid not null, status public.driver_status not null, started_at timestamptz not null default now(), ended_at timestamptz,
  reason text, recorded_by uuid not null,
  constraint driver_availability_driver_fk foreign key (company_id, driver_id) references public.drivers (company_id, id) on delete restrict,
  constraint driver_availability_actor_fk foreign key (company_id, recorded_by) references public.profiles (company_id, id) on delete restrict,
  constraint driver_availability_dates check (ended_at is null or ended_at >= started_at),
  constraint driver_availability_company_id_id_unique unique (company_id, id)
);
create unique index driver_one_open_availability_idx on public.driver_availability (company_id, driver_id) where ended_at is null;

create table public.operational_cycles (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies (id) on delete restrict,
  code text not null, vehicle_id uuid, primary_driver_id uuid,
  status public.operational_cycle_status not null default 'planned', return_status public.return_status not null default 'unidentified',
  started_at timestamptz, ended_at timestamptz, notes text,
  created_by uuid not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint cycles_vehicle_fk foreign key (company_id, vehicle_id) references public.vehicles (company_id, id) on delete restrict,
  constraint cycles_driver_fk foreign key (company_id, primary_driver_id) references public.drivers (company_id, id) on delete restrict,
  constraint cycles_actor_fk foreign key (company_id, created_by) references public.profiles (company_id, id) on delete restrict,
  constraint cycles_dates check (ended_at is null or started_at is null or ended_at >= started_at),
  constraint cycles_company_code_unique unique (company_id, code), constraint cycles_company_id_id_unique unique (company_id, id)
);

create table public.trips (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies (id) on delete restrict,
  code text not null, cycle_id uuid, client_id uuid not null, vehicle_id uuid, driver_id uuid, route_id uuid,
  origin text not null check (length(trim(origin)) > 0), destination text not null check (length(trim(destination)) > 0),
  scheduled_at timestamptz not null, started_at timestamptz, operational_finished_at timestamptz, financially_closed_at timestamptz,
  operational_status public.trip_operational_status not null default 'draft', administrative_status public.trip_administrative_status not null default 'not_required',
  financial_status public.trip_financial_status not null default 'unbilled',
  freight_amount numeric(14,2) not null default 0 check (freight_amount >= 0), additional_amount numeric(14,2) not null default 0 check (additional_amount >= 0),
  currency char(3) not null default 'PEN', notes text, version integer not null default 1 check (version > 0),
  created_by uuid not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint trips_cycle_fk foreign key (company_id, cycle_id) references public.operational_cycles (company_id, id) on delete restrict,
  constraint trips_client_fk foreign key (company_id, client_id) references public.clients (company_id, id) on delete restrict,
  constraint trips_vehicle_fk foreign key (company_id, vehicle_id) references public.vehicles (company_id, id) on delete restrict,
  constraint trips_driver_fk foreign key (company_id, driver_id) references public.drivers (company_id, id) on delete restrict,
  constraint trips_route_fk foreign key (company_id, route_id) references public.routes (company_id, id) on delete restrict,
  constraint trips_actor_fk foreign key (company_id, created_by) references public.profiles (company_id, id) on delete restrict,
  constraint trips_company_code_unique unique (company_id, code), constraint trips_company_id_id_unique unique (company_id, id)
);
create index trips_company_status_idx on public.trips (company_id, operational_status, scheduled_at desc);
create unique index one_active_trip_per_vehicle_idx on public.trips (company_id, vehicle_id) where vehicle_id is not null and operational_status in ('scheduled', 'loading', 'in_transit', 'unloading');
create unique index one_active_trip_per_driver_idx on public.trips (company_id, driver_id) where driver_id is not null and operational_status in ('scheduled', 'loading', 'in_transit', 'unloading');

create table public.trip_status_events (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies (id) on delete restrict,
  trip_id uuid not null, dimension text not null check (dimension in ('operational', 'administrative', 'financial')),
  previous_status text, new_status text not null, occurred_at timestamptz not null default now(), reason text, notes text, actor_id uuid not null,
  constraint trip_events_trip_fk foreign key (company_id, trip_id) references public.trips (company_id, id) on delete restrict,
  constraint trip_events_actor_fk foreign key (company_id, actor_id) references public.profiles (company_id, id) on delete restrict,
  constraint trip_events_company_id_id_unique unique (company_id, id)
);

create table public.loads (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies (id) on delete restrict,
  trip_id uuid not null, description text not null, cargo_type text, tons numeric(10,3) check (tons is null or tons > 0),
  package_count integer check (package_count is null or package_count >= 0), notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint loads_trip_fk foreign key (company_id, trip_id) references public.trips (company_id, id) on delete restrict,
  constraint loads_company_id_id_unique unique (company_id, id)
);

create table public.files (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies (id) on delete restrict,
  original_name text not null, mime_type text not null, size_bytes bigint not null check (size_bytes >= 0), storage_path text not null,
  content_hash text, uploaded_by uuid not null, created_at timestamptz not null default now(),
  constraint files_actor_fk foreign key (company_id, uploaded_by) references public.profiles (company_id, id) on delete restrict,
  constraint files_storage_path_unique unique (storage_path), constraint files_company_id_id_unique unique (company_id, id),
  constraint files_company_path check (storage_path like ('companies/' || company_id::text || '/%'))
);

create table public.odometer_entries (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies (id) on delete restrict,
  vehicle_id uuid not null, trip_id uuid, reading_km numeric(14,2) not null check (reading_km >= 0), reading_at timestamptz not null,
  reading_type text not null, source text not null, recorded_by uuid not null, source_device_id text, idempotency_key uuid,
  created_at timestamptz not null default now(),
  constraint odometer_vehicle_fk foreign key (company_id, vehicle_id) references public.vehicles (company_id, id) on delete restrict,
  constraint odometer_trip_fk foreign key (company_id, trip_id) references public.trips (company_id, id) on delete restrict,
  constraint odometer_actor_fk foreign key (company_id, recorded_by) references public.profiles (company_id, id) on delete restrict,
  constraint odometer_entries_company_id_id_unique unique (company_id, id), constraint odometer_entries_idempotency_unique unique (company_id, idempotency_key)
);

create table public.incidents (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies (id) on delete restrict,
  trip_id uuid, vehicle_id uuid, driver_id uuid, occurred_at timestamptz not null, location text, incident_type text not null,
  severity public.incident_severity not null, description text not null, action_taken text, status public.incident_status not null default 'open',
  estimated_cost numeric(14,2) check (estimated_cost is null or estimated_cost >= 0), file_id uuid, created_by uuid not null,
  source_device_id text, idempotency_key uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint incidents_trip_fk foreign key (company_id, trip_id) references public.trips (company_id, id) on delete restrict,
  constraint incidents_vehicle_fk foreign key (company_id, vehicle_id) references public.vehicles (company_id, id) on delete restrict,
  constraint incidents_driver_fk foreign key (company_id, driver_id) references public.drivers (company_id, id) on delete restrict,
  constraint incidents_file_fk foreign key (company_id, file_id) references public.files (company_id, id) on delete restrict,
  constraint incidents_actor_fk foreign key (company_id, created_by) references public.profiles (company_id, id) on delete restrict,
  constraint incidents_scope check (trip_id is not null or vehicle_id is not null),
  constraint incidents_company_id_id_unique unique (company_id, id), constraint incidents_idempotency_unique unique (company_id, idempotency_key)
);

create table public.advances (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies (id) on delete restrict,
  trip_id uuid not null, driver_id uuid not null, delivered_at timestamptz not null, amount numeric(14,2) not null check (amount > 0),
  currency char(3) not null default 'PEN', delivery_method text not null, reference text, concept text, status public.advance_status not null default 'delivered',
  receipt_file_id uuid, created_by uuid not null, idempotency_key uuid, created_at timestamptz not null default now(),
  constraint advances_trip_fk foreign key (company_id, trip_id) references public.trips (company_id, id) on delete restrict,
  constraint advances_driver_fk foreign key (company_id, driver_id) references public.drivers (company_id, id) on delete restrict,
  constraint advances_file_fk foreign key (company_id, receipt_file_id) references public.files (company_id, id) on delete restrict,
  constraint advances_actor_fk foreign key (company_id, created_by) references public.profiles (company_id, id) on delete restrict,
  constraint advances_company_id_id_unique unique (company_id, id), constraint advances_idempotency_unique unique (company_id, idempotency_key)
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies (id) on delete restrict,
  assignment_type public.assignment_type not null, trip_id uuid, vehicle_id uuid, driver_id uuid, category_id uuid not null, supplier_id uuid,
  incurred_at timestamptz not null, amount numeric(14,2) not null check (amount > 0), currency char(3) not null default 'PEN',
  receipt_type text, receipt_number text, receipt_file_id uuid, description text, source text not null,
  validation_status public.validation_status not null default 'pending_review', approved_amount numeric(14,2) check (approved_amount is null or approved_amount >= 0),
  created_by uuid not null, source_device_id text, idempotency_key uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint expenses_trip_fk foreign key (company_id, trip_id) references public.trips (company_id, id) on delete restrict,
  constraint expenses_vehicle_fk foreign key (company_id, vehicle_id) references public.vehicles (company_id, id) on delete restrict,
  constraint expenses_driver_fk foreign key (company_id, driver_id) references public.drivers (company_id, id) on delete restrict,
  constraint expenses_category_fk foreign key (company_id, category_id) references public.expense_categories (company_id, id) on delete restrict,
  constraint expenses_supplier_fk foreign key (company_id, supplier_id) references public.suppliers (company_id, id) on delete restrict,
  constraint expenses_file_fk foreign key (company_id, receipt_file_id) references public.files (company_id, id) on delete restrict,
  constraint expenses_actor_fk foreign key (company_id, created_by) references public.profiles (company_id, id) on delete restrict,
  constraint expenses_assignment check ((assignment_type = 'trip' and trip_id is not null) or (assignment_type = 'vehicle' and vehicle_id is not null) or assignment_type = 'general'),
  constraint expenses_company_id_id_unique unique (company_id, id), constraint expenses_idempotency_unique unique (company_id, idempotency_key)
);

create table public.fuel_entries (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies (id) on delete restrict,
  trip_id uuid, vehicle_id uuid not null, driver_id uuid, supplier_id uuid, fueled_at timestamptz not null, location text,
  odometer_km numeric(14,2) not null check (odometer_km >= 0), quantity numeric(14,3) not null check (quantity > 0),
  volume_unit text not null check (volume_unit in ('gallon', 'liter')), unit_price numeric(14,4) not null check (unit_price >= 0),
  total_amount numeric(14,2) not null check (total_amount > 0), currency char(3) not null default 'PEN', payment_method text,
  receipt_type text, receipt_number text, receipt_file_id uuid, validation_status public.validation_status not null default 'pending_review',
  created_by uuid not null, source_device_id text, idempotency_key uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint fuel_trip_fk foreign key (company_id, trip_id) references public.trips (company_id, id) on delete restrict,
  constraint fuel_vehicle_fk foreign key (company_id, vehicle_id) references public.vehicles (company_id, id) on delete restrict,
  constraint fuel_driver_fk foreign key (company_id, driver_id) references public.drivers (company_id, id) on delete restrict,
  constraint fuel_supplier_fk foreign key (company_id, supplier_id) references public.suppliers (company_id, id) on delete restrict,
  constraint fuel_file_fk foreign key (company_id, receipt_file_id) references public.files (company_id, id) on delete restrict,
  constraint fuel_actor_fk foreign key (company_id, created_by) references public.profiles (company_id, id) on delete restrict,
  constraint fuel_total_consistent check (abs(total_amount - round((quantity * unit_price)::numeric, 2)) <= 0.05),
  constraint fuel_company_id_id_unique unique (company_id, id), constraint fuel_idempotency_unique unique (company_id, idempotency_key)
);

create table public.settlements (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies (id) on delete restrict,
  trip_id uuid not null, driver_id uuid not null, started_at timestamptz not null default now(), submitted_at timestamptz, approved_at timestamptz, closed_at timestamptz,
  total_advances numeric(14,2) not null default 0, total_expenses numeric(14,2) not null default 0, balance numeric(14,2) not null default 0,
  status public.settlement_status not null default 'pending', notes text, approved_by uuid, version integer not null default 1,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint settlements_trip_fk foreign key (company_id, trip_id) references public.trips (company_id, id) on delete restrict,
  constraint settlements_driver_fk foreign key (company_id, driver_id) references public.drivers (company_id, id) on delete restrict,
  constraint settlements_approver_fk foreign key (company_id, approved_by) references public.profiles (company_id, id) on delete restrict,
  constraint settlements_company_trip_unique unique (company_id, trip_id), constraint settlements_company_id_id_unique unique (company_id, id)
);

create table public.settlement_expenses (
  company_id uuid not null references public.companies (id) on delete restrict, settlement_id uuid not null, expense_id uuid not null,
  included_at timestamptz not null default now(), included_by uuid not null,
  primary key (company_id, settlement_id, expense_id),
  constraint settlement_expenses_settlement_fk foreign key (company_id, settlement_id) references public.settlements (company_id, id) on delete restrict,
  constraint settlement_expenses_expense_fk foreign key (company_id, expense_id) references public.expenses (company_id, id) on delete restrict,
  constraint settlement_expenses_actor_fk foreign key (company_id, included_by) references public.profiles (company_id, id) on delete restrict
);

create table public.maintenance_plans (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies (id) on delete restrict,
  vehicle_id uuid not null, maintenance_type text not null, name text not null, description text,
  frequency_km numeric(14,2) check (frequency_km is null or frequency_km > 0), frequency_days integer check (frequency_days is null or frequency_days > 0),
  last_odometer_km numeric(14,2), last_date date, active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint maintenance_plans_vehicle_fk foreign key (company_id, vehicle_id) references public.vehicles (company_id, id) on delete restrict,
  constraint maintenance_plans_frequency check (frequency_km is not null or frequency_days is not null),
  constraint maintenance_plans_company_id_id_unique unique (company_id, id)
);

create table public.work_orders (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies (id) on delete restrict,
  code text not null, vehicle_id uuid not null, supplier_id uuid, maintenance_type text not null, source text not null,
  admitted_at timestamptz, started_at timestamptz, finished_at timestamptz, odometer_km numeric(14,2),
  reported_problem text, diagnosis text, work_performed text, labor_cost numeric(14,2) not null default 0 check (labor_cost >= 0),
  parts_cost numeric(14,2) not null default 0 check (parts_cost >= 0), status public.work_order_status not null default 'scheduled', notes text,
  blocks_operation boolean not null default false,
  created_by uuid not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint work_orders_vehicle_fk foreign key (company_id, vehicle_id) references public.vehicles (company_id, id) on delete restrict,
  constraint work_orders_supplier_fk foreign key (company_id, supplier_id) references public.suppliers (company_id, id) on delete restrict,
  constraint work_orders_actor_fk foreign key (company_id, created_by) references public.profiles (company_id, id) on delete restrict,
  constraint work_orders_company_code_unique unique (company_id, code), constraint work_orders_company_id_id_unique unique (company_id, id)
);

create table public.parts (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies (id) on delete restrict,
  name text not null, internal_code text, brand text, category text, unit text not null, active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint parts_company_code_unique unique (company_id, internal_code), constraint parts_company_id_id_unique unique (company_id, id)
);

create table public.work_order_parts (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies (id) on delete restrict,
  work_order_id uuid not null, part_id uuid not null, supplier_id uuid, quantity numeric(14,3) not null check (quantity > 0),
  unit_cost numeric(14,4) not null check (unit_cost >= 0), installed_at timestamptz, installation_odometer_km numeric(14,2), notes text,
  constraint work_order_parts_order_fk foreign key (company_id, work_order_id) references public.work_orders (company_id, id) on delete restrict,
  constraint work_order_parts_part_fk foreign key (company_id, part_id) references public.parts (company_id, id) on delete restrict,
  constraint work_order_parts_supplier_fk foreign key (company_id, supplier_id) references public.suppliers (company_id, id) on delete restrict,
  constraint work_order_parts_company_id_id_unique unique (company_id, id)
);

create table public.documents (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies (id) on delete restrict,
  document_type text not null, document_number text, issued_on date, expires_on date, entity_type text not null,
  vehicle_id uuid, driver_id uuid, trip_id uuid, client_id uuid, file_id uuid, status public.document_status not null default 'valid',
  blocks_operation boolean not null default false,
  notes text, created_by uuid not null, created_at timestamptz not null default now(),
  constraint documents_vehicle_fk foreign key (company_id, vehicle_id) references public.vehicles (company_id, id) on delete restrict,
  constraint documents_driver_fk foreign key (company_id, driver_id) references public.drivers (company_id, id) on delete restrict,
  constraint documents_trip_fk foreign key (company_id, trip_id) references public.trips (company_id, id) on delete restrict,
  constraint documents_client_fk foreign key (company_id, client_id) references public.clients (company_id, id) on delete restrict,
  constraint documents_file_fk foreign key (company_id, file_id) references public.files (company_id, id) on delete restrict,
  constraint documents_actor_fk foreign key (company_id, created_by) references public.profiles (company_id, id) on delete restrict,
  constraint documents_one_entity check (
    (entity_type = 'company' and num_nonnulls(vehicle_id,driver_id,trip_id,client_id) = 0)
    or (entity_type = 'vehicle' and vehicle_id is not null and num_nonnulls(driver_id,trip_id,client_id) = 0)
    or (entity_type = 'driver' and driver_id is not null and num_nonnulls(vehicle_id,trip_id,client_id) = 0)
    or (entity_type = 'trip' and trip_id is not null and num_nonnulls(vehicle_id,driver_id,client_id) = 0)
    or (entity_type = 'client' and client_id is not null and num_nonnulls(vehicle_id,driver_id,trip_id) = 0)
  ),
  constraint documents_dates check (expires_on is null or issued_on is null or expires_on >= issued_on),
  constraint documents_company_id_id_unique unique (company_id, id)
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies (id) on delete restrict,
  client_id uuid not null, trip_id uuid not null, series text not null, number text not null, issued_on date not null, due_on date,
  currency char(3) not null default 'PEN', subtotal numeric(14,2) not null check (subtotal >= 0), tax numeric(14,2) not null default 0 check (tax >= 0),
  total numeric(14,2) not null check (total > 0), status public.invoice_status not null default 'draft', file_id uuid, notes text,
  created_by uuid not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint invoices_client_fk foreign key (company_id, client_id) references public.clients (company_id, id) on delete restrict,
  constraint invoices_trip_fk foreign key (company_id, trip_id) references public.trips (company_id, id) on delete restrict,
  constraint invoices_file_fk foreign key (company_id, file_id) references public.files (company_id, id) on delete restrict,
  constraint invoices_actor_fk foreign key (company_id, created_by) references public.profiles (company_id, id) on delete restrict,
  constraint invoices_total_consistent check (total = subtotal + tax),
  constraint invoices_company_number_unique unique (company_id, series, number), constraint invoices_company_id_id_unique unique (company_id, id)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies (id) on delete restrict,
  invoice_id uuid not null, client_id uuid not null, paid_at timestamptz not null, amount numeric(14,2) not null check (amount > 0),
  currency char(3) not null default 'PEN', payment_method text not null, reference text, file_id uuid, notes text,
  created_by uuid not null, idempotency_key uuid not null, cancelled_at timestamptz, cancellation_reason text, created_at timestamptz not null default now(),
  constraint payments_invoice_fk foreign key (company_id, invoice_id) references public.invoices (company_id, id) on delete restrict,
  constraint payments_client_fk foreign key (company_id, client_id) references public.clients (company_id, id) on delete restrict,
  constraint payments_file_fk foreign key (company_id, file_id) references public.files (company_id, id) on delete restrict,
  constraint payments_actor_fk foreign key (company_id, created_by) references public.profiles (company_id, id) on delete restrict,
  constraint payments_cancellation check ((cancelled_at is null and cancellation_reason is null) or (cancelled_at is not null and length(trim(cancellation_reason)) > 0)),
  constraint payments_company_idempotency_unique unique (company_id, idempotency_key), constraint payments_company_id_id_unique unique (company_id, id)
);

create table public.alerts (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies (id) on delete restrict,
  alert_type text not null, priority text not null check (priority in ('low', 'medium', 'high', 'critical')),
  entity_type text not null, entity_id uuid not null, title text not null, message text not null,
  generated_at timestamptz not null default now(), due_at timestamptz, status public.alert_status not null default 'new', resolved_by uuid, resolved_at timestamptz,
  constraint alerts_resolver_fk foreign key (company_id, resolved_by) references public.profiles (company_id, id) on delete restrict,
  constraint alerts_resolution check ((resolved_at is null and resolved_by is null) or (resolved_at is not null and resolved_by is not null)),
  constraint alerts_company_id_id_unique unique (company_id, id)
);

-- Consistent updated_at behavior for mutable business records.
do $$
declare table_name text;
begin
  foreach table_name in array array['clients','suppliers','expense_categories','routes','vehicles','drivers','operational_cycles','trips','loads','incidents','expenses','fuel_entries','settlements','maintenance_plans','work_orders','parts','invoices']
  loop
    execute format('create trigger %I before update on public.%I for each row execute function private.set_updated_at()', table_name || '_set_updated_at', table_name);
  end loop;
end
$$;

create index expenses_trip_idx on public.expenses (company_id, trip_id, incurred_at desc);
create index fuel_entries_trip_idx on public.fuel_entries (company_id, trip_id, fueled_at desc);
create index odometer_vehicle_idx on public.odometer_entries (company_id, vehicle_id, reading_at desc);
create index invoices_due_idx on public.invoices (company_id, status, due_on);
