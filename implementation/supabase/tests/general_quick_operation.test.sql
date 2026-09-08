begin;
set local search_path=extensions,public,auth;
select no_plan();

insert into public.companies(id,legal_name) values ('e7000000-0000-4000-8000-000000000001','QA QUICK ROLLBACK'),('e7000000-0000-4000-8000-000000000002','QA OTHER ROLLBACK');
insert into auth.users(id,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,aud,role)
values ('e7100000-0000-4000-8000-000000000001','qa-quick-rollback@example.test','',now(),'{}','{}','authenticated','authenticated'),
('e7100000-0000-4000-8000-000000000002','qa-other-rollback@example.test','',now(),'{}','{}','authenticated','authenticated');
insert into public.profiles(id,company_id,display_name,role) values
('e7100000-0000-4000-8000-000000000001','e7000000-0000-4000-8000-000000000001','QA manager','management'),
('e7100000-0000-4000-8000-000000000002','e7000000-0000-4000-8000-000000000002','Other QA manager','management');
insert into public.vehicles(id,company_id,plate) values('e7200000-0000-4000-8000-000000000001','e7000000-0000-4000-8000-000000000001','QAQ-001');
insert into public.drivers(id,company_id,display_name) values('e7300000-0000-4000-8000-000000000001','e7000000-0000-4000-8000-000000000001','QA driver');
insert into public.clients(id,company_id,legal_name) values('e7400000-0000-4000-8000-000000000001','e7000000-0000-4000-8000-000000000001','QA customer');
insert into public.expense_categories(id,company_id,code,name) values('e7500000-0000-4000-8000-000000000001','e7000000-0000-4000-8000-000000000001','OTHER','Otros gastos');

select ok(not has_table_privilege('authenticated','public.operation_commands','INSERT'),'commands cannot bypass the authoritative RPC');
select ok(not has_function_privilege('anon','public.apply_operation_command(uuid,text,text,integer,uuid,text)','EXECUTE'),'anonymous commands denied');
set local role authenticated;
select set_config('request.jwt.claim.sub','e7100000-0000-4000-8000-000000000001',true);
select lives_ok($q$ select public.apply_operation_command('e7600000-0000-4000-8000-000000000001','departure',
'{"vehicle_id":"e7200000-0000-4000-8000-000000000001","driver_id":"e7300000-0000-4000-8000-000000000001","status":"active","occurred_at":"2026-09-01T12:00:00Z","notes":"QA Cusco-Cusco","advance":{"id":"e7700000-0000-4000-8000-000000000001","amount":800,"method":"cash"},"service":null,"fuel":null}',1,null,'qa-device') $q$,
'departure and initial fund commit together without a customer or service');
select is((select count(*) from public.trips where company_id='e7000000-0000-4000-8000-000000000001'),0::bigint,'no fictitious service');
select is((select count(*) from public.advances where cycle_id='e7600000-0000-4000-8000-000000000001'),1::bigint,'initial fund linked to outing');
select lives_ok($q$ select public.apply_operation_command('e7600000-0000-4000-8000-000000000001','departure',
'{"vehicle_id":"e7200000-0000-4000-8000-000000000001","driver_id":"e7300000-0000-4000-8000-000000000001","status":"active","occurred_at":"2026-09-01T12:00:00Z","notes":"QA Cusco-Cusco","advance":{"id":"e7700000-0000-4000-8000-000000000001","amount":800,"method":"cash"},"service":null,"fuel":null}',1,null,'qa-device') $q$,'retry of complete bundle is idempotent');
select throws_ok($q$ select public.apply_operation_command('e7600000-0000-4000-8000-000000000001','departure',
'{"vehicle_id":"e7200000-0000-4000-8000-000000000001","driver_id":"e7300000-0000-4000-8000-000000000001","status":"active","occurred_at":"2026-09-01T12:00:00Z","notes":"changed"}',1,null,'qa-device') $q$,'23505',null,'same command with different content rejected');
select throws_ok($q$ select public.apply_operation_command('e7600000-0000-4000-8000-000000000002','departure',
'{"vehicle_id":"e7200000-0000-4000-8000-000000000001","driver_id":"e7300000-0000-4000-8000-000000000001","status":"active","occurred_at":"2026-09-01T12:00:00Z"}',1,null,'qa-device') $q$,'23505',null,'another outing cannot reserve the same resources');
select lives_ok($q$ select public.apply_operation_command('e7800000-0000-4000-8000-000000000001','service',
'{"cycle_id":"e7600000-0000-4000-8000-000000000001","client_id":"e7400000-0000-4000-8000-000000000001","origin":"Cusco","destination":"Lima","cargo_description":"QA load","leg_kind":"outbound","occurred_at":"2026-09-02T12:00:00Z","cargo_tons":null,"freight_amount":null}',1,'e7600000-0000-4000-8000-000000000001','qa-device') $q$,'later service directly approved and assigned within the same outing');
select lives_ok($q$ select public.apply_operation_command('e7800000-0000-4000-8000-000000000002','service',
'{"cycle_id":"e7600000-0000-4000-8000-000000000001","client_id":"e7400000-0000-4000-8000-000000000001","origin":"Lima","destination":"Cusco","cargo_description":"QA return","leg_kind":"return","occurred_at":"2026-09-03T12:00:00Z","cargo_tons":null,"freight_amount":null}',1,'e7600000-0000-4000-8000-000000000001','qa-device') $q$,'second commercial service does not compete for its outing resources');
select is((select count(*) from public.odometer_entries where company_id='e7000000-0000-4000-8000-000000000001'),0::bigint,'no odometer reading fabricated');
select lives_ok($q$ select public.apply_operation_command('e7700000-0000-4000-8000-000000000002','advance',
'{"cycle_id":"e7600000-0000-4000-8000-000000000001","occurred_at":"2026-09-03T12:00:00Z","amount":200,"method":"transfer","description":null}',1,'e7600000-0000-4000-8000-000000000001','qa-device') $q$,'additional deposit goes to the same account');
select is((select sum(amount) from public.advances where cycle_id='e7600000-0000-4000-8000-000000000001'),1000::numeric,'fund is initial plus deposits');
select throws_ok($q$ select public.apply_operation_command('e7900000-0000-4000-8000-000000000001','expense',
'{"cycle_id":"e7600000-0000-4000-8000-000000000001","occurred_at":"2026-09-03T12:00:00Z","amount":20,"category_id":"e7500000-0000-4000-8000-000000000001","description":null}',1,'e7600000-0000-4000-8000-000000000001','qa-device') $q$,'23514',null,'other expenses require description');
select lives_ok($q$ select public.apply_operation_command('e7a00000-0000-4000-8000-000000000001','return',
'{"cycle_id":"e7600000-0000-4000-8000-000000000001","occurred_at":"2026-09-05T12:00:00Z"}',1,'e7600000-0000-4000-8000-000000000001','qa-device') $q$,'return is an explicit separate event');
select is((select status::text from public.operational_cycles where id='e7600000-0000-4000-8000-000000000001'),'active','unresolved services prevent operation finalization');
select is((select count(*) from public.settlements where company_id='e7000000-0000-4000-8000-000000000001' and status='closed'),0::bigint,'return never closes a financial account');
select set_config('request.jwt.claim.sub','e7100000-0000-4000-8000-000000000002',true);
select is((select count(*) from public.operation_commands where company_id='e7000000-0000-4000-8000-000000000001'),0::bigint,'other company cannot read commands');
select throws_ok($q$ select public.apply_operation_command('e7b00000-0000-4000-8000-000000000001','advance',
'{"cycle_id":"e7600000-0000-4000-8000-000000000001","occurred_at":"2026-09-03T12:00:00Z","amount":20,"method":"cash"}',1,'e7600000-0000-4000-8000-000000000001','other-device') $q$,'P0001',null,'other company cannot move money in an outing');
select set_config('request.jwt.claim.sub','e7100000-0000-4000-8000-000000000001',true);
select lives_ok($q$ select public.apply_operation_command('e7900000-0000-4000-8000-000000000001','expense',
'{"cycle_id":"e7600000-0000-4000-8000-000000000001","occurred_at":"2026-09-03T12:00:00Z","amount":100,"category_id":"e7500000-0000-4000-8000-000000000001","description":"Peajes de prueba"}',1,'e7600000-0000-4000-8000-000000000001','qa-device') $q$,'expense retained for joint rendition');
select lives_ok($q$ select public.record_cycle_fuel_entry('e7c00000-0000-4000-8000-000000000001','e7600000-0000-4000-8000-000000000001','e7300000-0000-4000-8000-000000000001','2026-09-03',null,null,10,'gallon',10,100,'PEN','company','cash',null,null,null,null,'e7c00000-0000-4000-8000-000000000001') $q$,'company fuel accepts no odometer');
select lives_ok($q$ select public.record_cycle_fuel_entry('e7c00000-0000-4000-8000-000000000002','e7600000-0000-4000-8000-000000000001','e7300000-0000-4000-8000-000000000001','2026-09-03',null,null,10,'gallon',10,100,'PEN','driver_fund','cash',null,null,null,null,'e7c00000-0000-4000-8000-000000000002') $q$,'driver fuel accepts no odometer');
select lives_ok($q$ select public.review_expense('e7900000-0000-4000-8000-000000000001','validated',100,null) $q$,'expense can be recognized');
select lives_ok($q$ select public.review_cycle_fuel(f.id,'validated',100,f.updated_at,null) from public.fuel_entries f where f.cycle_id='e7600000-0000-4000-8000-000000000001' $q$,'both fuel sources can be reviewed');
select lives_ok($q$ select public.create_cycle_settlement('e7d00000-0000-4000-8000-000000000001','e7600000-0000-4000-8000-000000000001','e7300000-0000-4000-8000-000000000001',null) $q$,'joint rendition is created');
select is((public.get_cycle_rendition('e7600000-0000-4000-8000-000000000001')->>'balance')::numeric,800::numeric,'company fuel never reduces driver balance');
select throws_ok($q$ select public.save_cycle_rendition('e7d00000-0000-4000-8000-000000000001','[]',public.get_cycle_rendition('e7600000-0000-4000-8000-000000000001')->>'baseline','submitted',0,null) $q$,'23514',null,'summary submission requires synchronized evidence');
reset role;
insert into public.files(id,company_id,original_name,mime_type,size_bytes,storage_path,uploaded_by)
 values('e7e00000-0000-4000-8000-000000000001','e7000000-0000-4000-8000-000000000001','qa-sheet.pdf','application/pdf',100,'companies/e7000000-0000-4000-8000-000000000001/qa-rollback-only/sheet.pdf','e7100000-0000-4000-8000-000000000001');
set local role authenticated;
select lives_ok($q$ select public.attach_settlement_file('settlement','e7d00000-0000-4000-8000-000000000001','e7e00000-0000-4000-8000-000000000001') $q$,'private sheet can be linked');
select lives_ok($q$ select public.save_cycle_rendition('e7d00000-0000-4000-8000-000000000001',
'[{"category_id":"e7500000-0000-4000-8000-000000000001","declared":150,"recognized":150,"description":"50 adicionales de cochera"}]',public.get_cycle_rendition('e7600000-0000-4000-8000-000000000001')->>'baseline','approved',0,null) $q$,'sheet explicitly reconciles existing expense and additional amount');
select is((public.get_cycle_rendition('e7600000-0000-4000-8000-000000000001')->>'balance')::numeric,750::numeric,'only the additional 50 is added, never the whole sheet twice');
select lives_ok($q$ select public.apply_operation_command(gen_random_uuid(),'service_complete',jsonb_build_object('cycle_id',t.cycle_id,'trip_id',t.id,'occurred_at','2026-09-04T12:00:00Z','cargo_delivered',true)::text,1,t.cycle_id,'qa-device') from public.trips t where t.cycle_id='e7600000-0000-4000-8000-000000000001' $q$,'services delivered independently after recording the actual return');
select is((select status::text from public.operational_cycles where id='e7600000-0000-4000-8000-000000000001'),'completed','resolved services finalize returned operation');
select lives_ok($q$ select public.apply_operation_command('e7600000-0000-4000-8000-000000000002','departure',
'{"vehicle_id":"e7200000-0000-4000-8000-000000000001","driver_id":"e7300000-0000-4000-8000-000000000001","status":"active","occurred_at":"2026-09-06T12:00:00Z"}',1,null,'qa-device') $q$,'a pending financial account does not block the next outing');
select throws_ok($q$ select public.close_cycle_settlement('e7d00000-0000-4000-8000-000000000001','cash','pretend paid',null) $q$,'23514',null,'reference alone does not settle money');
select lives_ok($q$ select public.record_cycle_balance_payment('e7f00000-0000-4000-8000-000000000001','e7d00000-0000-4000-8000-000000000001','DRIVER_RETURNS',300,'cash',null,'2026-09-06',750) $q$,'partial return is recorded');
select is((public.get_cycle_rendition('e7600000-0000-4000-8000-000000000001')->>'remaining')::numeric,450::numeric,'partial payment leaves its own outstanding balance');
select lives_ok($q$ select public.record_cycle_balance_payment('e7f00000-0000-4000-8000-000000000001','e7d00000-0000-4000-8000-000000000001','DRIVER_RETURNS',300,'cash',null,'2026-09-06',750) $q$,'same payment retry is idempotent');
select throws_ok($q$ select public.record_cycle_balance_payment('e7f00000-0000-4000-8000-000000000001','e7d00000-0000-4000-8000-000000000001','DRIVER_RETURNS',350,'cash',null,'2026-09-06',750) $q$,'23505',null,'payment retry with different amount is rejected');
select lives_ok($q$ select public.record_cycle_balance_payment('e7f00000-0000-4000-8000-000000000002','e7d00000-0000-4000-8000-000000000001','DRIVER_RETURNS',450,'cash',null,'2026-09-06',450) $q$,'remaining amount can be paid separately');
select lives_ok($q$ select public.close_cycle_settlement('e7d00000-0000-4000-8000-000000000001',null,null,null) $q$,'financial closure recalculates the actual zero remainder');
select throws_ok($q$ select public.review_expense('e7900000-0000-4000-8000-000000000001','validated',90,'correction') $q$,'23514',null,'closed cycle expense cannot change silently');
select lives_ok($q$ select public.reopen_cycle_settlement('e7d00000-0000-4000-8000-000000000001','QA correction after closure') $q$,'audit reopen retains payment history');
select is((public.get_cycle_rendition('e7600000-0000-4000-8000-000000000001')->>'remaining')::numeric,0::numeric,'reopening does not erase real repayments');
select lives_ok($q$ select public.correct_cycle_money('e7f10000-0000-4000-8000-000000000001','advance','e7700000-0000-4000-8000-000000000001',1,200,false,'Initial amount entered incorrectly; QA correction') $q$,'advance correction is audited without discarding prior repayments');
select is((public.get_cycle_rendition('e7600000-0000-4000-8000-000000000001')->>'remaining')::numeric,(-600)::numeric,'corrected account can require a company reimbursement');
select lives_ok($q$ select public.record_cycle_balance_payment('e7f10000-0000-4000-8000-000000000002','e7d00000-0000-4000-8000-000000000001','COMPANY_REIMBURSES',600,'transfer','QA real refund','2026-09-06',-600) $q$,'company reimbursement resolves only this account');
select lives_ok($q$ select public.close_cycle_settlement('e7d00000-0000-4000-8000-000000000001',null,null,null) $q$,'reopened corrected account closes at authoritative zero');
select throws_ok($q$ select public.correct_cycle_money('e7f10000-0000-4000-8000-000000000003','advance','e7700000-0000-4000-8000-000000000001',2,100,false,null) $q$,'23514',null,'corrections require reasons');
select ok(not has_table_privilege('authenticated','public.cycle_balance_payments','INSERT'),'payments cannot bypass audited command');
select lives_ok($q$ select public.reopen_cycle_settlement('e7d00000-0000-4000-8000-000000000001','QA null version protection') $q$,'reopen for concurrency validation');
select throws_ok($q$ select public.save_cycle_rendition('e7d00000-0000-4000-8000-000000000001','[]',public.get_cycle_rendition('e7600000-0000-4000-8000-000000000001')->>'baseline','draft',null,'QA') $q$,'40001',null,'null summary version cannot bypass concurrent edits');
select lives_ok($q$ select public.manage_expense_category('e7500000-0000-4000-8000-000000000002','Viáticos QA',true,null,null) $q$,'administration can add a category without a fictitious reason');
select throws_ok($q$ select public.manage_expense_category('e7500000-0000-4000-8000-000000000002','Changed',false,(select updated_at from expense_categories where id='e7500000-0000-4000-8000-000000000002'),null) $q$,'23514',null,'category changes require an audit reason');
reset role;
insert into public.invoices(id,company_id,trip_id,client_id,series,number,issued_on,currency,subtotal,tax,total,status,created_by)
values('e7f20000-0000-4000-8000-000000000001','e7000000-0000-4000-8000-000000000001',(select result_id from operation_commands where id='e7800000-0000-4000-8000-000000000001'),'e7400000-0000-4000-8000-000000000001','QA','CORRECTION','2026-09-04','PEN',1000,0,1000,'issued','e7100000-0000-4000-8000-000000000001');
set local role authenticated;
select lives_ok($q$ select public.record_commercial_payment('e7f30000-0000-4000-8000-000000000001','e7f20000-0000-4000-8000-000000000001','2026-09-04',400,'cash',null,'e7f30000-0000-4000-8000-000000000001') $q$,'partial client payment recorded');
select throws_ok($q$ select public.record_commercial_payment('e7f30000-0000-4000-8000-000000000001','e7f20000-0000-4000-8000-000000000001','2026-09-04',450,'cash',null,'e7f30000-0000-4000-8000-000000000001') $q$,'23505',null,'different retry cannot silently reuse a client payment');
select is((public.get_invoice_accounts()->0->>'remaining')::numeric,600::numeric,'collection subtracts partial client payments');
select throws_ok($q$ select public.correct_commercial_record(gen_random_uuid(),'invoice','e7f20000-0000-4000-8000-000000000001',(select version from invoices where id='e7f20000-0000-4000-8000-000000000001'),'{"cancel":true}','QA mistaken invoice') $q$,'23514',null,'an invoice with actual payments cannot disappear');
select lives_ok($q$ select public.correct_commercial_record('e7f40000-0000-4000-8000-000000000001','payment','e7f30000-0000-4000-8000-000000000001',1,'{"amount":300}','QA amount transcription') $q$,'audited payment correction retains original record');
select is((public.get_invoice_accounts()->0->>'remaining')::numeric,700::numeric,'corrected payment recalculates debt');
select lives_ok($q$ select public.correct_commercial_record('e7f40000-0000-4000-8000-000000000001','payment','e7f30000-0000-4000-8000-000000000001',1,'{"amount":300}','QA amount transcription') $q$,'commercial correction retry is idempotent');
select lives_ok($q$ select public.correct_commercial_record('e7f40000-0000-4000-8000-000000000002','payment','e7f30000-0000-4000-8000-000000000001',2,'{"cancel":true}','QA payment belonged to another record') $q$,'mistaken payment cancelled with history retained');
select is((public.get_invoice_accounts()->0->>'remaining')::numeric,1000::numeric,'cancelled payment restores debt');
select lives_ok($q$ select public.correct_commercial_record(gen_random_uuid(),'invoice','e7f20000-0000-4000-8000-000000000001',(select version from invoices where id='e7f20000-0000-4000-8000-000000000001'),'{"cancel":true}','QA duplicate document') $q$,'invoice with resolved erroneous payments can be cancelled');
select is((select financial_status::text from trips where id=(select result_id from operation_commands where id='e7800000-0000-4000-8000-000000000001')),'unbilled','cancelled invoice keeps service obligation to invoice');
select ok(not has_function_privilege('anon','public.correct_commercial_record(uuid,text,uuid,integer,jsonb,text)','EXECUTE'),'anonymous correction prohibited');
select lives_ok($q$ select public.record_cycle_fuel_entry('e7c00000-0000-4000-8000-000000000003','e7600000-0000-4000-8000-000000000002','e7300000-0000-4000-8000-000000000001','2026-09-06',null,100,10,'gallon',10,100,'PEN','company','cash',null,null,null,null,'e7c00000-0000-4000-8000-000000000003') $q$,'a supplied manual reading is retained');
select is((select count(*) from odometer_entries where company_id='e7000000-0000-4000-8000-000000000001' and reading_km=100),1::bigint,'exactly one actual odometer entry exists');
select throws_ok($q$ select public.change_cycle_capture_channel('e7600000-0000-4000-8000-000000000002','office','new-device','QA handoff') $q$,'23514',null,'channel change requires origin acknowledgment');
select throws_ok($q$ select public.acknowledge_cycle_device('e7600000-0000-4000-8000-000000000002','wrong-device',true) $q$,'42501',null,'another device cannot acknowledge the capture origin');
select lives_ok($q$ select public.acknowledge_cycle_device('e7600000-0000-4000-8000-000000000002','qa-device',true) $q$,'origin acknowledges its empty queue');
reset role;
insert into auth.users(id,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,aud,role) values('e7100000-0000-4000-8000-000000000003','qa-driver-rollback@example.test','',now(),'{}','{}','authenticated','authenticated');
insert into profiles(id,company_id,display_name,role) values('e7100000-0000-4000-8000-000000000003','e7000000-0000-4000-8000-000000000001','QA driver account','driver');
update drivers set profile_id='e7100000-0000-4000-8000-000000000003' where id='e7300000-0000-4000-8000-000000000001';
set local role authenticated;
select lives_ok($q$ select public.change_cycle_capture_channel('e7600000-0000-4000-8000-000000000002','driver_app','qa-device','QA acknowledged change') $q$,'capture transferred only after acknowledgment');
select throws_ok($q$ select public.record_cycle_expense(gen_random_uuid(),'e7600000-0000-4000-8000-000000000002','e7300000-0000-4000-8000-000000000001','e7500000-0000-4000-8000-000000000001','2026-09-06',10,'PEN',null,null,null,'QA',gen_random_uuid()) $q$,'42501',null,'legacy office capture cannot bypass driver channel');
select set_config('request.jwt.claim.sub','e7100000-0000-4000-8000-000000000003',true);
select lives_ok($q$ select public.apply_operation_command(gen_random_uuid(),'expense','{"cycle_id":"e7600000-0000-4000-8000-000000000002","category_id":"e7500000-0000-4000-8000-000000000001","amount":10,"occurred_at":"2026-09-06T12:00:00Z","description":"QA road expense"}',1,'e7600000-0000-4000-8000-000000000002','driver-phone') $q$,'driver captures expenses without a commercial service');
select is((select count(*) from trips where cycle_id='e7600000-0000-4000-8000-000000000002'),0::bigint,'driver outing does not need a fictitious service');
select throws_ok($q$ select public.apply_operation_command(gen_random_uuid(),'expense','{"cycle_id":"e7600000-0000-4000-8000-000000000002","category_id":"e7500000-0000-4000-8000-000000000001","amount":10,"occurred_at":"2026-09-06T12:00:00Z","description":"QA second device"}',1,'e7600000-0000-4000-8000-000000000002','another-phone') $q$,'42501',null,'second field device cannot silently capture');
reset role;update profiles set active=false where id='e7100000-0000-4000-8000-000000000003';set local role authenticated;
select throws_ok($q$ select public.apply_operation_command(gen_random_uuid(),'expense','{"cycle_id":"e7600000-0000-4000-8000-000000000002","category_id":"e7500000-0000-4000-8000-000000000001","amount":10,"occurred_at":"2026-09-06T12:00:00Z","description":"QA revoked"}',1,'e7600000-0000-4000-8000-000000000002','driver-phone') $q$,'42501',null,'revoked permissions are revalidated during upload');
select set_config('request.jwt.claim.sub','e7100000-0000-4000-8000-000000000002',true);
select is((select count(*) from public.cycle_balance_payments),0::bigint,'cross-company payment history is isolated');
select * from finish();
rollback;
