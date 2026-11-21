import { getBrowserSupabase } from './supabase'

const db = () => getBrowserSupabase()
export interface OperatorClinic {
  id: string; name: string; address: string | null; phone: string | null; email: string | null; specialties: string[]
  verified: boolean; accepting_intakes: boolean; created_at: string
  admin_name: string | null; admin_email: string | null; doctor_count: number; case_count: number
}

export async function isOperator(): Promise<boolean> {
  const { data, error } = await db().rpc('is_platform_operator')
  return !error && data === true
}
export async function listOperatorClinics(): Promise<OperatorClinic[]> {
  const { data, error } = await db().rpc('operator_clinics')
  if (error) throw new Error(error.message)
  return (data ?? []) as OperatorClinic[]
}
export async function setClinicVerified(id: string, verified: boolean): Promise<void> {
  const { error } = await db().rpc('operator_set_clinic_verified', { _clinic: id, _verified: verified })
  if (error) throw new Error(error.message)
}
