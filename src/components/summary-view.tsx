import type { ReactNode } from 'react'
import type { ClinicalExtraction } from '@/lib/clinical/schemas'
import { TriageBadge } from './ui/badges'

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</h3>
      <div className="mt-1 text-sm leading-relaxed">{children}</div>
    </div>
  )
}

const List = ({ items, empty = 'None reported' }: { items: string[]; empty?: string }) =>
  items.length ? <ul className="list-disc space-y-0.5 pl-5">{items.map((i) => <li key={i}>{i}</li>)}</ul> : <p className="text-muted">{empty}</p>

/** Read-only rendering of a confirmed summary. Shared by the case page and the printable slip. */
export function SummaryView({ ex }: { ex: ClinicalExtraction }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Main problem</h3>
          <p className="mt-1 text-lg font-semibold">{ex.chiefComplaint}</p>
          {ex.onset && <p className="text-sm text-muted">Started: {ex.onset}</p>}
        </div>
        <TriageBadge level={ex.triage.level} />
      </div>

      {ex.redFlags.length > 0 && (
        <Block title="Warning signs flagged">
          <ul className="list-disc pl-5 font-medium text-urgent">{ex.redFlags.map((f) => <li key={f.label}>{f.label}</li>)}</ul>
        </Block>
      )}

      <Block title="What happened"><p>{ex.hpi}</p></Block>

      {ex.symptoms.length > 0 && (
        <Block title="Symptoms">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[28rem] text-left text-sm">
              <thead className="text-xs text-muted"><tr><th className="py-1 pr-3 font-medium">Symptom</th><th className="pr-3 font-medium">Severity</th><th className="pr-3 font-medium">Duration</th><th className="font-medium">Trend</th></tr></thead>
              <tbody>
                {ex.symptoms.map((s, i) => (
                  <tr key={`${s.name}-${i}`} className="border-t border-line align-top">
                    <td className="py-1.5 pr-3">{s.name}{s.bodyRegion ? <span className="text-muted"> ({s.bodyRegion})</span> : null}{s.notes ? <span className="block text-muted">{s.notes}</span> : null}</td>
                    <td className="pr-3">{s.severity ? `${s.severity}/10` : '-'}</td>
                    <td className="pr-3">{s.duration ?? s.onset ?? '-'}</td>
                    <td className="capitalize">{s.progression === 'unknown' ? '-' : s.progression}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Block>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <Block title="Also has"><List items={ex.pertinentPositives} /></Block>
        <Block title="Does not have"><List items={ex.pertinentNegatives} /></Block>
      </div>

      {ex.timeline.length > 0 && (
        <Block title="Timeline">
          <ul className="space-y-0.5">{ex.timeline.map((t, i) => <li key={i}><span className="font-medium">{t.when}:</span> {t.event}</li>)}</ul>
        </Block>
      )}

      <div className="grid gap-5 sm:grid-cols-3">
        <Block title="Past medical history"><List items={ex.pastMedicalHistory} /></Block>
        <Block title="Medications"><List items={ex.medications} /></Block>
        <Block title="Allergies"><List items={ex.allergies} /></Block>
      </div>
    </div>
  )
}
