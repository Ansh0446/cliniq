import { Check, Copy, Plus, Trash2, Wand2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Callout, Section, TextArea } from '@/components/ui/form'
import { formatWhen } from '@/lib/clinical/display'
import type { ClinicalExtraction } from '@/lib/clinical/schemas'
import { copyText } from '@/lib/browser'
import { addNote, deleteNote, updateNote, type NoteRow } from '@/lib/doctor/data'
import { defaultChecklist, parseChecklist, type ChecklistItem } from '@/lib/doctor/inbox'
import { generateSoap, soapToText, type PatientFacts } from '@/lib/doctor/note-text'
import type { Json } from '@/lib/database.types'

interface PanelProps { caseId: string; me: string; notes: NoteRow[]; onChanged: () => void }
const msg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong.')

export function SoapPanel({ caseId, me, notes, onChanged, ex, facts }: PanelProps & { ex: ClinicalExtraction | null; facts: PatientFacts }) {
  const mine = notes.find((n) => n.kind === 'soap_draft' && n.author_id === me)
  const [text, setText] = useState(mine?.body ?? '')
  const [state, setState] = useState<{ kind: 'idle' | 'saving' | 'saved' | 'copied' | 'error'; message?: string }>({ kind: 'idle' })
  const dirty = text !== (mine?.body ?? '')

  function generate() {
    if (!ex) return
    if (text.trim() && !window.confirm('Replace the current draft with a fresh one made from the intake?')) return
    setText(soapToText(generateSoap(ex, facts)))
    setState({ kind: 'idle' })
  }
  async function save() {
    setState({ kind: 'saving' })
    try {
      if (mine) await updateNote(mine.id, { body: text }); else await addNote(caseId, me, 'soap_draft', text)
      setState({ kind: 'saved' }); onChanged()
    } catch (e) { setState({ kind: 'error', message: msg(e) }) }
  }
  async function copy() { setState((await copyText(text)) ? { kind: 'copied' } : { kind: 'error', message: 'Copy was blocked by the browser.' }) }

  return (
    <Section title="SOAP note" hint="A pre-visit draft from the patient's own report. Objective, Assessment and Plan are left for you; nothing is diagnosed or prescribed.">
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={generate} disabled={!ex}><Wand2 className="size-4" aria-hidden /> Generate from intake</Button>
        <Button size="sm" onClick={save} disabled={!dirty || state.kind === 'saving' || !text.trim()}>{state.kind === 'saving' ? 'Saving' : 'Save draft'}</Button>
        <Button variant="ghost" size="sm" onClick={copy} disabled={!text.trim()}><Copy className="size-4" aria-hidden /> Copy</Button>
        <span className="self-center text-xs text-muted" aria-live="polite">{state.kind === 'saved' ? 'Saved' : state.kind === 'copied' ? 'Copied' : dirty ? 'Unsaved changes' : ''}</span>
      </div>
      <TextArea id="soap" aria-label="SOAP note" className="min-h-96 font-mono text-[13px]" value={text} onChange={(e) => { setText(e.target.value); setState({ kind: 'idle' }) }} placeholder="Choose Generate from intake to start a draft." />
      {state.kind === 'error' && <Callout tone="danger">{state.message}</Callout>}
    </Section>
  )
}

export function NotesPanel({ caseId, me, notes, onChanged, nameOf }: PanelProps & { nameOf: (id: string) => string }) {
  const [body, setBody] = useState('')
  const [kind, setKind] = useState<'note' | 'impression'>('note')
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const list = notes.filter((n) => n.kind === 'note' || n.kind === 'impression').sort((a, b) => b.created_at.localeCompare(a.created_at))

  async function run(fn: () => Promise<void>) {
    setBusy(true); setError(null)
    try { await fn(); onChanged() } catch (e) { setError(msg(e)) } finally { setBusy(false) }
  }

  return (
    <Section title="Internal notes" hint="Private to your clinic's doctors. Patients never see these.">
      <div className="space-y-2">
        <TextArea id="new-note" aria-label="New note" className="min-h-24" value={body} maxLength={4000} onChange={(e) => setBody(e.target.value)} placeholder="Write a note for yourself or your colleagues" />
        <div className="flex flex-wrap items-center gap-3">
          <select aria-label="Note type" value={kind} onChange={(e) => setKind(e.target.value as 'note' | 'impression')} className="h-9 rounded-control border border-control bg-panel px-2 text-sm">
            <option value="note">Note</option><option value="impression">Clinical impression (yours)</option>
          </select>
          <Button size="sm" disabled={busy || !body.trim()} onClick={() => run(async () => { await addNote(caseId, me, kind, body.trim()); setBody('') })}><Plus className="size-4" aria-hidden /> Add</Button>
        </div>
      </div>
      {error && <Callout tone="danger">{error}</Callout>}
      <ul className="space-y-3">
        {list.length === 0 && <li className="text-sm text-muted">No notes yet.</li>}
        {list.map((n) => (
          <li key={n.id} className="rounded-control border border-line p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
              <span>{n.author_id === me ? 'You' : nameOf(n.author_id)} · {n.kind === 'impression' ? 'Clinical impression' : 'Note'} · {formatWhen(n.created_at)}</span>
              {n.author_id === me && editing?.id !== n.id && (
                <span className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setEditing({ id: n.id, body: n.body })}>Edit</Button>
                  <Button variant="ghost" size="sm" aria-label="Delete note" disabled={busy} onClick={() => { if (window.confirm('Delete this note?')) void run(() => deleteNote(n.id)) }}><Trash2 className="size-4" aria-hidden /></Button>
                </span>
              )}
            </div>
            {editing?.id === n.id ? (
              <div className="mt-2 space-y-2">
                <TextArea id={`edit-${n.id}`} aria-label="Edit note" className="min-h-24" value={editing.body} maxLength={4000} onChange={(e) => setEditing({ id: n.id, body: e.target.value })} />
                <div className="flex gap-2">
                  <Button size="sm" disabled={busy || !editing.body.trim()} onClick={() => run(async () => { await updateNote(n.id, { body: editing.body.trim() }); setEditing(null) })}>Save</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                </div>
              </div>
            ) : <p className="mt-1.5 whitespace-pre-wrap leading-relaxed">{n.body}</p>}
          </li>
        ))}
      </ul>
    </Section>
  )
}

export function ChecklistPanel({ caseId, me, notes, onChanged, ex }: PanelProps & { ex: ClinicalExtraction | null }) {
  const mine = notes.find((n) => n.kind === 'checklist' && n.author_id === me)
  const [items, setItems] = useState<ChecklistItem[]>(parseChecklist(mine?.checklist))
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [noteId, setNoteId] = useState<string | null>(mine?.id ?? null)

  async function persist(next: ChecklistItem[]) {
    setItems(next); setError(null)
    try {
      if (noteId) await updateNote(noteId, { checklist: next as unknown as Json })
      else { const n = await addNote(caseId, me, 'checklist', '', next as unknown as Json); setNoteId(n.id); onChanged() }
    } catch (e) { setError(msg(e)) }
  }

  return (
    <Section title="Pre-visit checklist" hint="Yours alone. Suggested from the patient's open questions.">
      {items.length === 0 ? (
        <Button variant="secondary" size="sm" onClick={() => void persist(defaultChecklist(ex?.missingInformation ?? []))}>Create checklist</Button>
      ) : (
        <ul className="space-y-1.5">
          {items.map((it, i) => (
            <li key={`${it.text}-${i}`} className="flex items-start gap-2 text-sm">
              <label className="flex flex-1 items-start gap-2">
                <input type="checkbox" className="mt-0.5 size-4 accent-teal-600" checked={it.done} onChange={() => void persist(items.map((x, j) => (j === i ? { ...x, done: !x.done } : x)))} />
                <span className={it.done ? 'text-muted line-through' : ''}>{it.text}</span>
              </label>
              <button type="button" aria-label={`Remove ${it.text}`} className="text-muted hover:text-urgent" onClick={() => void persist(items.filter((_, j) => j !== i))}><Trash2 className="size-4" aria-hidden /></button>
            </li>
          ))}
        </ul>
      )}
      {items.length > 0 && (
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); const t = draft.trim(); if (t) { setDraft(''); void persist([...items, { text: t.slice(0, 200), done: false }]) } }}>
          <input aria-label="New checklist item" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add an item" className="h-9 flex-1 rounded-control border border-control bg-panel px-3 text-sm" />
          <Button type="submit" size="sm" variant="secondary"><Check className="size-4" aria-hidden /> Add</Button>
        </form>
      )}
      {error && <Callout tone="danger">{error}</Callout>}
    </Section>
  )
}
