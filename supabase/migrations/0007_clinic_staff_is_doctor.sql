-- Already applied. The assign dropdown must list doctors only, not admins who are not doctors.
drop function if exists public.clinic_staff(uuid);

create function public.clinic_staff(_clinic uuid)
returns table (user_id uuid, full_name text, specialty text, license_number text,
               license_verified boolean, is_admin boolean, is_doctor boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.is_clinic_doctor(_clinic) or public.is_clinic_admin(_clinic)) then
    raise exception 'Not allowed';
  end if;
  return query
    select m.uid, pr.full_name, cd.specialty, cd.license_number,
           coalesce(cd.license_verified, false),
           exists (select 1 from public.clinic_admins ca where ca.clinic_id = _clinic and ca.user_id = m.uid),
           cd.user_id is not null
      from (select d.user_id as uid from public.clinic_doctors d where d.clinic_id = _clinic
            union
            select a.user_id from public.clinic_admins a where a.clinic_id = _clinic) m
      left join public.clinic_doctors cd on cd.clinic_id = _clinic and cd.user_id = m.uid
      left join public.profiles pr on pr.id = m.uid;
end $$;

revoke all on function public.clinic_staff(uuid) from public, anon;
grant execute on function public.clinic_staff(uuid) to authenticated;
