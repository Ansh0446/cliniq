import { Link, createFileRoute } from '@tanstack/react-router'
import { Copy, LocateFixed, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { EmptyState } from '@/components/app-shell'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Callout, Section, SelectField, Spinner } from '@/components/ui/form'
import { SPECIALTIES } from '@/lib/clinical/constants'
import { getPosition } from '@/lib/clinics/geo'
import { copyText } from '@/lib/browser'
import {
  DAYS, DAY_LABEL, addSelfAsDoctor, createInvite, inviteLink, listAdminClinics, listInvites, parseHours, removeDoctor,
  revokeInvite, setLicense, updateClinic, type ClinicFull, type Hours,
} from '@/lib/clinic-admin'
import { clinicStaff, type StaffMember } from '@/lib/doctor/data'
import { useAsync } from '@/lib/hooks/use-async'
import { coordsError, emailError, nameError, phoneError } from '@/lib/validators'
import { privateHead } from '@/lib/site'

export const Route = createFileRoute('/clinic/settings')({
  head: () => privateHead('Clinic settings'), component: ClinicSettings })

const msg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong.')
const num = (s: string): number | null => { const n = Number(s); return s.trim() !== '' && Number.isFinite(n) ? n : null }

function ClinicSettings() {
  const { userId } = Route.useRouteContext()
  const clinics = useAsync(() => listAdminClinics(userId), [userId])
  const [pick, setPick] = useState<string | null>(null)

  if (clinics.loading && !clinics.data) return <Spinner label="Loading clinic" />
  if (clinics.error) return <Callout tone="danger" title="Could not load your clinic">{clinics.error}</Callout>
  const list = clinics.data ?? []
  if (list.length === 0) return <EmptyState title="No clinic yet"><Link to="/register-clinic" className="font-semibold text-teal-700 underline">Register your clinic</Link></EmptyState>
  const clinic = list.find((c) => c.id === pick) ?? list[0]!

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-bold">Clinic settings</h1>
        {list.length > 1 && <div className="w-64"><SelectField id="which" label="Clinic" value={clinic.id} onChange={(e) => setPick(e.target.value)} options={list.map((c) => ({ value: c.id, label: c.name }))} /></div>}
      </div>
      <VerificationBanner clinic={clinic} />
      <div key={clinic.id} className="space-y-6">
        <ProfileSection clinic={clinic} onSaved={clinics.reload} />
        <SpecialtySection clinic={clinic} onSaved={clinics.reload} />
        <IntakeSection clinic={clinic} onSaved={clinics.reload} />
        <StaffSection clinic={clinic} />
      </div>
    </div>
  )
}

function VerificationBanner({ clinic }: { clinic: ClinicFull }) {
  const [copied, setCopied] = useState(false)
  if (clinic.verified) return <Callout tone="success" title="Verified">Patients can find this clinic and send cases to it.</Callout>
  return (
    <Callout tone="warn" title="Waiting for verification">
      <p>Patients cannot find this clinic yet. A platform operator must verify it first; clinic admins cannot do this themselves. Send the operator the clinic ID below.</p>
      <p className="mt-1">Clinic ID: <code className="rounded bg-panel px-1.5 py-0.5 text-xs">{clinic.id}</code>{' '}
        <button type="button" className="font-semibold underline" onClick={async () => { setCopied(await copyText(clinic.id)); setTimeout(() => setCopied(false), 2000) }}>{copied ? 'Copied' : 'Copy'}</button></p>
    </Callout>
  )
}

function useSave(onSaved: () => void) {
  const [state, setState] = useState<{ kind: 'idle' | 'saving' | 'saved' | 'error'; message?: string }>({ kind: 'idle' })
  const save = async (fn: () => Promise<void>) => {
    setState({ kind: 'saving' })
    try { await fn(); onSaved(); setState({ kind: 'saved' }) } catch (e) { setState({ kind: 'error', message: msg(e) }) }
  }
  return { state, save, reset: () => setState({ kind: 'idle' }) }
}
const Status = ({ s }: { s: ReturnType<typeof useSave>['state'] }) =>
  s.kind === 'error' ? <Callout tone="danger">{s.message}</Callout> : s.kind === 'saved' ? <Callout tone="success">Saved.</Callout> : null

function ProfileSection({ clinic, onSaved }: { clinic: ClinicFull; onSaved: () => void }) {
  const [v, setV] = useState({ name: clinic.name, address: clinic.address ?? '', phone: clinic.phone ?? '', email: clinic.email ?? '', lat: clinic.lat?.toString() ?? '', lng: clinic.lng?.toString() ?? '' })
  const [hours, setHours] = useState<Hours>(parseHours(clinic.operating_hours))
  const [locErr, setLocErr] = useState<string | null>(null)
  const { state, save, reset } = useSave(onSaved)
  const set = (k: keyof typeof v, val: string) => { setV((p) => ({ ...p, [k]: val })); reset() }

  const lat = num(v.lat), lng = num(v.lng)
  const [showErrors, setShowErrors] = useState(false)
  const errs = {
    name: nameError(v.name, { required: true }),
    phone: phoneError(v.phone),
    email: emailError(v.email),
    coords: coordsError(v.lat, v.lng),
    hours: DAYS.find((d) => { const h = hours[d]; return h && h.open >= h.close }) ?? null,
  }
  const coordsBad = errs.coords !== null
  const hasErrors = Boolean(errs.name || errs.phone || errs.email || errs.coords || errs.hours)

  return (
    <Section title="Clinic profile" hint="This is what patients see when choosing where to send a case.">
      <form className="space-y-4" noValidate onSubmit={(e) => { e.preventDefault(); setShowErrors(true); if (hasErrors) return
        void save(() => updateClinic(clinic.id, { name: v.name.trim(), address: v.address.trim() || null, phone: v.phone.trim() || null, email: v.email.trim() || null, lat, lng, operating_hours: hours })) }}>
        <Field id="c-name" label="Clinic name" value={v.name} maxLength={120} error={showErrors ? errs.name ?? undefined : undefined} onChange={(e) => set('name', e.target.value)} />
        <Field id="c-addr" label="Address" value={v.address} maxLength={300} onChange={(e) => set('address', e.target.value)} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="c-phone" type="tel" label="Phone" autoComplete="tel" value={v.phone} maxLength={30} error={showErrors ? errs.phone ?? undefined : undefined} onChange={(e) => set('phone', e.target.value)} />
          <Field id="c-email" type="email" label="Contact email" autoComplete="email" value={v.email} maxLength={160} error={showErrors ? errs.email ?? undefined : undefined} onChange={(e) => set('email', e.target.value)} />
        </div>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Map location</legend>
          <div className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <Field id="c-lat" label="Latitude" inputMode="decimal" value={v.lat} onChange={(e) => set('lat', e.target.value)} />
            <Field id="c-lng" label="Longitude" inputMode="decimal" value={v.lng} onChange={(e) => set('lng', e.target.value)} />
            <Button type="button" variant="secondary" onClick={async () => { setLocErr(null); try { const p = await getPosition(); setV((x) => ({ ...x, lat: p.lat.toFixed(5), lng: p.lng.toFixed(5) })); reset() } catch (e) { setLocErr(msg(e)) } }}><LocateFixed className="size-4" aria-hidden /> Use my location</Button>
          </div>
          {errs.coords && <p className="text-sm text-urgent">{errs.coords}</p>}
          {locErr && <p className="text-sm text-urgent">{locErr}</p>}
          <p className="text-xs text-muted">Stand at the clinic and use your location, or copy the coordinates from a map. They are used to show distance to patients.</p>
        </fieldset>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Operating hours</legend>
          <ul className="space-y-2">
            {DAYS.map((d) => {
              const h = hours[d]
              return (
                <li key={d} className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="w-24 font-medium">{DAY_LABEL[d]}</span>
                  <label className="flex items-center gap-2"><input type="checkbox" className="size-4 accent-teal-600" checked={h !== null} onChange={(e) => { setHours({ ...hours, [d]: e.target.checked ? { open: '09:00', close: '17:00' } : null }); reset() }} /> Open</label>
                  {h ? (<>
                    <input aria-label={`${DAY_LABEL[d]} opens`} type="time" value={h.open} onChange={(e) => { setHours({ ...hours, [d]: { ...h, open: e.target.value } }); reset() }} className="h-9 rounded-control border border-control bg-panel px-2" />
                    <span>to</span>
                    <input aria-label={`${DAY_LABEL[d]} closes`} type="time" value={h.close} onChange={(e) => { setHours({ ...hours, [d]: { ...h, close: e.target.value } }); reset() }} className="h-9 rounded-control border border-control bg-panel px-2" />
                  </>) : <span className="text-muted">Closed</span>}
                </li>
              )
            })}
          </ul>
        </fieldset>
        {showErrors && errs.hours && <p className="text-sm text-urgent">{DAY_LABEL[errs.hours]}: closing time must be after opening time.</p>}
        <Status s={state} />
        <Button type="submit" disabled={state.kind === 'saving'}>{state.kind === 'saving' ? 'Saving' : 'Save profile'}</Button>
      </form>
    </Section>
  )
}

function SpecialtySection({ clinic, onSaved }: { clinic: ClinicFull; onSaved: () => void }) {
  const [sel, setSel] = useState<string[]>(clinic.specialties)
  const { state, save, reset } = useSave(onSaved)
  return (
    <Section title="Specialties" hint="Patients are matched to clinics by the specialty their summary suggests.">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {SPECIALTIES.map((s) => (
          <label key={s.slug} className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-teal-600" checked={sel.includes(s.slug)} onChange={(e) => { setSel(e.target.checked ? [...sel, s.slug] : sel.filter((x) => x !== s.slug)); reset() }} /> {s.label}
          </label>
        ))}
      </div>
      <Status s={state} />
      <Button onClick={() => void save(() => updateClinic(clinic.id, { specialties: sel }))} disabled={state.kind === 'saving'}>Save specialties</Button>
    </Section>
  )
}

function IntakeSection({ clinic, onSaved }: { clinic: ClinicFull; onSaved: () => void }) {
  const [accepting, setAccepting] = useState(clinic.accepting_intakes)
  const [signoff, setSignoff] = useState(clinic.require_triage_signoff)
  const { state, save, reset } = useSave(onSaved)
  return (
    <Section title="Intake settings">
      <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-0.5 size-5 accent-teal-600" checked={accepting} onChange={(e) => { setAccepting(e.target.checked); reset() }} />
        <span><span className="font-medium">Accepting new intakes</span><br /><span className="text-muted">Turn off to hide the clinic from patients without losing existing cases.</span></span></label>
      <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-0.5 size-5 accent-teal-600" checked={signoff} onChange={(e) => { setSignoff(e.target.checked); reset() }} />
        <span><span className="font-medium">Require triage sign-off before appointment confirmation</span><br /><span className="text-muted">Saved as a clinic policy. ClinIQ does not book appointments yet, so this is recorded for when scheduling is added.</span></span></label>
      <Status s={state} />
      <Button onClick={() => void save(() => updateClinic(clinic.id, { accepting_intakes: accepting, require_triage_signoff: signoff }))} disabled={state.kind === 'saving'}>Save intake settings</Button>
    </Section>
  )
}

function StaffSection({ clinic }: { clinic: ClinicFull }) {
  const { userId } = Route.useRouteContext()
  const staff = useAsync(() => clinicStaff(clinic.id), [clinic.id])
  const invites = useAsync(() => listInvites(clinic.id), [clinic.id])
  const [email, setEmail] = useState('')
  const [specialty, setSpecialty] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const me = (staff.data ?? []).find((s) => s.user_id === userId)

  async function run(fn: () => Promise<void>, after: () => void) {
    setBusy(true); setError(null)
    try { await fn(); after() } catch (e) { setError(msg(e)) } finally { setBusy(false) }
  }
  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())
  const specOptions = [{ value: '', label: 'Not set' }, ...SPECIALTIES.map((s) => ({ value: s.slug, label: s.label }))]

  return (
    <Section title="Staff" hint="Doctors you add can read cases sent to this clinic. Invite them with a link; they sign in with the invited email to join.">
      {staff.loading && !staff.data && <Spinner />}
      {staff.error && <Callout tone="danger">{staff.error}</Callout>}
      <ul className="divide-y divide-line rounded-control border border-line">
        {(staff.data ?? []).map((s) => <StaffRow key={s.user_id} s={s} clinicId={clinic.id} isMe={s.user_id === userId} onChanged={staff.reload} />)}
      </ul>
      {me && !me.is_doctor && (
        <div className="flex flex-wrap items-center gap-3 rounded-control bg-canvas p-3 text-sm">
          <span>You are an admin but not a doctor here. Add yourself to use the doctor inbox.</span>
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => void run(() => addSelfAsDoctor(clinic.id, specialty || null), staff.reload)}>Add me as a doctor</Button>
        </div>
      )}

      <div className="space-y-3 border-t border-line pt-4">
        <h3 className="text-sm font-semibold">Invite a doctor</h3>
        <form className="grid items-end gap-3 sm:grid-cols-[1fr_14rem_auto]" onSubmit={(e) => { e.preventDefault(); if (emailOk) void run(async () => { await createInvite(clinic.id, email, specialty || null, userId); setEmail('') }, invites.reload) }}>
          <Field id="inv-email" type="email" label="Doctor's email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <SelectField id="inv-spec" label="Specialty" value={specialty} onChange={(e) => setSpecialty(e.target.value)} options={specOptions} />
          <Button type="submit" disabled={busy || !emailOk}>Create invite</Button>
        </form>
        <p className="text-xs text-muted">ClinIQ does not send email. Copy the invite link and send it to the doctor yourself. Links work for 14 days and only for the invited email address.</p>
        {invites.error && <Callout tone="danger">{invites.error}</Callout>}
        <ul className="space-y-2">
          {(invites.data ?? []).map((i) => (
            <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 rounded-control border border-line p-3 text-sm">
              <div><p className="font-medium">{i.email}</p><p className="text-xs text-muted">Expires {new Date(i.expires_at).toLocaleDateString()}</p></div>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={async () => { const ok = await copyText(inviteLink(i.token)); setCopied(ok ? i.id : null); setTimeout(() => setCopied(null), 2000) }}><Copy className="size-4" aria-hidden /> {copied === i.id ? 'Copied' : 'Copy link'}</Button>
                <Button size="sm" variant="ghost" aria-label={`Revoke invite for ${i.email}`} disabled={busy} onClick={() => void run(() => revokeInvite(i.id), invites.reload)}><Trash2 className="size-4" aria-hidden /></Button>
              </div>
            </li>
          ))}
        </ul>
      </div>
      {error && <Callout tone="danger">{error}</Callout>}
    </Section>
  )
}

function StaffRow({ s, clinicId, isMe, onChanged }: { s: StaffMember; clinicId: string; isMe: boolean; onChanged: () => void }) {
  const [license, setLicense_] = useState(s.license_number ?? '')
  const [verified, setVerified] = useState(s.license_verified)
  const { state, save, reset } = useSave(onChanged)
  const dirty = license !== (s.license_number ?? '') || verified !== s.license_verified
  return (
    <li className="space-y-2 p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">{s.full_name || 'Unnamed'} {isMe && <span className="text-muted">(you)</span>}
          {s.is_admin && <span className="ml-2 rounded-full bg-teal-50 px-2 py-0.5 text-xs text-teal-700">Admin</span>}
          {s.is_doctor && <span className="ml-2 rounded-full bg-teal-100 px-2 py-0.5 text-xs text-teal-900">Doctor</span>}</p>
        {s.is_doctor && !isMe && (
          <Button size="sm" variant="ghost" onClick={() => { if (window.confirm(`Remove ${s.full_name || 'this doctor'} from the clinic? They lose access to its cases.`)) void save(() => removeDoctor(clinicId, s.user_id)) }}><Trash2 className="size-4" aria-hidden /> Remove</Button>
        )}
      </div>
      {s.is_doctor && (
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-56"><Field id={`lic-${s.user_id}`} label="Licence number" value={license} maxLength={60} onChange={(e) => { setLicense_(e.target.value); reset() }} /></div>
          <label className="flex items-center gap-2 pb-2"><input type="checkbox" className="size-4 accent-teal-600" checked={verified} onChange={(e) => { setVerified(e.target.checked); reset() }} /> Licence checked</label>
          <Button size="sm" variant="secondary" disabled={!dirty || state.kind === 'saving'} onClick={() => void save(() => setLicense(clinicId, s.user_id, license.trim() || null, verified))}>Save</Button>
          {state.kind === 'saved' && <span className="pb-2 text-xs text-routine">Saved</span>}
          {state.kind === 'error' && <span className="pb-2 text-xs text-urgent">{state.message}</span>}
        </div>
      )}
    </li>
  )
}
