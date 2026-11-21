-- Doctor and clinic-admin access test. Paste into the Supabase SQL editor and run.
-- It ends by raising "ALL_TESTS_PASSED", which rolls everything back, so nothing is left behind.
do $$
declare
  pat uuid := gen_random_uuid(); adm uuid := gen_random_uuid(); dr1 uuid := gen_random_uuid();
  dr2 uuid := gen_random_uuid(); stranger uuid := gen_random_uuid();
  cid uuid; case_a uuid; case_b uuid; tok uuid; n int; ok boolean; r record; log text := '';
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data) values
    (pat, 'pat@test.local', 'authenticated', 'authenticated', '{"full_name":"Pat Test"}'),
    (adm, 'adm@test.local', 'authenticated', 'authenticated', '{"full_name":"Admin Test"}'),
    (dr1, 'dr1@test.local', 'authenticated', 'authenticated', '{"full_name":"Dr One"}'),
    (dr2, 'dr2@test.local', 'authenticated', 'authenticated', '{"full_name":"Dr Two"}'),
    (stranger, 'st@test.local', 'authenticated', 'authenticated', '{"full_name":"Stranger"}');

  -- clinic registration and the verification guard
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  set local role authenticated;
  ok := false; begin perform public.register_clinic('  '); exception when others then ok := true; end;
  if not ok then raise exception 'FAIL blank clinic name accepted'; end if;
  cid := public.register_clinic('Doctor Flow Test Clinic');
  ok := false; begin insert into public.clinics (name) values ('sneaky'); exception when others then ok := true; end;
  if not ok then raise exception 'FAIL direct clinic insert allowed'; end if;
  ok := false; begin update public.clinics set verified = true where id = cid; exception when others then ok := true; end;
  if not ok then raise exception 'FAIL clinic admin verified their own clinic'; end if;
  update public.clinics set address = 'Somewhere', accepting_intakes = true where id = cid;
  log := log || 'register+verify-guard; ';

  reset role;
  perform set_config('request.jwt.claims', '', true);
  update public.clinics set verified = true where id = cid;   -- operator path (no JWT)
  log := log || 'operator-verify; ';

  -- admin acts as a doctor of their own clinic
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.admin_add_self_as_doctor(cid, 'cardiology');
  reset role;
  select count(*) into n from public.clinic_doctors where clinic_id = cid and user_id = adm;
  if n <> 1 then raise exception 'FAIL admin not added as doctor'; end if;
  select count(*) into n from public.user_roles where user_id = adm and role = 'doctor';
  if n <> 1 then raise exception 'FAIL admin missing doctor role'; end if;
  log := log || 'self-doctor; ';

  -- invites: only the invited email can accept, once
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.clinic_invites (clinic_id, email, specialty, invited_by) values (cid, 'dr1@test.local', 'general_practice', adm) returning token into tok;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', stranger, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.clinic_invites;
  if n <> 0 then raise exception 'FAIL stranger can read invites'; end if;
  ok := false; begin perform public.accept_clinic_invite(tok); exception when others then ok := true; end;
  if not ok then raise exception 'FAIL wrong email accepted an invite'; end if;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', dr1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.accept_clinic_invite(tok);
  ok := false; begin perform public.accept_clinic_invite(tok); exception when others then ok := true; end;
  if not ok then raise exception 'FAIL invite accepted twice'; end if;
  reset role;
  insert into public.clinic_doctors (clinic_id, user_id, specialty) values (cid, dr2, 'general_practice');
  insert into public.user_roles (user_id, role) values (dr2, 'doctor');
  log := log || 'invite-flow; ';

  -- patient sends two cases: A has malformed AI JSON, B has urgency lowered by the patient
  perform set_config('request.jwt.claims', json_build_object('sub', pat, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.cases (patient_id, raw_transcript) values (pat, 'case a') returning id into case_a;
  update public.cases set ai_extraction = '{"redFlags":5,"triage":"oops"}', structured = '{"onset":"1d"}', chief_complaint = 'Case A', triage_level = 'routine', specialty_hint = 'general_practice' where id = case_a;
  update public.cases set status = 'confirmed' where id = case_a;
  update public.cases set clinic_id = cid, status = 'sent' where id = case_a;

  insert into public.cases (patient_id, raw_transcript) values (pat, 'case b') returning id into case_b;
  update public.cases set ai_extraction = '{"triage":{"level":"urgent"},"redFlags":[{"label":"Chest pain or pressure"}]}', structured = '{"onset":"2d"}',
         chief_complaint = 'Case B', triage_level = 'routine', specialty_hint = 'cardiology' where id = case_b;
  update public.cases set status = 'confirmed' where id = case_b;
  update public.cases set clinic_id = cid, status = 'sent' where id = case_b;
  log := log || 'patient-sends; ';

  -- the inbox cannot be broken by bad JSON, and a lowered urgency is not trusted
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', dr1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.doctor_inbox;
  if n <> 2 then raise exception 'FAIL inbox shows % cases, expected 2', n; end if;
  select * into r from public.doctor_inbox where id = case_b;
  if r.effective_triage::text <> 'urgent' or r.has_red_flags is not true or r.triage_rank <> 0 then
    raise exception 'FAIL lowered urgency hid case B: % % %', r.effective_triage, r.has_red_flags, r.triage_rank; end if;
  if r.patient_name <> 'Pat Test' then raise exception 'FAIL patient name missing: %', r.patient_name; end if;
  select * into r from public.doctor_inbox where id = case_a;
  if r.effective_triage::text <> 'routine' or r.has_red_flags is not false then raise exception 'FAIL case A wrongly flagged'; end if;
  log := log || 'inbox-effective-urgency; ';

  -- staff directory, assignment, review, notes
  select count(*) into n from public.clinic_staff(cid) where is_doctor;
  if n <> 3 then raise exception 'FAIL clinic_staff doctors: %', n; end if;
  select count(*) into n from public.clinic_staff(cid) where full_name in ('Dr One','Dr Two','Admin Test');
  if n <> 3 then raise exception 'FAIL clinic_staff names: %', n; end if;
  perform public.log_case_view(case_b);
  perform public.doctor_assign_case(case_b, dr2);
  ok := false; begin perform public.doctor_assign_case(case_b, stranger); exception when others then ok := true; end;
  if not ok then raise exception 'FAIL assigned a case to a non-member'; end if;
  perform public.doctor_set_case_status(case_b, 'under_review');
  perform public.doctor_mark_reviewed(case_b);
  insert into public.case_notes (case_id, author_id, kind, body) values (case_b, dr1, 'note', 'internal');
  insert into public.case_notes (case_id, author_id, kind, body, checklist) values (case_b, dr1, 'checklist', '', '[{"text":"Record vitals","done":false}]');
  log := log || 'doctor-actions; ';

  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', dr2, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.case_notes where case_id = case_b;
  if n <> 2 then raise exception 'FAIL colleague sees % notes', n; end if;
  update public.case_notes set body = 'hijacked' where case_id = case_b;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL colleague edited another doctors note'; end if;
  perform public.doctor_request_info(case_b, 'Any recent travel?');
  log := log || 'colleague-notes; ';

  -- outsiders
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', stranger, 'role', 'authenticated')::text, true);
  set local role authenticated;
  ok := false; begin perform * from public.clinic_staff(cid); exception when others then ok := true; end;
  if not ok then raise exception 'FAIL stranger read the staff directory'; end if;
  select count(*) into n from public.doctor_inbox;
  if n <> 0 then raise exception 'FAIL stranger sees inbox rows: %', n; end if;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', pat, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.case_notes;
  if n <> 0 then raise exception 'FAIL patient reads doctor notes'; end if;
  ok := false; begin perform * from public.clinic_staff(cid); exception when others then ok := true; end;
  if not ok then raise exception 'FAIL patient read the staff directory'; end if;
  log := log || 'outsiders-blocked; ';

  -- admin can edit licence details but cannot move a membership to another user
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.clinic_doctors set license_number = 'L-123', license_verified = true where clinic_id = cid and user_id = dr2;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL admin could not update licence'; end if;
  ok := false; begin update public.clinic_doctors set user_id = stranger where clinic_id = cid and user_id = dr2; exception when others then ok := true; end;
  if not ok then raise exception 'FAIL membership was moved to another user'; end if;
  log := log || 'admin-licence; ';

  reset role;
  select count(*) into n from public.audit_log where case_id = case_b and action in ('case_viewed','assignment','marked_reviewed','status_change');
  if n < 6 then raise exception 'FAIL audit rows for case B: %', n; end if;
  log := log || 'audit=' || n || '; ';

  raise exception 'ALL_TESTS_PASSED: %', log;
end $$;
