-- Phase 1 (patient) support. Already applied to the live project.

alter table public.cases add column if not exists info_request_note text;

create or replace function public.doctor_request_info(_case_id uuid, _note text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.doctor_can_view_case(_case_id) then
    raise exception 'Not allowed';
  end if;
  if coalesce(trim(_note), '') = '' then
    raise exception 'Write what information you need';
  end if;
  update public.cases
     set status = 'info_requested', info_request_note = left(trim(_note), 1000)
   where id = _case_id;
end $$;

revoke all on function public.doctor_request_info(uuid, text) from public, anon;
grant execute on function public.doctor_request_info(uuid, text) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'cases') then
    alter publication supabase_realtime add table public.cases;
  end if;
end $$;

-- One clearly labelled test clinic. It has no doctors, so cases sent here are never read.
-- Delete it before launch.
insert into public.clinics (name, specialties, address, lat, lng, verified, accepting_intakes)
select 'ClinIQ Test Clinic (safe to delete)',
       array['general_practice','pediatrics','cardiology','orthopedics','neurology','dermatology',
             'ent','gastroenterology','obstetrics_gynecology','psychiatry','ophthalmology','pulmonology'],
       'Test address, New Delhi', 28.6139, 77.2090, true, true
where not exists (select 1 from public.clinics where name like 'ClinIQ Test Clinic%');
