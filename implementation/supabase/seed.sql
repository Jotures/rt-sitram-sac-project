-- Reproducible non-secret development seed. Auth users are provisioned separately.

with company as (
  select id from public.companies where legal_name = 'R&T SITRAM SAC'
)
insert into public.expense_categories (company_id, code, name)
select company.id, seed.code, seed.name
from company
cross join (values
  ('TOLL','Peaje'),
  ('MEALS','Alimentación'),
  ('PARKING','Garaje'),
  ('LODGING','Hospedaje'),
  ('REPAIR','Reparación'),
  ('PARTS','Repuesto'),
  ('TIRE_SERVICE','Llantería'),
  ('LOAD_UNLOAD','Carga y descarga'),
  ('OTHER','Otro')
) as seed(code,name)
on conflict (company_id,code) do update set name = excluded.name, active = true;
