import { createFileRoute } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Callout, Section, SelectField, Spinner, TagInput } from '@/components/ui/form'
import { getProfile, saveProfile, type ProfileInput, type ProfileRow } from '@/lib/data'
import { useAsync } from '@/lib/hooks/use-async'
import { nameError, phoneError } from '@/lib/validators'
import { privateHead } from '@/lib/site'

export const Route = createFileRoute('/app/profile')({
  head: () => privateHead('Health profile'), component: ProfilePage })

const SEX = [
  { value: '', label: 'Select' }, { value: 'female', label: 'Female' }, { value: 'male', label: 'Male' },
  { value: 'other', label: 'Other' }, { value: 'unspecified', label: 'Prefer not to say' },
]
const BLOOD = [{ value: '', label: 'Not sure' }, ...['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((b) => ({ value: b, label: b }))]

function ProfilePage() {
  const profile = useAsync(getProfile, [])
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Health profile</h1>
        <p className="mt-1 text-sm text-muted">Saved once, filled in on every intake. Only clinics you send a case to can see it, and only with that case.</p>
      </div>
      {profile.loading && !profile.data && <Spinner />}
      {profile.error && <Callout tone="danger" title="Could not load your profile">{profile.error}</Callout>}
      {profile.data && <ProfileForm initial={profile.data} />}
    </div>
  )
}

function ProfileForm({ initial }: { initial: ProfileRow }) {
  const [v, setV] = useState<ProfileInput>({
    full_name: initial.full_name, dob: initial.dob, sex: initial.sex, blood_group: initial.blood_group,
    emergency_contact_name: initial.emergency_contact_name, emergency_contact_phone: initial.emergency_contact_phone,
    allergies: initial.allergies, chronic_conditions: initial.chronic_conditions, medications: initial.medications,
  })
  const [state, setState] = useState<{ kind: 'idle' | 'saving' | 'saved' | 'error'; message?: string }>({ kind: 'idle' })
  const set = <K extends keyof ProfileInput>(k: K, val: ProfileInput[K]) => { setV((p) => ({ ...p, [k]: val })); setState({ kind: 'idle' }) }
  const text = (s: string) => (s.trim() ? s : null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (v.dob) {
      const d = new Date(v.dob)
      if (Number.isNaN(d.getTime()) || d > new Date() || d.getFullYear() < 1900) { setState({ kind: 'error', message: 'Enter a valid date of birth.' }); return }
    }
    const pe = phoneError(v.emergency_contact_phone ?? '')
    if (pe) { setState({ kind: 'error', message: `Emergency contact phone: ${pe}` }); return }
    const ne = nameError(v.full_name ?? '')
    if (ne) { setState({ kind: 'error', message: `Full name: ${ne}` }); return }
    setState({ kind: 'saving' })
    try {
      await saveProfile({ ...v, full_name: v.full_name?.trim() || null })
      setState({ kind: 'saved' })
    } catch (err) {
      setState({ kind: 'error', message: err instanceof Error ? err.message : 'Could not save.' })
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <Section title="About you">
        <Field id="name" label="Full name" autoComplete="name" value={v.full_name ?? ''} maxLength={120} onChange={(e) => set('full_name', e.target.value)} />
        <div className="grid gap-4 sm:grid-cols-3">
          <Field id="dob" type="date" label="Date of birth" max={new Date().toISOString().slice(0, 10)} value={v.dob ?? ''} onChange={(e) => set('dob', text(e.target.value))} />
          <SelectField id="sex" label="Sex" options={SEX} value={v.sex ?? ''} onChange={(e) => set('sex', text(e.target.value))} />
          <SelectField id="blood" label="Blood group" options={BLOOD} value={v.blood_group ?? ''} onChange={(e) => set('blood_group', text(e.target.value))} />
        </div>
      </Section>

      <Section title="Medical background">
        <TagInput id="allergies" label="Allergies" hint="Medicines, foods or anything else. Press Enter after each one." value={v.allergies} onChange={(x) => set('allergies', x)} placeholder="For example: penicillin" />
        <TagInput id="conditions" label="Long-term conditions" value={v.chronic_conditions} onChange={(x) => set('chronic_conditions', x)} placeholder="For example: asthma" />
        <TagInput id="meds" label="Medicines you take regularly" value={v.medications} onChange={(x) => set('medications', x)} placeholder="For example: metformin 500 mg" />
      </Section>

      <Section title="Emergency contact">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="ec-name" label="Name" value={v.emergency_contact_name ?? ''} maxLength={120} onChange={(e) => set('emergency_contact_name', text(e.target.value))} />
          <Field id="ec-phone" type="tel" label="Phone" autoComplete="tel" value={v.emergency_contact_phone ?? ''} maxLength={20} onChange={(e) => set('emergency_contact_phone', text(e.target.value))} />
        </div>
      </Section>

      {state.kind === 'error' && <Callout tone="danger">{state.message}</Callout>}
      {state.kind === 'saved' && <Callout tone="success">Profile saved.</Callout>}
      <Button type="submit" size="lg" disabled={state.kind === 'saving'}>{state.kind === 'saving' ? 'Saving' : 'Save profile'}</Button>
    </form>
  )
}
