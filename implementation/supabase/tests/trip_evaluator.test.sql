begin;
set local search_path = extensions, public, auth;
select plan(40);

select has_table('public', 'trip_evaluation_policies', 'trip evaluation policies table exists');
select has_table('public', 'trip_evaluations', 'trip evaluations table exists');
select has_table('public', 'trip_evaluation_exceptions', 'trip evaluation exceptions table exists');
select ok(
  (
    select bool_and(relrowsecurity and relforcerowsecurity)
    from pg_class
    where oid in (
      'public.trip_evaluation_policies'::regclass,
      'public.trip_evaluations'::regclass,
      'public.trip_evaluation_exceptions'::regclass
    )
  ),
  'evaluator tables enable and force RLS'
);
select ok(
  not has_table_privilege('authenticated', 'public.trip_evaluation_policies', 'INSERT')
  and not has_table_privilege('authenticated', 'public.trip_evaluations', 'INSERT')
  and not has_table_privilege('authenticated', 'public.trip_evaluation_exceptions', 'UPDATE'),
  'authenticated users have no direct evaluator writes'
);
select ok(
  not has_table_privilege('authenticated', 'public.trip_evaluations', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.trip_evaluation_exceptions', 'DELETE'),
  'evaluator snapshots cannot be mutated directly'
);

insert into public.companies (id, legal_name) values
  ('91000000-0000-0000-0000-000000000001', 'EVALUATOR COMPANY A'),
  ('92000000-0000-0000-0000-000000000002', 'EVALUATOR COMPANY B');
insert into auth.users (
  id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role
) values
  ('91100000-0000-0000-0000-000000000001', 'evaluator-management-a@example.test', '', now(), '{}', '{}', 'authenticated', 'authenticated'),
  ('91200000-0000-0000-0000-000000000002', 'evaluator-admin-a@example.test', '', now(), '{}', '{}', 'authenticated', 'authenticated'),
  ('91300000-0000-0000-0000-000000000003', 'evaluator-accounting-a@example.test', '', now(), '{}', '{}', 'authenticated', 'authenticated'),
  ('91400000-0000-0000-0000-000000000004', 'evaluator-driver-a@example.test', '', now(), '{}', '{}', 'authenticated', 'authenticated'),
  ('92100000-0000-0000-0000-000000000001', 'evaluator-management-b@example.test', '', now(), '{}', '{}', 'authenticated', 'authenticated');
insert into public.profiles (id, company_id, display_name, role) values
  ('91100000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000001', 'Evaluator Management A', 'management'),
  ('91200000-0000-0000-0000-000000000002', '91000000-0000-0000-0000-000000000001', 'Evaluator Admin A', 'administration'),
  ('91300000-0000-0000-0000-000000000003', '91000000-0000-0000-0000-000000000001', 'Evaluator Accounting A', 'accounting'),
  ('91400000-0000-0000-0000-000000000004', '91000000-0000-0000-0000-000000000001', 'Evaluator Driver A', 'driver'),
  ('92100000-0000-0000-0000-000000000001', '92000000-0000-0000-0000-000000000002', 'Evaluator Management B', 'management');

set local role authenticated;
select set_config('request.jwt.claim.sub', '91100000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$select public.create_trip_evaluation_policy(
    'STANDARD', 'Política estándar', 'PEN', 'REVENUE', 'INCLUDED', 0.18, 0.10, 0.20,
    '{"included_categories":["fuel","tolls"],"excluded_categories":["driver","administration"]}'::jsonb,
    now(), null
  )$$,
  'management creates a policy with all rates explicitly supplied'
);
select is(
  (select tax_rate from public.trip_evaluation_policies where policy_key = 'STANDARD'),
  0.18::numeric,
  'policy persists configurable tax rate'
);
select is(
  (select count(*)::integer from public.trip_evaluation_policies where active),
  1,
  'one published policy is active for the company'
);

select set_config('request.jwt.claim.sub', '91200000-0000-0000-0000-000000000002', true);
select throws_ok(
  $$select public.create_trip_evaluation_policy(
    'ADMIN', 'No permitido', 'PEN', 'REVENUE', 'INCLUDED', 0.18, 0.10, 0.20,
    '{"included_categories":[],"excluded_categories":["driver"]}'::jsonb, now(), null
  )$$,
  '42501', null,
  'administration cannot publish economic policy'
);

select set_config('request.jwt.claim.sub', '91300000-0000-0000-0000-000000000003', true);
select is(
  (select count(*)::integer from public.trip_evaluation_policies),
  1,
  'accounting can read company evaluator policies'
);
select set_config('request.jwt.claim.sub', '91400000-0000-0000-0000-000000000004', true);
select is(
  (select count(*)::integer from public.trip_evaluation_policies),
  0,
  'driver cannot read evaluator policies'
);
select set_config('request.jwt.claim.sub', '92100000-0000-0000-0000-000000000001', true);
select is(
  (select count(*)::integer from public.trip_evaluation_policies),
  0,
  'another company cannot read evaluator policies'
);

select set_config('request.jwt.claim.sub', '91200000-0000-0000-0000-000000000002', true);
select lives_ok(
  $$select public.save_trip_evaluation(
    (select id from public.trip_evaluation_policies where policy_key = 'STANDARD'),
    $input${
      "origin":" Lima ",
      "destination":" Cusco ",
      "offer_amount":1000,
      "outbound_direct_costs":[{"category":"fuel","amount":400},{"category":"tolls","amount":100}],
      "empty_return_direct_costs":[{"category":"tolls","amount":50}],
      "return":{"status":"PROBABLE","income":300,"direct_costs":[{"category":"fuel","amount":100}],"probability_rate":0.5},
      "estimated_distance_km":500,
      "estimated_days":2,
      "excluded_costs":[],
      "result_snapshot":{"forged":true}
    }$input$::jsonb,
    null, null, null, 'EVAL-OK', null, '91500000-0000-4000-8000-000000000005'
  )$$,
  'administration saves a server-calculated evaluation'
);
select is(
  (select status::text from public.trip_evaluations where reference = 'EVAL-OK'),
  'DRAFT',
  'saved evaluation begins as a draft'
);
select is(
  (select (result_snapshot -> 'scenarios' -> 'conservative' ->> 'direct_cost')::numeric
    from public.trip_evaluations where reference = 'EVAL-OK'),
  550::numeric,
  'server aggregates outbound and empty-return direct costs'
);
select is(
  (select (result_snapshot -> 'scenarios' -> 'probable' ->> 'direct_revenue')::numeric
    from public.trip_evaluations where reference = 'EVAL-OK'),
  1150::numeric,
  'server applies probable return income by declared probability'
);
select is(
  (select input_snapshot ->> 'origin' from public.trip_evaluations where reference = 'EVAL-OK'),
  'Lima',
  'origin is normalized and retained in the input snapshot'
);
select is(
  (select (result_snapshot -> 'scenarios' -> 'conservative' -> 'metrics' ->> 'direct_cost_per_day')::numeric
    from public.trip_evaluations where reference = 'EVAL-OK'),
  275::numeric,
  'server exposes direct cost per estimated day'
);
select is(
  (select input_snapshot -> 'excluded_costs' from public.trip_evaluations where reference = 'EVAL-OK'),
  '["driver", "administration"]'::jsonb,
  'server retains every policy exclusion even when the client submits an empty list'
);
select ok(
  not (select input_snapshot ? 'result_snapshot' from public.trip_evaluations where reference = 'EVAL-OK'),
  'server does not persist a client-supplied result snapshot'
);
select throws_ok(
  $$select public.save_trip_evaluation(
    (select id from public.trip_evaluation_policies where policy_key = 'STANDARD'),
    '{
      "offer_amount":1000,
      "outbound_direct_costs":[{"category":"driver","amount":50}],
      "return":{"status":"NONE"}
    }'::jsonb,
    null, null, null, 'EVAL-EXCLUDED-COST', null, null
  )$$,
  '23514', null,
  'server rejects direct-cost categories excluded by the selected policy'
);
select is(
  (public.save_trip_evaluation(
    (select id from public.trip_evaluation_policies where policy_key = 'STANDARD'),
    $input${
      "origin":" Lima ",
      "destination":" Cusco ",
      "offer_amount":1000,
      "outbound_direct_costs":[{"category":"fuel","amount":400},{"category":"tolls","amount":100}],
      "empty_return_direct_costs":[{"category":"tolls","amount":50}],
      "return":{"status":"PROBABLE","income":300,"direct_costs":[{"category":"fuel","amount":100}],"probability_rate":0.5},
      "estimated_distance_km":500,
      "estimated_days":2,
      "excluded_costs":[],
      "result_snapshot":{"forged":true}
    }$input$::jsonb,
    null, null, null, 'EVAL-OK', null, '91500000-0000-4000-8000-000000000005'
  )).id,
  (select id from public.trip_evaluations where reference = 'EVAL-OK'),
  'exact save replay returns the original evaluation'
);
select is(
  (select count(*)::integer from public.trip_evaluations where reference = 'EVAL-OK'),
  1,
  'exact save replay does not duplicate the evaluation'
);
select lives_ok(
  $$select public.save_trip_evaluation(
    (select id from public.trip_evaluation_policies where policy_key = 'STANDARD'),
    $input${
      "origin":"Lima","destination":"Cusco","offer_amount":900,
      "outbound_direct_costs":[{"category":"fuel","amount":400},{"category":"tolls","amount":100}],
      "empty_return_direct_costs":[{"category":"tolls","amount":50}],
      "return":{"status":"PROBABLE","income":300,"direct_costs":[{"category":"fuel","amount":100}],"probability_rate":0.5},
      "estimated_distance_km":500,"estimated_days":2
    }$input$::jsonb,
    (select id from public.trip_evaluations where reference = 'EVAL-OK'), null, null, 'EVAL-OK', 1, null
  )$$,
  'administration updates a draft with its expected version'
);
select is(
  (select version from public.trip_evaluations where reference = 'EVAL-OK'),
  2,
  'draft update increments its optimistic version'
);

select lives_ok(
  $$select public.save_trip_evaluation(
    (select id from public.trip_evaluation_policies where policy_key = 'STANDARD'),
    $input${
      "origin":"Lima","destination":"Cusco","offer_amount":100,
      "outbound_direct_costs":[{"category":"fuel","amount":400},{"category":"tolls","amount":100}],
      "empty_return_direct_costs":[{"category":"tolls","amount":50}],
      "return":{"status":"NONE"}
    }$input$::jsonb,
    null, null, null, 'EVAL-LOW', null, '91600000-0000-4000-8000-000000000006'
  )$$,
  'administration saves a below-minimum draft'
);
select lives_ok(
  $$select public.fix_trip_evaluation((select id from public.trip_evaluations where reference = 'EVAL-LOW'))$$,
  'administration requests an exception while fixing a below-minimum evaluation'
);
select is(
  (select status::text from public.trip_evaluations where reference = 'EVAL-LOW'),
  'EXCEPTION_REQUIRED',
  'below-minimum evaluation requires an exception'
);
select is(
  (select evaluation_exception.status::text from public.trip_evaluation_exceptions evaluation_exception
    join public.trip_evaluations evaluation on evaluation.id = evaluation_exception.evaluation_id
    where evaluation.reference = 'EVAL-LOW'),
  'PENDING',
  'exception stores the immutable pending decision snapshot'
);
select throws_ok(
  $$select public.approve_trip_evaluation_exception(
    (select evaluation_exception.id from public.trip_evaluation_exceptions evaluation_exception
      join public.trip_evaluations evaluation on evaluation.id = evaluation_exception.evaluation_id
      where evaluation.reference = 'EVAL-LOW'),
    'Administration cannot approve'
  )$$,
  '42501', null,
  'administration cannot approve an exception'
);

select set_config('request.jwt.claim.sub', '91100000-0000-0000-0000-000000000001', true);
select throws_ok(
  $$select public.approve_trip_evaluation_exception(
    (select evaluation_exception.id from public.trip_evaluation_exceptions evaluation_exception
      join public.trip_evaluations evaluation on evaluation.id = evaluation_exception.evaluation_id
      where evaluation.reference = 'EVAL-LOW'),
    ' '
  )$$,
  '23514', null,
  'management must provide an exception approval reason'
);
select lives_ok(
  $$select public.approve_trip_evaluation_exception(
    (select evaluation_exception.id from public.trip_evaluation_exceptions evaluation_exception
      join public.trip_evaluations evaluation on evaluation.id = evaluation_exception.evaluation_id
      where evaluation.reference = 'EVAL-LOW'),
    'Cliente estratégico con revisión gerencial'
  )$$,
  'management approves the exception with an audited reason'
);
select is(
  (select status::text from public.trip_evaluations where reference = 'EVAL-LOW'),
  'FIXED',
  'approved exception fixes the evaluation without altering its snapshot'
);
select is(
  (select evaluation_exception.status::text from public.trip_evaluation_exceptions evaluation_exception
    join public.trip_evaluations evaluation on evaluation.id = evaluation_exception.evaluation_id
    where evaluation.reference = 'EVAL-LOW'),
  'APPROVED',
  'exception retains the management approval state'
);
select throws_ok(
  $$update public.trip_evaluations set input_snapshot = '{}'::jsonb where reference = 'EVAL-LOW'$$,
  '42501', null,
  'authenticated management cannot overwrite a fixed input snapshot directly'
);
select lives_ok(
  $$select public.create_trip_evaluation_policy(
    'STANDARD-NEW', 'Política reemplazo', 'PEN', 'COST', 'EXCLUDED', 0.18, 0.12, 0.25,
    '{"included_categories":["fuel","tolls"],"excluded_categories":["driver","administration"]}'::jsonb,
    now(), null
  )$$,
  'new management policy supersedes the company active policy'
);
select is(
  (select count(*)::integer from public.trip_evaluation_policies where active),
  1,
  'publishing a replacement leaves exactly one company policy active'
);
select throws_ok(
  $$select public.save_trip_evaluation(
    (select id from public.trip_evaluation_policies where policy_key = 'STANDARD'),
    '{"offer_amount":100,"outbound_direct_costs":[],"return":{"status":"NONE"}}'::jsonb,
    null, null, null, 'STALE-POLICY', null, null
  )$$,
  '23514', null,
  'inactive policy cannot be used to save a new evaluation'
);
select ok(
  exists (
    select 1 from public.audit_events
    where company_id = '91000000-0000-0000-0000-000000000001'
      and action = 'TRIP_EVALUATION_EXCEPTION_APPROVED'
      and actor_id = '91100000-0000-0000-0000-000000000001'
      and reason = 'Cliente estratégico con revisión gerencial'
  ),
  'exception approval is attributed and audited'
);

select * from finish(true);
rollback;
