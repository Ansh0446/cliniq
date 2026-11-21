-- Phase 2: doctor dashboard and clinic administration. Already applied to the live project.

-- 1. Inbox view. Urgency is derived from the stored value AND the untouched AI output, so a
--    patient lowering their own triage cannot hide a case. Any red flag forces "urgent".
create or replace view public.doctor_inbox with (security_invoker = true) as
select c.id, c.clinic_id, c.status, c.triage_level, c.chief_complaint, c.specialty_hint,
       c.red_flags, c.assigned_doctor_id, c.reviewed_at, c.sent_at, c.structured ->> 'onset' as symptom_onset,
       extract(year from age(p.dob))::int as patient_age, p.sex as patient_sex,
       case u.eff when 'urgent' then 0 when 'soon' then 1 else 2 end as triage_rank,
       p.full_name as patient_name,
       u.eff::public.triage_level as effective_triage,
       u.flagged as has_red_flags
from public.cases c
join public.profiles p on p.id = c.patient_id
cross join lateral (
  select
    (cardinality(c.red_flags) > 0
      or (case when jsonb_typeof(c.ai_extraction -> 'redFlags') = 'array'
               then jsonb_array_length(c.ai_extraction -> 'redFlags') else 0 end) > 0) as flagged,
    case
      when c.triage_level = 'urgent' or (c.ai_extraction -> 'triage' ->> 'level') = 'urgent'
        or cardinality(c.red_flags) > 0
        or (case when jsonb_typeof(c.ai_extraction -> 'redFlags') = 'array'
                 then jsonb_array_length(c.ai_extraction -> 'redFlags') else 0 end) > 0 then 'urgent'
      when c.triage_level = 'soon' or (c.ai_extraction -> 'triage' ->> 'level') = 'soon' then 'soon'
      else 'routine'
    end as eff
) u;

-- 2. Staff directory with names.
create or replace function public.clinic_staff(_clinic uuid)
returns table (user_id uuid, full_name text, specialty text, license_number text,
               license_verified boolean, is_admin boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.is_clinic_doctor(_clinic) or public.is_clinic_admin(_clinic)) then
    raise exception 'Not allowed';
  end if;
  return query
    select m.uid, pr.full_name, cd.specialty, cd.license_number,
           coalesce(cd.license_verified, false),
           exists (select 1 from public.clinic_admins ca where ca.clinic_id = _clinic and ca.user_id = m.uid)
      from (select d.user_id as uid from public.clinic_doctors d where d.clinic_id = _clinic
            union
            select a.user_id from public.clinic_admins a where a.clinic_id = _clinic) m
      left join public.clinic_doctors cd on cd.clinic_id = _clinic and cd.user_id = m.uid
      left join public.profiles pr on pr.id = m.uid;
end $$;

-- 3. Solo practitioners: a clinic admin can also act as a doctor of their own clinic.
create or replace function public.admin_add_self_as_doctor(_clinic uuid, _specialty text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_clinic_admin(_clinic) then raise exception 'Not allowed'; end if;
  insert into public.clinic_doctors (clinic_id, user_id, specialty)
  values (_clinic, auth.uid(), _specialty)
  on conflict (clinic_id, user_id)
  do update set specialty = coalesce(excluded.specialty, public.clinic_doctors.specialty);
  insert into public.user_roles (user_id, role) values (auth.uid(), 'doctor') on conflict do nothing;
end $$;

-- 4. Clinic names are validated at registration.
create or replace function public.register_clinic(_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare _id uuid; _clean text := trim(coalesce(_name, ''));
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if length(_clean) < 2 or length(_clean) > 120 then raise exception 'Clinic name must be 2 to 120 characters'; end if;
  insert into public.clinics (name, created_by) values (_clean, auth.uid()) returning id into _id;
  insert into public.clinic_admins (clinic_id, user_id) values (_id, auth.uid());
  insert into public.user_roles (user_id, role) values (auth.uid(), 'clinic_admin') on conflict do nothing;
  return _id;
end $$;

-- 5. Only a platform operator (SQL editor / service role, where auth.uid() is null) can mark a
--    clinic verified. Clinic admins cannot verify themselves.
create or replace function public.clinics_protect_verified()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then
    if tg_op = 'INSERT' then
      new.verified := false;
    elsif new.verified is distinct from old.verified then
      raise exception 'Only a platform operator can verify a clinic';
    end if;
  end if;
  return new;
end $$;
create trigger clinics_verified_guard before insert or update on public.clinics
  for each row execute function public.clinics_protect_verified();

-- 6. Admins can edit license details but cannot re-point a membership row at another user or clinic.
create or replace function public.clinic_doctors_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.user_id <> old.user_id or new.clinic_id <> old.clinic_id then
    raise exception 'Membership cannot be moved';
  end if;
  return new;
end $$;
create trigger clinic_doctors_guard_update before update on public.clinic_doctors
  for each row execute function public.clinic_doctors_guard();

revoke all on function public.clinics_protect_verified() from public, anon, authenticated;
revoke all on function public.clinic_doctors_guard() from public, anon, authenticated;
revoke all on function public.clinic_staff(uuid) from public, anon;
revoke all on function public.admin_add_self_as_doctor(uuid, text) from public, anon;
grant execute on function public.clinic_staff(uuid) to authenticated;
grant execute on function public.admin_add_self_as_doctor(uuid, text) to authenticated;
