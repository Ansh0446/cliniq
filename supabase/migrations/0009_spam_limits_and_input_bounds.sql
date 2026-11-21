-- Launch hardening: abuse limits and input size bounds. Already applied.

alter table public.cases add constraint cases_transcript_len check (char_length(raw_transcript) <= 20000);
alter table public.case_notes add constraint case_notes_body_len check (char_length(body) <= 8000);
alter table public.clinics add constraint clinics_field_lengths check (
  char_length(name) between 2 and 120
  and (phone is null or char_length(phone) <= 30)
  and (email is null or char_length(email) <= 160)
  and (address is null or char_length(address) <= 300));
alter table public.profiles add constraint profiles_bounds check (
  (full_name is null or char_length(full_name) <= 120)
  and cardinality(allergies) <= 60 and cardinality(chronic_conditions) <= 60 and cardinality(medications) <= 60);
alter table public.clinic_invites add constraint invites_email_len check (char_length(email) between 3 and 160);

-- Sign-up must never fail because a provider sent a very long display name.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'), 120));
  insert into public.user_roles (user_id, role) values (new.id, 'patient');
  return new;
end $$;

-- At most 3 clinics per person.
create or replace function public.register_clinic(_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare _id uuid; _clean text := trim(coalesce(_name, ''));
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if length(_clean) < 2 or length(_clean) > 120 then raise exception 'Clinic name must be 2 to 120 characters'; end if;
  if (select count(*) from public.clinic_admins where user_id = auth.uid()) >= 3 then
    raise exception 'You can register up to 3 clinics';
  end if;
  insert into public.clinics (name, created_by) values (_clean, auth.uid()) returning id into _id;
  insert into public.clinic_admins (clinic_id, user_id) values (_id, auth.uid());
  insert into public.user_roles (user_id, role) values (auth.uid(), 'clinic_admin') on conflict do nothing;
  return _id;
end $$;

-- At most 25 unfinished intakes per patient.
create or replace function public.limit_open_cases()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.cases where patient_id = new.patient_id and status in ('draft', 'confirmed')) >= 25 then
    raise exception 'You have 25 unfinished intakes. Finish or delete some before starting another.';
  end if;
  return new;
end $$;
create trigger cases_limit_open before insert on public.cases
  for each row execute function public.limit_open_cases();

-- At most 50 pending invites per clinic.
create or replace function public.limit_pending_invites()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.clinic_invites where clinic_id = new.clinic_id and accepted_at is null and expires_at > now()) >= 50 then
    raise exception 'This clinic already has 50 pending invites. Revoke some first.';
  end if;
  return new;
end $$;
create trigger invites_limit_pending before insert on public.clinic_invites
  for each row execute function public.limit_pending_invites();

revoke all on function public.limit_open_cases() from public, anon, authenticated;
revoke all on function public.limit_pending_invites() from public, anon, authenticated;
revoke all on function public.register_clinic(text) from public, anon;
grant execute on function public.register_clinic(text) to authenticated;
