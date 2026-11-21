export const ROLES = ['patient', 'doctor', 'clinic_admin'] as const
export type AppRole = (typeof ROLES)[number]

export const TRIAGE_LEVELS = ['urgent', 'soon', 'routine'] as const
export type TriageLevel = (typeof TRIAGE_LEVELS)[number]

export const CASE_STATUSES = [
  'draft',
  'confirmed',
  'sent',
  'under_review',
  'info_requested',
  'consultation_ready',
] as const
export type CaseStatus = (typeof CASE_STATUSES)[number]

export const STATUS_LABEL: Record<CaseStatus, string> = {
  draft: 'Draft',
  confirmed: 'Confirmed',
  sent: 'Sent to clinic',
  under_review: 'Under doctor review',
  info_requested: 'More information requested',
  consultation_ready: 'Consultation ready',
}

export const TRIAGE_LABEL: Record<TriageLevel, string> = {
  urgent: 'Urgent',
  soon: 'Soon',
  routine: 'Routine',
}

export const TRIAGE_RANK: Record<TriageLevel, number> = { urgent: 0, soon: 1, routine: 2 }

/**
 * Crisis lines are regional. Verify these for each deployment before launch.
 * Tele-MANAS is India's government tele-mental-health service.
 */
export const CRISIS_LINES = [{ name: 'Tele-MANAS (India)', number: '14416' }] as const

/** Shown in the emergency modal. Edit per deployment region. */
export const EMERGENCY_NUMBERS = ['911', '112'] as const

export const SPECIALTIES = [
  { slug: 'general_practice', label: 'General practice' },
  { slug: 'pediatrics', label: 'Pediatrics' },
  { slug: 'cardiology', label: 'Cardiology' },
  { slug: 'orthopedics', label: 'Orthopedics' },
  { slug: 'neurology', label: 'Neurology' },
  { slug: 'dermatology', label: 'Dermatology' },
  { slug: 'ent', label: 'Ear, nose and throat' },
  { slug: 'gastroenterology', label: 'Gastroenterology' },
  { slug: 'obstetrics_gynecology', label: 'Obstetrics and gynecology' },
  { slug: 'psychiatry', label: 'Psychiatry' },
  { slug: 'ophthalmology', label: 'Ophthalmology' },
  { slug: 'pulmonology', label: 'Pulmonology' },
] as const
export const SPECIALTY_SLUGS = SPECIALTIES.map((s) => s.slug) as [
  (typeof SPECIALTIES)[number]['slug'],
  ...(typeof SPECIALTIES)[number]['slug'][],
]
