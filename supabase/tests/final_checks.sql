-- Operator, signature column and account-deletion test. Paste into the Supabase SQL editor and run.
-- It ends by raising "ALL_TESTS_PASSED", which rolls everything back, so nothing is left behind.
do $$
declare
  op uuid := gen_random_uuid(); adm uuid := gen_random_uuid(); pat uuid := gen_random_uuid();
  pat2 uuid := gen_random_uuid(); doc uuid := gen_random_uuid();
  cid uuid; v_case uuid; n int; ok boolean; log text := '';
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data) values
    (op, 'op@test.local', 'authenticated', 'authenticated', '{"full_name":"Operator"}'),
    (adm, 'adm@test.local', 'authenticated', 'authenticated', '{"full_name":"Clinic Admin"}'),
    (pat, 'pat@test.local', 'authenticated', 'authenticated', '{"full_name":"Pat"}'),
    (pat2, 'pat2@test.local', 'authenticated', 'authenticated', '{"full_name":"Pat Two"}'),
    (doc, 'doc@test.local', 'authenticated', 'authenticated', '{"full_name":"Doc"}');
  insert into public.platform_operators (user_id) values (op);

  -- clinic registered by an admin starts unverified
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  set local role authenticated;
  cid := public.register_clinic('Operator Test Clinic');
  select count(*) into n from public.platform_operators;
  if n <> 0 then raise exception 'FAIL operators table is visible to the API'; end if;
  ok := false; begin perform public.operator_set_clinic_verified(cid, true); exception when others then ok := true; end;
  if not ok then raise exception 'FAIL clinic admin used the operator function'; end if;
  ok := false; begin perform * from public.operator_clinics(); exception when others then ok := true; end;
  if not ok then raise exception 'FAIL clinic admin listed all clinics'; end if;
  if public.is_platform_operator() then raise exception 'FAIL admin reported as operator'; end if;
  log := log || 'non-operator-blocked; ';

  -- operator can list and verify
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', op, 'role', 'authenticated')::text, true);
  set local role authenticated;
  if not public.is_platform_operator() then raise exception 'FAIL operator not recognised'; end if;
  select count(*) into n from public.operator_clinics() where id = cid and verified = false and admin_name = 'Clinic Admin' and admin_email = 'adm@test.local';
  if n <> 1 then raise exception 'FAIL operator list missing the pending clinic'; end if;
  perform public.operator_set_clinic_verified(cid, true);
  select count(*) into n from public.operator_clinics() where id = cid and verified;
  if n <> 1 then raise exception 'FAIL clinic not verified'; end if;
  perform public.operator_set_clinic_verified(cid, false);
  ok := false; begin perform public.operator_set_clinic_verified(gen_random_uuid(), true); exception when others then ok := true; end;
  if not ok then raise exception 'FAIL verified a clinic that does not exist'; end if;
  log := log || 'operator-verify; ';

  -- the verified flag still cannot be changed directly by a clinic admin
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  set local role authenticated;
  ok := false; begin update public.clinics set verified = true where id = cid; exception when others then ok := true; end;
  if not ok then raise exception 'FAIL admin verified directly'; end if;
  log := log || 'direct-verify-blocked; ';

  -- signature column is writable by the patient (the server writes it; doctors verify it)
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', pat, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.cases (patient_id, raw_transcript) values (pat, 'cough') returning id into v_case;
  update public.cases set ai_extraction = '{"x":1}', ai_signature = 'deadbeef' where id = v_case;
  select count(*) into n from public.cases where id = v_case and ai_signature = 'deadbeef';
  if n <> 1 then raise exception 'FAIL ai_signature not stored'; end if;
  log := log || 'signature-column; ';

  -- account deletion: staff cannot, patients can and everything under them goes
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  set local role authenticated;
  ok := false; begin perform public.delete_my_account(); exception when others then ok := true; end;
  if not ok then raise exception 'FAIL clinic admin deleted their account'; end if;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  ok := false; begin perform public.delete_my_account(); exception when others then ok := true; end;
  if not ok then raise exception 'FAIL anonymous deletion worked'; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', pat, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.delete_my_account();
  reset role;
  select count(*) into n from auth.users where id = pat;
  if n <> 0 then raise exception 'FAIL user still exists'; end if;
  select count(*) into n from public.cases where patient_id = pat;
  if n <> 0 then raise exception 'FAIL cases survived deletion'; end if;
  select count(*) into n from public.profiles where id = pat;
  if n <> 0 then raise exception 'FAIL profile survived deletion'; end if;
  select count(*) into n from auth.users where id = pat2;
  if n <> 1 then raise exception 'FAIL deletion touched another user'; end if;
  log := log || 'account-deletion; ';

  raise exception 'ALL_TESTS_PASSED: %', log;
end $$;
