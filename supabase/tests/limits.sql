-- Abuse-limit and input-bound test. Paste into the Supabase SQL editor and run.
-- It ends by raising "ALL_TESTS_PASSED", which rolls everything back.
do $$
declare
  u uuid := gen_random_uuid(); a uuid := gen_random_uuid(); cid uuid; n int; i int; ok boolean; log text := '';
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data) values
    (u, 'u@test.local', 'authenticated', 'authenticated', json_build_object('full_name', repeat('x', 300))::jsonb),
    (a, 'a@test.local', 'authenticated', 'authenticated', '{"full_name":"Admin"}');

  -- a very long provider display name must not break sign-up
  select char_length(full_name) into n from public.profiles where id = u;
  if n <> 120 then raise exception 'FAIL long name not truncated: %', n; end if;
  log := log || 'long-name-ok; ';

  -- at most 3 clinics per person
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  for i in 1..3 loop cid := public.register_clinic('Limit Clinic ' || i); end loop;
  ok := false; begin perform public.register_clinic('Limit Clinic 4'); exception when others then ok := true; end;
  if not ok then raise exception 'FAIL a fourth clinic was allowed'; end if;
  log := log || 'clinic-cap; ';

  -- clinic field bounds
  ok := false; begin update public.clinics set phone = repeat('9', 31) where id = cid; exception when others then ok := true; end;
  if not ok then raise exception 'FAIL oversized phone accepted'; end if;

  -- at most 50 pending invites per clinic
  for i in 1..50 loop insert into public.clinic_invites (clinic_id, email, invited_by) values (cid, 'inv' || i || '@test.local', a); end loop;
  ok := false; begin insert into public.clinic_invites (clinic_id, email, invited_by) values (cid, 'one-too-many@test.local', a); exception when others then ok := true; end;
  if not ok then raise exception 'FAIL 51st invite allowed'; end if;
  log := log || 'invite-cap; ';

  -- at most 25 unfinished intakes per patient, and a bounded transcript
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  set local role authenticated;
  for i in 1..25 loop insert into public.cases (patient_id, raw_transcript) values (u, 'draft ' || i); end loop;
  ok := false; begin insert into public.cases (patient_id, raw_transcript) values (u, 'draft 26'); exception when others then ok := true; end;
  if not ok then raise exception 'FAIL 26th unfinished intake allowed'; end if;
  ok := false; begin update public.cases set raw_transcript = repeat('a', 20001) where patient_id = u and raw_transcript = 'draft 1'; exception when others then ok := true; end;
  if not ok then raise exception 'FAIL oversized transcript accepted'; end if;
  delete from public.cases where patient_id = u and raw_transcript = 'draft 2';
  insert into public.cases (patient_id, raw_transcript) values (u, 'after delete');
  log := log || 'draft-cap+bounds; ';

  raise exception 'ALL_TESTS_PASSED: %', log;
end $$;
