-- Final pass: platform operators, signed AI output, patient account deletion. Already applied.

-- 1. Platform operators. No policies on purpose: the table is invisible to the API.
--    Add an operator from the SQL editor:  insert into public.platform_operators (user_id) values ('<user id>');
create table public.platform_operators (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.platform_operators enable row level security;

create or replace function public.is_platform_operator()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.platform_operators where user_id = auth.uid());
$$;

-- Operators may change `verified`; clinic admins still cannot.
create or replace function public.clinics_protect_verified()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_platform_operator() then
    if tg_op = 'INSERT' then
      new.verified := false;
    elsif new.verified is distinct from old.verified then
      raise exception 'Only a platform operator can verify a clinic';
    end if;
  end if;
  return new;
end $$;

create or replace function public.operator_clinics()
returns table (id uuid, name text, address text, phone text, email text, specialties text[],
               verified boolean, accepting_intakes boolean, created_at timestamptz,
               admin_name text, admin_email text, doctor_count int, case_count int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_platform_operator() then raise exception 'Not allowed'; end if;
  return query
    select c.id, c.name, c.address, c.phone, c.email, c.specialties, c.verified, c.accepting_intakes, c.created_at,
           (select p.full_name from public.clinic_admins a join public.profiles p on p.id = a.user_id
             where a.clinic_id = c.id order by a.user_id limit 1),
           (select u.email::text from public.clinic_admins a join auth.users u on u.id = a.user_id
             where a.clinic_id = c.id order by a.user_id limit 1),
           (select count(*)::int from public.clinic_doctors d where d.clinic_id = c.id),
           (select count(*)::int from public.cases k where k.clinic_id = c.id)
      from public.clinics c
     order by c.verified, c.created_at desc;
end $$;

create or replace function public.operator_set_clinic_verified(_clinic uuid, _verified boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_operator() then raise exception 'Not allowed'; end if;
  update public.clinics set verified = _verified where id = _clinic;
  if not found then raise exception 'Clinic not found'; end if;
end $$;

-- 2. Signature over the AI output, written by the server so a doctor can tell if it was altered.
alter table public.cases add column if not exists ai_signature text;

-- 3. Patients can delete their own account and everything under it.
--    Clinic staff and operators cannot (their records are referenced by clinics and cases).
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Sign in first'; end if;
  if exists (select 1 from public.clinic_doctors where user_id = uid)
     or exists (select 1 from public.clinic_admins where user_id = uid)
     or exists (select 1 from public.platform_operators where user_id = uid)
     or exists (select 1 from public.clinics where created_by = uid)
     or exists (select 1 from public.case_notes where author_id = uid) then
    raise exception 'Clinic staff accounts must be removed by a clinic admin or the platform operator';
  end if;
  delete from auth.users where id = uid;
end $$;

revoke all on function public.is_platform_operator() from public, anon;
revoke all on function public.operator_clinics() from public, anon;
revoke all on function public.operator_set_clinic_verified(uuid, boolean) from public, anon;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.is_platform_operator() to authenticated;
grant execute on function public.operator_clinics() to authenticated;
grant execute on function public.operator_set_clinic_verified(uuid, boolean) to authenticated;
grant execute on function public.delete_my_account() to authenticated;
