import { Plus, Trash2 } from 'lucide-react'
import { SPECIALTIES } from '@/lib/clinical/constants'
import type { ClinicalExtraction, Symptom } from '@/lib/clinical/schemas'
import { Button } from './ui/button'
import { Field } from './ui/field'
import { Section, SelectField, TagInput, TextArea } from './ui/form'

const nul = (v: string) => (v.trim() ? v : null)
const lines = (v: string) => v.split('\n').map((s) => s.trim()).filter(Boolean)
const blankSymptom = (): Symptom => ({ name: '', bodyRegion: null, severity: null, onset: null, duration: null, progression: 'unknown', notes: null })

const SEVERITY = [{ value: '', label: 'Not sure' }, ...Array.from({ length: 10 }, (_, i) => ({ value: String(i + 1), label: `${i + 1} of 10` }))]
const TREND = [
  { value: 'unknown', label: 'Not sure' }, { value: 'improving', label: 'Getting better' },
  { value: 'stable', label: 'Staying the same' }, { value: 'worsening', label: 'Getting worse' },
]

/** Patient-facing editor for the AI summary. Urgency and red flags are deliberately not editable here. */
export function ExtractionEditor({ value, onChange }: { value: ClinicalExtraction; onChange: (v: ClinicalExtraction) => void }) {
  const set = <K extends keyof ClinicalExtraction>(k: K, v: ClinicalExtraction[K]) => onChange({ ...value, [k]: v })
  const setSymptom = (i: number, patch: Partial<Symptom>) =>
    set('symptoms', value.symptoms.map((s, j) => (j === i ? { ...s, ...patch } : s)))

  return (
    <div className="space-y-5">
      <Section title="Main problem">
        <Field id="cc" label="In a few words, what is the problem?" value={value.chiefComplaint} maxLength={200} onChange={(e) => set('chiefComplaint', e.target.value)} />
        <Field id="onset" label="When did it start?" value={value.onset ?? ''} maxLength={120} onChange={(e) => set('onset', nul(e.target.value))} />
        <TextArea id="hpi" label="What happened" hint="Check that this matches what you meant. Fix anything that is wrong." value={value.hpi} maxLength={1500} onChange={(e) => set('hpi', e.target.value)} />
      </Section>

      <Section title="Symptoms" hint="Add, change or remove symptoms.">
        {value.symptoms.map((s, i) => (
          <fieldset key={i} className="space-y-3 rounded-control border border-line p-4">
            <legend className="px-1 text-sm font-semibold">Symptom {i + 1}</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id={`s-name-${i}`} label="Symptom" value={s.name} maxLength={120} onChange={(e) => setSymptom(i, { name: e.target.value })} />
              <Field id={`s-region-${i}`} label="Where on the body" value={s.bodyRegion ?? ''} maxLength={80} onChange={(e) => setSymptom(i, { bodyRegion: nul(e.target.value) })} />
              <SelectField id={`s-sev-${i}`} label="How bad is it" options={SEVERITY} value={s.severity ? String(s.severity) : ''} onChange={(e) => setSymptom(i, { severity: e.target.value ? Number(e.target.value) : null })} />
              <SelectField id={`s-trend-${i}`} label="Is it changing" options={TREND} value={s.progression} onChange={(e) => setSymptom(i, { progression: e.target.value as Symptom['progression'] })} />
              <Field id={`s-onset-${i}`} label="When it started" value={s.onset ?? ''} maxLength={120} onChange={(e) => setSymptom(i, { onset: nul(e.target.value) })} />
              <Field id={`s-dur-${i}`} label="How long it lasts" value={s.duration ?? ''} maxLength={120} onChange={(e) => setSymptom(i, { duration: nul(e.target.value) })} />
            </div>
            <Field id={`s-notes-${i}`} label="Anything else about this symptom" value={s.notes ?? ''} maxLength={300} onChange={(e) => setSymptom(i, { notes: nul(e.target.value) })} />
            <Button type="button" variant="ghost" size="sm" onClick={() => set('symptoms', value.symptoms.filter((_, j) => j !== i))}>
              <Trash2 className="size-4" aria-hidden /> Remove symptom
            </Button>
          </fieldset>
        ))}
        {value.symptoms.length < 20 && (
          <Button type="button" variant="secondary" size="sm" onClick={() => set('symptoms', [...value.symptoms, blankSymptom()])}>
            <Plus className="size-4" aria-hidden /> Add a symptom
          </Button>
        )}
      </Section>

      <Section title="Timeline" hint="Key moments in order, for example when a fever started or a medicine was taken.">
        {value.timeline.map((t, i) => (
          <div key={i} className="grid items-end gap-3 sm:grid-cols-[10rem_1fr_auto]">
            <Field id={`t-when-${i}`} label="When" value={t.when} maxLength={80} onChange={(e) => set('timeline', value.timeline.map((x, j) => (j === i ? { ...x, when: e.target.value } : x)))} />
            <Field id={`t-event-${i}`} label="What happened" value={t.event} maxLength={200} onChange={(e) => set('timeline', value.timeline.map((x, j) => (j === i ? { ...x, event: e.target.value } : x)))} />
            <Button type="button" variant="ghost" size="sm" aria-label={`Remove timeline entry ${i + 1}`} onClick={() => set('timeline', value.timeline.filter((_, j) => j !== i))}><Trash2 className="size-4" aria-hidden /></Button>
          </div>
        ))}
        {value.timeline.length < 15 && (
          <Button type="button" variant="secondary" size="sm" onClick={() => set('timeline', [...value.timeline, { when: '', event: '' }])}>
            <Plus className="size-4" aria-hidden /> Add an entry
          </Button>
        )}
      </Section>

      <Section title="What else is going on" hint="One item per line.">
        <TextArea id="pos" label="Other things you have noticed" className="min-h-20" value={value.pertinentPositives.join('\n')} onChange={(e) => set('pertinentPositives', lines(e.target.value).slice(0, 20))} />
        <TextArea id="neg" label="Things you do not have" hint="For example: no fever, no vomiting." className="min-h-20" value={value.pertinentNegatives.join('\n')} onChange={(e) => set('pertinentNegatives', lines(e.target.value).slice(0, 20))} />
      </Section>

      <Section title="Medical background" hint="Filled in from your health profile. Change anything that is out of date.">
        <TagInput id="pmh" label="Past medical history" value={value.pastMedicalHistory} onChange={(v) => set('pastMedicalHistory', v)} placeholder="Type and press Enter" />
        <TagInput id="meds" label="Medicines you take" value={value.medications} onChange={(v) => set('medications', v)} placeholder="Type and press Enter" />
        <TagInput id="allergies" label="Allergies" value={value.allergies} onChange={(v) => set('allergies', v)} placeholder="Type and press Enter" />
      </Section>

      <Section title="Type of doctor" hint="Used to suggest clinics. You can change it.">
        <SelectField id="spec" label="Best match" options={SPECIALTIES.map((s) => ({ value: s.slug, label: s.label }))}
          value={value.triage.suggestedSpecialty}
          onChange={(e) => onChange({ ...value, triage: { ...value.triage, suggestedSpecialty: e.target.value as typeof value.triage.suggestedSpecialty } })} />
      </Section>
    </div>
  )
}
