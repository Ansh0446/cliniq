-- Patient-flow access test. Paste into the Supabase SQL editor and run.
-- It builds throwaway users and ends by raising "ALL_TESTS_PASSED", which rolls
-- everything back, so nothing is left in your database. Any other error is a failure.
do $$
declare
  pa uuid := gen_random_uuid(); dr uuid := gen_random_uuid(); stranger uuid := gen_random_uuid();
  cid uuid; v_case uuid; n int; ok boolean; st text; note text; log text := '';
begin
  insert into auth.users (id, email, aud, role) values
    (pa, 'pa@test.local', 'authenticated', 'authenticated'),
    (dr, 'dr@test.local', 'authenticated', 'authenticated'),
    (stranger, 'st@test.local', 'authenticated', 'authenticated');

  select id into cid from public.clinics where name like 'ClinIQ Test Clinic%' and verified and accepting_intakes;
  if cid is null then raise exception 'FAIL test clinic missing'; end if;
  select count(*) into n from public.clinics where name like 'ClinIQ Test Clinic%';
  if n <> 1 then raise exception 'FAIL expected exactly one test clinic, found %', n; end if;
  log := log || 'test-clinic; ';

  perform set_config('request.jwt.claims', json_build_object('sub', pa, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.clinics where verified;
  if n < 1 then raise exception 'FAIL patient cannot list clinics'; end if;
  reset role; set local role anon;
  select count(*) into n from public.clinics;
  if n <> 0 then raise exception 'FAIL anon can list clinics'; end if;
  log := log || 'clinic-visibility; ';
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', pa, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.cases (patient_id, raw_transcript, transcript_source) values (pa, 'cough and chest pressure for a day', 'voice') returning id into v_case;
  update public.cases set raw_transcript = 'cough and chest pressure for two days' where id = v_case;
  update public.cases
     set ai_extraction = '{"x":1}', structured = '{"x":1}', chief_complaint = 'Cough', specialty_hint = 'general_practice',
         triage_level = 'urgent', red_flags = array['Chest pain or pressure'], emergency_acknowledged_at = null
   where id = v_case;

  ok := false;
  begin update public.cases set status = 'confirmed' where id = v_case;
  exception when others then ok := true; end;
  if not ok then raise exception 'FAIL confirmed without emergency acknowledgement'; end if;

  update public.cases set emergency_acknowledged_at = now() where id = v_case;
  update public.cases set status = 'confirmed' where id = v_case;
  log := log || 'confirm-with-ack; ';

  update public.cases set status = 'draft' where id = v_case;
  update public.cases set status = 'confirmed' where id = v_case;

  update public.cases set clinic_id = cid, status = 'sent' where id = v_case;
  log := log || 'send-one-step; ';

  update public.cases set raw_transcript = 'tampered' where id = v_case;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL patient edited a sent case'; end if;
  delete from public.cases where id = v_case;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL patient deleted a sent case'; end if;
  log := log || 'sent-locked; ';

  reset role;
  insert into public.clinic_doctors (clinic_id, user_id, specialty) values (cid, dr, 'general_practice');
  perform set_config('request.jwt.claims', json_build_object('sub', dr, 'role', 'authenticated')::text, true);
  set local role authenticated;
  ok := false;
  begin perform public.doctor_request_info(v_case, '   ');
  exception when others then ok := true; end;
  if not ok then raise exception 'FAIL empty info request accepted'; end if;
  perform public.doctor_request_info(v_case, 'How high was the fever, and are you on any blood thinners?');

  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', stranger, 'role', 'authenticated')::text, true);
  set local role authenticated;
  ok := false;
  begin perform public.doctor_request_info(v_case, 'let me in');
  exception when others then ok := true; end;
  if not ok then raise exception 'FAIL stranger requested info'; end if;
  log := log || 'info-request-auth; ';

  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', pa, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select status::text, info_request_note into st, note from public.cases where id = v_case;
  if st <> 'info_requested' or note is null then raise exception 'FAIL patient does not see the request: % / %', st, note; end if;
  update public.cases set structured = '{"x":2,"answer":"38.9C, no blood thinners"}' where id = v_case;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL patient could not add info while requested'; end if;
  update public.cases set structured = '{"x":2,"answer":"38.9C, no blood thinners"}', status = 'sent' where id = v_case;
  log := log || 'resend; ';

  ok := false;
  begin update public.cases set status = 'consultation_ready' where id = v_case;
  exception when others then ok := true; end;
  if not ok then
    get diagnostics n = row_count;
    if n <> 0 then raise exception 'FAIL patient jumped to consultation_ready'; end if;
  end if;

  select count(*) into n from public.audit_log where case_id = v_case and action = 'status_change';
  if n < 6 then raise exception 'FAIL audit missing status changes: %', n; end if;
  log := log || 'audit-status-changes=' || n || '; ';

  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', stranger, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.cases where id = v_case;
  if n <> 0 then raise exception 'FAIL stranger can read the case'; end if;
  log := log || 'stranger-blocked; ';

  reset role;
  select count(*) into n from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'cases';
  if n <> 1 then raise exception 'FAIL cases not in realtime publication'; end if;
  log := log || 'realtime; ';

  raise exception 'ALL_TESTS_PASSED: %', log;
end $$;
