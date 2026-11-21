-- Found by the live access-control test: the BEFORE INSERT trigger wrote an
-- audit row that referenced a case row which did not exist yet (FK violation),
-- so no patient could create a case. Validate in BEFORE, audit in AFTER.
-- 0001 in this repo already has the corrected guard function; run 0004 after it.
create or replace function public.cases_audit_created()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_log (case_id, actor_id, action, to_value)
  values (new.id, auth.uid(), 'case_created', new.status::text);
  return new;
end $$;
revoke all on function public.cases_audit_created() from public, anon, authenticated;
create trigger cases_audit_insert after insert on public.cases
  for each row execute function public.cases_audit_created();
