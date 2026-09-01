-- Authoritative evaluator calculation, company isolation, and command-only
-- writes. The client submits assumptions; it never supplies a result snapshot.

create function private.validate_trip_evaluation_cost_coverage(p_cost_coverage jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  coverage_item jsonb;
begin
  if jsonb_typeof(p_cost_coverage) is distinct from 'object'
    or jsonb_typeof(p_cost_coverage -> 'included_categories') is distinct from 'array'
    or jsonb_typeof(p_cost_coverage -> 'excluded_categories') is distinct from 'array' then
    raise exception using
      errcode = '23514',
      message = 'Cost coverage requires included_categories and excluded_categories arrays';
  end if;

  for coverage_item in
    select value from jsonb_array_elements(p_cost_coverage -> 'included_categories') as coverage(value)
  loop
    if jsonb_typeof(coverage_item) <> 'string'
      or length(trim(coverage_item #>> '{}')) = 0 then
      raise exception using errcode = '23514', message = 'Included cost categories must be non-blank strings';
    end if;
  end loop;

  for coverage_item in
    select value from jsonb_array_elements(p_cost_coverage -> 'excluded_categories') as coverage(value)
  loop
    if jsonb_typeof(coverage_item) <> 'string'
      or length(trim(coverage_item #>> '{}')) = 0 then
      raise exception using errcode = '23514', message = 'Excluded cost categories must be non-blank strings';
    end if;
  end loop;

  if exists (
    select 1
    from jsonb_array_elements_text(p_cost_coverage -> 'included_categories') as included(value)
    join jsonb_array_elements_text(p_cost_coverage -> 'excluded_categories') as excluded(value)
      on lower(trim(included.value)) = lower(trim(excluded.value))
  ) then
    raise exception using errcode = '23514', message = 'A cost category cannot be both included and excluded';
  end if;

  if exists (
    select 1
    from (
      select lower(trim(value)) as category, count(*) as occurrences
      from jsonb_array_elements_text(p_cost_coverage -> 'included_categories') as included(value)
      group by lower(trim(value))
    ) as duplicates
    where duplicates.occurrences > 1
  ) or exists (
    select 1
    from (
      select lower(trim(value)) as category, count(*) as occurrences
      from jsonb_array_elements_text(p_cost_coverage -> 'excluded_categories') as excluded(value)
      group by lower(trim(value))
    ) as duplicates
    where duplicates.occurrences > 1
  ) then
    raise exception using errcode = '23514', message = 'Cost coverage categories cannot be duplicated';
  end if;
end;
$$;

create function private.trip_evaluation_nonnegative_number(
  p_value jsonb,
  p_field text,
  p_required boolean default true
)
returns numeric
language plpgsql
immutable
security definer
set search_path = ''
as $$
declare
  parsed_value numeric;
begin
  if p_value is null or jsonb_typeof(p_value) = 'null' then
    if p_required then
      raise exception using errcode = '23514', message = p_field || ' is required';
    end if;
    return null;
  end if;
  if jsonb_typeof(p_value) <> 'number' then
    raise exception using errcode = '23514', message = p_field || ' must be a number';
  end if;
  parsed_value := (p_value #>> '{}')::numeric;
  if parsed_value < 0 then
    raise exception using errcode = '23514', message = p_field || ' cannot be negative';
  end if;
  return parsed_value;
end;
$$;

create function private.normalize_trip_evaluation_costs(
  p_costs jsonb,
  p_cost_coverage jsonb,
  p_field text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  cost_item jsonb;
  category text;
  amount numeric;
  normalized_costs jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(p_costs) is distinct from 'array' then
    raise exception using errcode = '23514', message = p_field || ' must be an array';
  end if;

  for cost_item in select value from jsonb_array_elements(p_costs) as costs(value)
  loop
    if jsonb_typeof(cost_item) <> 'object' then
      raise exception using errcode = '23514', message = p_field || ' entries must be objects';
    end if;
    if jsonb_typeof(cost_item -> 'category') is distinct from 'string' then
      raise exception using errcode = '23514', message = p_field || ' entries require a string category';
    end if;
    category := trim(coalesce(cost_item ->> 'category', ''));
    if length(category) = 0 then
      raise exception using errcode = '23514', message = p_field || ' entries require a category';
    end if;
    if not exists (
      select 1
      from jsonb_array_elements_text(p_cost_coverage -> 'included_categories') as included(value)
      where lower(trim(included.value)) = lower(category)
    ) then
      raise exception using
        errcode = '23514',
        message = p_field || ' contains a category excluded by the selected policy';
    end if;
    amount := round(private.trip_evaluation_nonnegative_number(cost_item -> 'amount', p_field || '.amount'), 2);
    normalized_costs := normalized_costs || jsonb_build_array(
      jsonb_build_object('category', category, 'amount', amount)
    );
  end loop;

  return normalized_costs;
end;
$$;

create function private.normalize_trip_evaluation_excluded_costs(
  p_excluded_costs jsonb,
  p_cost_coverage jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  excluded_item jsonb;
  excluded_category text;
  normalized_excluded_costs jsonb := '[]'::jsonb;
begin
  -- Coverage is a policy decision, not a selectable client presentation.
  -- Always snapshot every excluded category declared by the selected policy so
  -- an administrator cannot hide a material exclusion with an empty payload.
  p_excluded_costs := p_cost_coverage -> 'excluded_categories';
  if jsonb_typeof(p_excluded_costs) is distinct from 'array' then
    raise exception using errcode = '23514', message = 'Policy excluded_categories must be an array';
  end if;

  for excluded_item in select value from jsonb_array_elements(p_excluded_costs) as excluded(value)
  loop
    if jsonb_typeof(excluded_item) <> 'string' then
      raise exception using errcode = '23514', message = 'Excluded costs must be non-blank strings';
    end if;
    excluded_category := trim(excluded_item #>> '{}');
    if length(excluded_category) = 0 then
      raise exception using errcode = '23514', message = 'Excluded costs must be non-blank strings';
    end if;
    normalized_excluded_costs := normalized_excluded_costs || jsonb_build_array(excluded_category);
  end loop;

  return normalized_excluded_costs;
end;
$$;

create function private.build_trip_evaluation_metrics(
  p_direct_revenue numeric,
  p_direct_cost numeric,
  p_direct_margin numeric,
  p_estimated_distance_km numeric,
  p_estimated_days numeric
)
returns jsonb
language sql
immutable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'estimated_distance_km', p_estimated_distance_km,
    'estimated_days', p_estimated_days,
    'direct_cost_per_km', case when p_estimated_distance_km is null then null else round(p_direct_cost / p_estimated_distance_km, 2) end,
    'direct_revenue_per_km', case when p_estimated_distance_km is null then null else round(p_direct_revenue / p_estimated_distance_km, 2) end,
    'direct_margin_per_km', case when p_estimated_distance_km is null then null else round(p_direct_margin / p_estimated_distance_km, 2) end,
    'direct_cost_per_day', case when p_estimated_days is null then null else round(p_direct_cost / p_estimated_days, 2) end,
    'direct_revenue_per_day', case when p_estimated_days is null then null else round(p_direct_revenue / p_estimated_days, 2) end,
    'direct_margin_per_day', case when p_estimated_days is null then null else round(p_direct_margin / p_estimated_days, 2) end
  )
$$;

create function private.build_trip_evaluation_scenario(
  p_scenario public.trip_evaluation_scenario,
  p_direct_revenue numeric,
  p_direct_cost numeric,
  p_policy public.trip_evaluation_policies,
  p_estimated_distance_km numeric,
  p_estimated_days numeric
)
returns jsonb
language plpgsql
immutable
security definer
set search_path = ''
as $$
declare
  normalized_revenue numeric := round(p_direct_revenue, 2);
  normalized_cost numeric := round(p_direct_cost, 2);
  direct_margin numeric;
  margin_rate numeric;
  equilibrium_price numeric;
  minimum_price numeric;
  target_price numeric;
begin
  direct_margin := round(normalized_revenue - normalized_cost, 2);
  if p_policy.margin_basis = 'REVENUE' then
    margin_rate := case when normalized_revenue = 0 then null else round(direct_margin / normalized_revenue, 4) end;
    equilibrium_price := normalized_cost;
    minimum_price := round(normalized_cost / (1 - p_policy.minimum_margin_rate), 2);
    target_price := round(normalized_cost / (1 - p_policy.target_margin_rate), 2);
  else
    margin_rate := case when normalized_cost = 0 then null else round(direct_margin / normalized_cost, 4) end;
    equilibrium_price := normalized_cost;
    minimum_price := round(normalized_cost * (1 + p_policy.minimum_margin_rate), 2);
    target_price := round(normalized_cost * (1 + p_policy.target_margin_rate), 2);
  end if;

  return jsonb_build_object(
    'type', p_scenario::text,
    'direct_revenue', normalized_revenue,
    'direct_cost', normalized_cost,
    'direct_margin', direct_margin,
    'margin_rate', margin_rate,
    'prices', jsonb_build_object(
      'equilibrium', equilibrium_price,
      'minimum', minimum_price,
      'target', target_price
    ),
    'metrics', private.build_trip_evaluation_metrics(
      normalized_revenue,
      normalized_cost,
      direct_margin,
      p_estimated_distance_km,
      p_estimated_days
    )
  );
end;
$$;

create function private.calculate_trip_evaluation(
  p_policy public.trip_evaluation_policies,
  p_input jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  input_currency text;
  offer_amount numeric;
  normalized_origin text;
  normalized_destination text;
  return_input jsonb;
  return_status text;
  return_income numeric;
  return_probability_rate numeric;
  estimated_distance_km numeric;
  estimated_days numeric;
  outbound_costs jsonb;
  empty_return_costs jsonb;
  loaded_return_costs jsonb;
  excluded_costs jsonb;
  outbound_cost numeric;
  empty_return_cost numeric;
  loaded_return_cost numeric;
  conservative_scenario jsonb;
  probable_scenario jsonb;
  favorable_scenario jsonb;
  normalized_input jsonb;
  result_snapshot jsonb;
  minimum_price numeric;
begin
  if jsonb_typeof(p_input) is distinct from 'object' then
    raise exception using errcode = '23514', message = 'Evaluation input must be a JSON object';
  end if;
  perform private.validate_trip_evaluation_cost_coverage(p_policy.cost_coverage);

  if p_input ? 'currency' then
    input_currency := upper(trim(coalesce(p_input ->> 'currency', '')));
    if input_currency <> trim(p_policy.currency) then
      raise exception using errcode = '23514', message = 'Evaluation currency must match the selected policy';
    end if;
  end if;

  if p_input ? 'origin'
    and jsonb_typeof(p_input -> 'origin') is distinct from 'string'
    and jsonb_typeof(p_input -> 'origin') is distinct from 'null' then
    raise exception using errcode = '23514', message = 'origin must be a string or null when supplied';
  end if;
  if p_input ? 'destination'
    and jsonb_typeof(p_input -> 'destination') is distinct from 'string'
    and jsonb_typeof(p_input -> 'destination') is distinct from 'null' then
    raise exception using errcode = '23514', message = 'destination must be a string or null when supplied';
  end if;
  normalized_origin := nullif(trim(coalesce(p_input ->> 'origin', '')), '');
  normalized_destination := nullif(trim(coalesce(p_input ->> 'destination', '')), '');

  offer_amount := round(private.trip_evaluation_nonnegative_number(p_input -> 'offer_amount', 'offer_amount'), 2);
  outbound_costs := private.normalize_trip_evaluation_costs(
    p_input -> 'outbound_direct_costs', p_policy.cost_coverage, 'outbound_direct_costs'
  );
  empty_return_costs := private.normalize_trip_evaluation_costs(
    coalesce(p_input -> 'empty_return_direct_costs', '[]'::jsonb),
    p_policy.cost_coverage,
    'empty_return_direct_costs'
  );

  return_input := p_input -> 'return';
  if jsonb_typeof(return_input) is distinct from 'object' then
    raise exception using errcode = '23514', message = 'return must be a JSON object';
  end if;
  return_status := upper(trim(coalesce(return_input ->> 'status', '')));
  if return_status not in ('NONE', 'PROBABLE', 'CONFIRMED') then
    raise exception using errcode = '23514', message = 'return.status is invalid';
  end if;

  if return_status = 'NONE' then
    return_income := coalesce(
      private.trip_evaluation_nonnegative_number(return_input -> 'income', 'return.income', false),
      0
    );
    if return_income <> 0 then
      raise exception using errcode = '23514', message = 'A NONE return cannot have income';
    end if;
    return_probability_rate := coalesce(
      private.trip_evaluation_nonnegative_number(return_input -> 'probability_rate', 'return.probability_rate', false),
      0
    );
    if return_probability_rate <> 0 then
      raise exception using errcode = '23514', message = 'A NONE return cannot have a probability';
    end if;
  elsif return_status = 'CONFIRMED' then
    return_income := private.trip_evaluation_nonnegative_number(return_input -> 'income', 'return.income');
    return_probability_rate := coalesce(
      private.trip_evaluation_nonnegative_number(return_input -> 'probability_rate', 'return.probability_rate', false),
      1
    );
    if return_probability_rate <> 1 then
      raise exception using errcode = '23514', message = 'A CONFIRMED return requires a probability of 1';
    end if;
  else
    return_income := private.trip_evaluation_nonnegative_number(return_input -> 'income', 'return.income');
    return_probability_rate := private.trip_evaluation_nonnegative_number(
      return_input -> 'probability_rate', 'return.probability_rate'
    );
    if return_probability_rate >= 1 then
      raise exception using errcode = '23514', message = 'A PROBABLE return probability must be below 1';
    end if;
  end if;

  loaded_return_costs := private.normalize_trip_evaluation_costs(
    coalesce(return_input -> 'direct_costs', '[]'::jsonb),
    p_policy.cost_coverage,
    'return.direct_costs'
  );
  if return_status = 'NONE' and jsonb_array_length(loaded_return_costs) <> 0 then
    raise exception using errcode = '23514', message = 'A NONE return cannot have loaded return costs';
  end if;

  estimated_distance_km := private.trip_evaluation_nonnegative_number(
    p_input -> 'estimated_distance_km', 'estimated_distance_km', false
  );
  if estimated_distance_km is not null and estimated_distance_km <= 0 then
    raise exception using errcode = '23514', message = 'estimated_distance_km must be positive when supplied';
  end if;
  estimated_days := private.trip_evaluation_nonnegative_number(
    p_input -> 'estimated_days', 'estimated_days', false
  );
  if estimated_days is not null and estimated_days <= 0 then
    raise exception using errcode = '23514', message = 'estimated_days must be positive when supplied';
  end if;

  excluded_costs := private.normalize_trip_evaluation_excluded_costs(
    p_input -> 'excluded_costs', p_policy.cost_coverage
  );
  outbound_cost := coalesce((select sum((cost ->> 'amount')::numeric) from jsonb_array_elements(outbound_costs) as costs(cost)), 0);
  empty_return_cost := coalesce((select sum((cost ->> 'amount')::numeric) from jsonb_array_elements(empty_return_costs) as costs(cost)), 0);
  loaded_return_cost := coalesce((select sum((cost ->> 'amount')::numeric) from jsonb_array_elements(loaded_return_costs) as costs(cost)), 0);

  conservative_scenario := private.build_trip_evaluation_scenario(
    'CONSERVATIVE',
    offer_amount,
    outbound_cost + empty_return_cost,
    p_policy,
    estimated_distance_km,
    estimated_days
  );
  if return_status = 'NONE' then
    probable_scenario := conservative_scenario;
    favorable_scenario := conservative_scenario;
  else
    probable_scenario := private.build_trip_evaluation_scenario(
      'PROBABLE',
      offer_amount + return_probability_rate * return_income,
      outbound_cost + return_probability_rate * loaded_return_cost
        + (1 - return_probability_rate) * empty_return_cost,
      p_policy,
      estimated_distance_km,
      estimated_days
    );
    favorable_scenario := private.build_trip_evaluation_scenario(
      'FAVORABLE',
      offer_amount + return_income,
      outbound_cost + loaded_return_cost,
      p_policy,
      estimated_distance_km,
      estimated_days
    );
  end if;

  normalized_input := jsonb_build_object(
    'currency', trim(p_policy.currency),
    'origin', normalized_origin,
    'destination', normalized_destination,
    'offer_amount', offer_amount,
    'outbound_direct_costs', outbound_costs,
    'empty_return_direct_costs', empty_return_costs,
    'return', jsonb_build_object(
      'status', return_status,
      'income', round(return_income, 2),
      'direct_costs', loaded_return_costs,
      'probability_rate', return_probability_rate
    ),
    'estimated_distance_km', estimated_distance_km,
    'estimated_days', estimated_days,
    'excluded_costs', excluded_costs
  );
  minimum_price := (conservative_scenario -> 'prices' ->> 'minimum')::numeric;
  result_snapshot := jsonb_build_object(
    'formula_version', 1,
    'currency', trim(p_policy.currency),
    'coverage', 'DIRECT_ONLY',
    'cost_coverage', p_policy.cost_coverage,
    'excluded_costs', excluded_costs,
    'policy', jsonb_build_object(
      'id', p_policy.id,
      'policy_key', p_policy.policy_key,
      'version', p_policy.version,
      'currency', trim(p_policy.currency),
      'margin_basis', p_policy.margin_basis::text,
      'tax_basis', p_policy.tax_basis::text,
      'tax_rate', p_policy.tax_rate,
      'minimum_margin_rate', p_policy.minimum_margin_rate,
      'target_margin_rate', p_policy.target_margin_rate,
      'cost_coverage', p_policy.cost_coverage
    ),
    'scenarios', jsonb_build_object(
      'conservative', conservative_scenario,
      'probable', probable_scenario,
      'favorable', favorable_scenario
    ),
    'assessment', jsonb_build_object(
      'threshold_scenario', 'CONSERVATIVE',
      'offer_amount', offer_amount,
      'minimum_price', minimum_price,
      'requires_exception', offer_amount < minimum_price
    )
  );

  return jsonb_build_object(
    'input_snapshot', normalized_input,
    'result_snapshot', result_snapshot
  );
end;
$$;

create function private.assert_trip_evaluation_policy_available(
  p_policy public.trip_evaluation_policies
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not p_policy.active
    or p_policy.effective_from > now()
    or (p_policy.effective_to is not null and p_policy.effective_to <= now()) then
    raise exception using errcode = '23514', message = 'The selected policy is not currently active';
  end if;
end;
$$;

create function public.create_trip_evaluation_policy(
  policy_key text,
  name text,
  currency char(3),
  margin_basis public.trip_evaluation_margin_basis,
  tax_basis public.trip_evaluation_tax_basis,
  tax_rate numeric,
  minimum_margin_rate numeric,
  target_margin_rate numeric,
  cost_coverage jsonb,
  effective_from timestamptz default now(),
  effective_to timestamptz default null
)
returns public.trip_evaluation_policies
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_company_id uuid := private.current_company_id();
  normalized_policy_key text := trim(coalesce($1, ''));
  normalized_name text := trim(coalesce($2, ''));
  normalized_currency text := upper(trim(coalesce($3::text, '')));
  next_version integer;
  policy_row public.trip_evaluation_policies;
begin
  perform private.assert_role(array['management']::public.app_role[]);
  if length(normalized_policy_key) = 0 or length(normalized_name) = 0 then
    raise exception using errcode = '23514', message = 'Policy key and name are required';
  end if;
  if normalized_currency !~ '^[A-Z]{3}$' then
    raise exception using errcode = '23514', message = 'Policy currency must contain three letters';
  end if;
  if $4 is null or $5 is null then
    raise exception using errcode = '23514', message = 'Margin and tax bases are required';
  end if;
  if $6 is null or $6 < 0 or $6 >= 1
    or $7 is null or $7 < 0 or $7 >= 1
    or $8 is null or $8 < 0 or $8 >= 1
    or $8 < $7 then
    raise exception using errcode = '23514', message = 'Policy margin rates are invalid';
  end if;
  if $10 is null or ($11 is not null and $11 <= $10) then
    raise exception using errcode = '23514', message = 'Policy effective window is invalid';
  end if;
  if $10 > now() or ($11 is not null and $11 <= now()) then
    raise exception using errcode = '23514', message = 'A published policy must be effective now';
  end if;
  perform private.validate_trip_evaluation_cost_coverage($9);

  perform pg_advisory_xact_lock(
    hashtextextended(current_company_id::text || ':trip-evaluation-policy', 0)
  );
  update public.trip_evaluation_policies policy
  set active = false,
      effective_to = case
        when policy.effective_from < $10
          and (policy.effective_to is null or policy.effective_to > $10)
          then $10
        else policy.effective_to
      end
  where policy.company_id = current_company_id and policy.active;

  select coalesce(max(policy.version), 0) + 1
    into next_version
  from public.trip_evaluation_policies policy
  where policy.company_id = current_company_id and policy.policy_key = normalized_policy_key;

  insert into public.trip_evaluation_policies (
    company_id, policy_key, name, version, currency, margin_basis, tax_basis, tax_rate,
    minimum_margin_rate, target_margin_rate, cost_coverage, active,
    effective_from, effective_to, created_by
  ) values (
    current_company_id, normalized_policy_key, normalized_name, next_version,
    normalized_currency::char(3), $4, $5, $6,
    $7, $8, $9, true,
    $10, $11, auth.uid()
  ) returning * into policy_row;

  perform private.write_audit(
    current_company_id,
    'TRIP_EVALUATION_POLICY_CREATED',
    'trip_evaluation_policy',
    policy_row.id,
    null,
    to_jsonb(policy_row)
  );
  return policy_row;
end;
$$;

create function public.save_trip_evaluation(
  policy_id uuid,
  input jsonb,
  evaluation_id uuid default null,
  client_id uuid default null,
  vehicle_id uuid default null,
  reference text default null,
  expected_version integer default null,
  idempotency_key uuid default null
)
returns public.trip_evaluations
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_company_id uuid := private.current_company_id();
  normalized_reference text := nullif(trim(coalesce($6, '')), '');
  policy_row public.trip_evaluation_policies;
  calculation jsonb;
  normalized_input jsonb;
  calculated_result_snapshot jsonb;
  existing_idempotent public.trip_evaluations;
  old_evaluation public.trip_evaluations;
  evaluation_row public.trip_evaluations;
begin
  perform private.assert_role(array['management', 'administration']::public.app_role[]);
  if $1 is null then
    raise exception using errcode = '23514', message = 'A policy is required';
  end if;
  select * into policy_row
  from public.trip_evaluation_policies policy
  where policy.id = $1 and policy.company_id = current_company_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'Trip evaluation policy not found';
  end if;
  calculation := private.calculate_trip_evaluation(policy_row, $2);
  normalized_input := calculation -> 'input_snapshot';
  calculated_result_snapshot := calculation -> 'result_snapshot';

  if $8 is not null then
    select * into existing_idempotent
    from public.trip_evaluations evaluation
    where evaluation.company_id = current_company_id
      and evaluation.idempotency_key = $8
    for update;
    if found then
      if existing_idempotent.policy_id = $1
        and existing_idempotent.client_id is not distinct from $4
        and existing_idempotent.vehicle_id is not distinct from $5
        and existing_idempotent.reference is not distinct from normalized_reference
        and existing_idempotent.input_snapshot = normalized_input
        and (
          $3 is null
          or existing_idempotent.id = $3
          or existing_idempotent.supersedes_evaluation_id = $3
        ) then
        return existing_idempotent;
      end if;
      raise exception using errcode = '23505', message = 'Idempotency key is already associated with another evaluation command';
    end if;
  end if;

  perform private.assert_trip_evaluation_policy_available(policy_row);
  if $4 is not null and not exists (
    select 1 from public.clients client
    where client.id = $4 and client.company_id = current_company_id
  ) then
    raise exception using errcode = '23514', message = 'Client must belong to the authenticated company';
  end if;
  if $5 is not null and not exists (
    select 1 from public.vehicles vehicle
    where vehicle.id = $5 and vehicle.company_id = current_company_id
  ) then
    raise exception using errcode = '23514', message = 'Vehicle must belong to the authenticated company';
  end if;

  if $3 is null then
    if $7 is not null then
      raise exception using errcode = '23514', message = 'New evaluations cannot specify an expected version';
    end if;
    insert into public.trip_evaluations (
      company_id, policy_id, policy_version, policy_snapshot, client_id, vehicle_id,
      reference, currency, input_snapshot, result_snapshot, created_by, idempotency_key
    ) values (
      current_company_id, policy_row.id, policy_row.version, to_jsonb(policy_row), $4, $5,
      normalized_reference, policy_row.currency, normalized_input, calculated_result_snapshot, auth.uid(), $8
    ) returning * into evaluation_row;
    perform private.write_audit(
      current_company_id,
      'TRIP_EVALUATION_SAVED',
      'trip_evaluation',
      evaluation_row.id,
      null,
      to_jsonb(evaluation_row)
    );
    return evaluation_row;
  end if;

  select * into old_evaluation
  from public.trip_evaluations evaluation
  where evaluation.id = $3 and evaluation.company_id = current_company_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Trip evaluation not found';
  end if;
  if $7 is null or old_evaluation.version <> $7 then
    raise exception using errcode = '40001', message = 'Trip evaluation changed; reload before saving';
  end if;

  if old_evaluation.status = 'DRAFT' then
    update public.trip_evaluations evaluation
    set policy_id = policy_row.id,
        policy_version = policy_row.version,
        policy_snapshot = to_jsonb(policy_row),
        client_id = $4,
        vehicle_id = $5,
        reference = normalized_reference,
        currency = policy_row.currency,
        input_snapshot = normalized_input,
        result_snapshot = calculated_result_snapshot,
        idempotency_key = coalesce($8, evaluation.idempotency_key),
        version = evaluation.version + 1
    where evaluation.id = old_evaluation.id and evaluation.company_id = current_company_id
    returning * into evaluation_row;
    perform private.write_audit(
      current_company_id,
      'TRIP_EVALUATION_UPDATED',
      'trip_evaluation',
      evaluation_row.id,
      to_jsonb(old_evaluation),
      to_jsonb(evaluation_row)
    );
    return evaluation_row;
  end if;

  insert into public.trip_evaluations (
    company_id, policy_id, policy_version, policy_snapshot, client_id, vehicle_id,
    reference, currency, input_snapshot, result_snapshot, supersedes_evaluation_id,
    created_by, idempotency_key
  ) values (
    current_company_id, policy_row.id, policy_row.version, to_jsonb(policy_row), $4, $5,
    normalized_reference, policy_row.currency, normalized_input, calculated_result_snapshot, old_evaluation.id,
    auth.uid(), $8
  ) returning * into evaluation_row;
  perform private.write_audit(
    current_company_id,
    'TRIP_EVALUATION_REVISION_CREATED',
    'trip_evaluation',
    evaluation_row.id,
    jsonb_build_object('supersedes_evaluation_id', old_evaluation.id),
    to_jsonb(evaluation_row)
  );
  return evaluation_row;
end;
$$;

create function public.fix_trip_evaluation(evaluation_id uuid)
returns public.trip_evaluations
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_company_id uuid := private.current_company_id();
  policy_row public.trip_evaluation_policies;
  old_evaluation public.trip_evaluations;
  evaluation_row public.trip_evaluations;
  exception_row public.trip_evaluation_exceptions;
  calculation jsonb;
  normalized_input jsonb;
  calculated_result_snapshot jsonb;
  requires_exception boolean;
begin
  perform private.assert_role(array['management', 'administration']::public.app_role[]);
  select * into old_evaluation
  from public.trip_evaluations evaluation
  where evaluation.id = $1 and evaluation.company_id = current_company_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Trip evaluation not found';
  end if;
  if old_evaluation.status in ('FIXED', 'EXCEPTION_REQUIRED') then
    return old_evaluation;
  end if;
  if old_evaluation.status <> 'DRAFT' then
    raise exception using errcode = '23514', message = 'Trip evaluation cannot be fixed from its current status';
  end if;

  select * into policy_row
  from public.trip_evaluation_policies policy
  where policy.id = old_evaluation.policy_id and policy.company_id = current_company_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'Trip evaluation policy not found';
  end if;
  perform private.assert_trip_evaluation_policy_available(policy_row);
  calculation := private.calculate_trip_evaluation(policy_row, old_evaluation.input_snapshot);
  normalized_input := calculation -> 'input_snapshot';
  calculated_result_snapshot := calculation -> 'result_snapshot';
  requires_exception := coalesce((calculated_result_snapshot -> 'assessment' ->> 'requires_exception')::boolean, false);

  if requires_exception then
    insert into public.trip_evaluation_exceptions (
      company_id, evaluation_id, policy_snapshot, input_snapshot, result_snapshot, requested_by
    ) values (
      current_company_id, old_evaluation.id, to_jsonb(policy_row), normalized_input, calculated_result_snapshot, auth.uid()
    ) returning * into exception_row;
    update public.trip_evaluations evaluation
    set policy_version = policy_row.version,
        policy_snapshot = to_jsonb(policy_row),
        currency = policy_row.currency,
        input_snapshot = normalized_input,
        result_snapshot = calculated_result_snapshot,
        status = 'EXCEPTION_REQUIRED',
        version = evaluation.version + 1
    where evaluation.id = old_evaluation.id and evaluation.company_id = current_company_id
    returning * into evaluation_row;
    perform private.write_audit(
      current_company_id,
      'TRIP_EVALUATION_EXCEPTION_REQUESTED',
      'trip_evaluation_exception',
      exception_row.id,
      to_jsonb(old_evaluation),
      jsonb_build_object('evaluation', to_jsonb(evaluation_row), 'exception', to_jsonb(exception_row))
    );
    return evaluation_row;
  end if;

  update public.trip_evaluations evaluation
  set policy_version = policy_row.version,
      policy_snapshot = to_jsonb(policy_row),
      currency = policy_row.currency,
      input_snapshot = normalized_input,
      result_snapshot = calculated_result_snapshot,
      status = 'FIXED',
      fixed_by = auth.uid(),
      fixed_at = now(),
      version = evaluation.version + 1
  where evaluation.id = old_evaluation.id and evaluation.company_id = current_company_id
  returning * into evaluation_row;
  perform private.write_audit(
    current_company_id,
    'TRIP_EVALUATION_FIXED',
    'trip_evaluation',
    evaluation_row.id,
    to_jsonb(old_evaluation),
    to_jsonb(evaluation_row)
  );
  return evaluation_row;
end;
$$;

create function public.approve_trip_evaluation_exception(
  exception_id uuid,
  reason text
)
returns public.trip_evaluation_exceptions
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_company_id uuid := private.current_company_id();
  normalized_reason text := trim(coalesce($2, ''));
  old_exception public.trip_evaluation_exceptions;
  exception_row public.trip_evaluation_exceptions;
  old_evaluation public.trip_evaluations;
  evaluation_row public.trip_evaluations;
begin
  perform private.assert_role(array['management']::public.app_role[]);
  if length(normalized_reason) = 0 then
    raise exception using errcode = '23514', message = 'An exception approval reason is required';
  end if;
  select * into old_exception
  from public.trip_evaluation_exceptions evaluation_exception
  where evaluation_exception.id = $1
    and evaluation_exception.company_id = current_company_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Trip evaluation exception not found';
  end if;
  if old_exception.status = 'APPROVED' then
    if old_exception.approval_reason = normalized_reason then
      return old_exception;
    end if;
    raise exception using errcode = '40001', message = 'Trip evaluation exception was already approved';
  end if;
  if old_exception.status <> 'PENDING' then
    raise exception using errcode = '23514', message = 'Trip evaluation exception cannot be approved from its current status';
  end if;

  select * into old_evaluation
  from public.trip_evaluations evaluation
  where evaluation.id = old_exception.evaluation_id and evaluation.company_id = current_company_id
  for update;
  if not found or old_evaluation.status <> 'EXCEPTION_REQUIRED' then
    raise exception using errcode = '23514', message = 'Trip evaluation is not awaiting this exception';
  end if;

  update public.trip_evaluation_exceptions evaluation_exception
  set status = 'APPROVED',
      approved_by = auth.uid(),
      approved_at = now(),
      approval_reason = normalized_reason
  where evaluation_exception.id = old_exception.id
    and evaluation_exception.company_id = current_company_id
  returning * into exception_row;
  update public.trip_evaluations evaluation
  set status = 'FIXED',
      fixed_by = auth.uid(),
      fixed_at = now(),
      version = evaluation.version + 1
  where evaluation.id = old_evaluation.id and evaluation.company_id = current_company_id
  returning * into evaluation_row;
  perform private.write_audit(
    current_company_id,
    'TRIP_EVALUATION_EXCEPTION_APPROVED',
    'trip_evaluation_exception',
    exception_row.id,
    to_jsonb(old_exception),
    jsonb_build_object('exception', to_jsonb(exception_row), 'evaluation', to_jsonb(evaluation_row)),
    normalized_reason
  );
  return exception_row;
end;
$$;

alter table public.trip_evaluation_policies enable row level security;
alter table public.trip_evaluation_policies force row level security;
alter table public.trip_evaluations enable row level security;
alter table public.trip_evaluations force row level security;
alter table public.trip_evaluation_exceptions enable row level security;
alter table public.trip_evaluation_exceptions force row level security;

revoke all on table public.trip_evaluation_policies from anon, authenticated;
revoke all on table public.trip_evaluations from anon, authenticated;
revoke all on table public.trip_evaluation_exceptions from anon, authenticated;
grant all on table public.trip_evaluation_policies to service_role;
grant all on table public.trip_evaluations to service_role;
grant all on table public.trip_evaluation_exceptions to service_role;
grant select on table public.trip_evaluation_policies to authenticated;
grant select on table public.trip_evaluations to authenticated;
grant select on table public.trip_evaluation_exceptions to authenticated;

create policy trip_evaluation_policies_finance_select
  on public.trip_evaluation_policies for select to authenticated
  using (
    company_id = (select private.current_company_id())
    and ((select private.is_staff()) or (select private.is_accounting()))
  );
create policy trip_evaluations_finance_select
  on public.trip_evaluations for select to authenticated
  using (
    company_id = (select private.current_company_id())
    and ((select private.is_staff()) or (select private.is_accounting()))
  );
create policy trip_evaluation_exceptions_finance_select
  on public.trip_evaluation_exceptions for select to authenticated
  using (
    company_id = (select private.current_company_id())
    and ((select private.is_staff()) or (select private.is_accounting()))
  );

revoke all on function private.validate_trip_evaluation_cost_coverage(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function private.trip_evaluation_nonnegative_number(jsonb,text,boolean)
  from public, anon, authenticated, service_role;
revoke all on function private.normalize_trip_evaluation_costs(jsonb,jsonb,text)
  from public, anon, authenticated, service_role;
revoke all on function private.normalize_trip_evaluation_excluded_costs(jsonb,jsonb)
  from public, anon, authenticated, service_role;
revoke all on function private.build_trip_evaluation_metrics(numeric,numeric,numeric,numeric,numeric)
  from public, anon, authenticated, service_role;
revoke all on function private.build_trip_evaluation_scenario(public.trip_evaluation_scenario,numeric,numeric,public.trip_evaluation_policies,numeric,numeric)
  from public, anon, authenticated, service_role;
revoke all on function private.calculate_trip_evaluation(public.trip_evaluation_policies,jsonb)
  from public, anon, authenticated, service_role;
revoke all on function private.assert_trip_evaluation_policy_available(public.trip_evaluation_policies)
  from public, anon, authenticated, service_role;
revoke all on function public.create_trip_evaluation_policy(text,text,char,public.trip_evaluation_margin_basis,public.trip_evaluation_tax_basis,numeric,numeric,numeric,jsonb,timestamptz,timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function public.save_trip_evaluation(uuid,jsonb,uuid,uuid,uuid,text,integer,uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.fix_trip_evaluation(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.approve_trip_evaluation_exception(uuid,text)
  from public, anon, authenticated, service_role;
