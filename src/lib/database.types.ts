// Generated from the live Supabase project (cnetwczqfzdssrsrocrt).
// Regenerate after schema changes: supabase gen types typescript --project-id <ref> > src/lib/database.types.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          case_id: string | null
          created_at: string
          from_value: string | null
          id: number
          to_value: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          case_id?: string | null
          created_at?: string
          from_value?: string | null
          id?: never
          to_value?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          case_id?: string | null
          created_at?: string
          from_value?: string | null
          id?: never
          to_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "doctor_inbox"
            referencedColumns: ["id"]
          },
        ]
      }
      case_notes: {
        Row: {
          author_id: string
          body: string
          case_id: string
          checklist: Json | null
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["note_kind"]
          updated_at: string
        }
        Insert: {
          author_id: string
          body?: string
          case_id: string
          checklist?: Json | null
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["note_kind"]
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          case_id?: string
          checklist?: Json | null
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["note_kind"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_notes_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_notes_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "doctor_inbox"
            referencedColumns: ["id"]
          },
        ]
      }
      cases: {
        Row: {
          ai_extraction: Json | null
          ai_signature: string | null
          assigned_doctor_id: string | null
          audio_path: string | null
          chief_complaint: string | null
          clinic_id: string | null
          confirmed_at: string | null
          created_at: string
          emergency_acknowledged_at: string | null
          id: string
          info_request_note: string | null
          patient_id: string
          raw_transcript: string
          red_flags: string[]
          reviewed_at: string | null
          reviewed_by: string | null
          sent_at: string | null
          specialty_hint: string | null
          status: Database["public"]["Enums"]["case_status"]
          structured: Json | null
          transcript_source: string
          triage_level: Database["public"]["Enums"]["triage_level"] | null
          updated_at: string
        }
        Insert: {
          ai_extraction?: Json | null
          ai_signature?: string | null
          assigned_doctor_id?: string | null
          audio_path?: string | null
          chief_complaint?: string | null
          clinic_id?: string | null
          confirmed_at?: string | null
          created_at?: string
          emergency_acknowledged_at?: string | null
          id?: string
          info_request_note?: string | null
          patient_id: string
          raw_transcript?: string
          red_flags?: string[]
          reviewed_at?: string | null
          reviewed_by?: string | null
          sent_at?: string | null
          specialty_hint?: string | null
          status?: Database["public"]["Enums"]["case_status"]
          structured?: Json | null
          transcript_source?: string
          triage_level?: Database["public"]["Enums"]["triage_level"] | null
          updated_at?: string
        }
        Update: {
          ai_extraction?: Json | null
          ai_signature?: string | null
          assigned_doctor_id?: string | null
          audio_path?: string | null
          chief_complaint?: string | null
          clinic_id?: string | null
          confirmed_at?: string | null
          created_at?: string
          emergency_acknowledged_at?: string | null
          id?: string
          info_request_note?: string | null
          patient_id?: string
          raw_transcript?: string
          red_flags?: string[]
          reviewed_at?: string | null
          reviewed_by?: string | null
          sent_at?: string | null
          specialty_hint?: string | null
          status?: Database["public"]["Enums"]["case_status"]
          structured?: Json | null
          transcript_source?: string
          triage_level?: Database["public"]["Enums"]["triage_level"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cases_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_admins: {
        Row: { clinic_id: string; user_id: string }
        Insert: { clinic_id: string; user_id: string }
        Update: { clinic_id?: string; user_id?: string }
        Relationships: [
          {
            foreignKeyName: "clinic_admins_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_doctors: {
        Row: {
          clinic_id: string
          created_at: string
          license_number: string | null
          license_verified: boolean
          specialty: string | null
          user_id: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          license_number?: string | null
          license_verified?: boolean
          specialty?: string | null
          user_id: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          license_number?: string | null
          license_verified?: boolean
          specialty?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_doctors_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_doctors_specialty_fkey"
            columns: ["specialty"]
            isOneToOne: false
            referencedRelation: "specialties"
            referencedColumns: ["slug"]
          },
        ]
      }
      clinic_invites: {
        Row: {
          accepted_at: string | null
          clinic_id: string
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          specialty: string | null
          token: string
        }
        Insert: {
          accepted_at?: string | null
          clinic_id: string
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          specialty?: string | null
          token?: string
        }
        Update: {
          accepted_at?: string | null
          clinic_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          specialty?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_invites_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_invites_specialty_fkey"
            columns: ["specialty"]
            isOneToOne: false
            referencedRelation: "specialties"
            referencedColumns: ["slug"]
          },
        ]
      }
      clinics: {
        Row: {
          accepting_intakes: boolean
          address: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          lat: number | null
          lng: number | null
          name: string
          operating_hours: Json
          phone: string | null
          require_triage_signoff: boolean
          specialties: string[]
          updated_at: string
          verified: boolean
        }
        Insert: {
          accepting_intakes?: boolean
          address?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name: string
          operating_hours?: Json
          phone?: string | null
          require_triage_signoff?: boolean
          specialties?: string[]
          updated_at?: string
          verified?: boolean
        }
        Update: {
          accepting_intakes?: boolean
          address?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
          operating_hours?: Json
          phone?: string | null
          require_triage_signoff?: boolean
          specialties?: string[]
          updated_at?: string
          verified?: boolean
        }
        Relationships: []
      }
      profiles: {
        Row: {
          allergies: string[]
          blood_group: string | null
          chronic_conditions: string[]
          created_at: string
          dob: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          full_name: string | null
          id: string
          medications: string[]
          sex: string | null
          updated_at: string
        }
        Insert: {
          allergies?: string[]
          blood_group?: string | null
          chronic_conditions?: string[]
          created_at?: string
          dob?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          full_name?: string | null
          id: string
          medications?: string[]
          sex?: string | null
          updated_at?: string
        }
        Update: {
          allergies?: string[]
          blood_group?: string | null
          chronic_conditions?: string[]
          created_at?: string
          dob?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          full_name?: string | null
          id?: string
          medications?: string[]
          sex?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      specialties: {
        Row: { label: string; slug: string }
        Insert: { label: string; slug: string }
        Update: { label?: string; slug?: string }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      doctor_inbox: {
        Row: {
          assigned_doctor_id: string | null
          chief_complaint: string | null
          clinic_id: string | null
          effective_triage: Database["public"]["Enums"]["triage_level"] | null
          has_red_flags: boolean | null
          id: string | null
          patient_age: number | null
          patient_name: string | null
          patient_sex: string | null
          red_flags: string[] | null
          reviewed_at: string | null
          sent_at: string | null
          specialty_hint: string | null
          status: Database["public"]["Enums"]["case_status"] | null
          symptom_onset: string | null
          triage_level: Database["public"]["Enums"]["triage_level"] | null
          triage_rank: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cases_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_clinic_invite: { Args: { _token: string }; Returns: string }
      admin_add_self_as_doctor: {
        Args: { _clinic: string; _specialty?: string }
        Returns: undefined
      }
      clinic_staff: {
        Args: { _clinic: string }
        Returns: {
          full_name: string
          is_admin: boolean
          is_doctor: boolean
          license_number: string
          license_verified: boolean
          specialty: string
          user_id: string
        }[]
      }
      delete_my_account: { Args: never; Returns: undefined }
      is_platform_operator: { Args: never; Returns: boolean }
      operator_clinics: {
        Args: never
        Returns: {
          accepting_intakes: boolean
          address: string
          admin_email: string
          admin_name: string
          case_count: number
          created_at: string
          doctor_count: number
          email: string
          id: string
          name: string
          phone: string
          specialties: string[]
          verified: boolean
        }[]
      }
      operator_set_clinic_verified: {
        Args: { _clinic: string; _verified: boolean }
        Returns: undefined
      }
      doctor_assign_case: {
        Args: { _case_id: string; _doctor: string }
        Returns: undefined
      }
      doctor_can_view_case: { Args: { _case_id: string }; Returns: boolean }
      doctor_mark_reviewed: { Args: { _case_id: string }; Returns: undefined }
      doctor_request_info: {
        Args: { _case_id: string; _note: string }
        Returns: undefined
      }
      doctor_set_case_status: {
        Args: {
          _case_id: string
          _status: Database["public"]["Enums"]["case_status"]
        }
        Returns: undefined
      }
      has_role: {
        Args: { _role: Database["public"]["Enums"]["app_role"] }
        Returns: boolean
      }
      is_clinic_admin: { Args: { _clinic: string }; Returns: boolean }
      is_clinic_doctor: { Args: { _clinic: string }; Returns: boolean }
      log_case_view: { Args: { _case_id: string }; Returns: undefined }
      nearby_clinics: {
        Args: {
          _lat: number
          _lng: number
          _radius_km?: number
          _specialty?: string
        }
        Returns: {
          address: string
          distance_km: number
          id: string
          lat: number
          lng: number
          name: string
          phone: string
          specialties: string[]
        }[]
      }
      register_clinic: { Args: { _name: string }; Returns: string }
      staff_can_view_case: {
        Args: { _case: Database["public"]["Tables"]["cases"]["Row"] }
        Returns: boolean
      }
      staff_can_view_patient: { Args: { _patient: string }; Returns: boolean }
    }
    Enums: {
      app_role: "patient" | "doctor" | "clinic_admin"
      case_status:
        | "draft"
        | "confirmed"
        | "sent"
        | "under_review"
        | "info_requested"
        | "consultation_ready"
      note_kind: "note" | "impression" | "checklist" | "soap_draft"
      triage_level: "urgent" | "soon" | "routine"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database["public"]
export type Tables<T extends keyof (PublicSchema["Tables"] & PublicSchema["Views"])> =
  (PublicSchema["Tables"] & PublicSchema["Views"])[T] extends { Row: infer R } ? R : never
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"]
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T]
