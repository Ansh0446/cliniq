import type { CaseStatus } from './constants'

export const ACTIVITY_LABEL = {
  case_created: 'You started this intake',
  clinic_transfer: 'Clinic selected',
  assignment: 'A doctor was assigned',
  marked_reviewed: 'A clinician reviewed your summary',
  case_viewed: 'The clinic opened your summary',
} as const

export const STATUS_EVENT: Record<CaseStatus, string> = {
  draft: 'Moved back to draft so you could edit',
  confirmed: 'You confirmed the summary',
  sent: 'Sent to the clinic',
  under_review: 'A doctor started reviewing',
  info_requested: 'The clinic asked for more information',
  consultation_ready: 'Ready for consultation',
}

export const DATE_FORMAT: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }
export const formatWhen = (iso: string) => new Date(iso).toLocaleString(undefined, DATE_FORMAT)
