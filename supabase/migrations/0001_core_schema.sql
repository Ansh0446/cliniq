-- ClinIQ core schema: roles, clinics, cases, notes, audit, RLS.
-- Run with the Supabase CLI (`supabase db push`) or paste into the SQL editor.

-- ─────────────────────────── Enums ───────────────────────────
create type public.app_role as enum ('patient', 'doctor', 'clinic_admin');
create type public.triage_level as enum ('urgent', 'soon', 'routine');
create type public.case_status as enum (
  'draft', 'confirmed', 'sent', 'under_review', 'info_requested', 'consultation_ready'
);
create type public.note_kind as enum ('note', 'impression', 'checklist', 'soap_draft');

-- ─────────────────────────── Utilities ───────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ─────────────────────────── Tables ───────────────────────────
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  dob date,
  sex text check (sex in ('female', 'male', 'other', 'unspecified')),
  blood_group text check (blood_group in ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
  emergency_contact_name text,
  emergency_contact_phone text,
  chronic_conditions text[] not null default '{}',
  medications text[] not null default '{}',
  allergies text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table public.specialties (
  slug text primary key,
  label text not null
);

create table public.clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  specialties text[] not null default '{}',          -- slugs from public.specialties
  address text,
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  phone text,
  email text,
  operating_hours jsonb not null default '{}'::jsonb,
  accepting_intakes boolean not null default true,
  require_triage_signoff boolean not null default false,
  verified boolean not null default false,            -- only verified clinics appear in patient search
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.clinic_admins (
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (clinic_id, user_id)
);

create table public.clinic_doctors (
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  specialty text references public.specialties(slug),
  license_number text,
  license_verified boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (clinic_id, user_id)
);

create table public.clinic_invites (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  email text not null,
  specialty text references public.specialties(slug),
  token uuid not null default gen_random_uuid() unique,
  invited_by uuid references auth.users(id),
  accepted_at timestamptz,
  expires_at timestamptz not null default now() + interval '14 days',
  created_at timestamptz not null default now()
);

create table public.cases (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references auth.users(id) on delete cascade,
  clinic_id uuid references public.clinics(id),
  assigned_doctor_id uuid references auth.users(id),
  status public.case_status not null default 'draft',
  triage_level public.triage_level,
  chief_complaint text,                               -- denormalised for inbox lists
  specialty_hint text,
  raw_transcript text not null default '',
  transcript_source text not null default 'text' check (transcript_source in ('text', 'voice')),
  audio_path text,                                    -- storage path in bucket case-audio
  ai_extraction jsonb,                                -- untouched model output
  structured jsonb,                                   -- patient-confirmed version
  red_flags text[] not null default '{}',
  emergency_acknowledged_at timestamptz,
  confirmed_at timestamptz,
  sent_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index cases_patient_idx on public.cases (patient_id, created_at desc);
create index cases_clinic_idx on public.cases (clinic_id, status, triage_level);
create index cases_assigned_idx on public.cases (assigned_doctor_id);

create table public.case_notes (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  author_id uuid not null references auth.users(id),
  kind public.note_kind not null default 'note',
  body text not null default '',
  checklist jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index case_notes_case_idx on public.case_notes (case_id, created_at);

create table public.audit_log (
  id bigint generated always as identity primary key,
  case_id uuid references public.cases(id) on delete cascade,
  actor_id uuid,
  action text not null,                               -- case_created | status_change | clinic_transfer | assignment | case_viewed | ...
  from_value text,
  to_value text,
  created_at timestamptz not null default now()
);
create index audit_case_idx on public.audit_log (case_id, created_at);

create trigger profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger clinics_updated before update on public.clinics
  for each row execute function public.set_updated_at();
create trigger cases_updated before update on public.cases
  for each row execute function public.set_updated_at();
create trigger case_notes_updated before update on public.case_notes
  for each row execute function public.set_updated_at();

-- ─────────────────────────── Access helpers ───────────────────────────
-- SECURITY DEFINER so policies can consult membership tables without recursion.
create or replace function public.has_role(_role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid() and role = _role);
$$;

create or replace function public.is_clinic_admin(_clinic uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.clinic_admins where clinic_id = _clinic and user_id = auth.uid());
$$;

create or replace function public.is_clinic_doctor(_clinic uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.clinic_doctors where clinic_id = _clinic and user_id = auth.uid());
$$;

-- Clinic staff may only see a case once the patient has sent it.
create or replace function public.staff_can_view_case(_case public.cases)
returns boolean language sql stable security definer set search_path = public as $$
  select _case.clinic_id is not null
     and _case.status in ('sent', 'under_review', 'info_requested', 'consultation_ready')
     and (public.is_clinic_doctor(_case.clinic_id) or public.is_clinic_admin(_case.clinic_id));
$$;

create or replace function public.doctor_can_view_case(_case_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.cases c
    where c.id = _case_id
      and c.clinic_id is not null
      and c.status in ('sent', 'under_review', 'info_requested', 'consultation_ready')
      and public.is_clinic_doctor(c.clinic_id)
  );
$$;

create or replace function public.staff_can_view_patient(_patient uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.cases c
    where c.patient_id = _patient
      and c.clinic_id is not null
      and c.status in ('sent', 'under_review', 'info_requested', 'consultation_ready')
      and public.is_clinic_doctor(c.clinic_id)
  );
$$;

-- ─────────────────────────── Sign-up bootstrap ───────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'));
  insert into public.user_roles (user_id, role) values (new.id, 'patient');
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────── Case guard + audit ───────────────────────────
-- Enforces the status machine and writes the audit trail.
create or replace function public.cases_guard_and_audit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  actor uuid := auth.uid();
  is_patient_actor boolean;
  allowed boolean := false;
begin
  if tg_op = 'INSERT' then
    if new.status <> 'draft' then
      raise exception 'New cases must start as draft';
    end if;
    return new;   -- 'case_created' is audited by cases_audit_insert (AFTER INSERT)
  end if;

  is_patient_actor := actor is not null and actor = old.patient_id;

  if new.patient_id <> old.patient_id then
    raise exception 'patient_id is immutable';
  end if;

  -- Status transitions
  if new.status is distinct from old.status then
    if actor is null then
      allowed := true;                                   -- service role / maintenance jobs
    elsif is_patient_actor then
      allowed := (old.status, new.status) in (
        ('draft', 'confirmed'), ('confirmed', 'draft'),
        ('confirmed', 'sent'), ('info_requested', 'sent')
      );
    else
      allowed := (old.status, new.status) in (
        ('sent', 'under_review'), ('under_review', 'info_requested'),
        ('under_review', 'consultation_ready'), ('sent', 'info_requested'),
        ('info_requested', 'under_review')
      );
    end if;
    if not allowed then
      raise exception 'Status change % -> % is not allowed for this user', old.status, new.status;
    end if;

    if new.status = 'confirmed' then
      if new.structured is null or new.triage_level is null then
        raise exception 'A case needs structured data and a triage level before confirmation';
      end if;
      if cardinality(new.red_flags) > 0 and new.emergency_acknowledged_at is null then
        raise exception 'Emergency warning must be acknowledged before confirmation';
      end if;
      new.confirmed_at := coalesce(new.confirmed_at, now());
    end if;
    if new.status = 'sent' then
      if new.clinic_id is null then
        raise exception 'Choose a clinic before sending';
      end if;
      new.sent_at := now();
    end if;

    insert into public.audit_log (case_id, actor_id, action, from_value, to_value)
    values (new.id, actor, 'status_change', old.status::text, new.status::text);
  end if;

  -- Patients cannot edit clinical content once the case has left their hands.
  if is_patient_actor and old.status in ('sent', 'under_review', 'consultation_ready')
     and (new.structured is distinct from old.structured
          or new.raw_transcript is distinct from old.raw_transcript
          or new.clinic_id is distinct from old.clinic_id) then
    raise exception 'This case has been sent and can no longer be edited';
  end if;

  -- Patients cannot touch clinician-owned fields.
  if is_patient_actor and (new.assigned_doctor_id is distinct from old.assigned_doctor_id
                           or new.reviewed_at is distinct from old.reviewed_at
                           or new.reviewed_by is distinct from old.reviewed_by) then
    raise exception 'Clinician fields cannot be changed by the patient';
  end if;

  if new.clinic_id is distinct from old.clinic_id then
    insert into public.audit_log (case_id, actor_id, action, from_value, to_value)
    values (new.id, actor, 'clinic_transfer', old.clinic_id::text, new.clinic_id::text);
  end if;
  if new.assigned_doctor_id is distinct from old.assigned_doctor_id then
    insert into public.audit_log (case_id, actor_id, action, from_value, to_value)
    values (new.id, actor, 'assignment', old.assigned_doctor_id::text, new.assigned_doctor_id::text);
  end if;

  return new;
end $$;

create trigger cases_guard before insert or update on public.cases
  for each row execute function public.cases_guard_and_audit();

-- ─────────────────────────── Doctor / admin RPCs ───────────────────────────
create or replace function public.doctor_set_case_status(_case_id uuid, _status public.case_status)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.doctor_can_view_case(_case_id) then
    raise exception 'Not allowed';
  end if;
  update public.cases set status = _status where id = _case_id;
end $$;

create or replace function public.doctor_mark_reviewed(_case_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.doctor_can_view_case(_case_id) then
    raise exception 'Not allowed';
  end if;
  update public.cases
     set reviewed_at = now(), reviewed_by = auth.uid(),
         assigned_doctor_id = coalesce(assigned_doctor_id, auth.uid())
   where id = _case_id;
  insert into public.audit_log (case_id, actor_id, action) values (_case_id, auth.uid(), 'marked_reviewed');
end $$;

create or replace function public.doctor_assign_case(_case_id uuid, _doctor uuid)
returns void language plpgsql security definer set search_path = public as $$
declare _clinic uuid;
begin
  if not public.doctor_can_view_case(_case_id) then
    raise exception 'Not allowed';
  end if;
  select clinic_id into _clinic from public.cases where id = _case_id;
  if not exists (select 1 from public.clinic_doctors where clinic_id = _clinic and user_id = _doctor) then
    raise exception 'Doctor does not belong to this clinic';
  end if;
  update public.cases set assigned_doctor_id = _doctor where id = _case_id;
end $$;

create or replace function public.log_case_view(_case_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.doctor_can_view_case(_case_id) then
    raise exception 'Not allowed';
  end if;
  insert into public.audit_log (case_id, actor_id, action) values (_case_id, auth.uid(), 'case_viewed');
end $$;

-- Any signed-in user can register a clinic and becomes its admin.
-- The clinic stays hidden from patients until a platform operator sets verified = true.
create or replace function public.register_clinic(_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare _id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  insert into public.clinics (name, created_by) values (_name, auth.uid()) returning id into _id;
  insert into public.clinic_admins (clinic_id, user_id) values (_id, auth.uid());
  insert into public.user_roles (user_id, role) values (auth.uid(), 'clinic_admin') on conflict do nothing;
  return _id;
end $$;

-- Doctor accepts an emailed invite. The signed-in email must match the invite.
create or replace function public.accept_clinic_invite(_token uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare inv public.clinic_invites; _email text;
begin
  select email into _email from auth.users where id = auth.uid();
  select * into inv from public.clinic_invites
   where token = _token and accepted_at is null and expires_at > now();
  if inv.id is null or lower(inv.email) <> lower(_email) then
    raise exception 'Invite is invalid, expired, or belongs to a different email';
  end if;
  insert into public.clinic_doctors (clinic_id, user_id, specialty)
  values (inv.clinic_id, auth.uid(), inv.specialty) on conflict do nothing;
  insert into public.user_roles (user_id, role) values (auth.uid(), 'doctor') on conflict do nothing;
  update public.clinic_invites set accepted_at = now() where id = inv.id;
  return inv.clinic_id;
end $$;

-- Verified clinics near a point, optionally filtered by specialty (haversine, no PostGIS needed).
create or replace function public.nearby_clinics(
  _lat double precision, _lng double precision,
  _specialty text default null, _radius_km double precision default 25
)
returns table (id uuid, name text, specialties text[], address text, phone text,
               lat double precision, lng double precision, distance_km double precision)
language sql stable security invoker set search_path = public as $$
  select * from (
    select c.id, c.name, c.specialties, c.address, c.phone, c.lat, c.lng,
           6371 * 2 * asin(sqrt(
             power(sin(radians(c.lat - _lat) / 2), 2) +
             cos(radians(_lat)) * cos(radians(c.lat)) * power(sin(radians(c.lng - _lng) / 2), 2)
           )) as distance_km
    from public.clinics c
    where c.verified and c.accepting_intakes and c.lat is not null and c.lng is not null
      and (_specialty is null or _specialty = any (c.specialties))
  ) t
  where t.distance_km <= _radius_km
  order by t.distance_km;
$$;

-- Inbox view (runs with the caller's RLS). Age and sex come from the profile.
create or replace view public.doctor_inbox with (security_invoker = true) as
select c.id, c.clinic_id, c.status, c.triage_level, c.chief_complaint, c.specialty_hint,
       c.red_flags, c.assigned_doctor_id, c.reviewed_at, c.sent_at, c.structured ->> 'onset' as symptom_onset,
       extract(year from age(p.dob))::int as patient_age, p.sex as patient_sex,
       case c.triage_level when 'urgent' then 0 when 'soon' then 1 else 2 end as triage_rank
from public.cases c
join public.profiles p on p.id = c.patient_id;

-- ─────────────────────────── Row Level Security ───────────────────────────
alter table public.profiles       enable row level security;
alter table public.user_roles     enable row level security;
alter table public.specialties    enable row level security;
alter table public.clinics        enable row level security;
alter table public.clinic_admins  enable row level security;
alter table public.clinic_doctors enable row level security;
alter table public.clinic_invites enable row level security;
alter table public.cases          enable row level security;
alter table public.case_notes     enable row level security;
alter table public.audit_log      enable row level security;

-- profiles
create policy profiles_self_select on public.profiles for select using (id = auth.uid());
create policy profiles_self_update on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_staff_select on public.profiles for select using (public.staff_can_view_patient(id));

-- user_roles: read-only for the owner; written only by definer functions
create policy roles_self_select on public.user_roles for select using (user_id = auth.uid());

-- specialties: public reference data
create policy specialties_read on public.specialties for select using (true);

-- clinics
create policy clinics_directory on public.clinics for select
  using (auth.uid() is not null and (verified or public.is_clinic_admin(id) or public.is_clinic_doctor(id)));
create policy clinics_admin_update on public.clinics for update
  using (public.is_clinic_admin(id)) with check (public.is_clinic_admin(id));

-- clinic_admins / clinic_doctors
create policy clinic_admins_read on public.clinic_admins for select
  using (user_id = auth.uid() or public.is_clinic_admin(clinic_id));
create policy clinic_doctors_read on public.clinic_doctors for select
  using (user_id = auth.uid() or public.is_clinic_admin(clinic_id) or public.is_clinic_doctor(clinic_id));
create policy clinic_doctors_admin_update on public.clinic_doctors for update
  using (public.is_clinic_admin(clinic_id)) with check (public.is_clinic_admin(clinic_id));
create policy clinic_doctors_admin_delete on public.clinic_doctors for delete
  using (public.is_clinic_admin(clinic_id));

-- clinic_invites (admins only; doctors accept through the RPC)
create policy invites_admin_all on public.clinic_invites for all
  using (public.is_clinic_admin(clinic_id)) with check (public.is_clinic_admin(clinic_id));

-- cases
create policy cases_patient_select on public.cases for select using (patient_id = auth.uid());
create policy cases_patient_insert on public.cases for insert
  with check (patient_id = auth.uid() and status = 'draft');
create policy cases_patient_update on public.cases for update
  using (patient_id = auth.uid() and status in ('draft', 'confirmed', 'info_requested'))
  with check (patient_id = auth.uid());
create policy cases_patient_delete on public.cases for delete
  using (patient_id = auth.uid() and status = 'draft');
create policy cases_staff_select on public.cases for select using (public.staff_can_view_case(cases));
-- Doctors never UPDATE cases directly; they use the doctor_* RPCs above.

-- case_notes: clinicians only, never patients
create policy notes_doctor_select on public.case_notes for select using (public.doctor_can_view_case(case_id));
create policy notes_doctor_insert on public.case_notes for insert
  with check (author_id = auth.uid() and public.doctor_can_view_case(case_id));
create policy notes_author_update on public.case_notes for update
  using (author_id = auth.uid() and public.doctor_can_view_case(case_id))
  with check (author_id = auth.uid());
create policy notes_author_delete on public.case_notes for delete using (author_id = auth.uid());

-- audit_log: read-only; patients see the trail for their own cases, clinic staff for theirs
create policy audit_patient_select on public.audit_log for select
  using (exists (select 1 from public.cases c where c.id = case_id and c.patient_id = auth.uid()));
create policy audit_staff_select on public.audit_log for select
  using (exists (select 1 from public.cases c where c.id = case_id and public.staff_can_view_case(c)));

-- ─────────────────────────── Storage: case audio ───────────────────────────
insert into storage.buckets (id, name, public) values ('case-audio', 'case-audio', false)
on conflict (id) do nothing;

-- Path convention: <patient_uuid>/<case_uuid>.webm
create policy case_audio_patient_rw on storage.objects for all
  using (bucket_id = 'case-audio' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'case-audio' and (storage.foldername(name))[1] = auth.uid()::text);
create policy case_audio_doctor_read on storage.objects for select
  using (bucket_id = 'case-audio' and exists (
    select 1 from public.cases c
    where c.audio_path = storage.objects.name and public.doctor_can_view_case(c.id)
  ));

-- ─────────────────────────── Grants ───────────────────────────
revoke all on function public.doctor_set_case_status(uuid, public.case_status) from public, anon;
revoke all on function public.doctor_mark_reviewed(uuid) from public, anon;
revoke all on function public.doctor_assign_case(uuid, uuid) from public, anon;
revoke all on function public.log_case_view(uuid) from public, anon;
revoke all on function public.register_clinic(text) from public, anon;
revoke all on function public.accept_clinic_invite(uuid) from public, anon;
grant execute on function public.doctor_set_case_status(uuid, public.case_status) to authenticated;
grant execute on function public.doctor_mark_reviewed(uuid) to authenticated;
grant execute on function public.doctor_assign_case(uuid, uuid) to authenticated;
grant execute on function public.log_case_view(uuid) to authenticated;
grant execute on function public.register_clinic(text) to authenticated;
grant execute on function public.accept_clinic_invite(uuid) to authenticated;
