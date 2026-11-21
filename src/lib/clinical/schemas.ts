import { z } from 'zod'
import { SPECIALTY_SLUGS, TRIAGE_LEVELS } from './constants'

export const SCHEMA_VERSION = 1

const text = (max = 400) => z.string().trim().max(max)

export const symptomSchema = z.object({
  name: text(120).min(1),
  bodyRegion: text(80).nullable(),
  severity: z.number().int().min(1).max(10).nullable(),
  onset: text(120).nullable(),
  duration: text(120).nullable(),
  progression: z.enum(['improving', 'stable', 'worsening', 'unknown']),
  notes: text(300).nullable(),
})

export const redFlagSchema = z.object({
  label: text(120).min(1),
  /** Short phrase from the patient's own words that triggered the flag. */
  evidence: text(200),
  source: z.enum(['rule', 'model']),
})

/**
 * Structured pre-consultation record. Observations only: there is deliberately
 * no diagnosis, differential, or treatment field anywhere in this schema.
 */
export const clinicalExtractionSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION).default(SCHEMA_VERSION),
  chiefComplaint: text(200).min(1),
  onset: text(120).nullable(),
  hpi: text(1500),
  symptoms: z.array(symptomSchema).max(20),
  pertinentPositives: z.array(text(200)).max(20),
  pertinentNegatives: z.array(text(200)).max(20),
  timeline: z.array(z.object({ when: text(80), event: text(200) })).max(15),
  pastMedicalHistory: z.array(text(200)).max(20),
  medications: z.array(text(200)).max(30),
  allergies: z.array(text(200)).max(20),
  redFlags: z.array(redFlagSchema).max(10),
  triage: z.object({
    level: z.enum(TRIAGE_LEVELS),
    rationale: text(400),
    suggestedSpecialty: z.enum(SPECIALTY_SLUGS),
  }),
  /** Questions the patient could still answer to make the record more useful. */
  missingInformation: z.array(text(200)).max(8),
})
export type ClinicalExtraction = z.infer<typeof clinicalExtractionSchema>
export type Symptom = z.infer<typeof symptomSchema>
export type RedFlag = z.infer<typeof redFlagSchema>

/** What the model is asked to produce (source is stamped by the server). */
export const modelOutputSchema = clinicalExtractionSchema.extend({
  redFlags: z.array(redFlagSchema.omit({ source: true })).max(10),
})

export const profileSnapshotSchema = z.object({
  allergies: z.array(text(120)).max(30).default([]),
  medications: z.array(text(120)).max(40).default([]),
  chronicConditions: z.array(text(120)).max(30).default([]),
  age: z.number().int().min(0).max(130).nullable().default(null),
  sex: z.enum(['female', 'male', 'other', 'unspecified']).nullable().default(null),
})
export type ProfileSnapshot = z.infer<typeof profileSnapshotSchema>

export const structureIntakeInputSchema = z.object({
  /** The draft case the result belongs to. The signature is bound to it. */
  caseId: z.string().uuid(),
  transcript: z.string().trim().min(10, 'Describe your symptoms in a little more detail').max(8000),
  profile: profileSnapshotSchema.default({
    allergies: [], medications: [], chronicConditions: [], age: null, sex: null,
  }),
})
export type StructureIntakeInput = z.infer<typeof structureIntakeInputSchema>

export const structureIntakeResultSchema = z.object({
  extraction: clinicalExtractionSchema,
  /** HMAC over the extraction, written by the server. Doctors use it to detect altered AI output. */
  signature: z.string(),
  /** True when a deterministic rule matched; the UI must show the emergency modal. */
  emergency: z.boolean(),
  emergencyCategories: z.array(z.string()),
})
export type StructureIntakeResult = z.infer<typeof structureIntakeResultSchema>
