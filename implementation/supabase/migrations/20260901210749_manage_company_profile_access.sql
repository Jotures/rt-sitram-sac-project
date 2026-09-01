-- Access administration is deliberately a reversible, auditable operation.
-- Profiles retain their identity and operational history; only Gerencia may
-- alter access, role or the optional driver association.

create function public.manage_company_profile_access(
  p_profile_id uuid,
  p_action text,
  p_next_role public.app_role default null,
  p_reason text default null
)
returns public.profiles
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  company_id uuid := private.current_company_id();
  actor_id uuid := (select auth.uid());
  old_profile public.profiles;
  new_profile public.profiles;
  linked_driver public.drivers;
  normalized_reason text := nullif(trim(p_reason), '');
begin
  perform private.assert_role(array['management']::public.app_role[]);
  if p_action not in ('suspend', 'reactivate', 'change_role', 'unlink_driver') then
    raise exception using errcode = '22023', message = 'Unsupported profile access action';
  end if;
  if normalized_reason is null then
    raise exception using errcode = '23514', message = 'A reason is required for access administration';
  end if;
  if p_profile_id = actor_id then
    raise exception using errcode = '23514', message = 'You cannot change your own access or role';
  end if;

  select * into old_profile
  from public.profiles p
  where p.id = p_profile_id and p.company_id = company_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Profile not found in your company';
  end if;

  select * into linked_driver
  from public.drivers d
  where d.company_id = company_id and d.profile_id = p_profile_id
  for update;

  if p_action in ('suspend', 'unlink_driver') and linked_driver.id is not null and exists (
    select 1
    from public.trips t
    where t.company_id = company_id
      and t.driver_id = linked_driver.id
      and t.operational_status in ('scheduled', 'loading', 'in_transit', 'unloading')
  ) then
    raise exception using errcode = '23514', message = 'A driver with an active trip cannot lose access or be unlinked';
  end if;

  if old_profile.role = 'management' and (
    p_action = 'suspend'
    or (p_action = 'change_role' and p_next_role is distinct from 'management')
  ) and (select count(*) from public.profiles p where p.company_id = company_id and p.active and p.role = 'management') <= 1 then
    raise exception using errcode = '23514', message = 'Your company must retain at least one active management profile';
  end if;

  if p_action = 'suspend' then
    if not old_profile.active then
      raise exception using errcode = '23514', message = 'Profile access is already suspended';
    end if;
    update public.profiles p set active = false, updated_at = now()
    where p.id = p_profile_id and p.company_id = company_id returning * into new_profile;
    perform private.write_audit(company_id, 'PROFILE_ACCESS_SUSPENDED', 'profile', p_profile_id,
      to_jsonb(old_profile), to_jsonb(new_profile), normalized_reason);
    return new_profile;
  end if;

  if p_action = 'reactivate' then
    if old_profile.active then
      raise exception using errcode = '23514', message = 'Profile access is already active';
    end if;
    update public.profiles p set active = true, updated_at = now()
    where p.id = p_profile_id and p.company_id = company_id returning * into new_profile;
    perform private.write_audit(company_id, 'PROFILE_ACCESS_REACTIVATED', 'profile', p_profile_id,
      to_jsonb(old_profile), to_jsonb(new_profile), normalized_reason);
    return new_profile;
  end if;

  if p_action = 'change_role' then
    if p_next_role is null then
      raise exception using errcode = '23514', message = 'A new role is required';
    end if;
    if p_next_role = old_profile.role then
      raise exception using errcode = '23514', message = 'Choose a different role';
    end if;
    if old_profile.role = 'driver' and p_next_role <> 'driver' and linked_driver.id is not null then
      raise exception using errcode = '23514', message = 'Unlink the driver record before changing this role';
    end if;
    update public.profiles p set role = p_next_role, updated_at = now()
    where p.id = p_profile_id and p.company_id = company_id returning * into new_profile;
    perform private.write_audit(company_id, 'PROFILE_ROLE_CHANGED', 'profile', p_profile_id,
      to_jsonb(old_profile), to_jsonb(new_profile), normalized_reason);
    return new_profile;
  end if;

  if linked_driver.id is null then
    raise exception using errcode = '23514', message = 'This profile is not linked to a driver record';
  end if;
  update public.drivers d set profile_id = null, updated_at = now()
  where d.id = linked_driver.id and d.company_id = company_id;
  perform private.write_audit(company_id, 'DRIVER_PROFILE_UNLINKED', 'driver', linked_driver.id,
    to_jsonb(linked_driver), to_jsonb(linked_driver) || jsonb_build_object('profile_id', null), normalized_reason);
  return old_profile;
end;
$$;

revoke all on function public.manage_company_profile_access(uuid,text,public.app_role,text) from public;
grant execute on function public.manage_company_profile_access(uuid,text,public.app_role,text) to authenticated, service_role;

comment on function public.manage_company_profile_access(uuid,text,public.app_role,text) is
  'Audited management-only profile suspension, reactivation, role change and driver unlinking.';
