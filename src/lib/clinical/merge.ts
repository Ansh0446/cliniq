import { TRIAGE_RANK, type TriageLevel } from './constants'
import type { ClinicalExtraction, RedFlag } from './schemas'
import type { RedFlagScan } from './redflags'

/** Most urgent level wins. Rules can raise urgency; the model can never lower it. */
export function mostUrgent(a: TriageLevel, b: TriageLevel): TriageLevel {
  return TRIAGE_RANK[a] <= TRIAGE_RANK[b] ? a : b
}

export function mergeWithRules(
  extraction: Omit<ClinicalExtraction, 'redFlags'> & { redFlags: Omit<RedFlag, 'source'>[] },
  scan: RedFlagScan,
): ClinicalExtraction {
  const modelFlags: RedFlag[] = extraction.redFlags.map((f) => ({ ...f, source: 'model' as const }))
  const seen = new Set(scan.flags.map((f) => f.label.toLowerCase()))
  const redFlags = [...scan.flags, ...modelFlags.filter((f) => !seen.has(f.label.toLowerCase()))]

  let level = extraction.triage.level
  let rationale = extraction.triage.rationale
  if (scan.emergency) {
    level = mostUrgent(level, 'urgent')
    if (extraction.triage.level !== 'urgent') {
      rationale = `Urgent because the description matches a red-flag rule (${scan.flags.map((f) => f.label).join(', ')}). ${rationale}`.slice(0, 400)
    }
  }
  return { ...extraction, redFlags, triage: { ...extraction.triage, level, rationale } }
}
