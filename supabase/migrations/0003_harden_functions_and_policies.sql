-- Applied to the live project after the Supabase security advisor run.

alter function public.set_updated_at() set search_path = public;

-- Trigger-only functions must not be callable through the REST API.
revoke all on function public.cases_guard_and_audit() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- RLS helpers: signed-in users need EXECUTE (policies call them as the caller); anonymous visitors do not.
revoke all on function public.has_role(public.app_role) from public, anon;
revoke all on function public.is_clinic_admin(uuid) from public, anon;
revoke all on function public.is_clinic_doctor(uuid) from public, anon;
revoke all on function public.staff_can_view_case(public.cases) from public, anon;
revoke all on function public.staff_can_view_patient(uuid) from public, anon;
revoke all on function public.doctor_can_view_case(uuid) from public, anon;
grant execute on function public.has_role(public.app_role) to authenticated;
grant execute on function public.is_clinic_admin(uuid) to authenticated;
grant execute on function public.is_clinic_doctor(uuid) to authenticated;
grant execute on function public.staff_can_view_case(public.cases) to authenticated;
grant execute on function public.staff_can_view_patient(uuid) to authenticated;
grant execute on function public.doctor_can_view_case(uuid) to authenticated;

-- Scope policies to signed-in users so anonymous requests get empty results, not permission errors.
alter policy profiles_self_select on public.profiles to authenticated;
alter policy profiles_self_update on public.profiles to authenticated;
alter policy profiles_staff_select on public.profiles to authenticated;
alter policy roles_self_select on public.user_roles to authenticated;
alter policy clinics_directory on public.clinics to authenticated;
alter policy clinics_admin_update on public.clinics to authenticated;
alter policy clinic_admins_read on public.clinic_admins to authenticated;
alter policy clinic_doctors_read on public.clinic_doctors to authenticated;
alter policy clinic_doctors_admin_update on public.clinic_doctors to authenticated;
alter policy clinic_doctors_admin_delete on public.clinic_doctors to authenticated;
alter policy invites_admin_all on public.clinic_invites to authenticated;
alter policy cases_patient_select on public.cases to authenticated;
alter policy cases_patient_insert on public.cases to authenticated;
alter policy cases_patient_update on public.cases to authenticated;
alter policy cases_patient_delete on public.cases to authenticated;
alter policy cases_staff_select on public.cases to authenticated;
alter policy notes_doctor_select on public.case_notes to authenticated;
alter policy notes_doctor_insert on public.case_notes to authenticated;
alter policy notes_author_update on public.case_notes to authenticated;
alter policy notes_author_delete on public.case_notes to authenticated;
alter policy audit_patient_select on public.audit_log to authenticated;
alter policy audit_staff_select on public.audit_log to authenticated;
alter policy case_audio_patient_rw on storage.objects to authenticated;
alter policy case_audio_doctor_read on storage.objects to authenticated;
