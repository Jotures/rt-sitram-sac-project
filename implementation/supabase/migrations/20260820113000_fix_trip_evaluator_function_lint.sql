-- Keep the evaluator helpers warning-free in hosted PostgreSQL linting.

create or replace function private.validate_trip_evaluation_cost_coverage(p_cost_coverage jsonb)
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

alter function private.build_trip_evaluation_scenario(
  public.trip_evaluation_scenario,
  numeric,
  numeric,
  public.trip_evaluation_policies,
  numeric,
  numeric
) stable;
