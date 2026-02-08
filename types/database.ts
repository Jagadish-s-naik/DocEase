/**
 * Supabase Database Types
 * Auto-generated types for database schema
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string | null
          preferred_language: string
          accessibility_settings: Json
          privacy_settings: Json
          auto_delete_days: number | null
          is_guest: boolean
          guest_expires_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name?: string | null
          preferred_language?: string
          accessibility_settings?: Json
          privacy_settings?: Json
          auto_delete_days?: number | null
          is_guest?: boolean
          guest_expires_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string | null
          preferred_language?: string
          accessibility_settings?: Json
          privacy_settings?: Json
          auto_delete_days?: number | null
          is_guest?: boolean
          guest_expires_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      documents: {
        Row: {
          id: string
          user_id: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          storage_path: string
          encrypted: boolean
          page_count: number
          upload_status: string
          processing_status: string
          ocr_confidence: number | null
          document_type: string | null
          language_detected: string | null
          created_at: string
          updated_at: string
          expires_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          storage_path: string
          encrypted?: boolean
          page_count?: number
          upload_status?: string
          processing_status?: string
          ocr_confidence?: number | null
          document_type?: string | null
          language_detected?: string | null
          created_at?: string
          updated_at?: string
          expires_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          file_name?: string
          file_size?: number
          file_type?: string
          file_url?: string
          storage_path?: string
          encrypted?: boolean
          page_count?: number
          upload_status?: string
          processing_status?: string
          ocr_confidence?: number | null
          document_type?: string | null
          language_detected?: string | null
          created_at?: string
          updated_at?: string
          expires_at?: string | null
        }
      }
      document_results: {
        Row: {
          id: string
          document_id: string
          user_id: string
          extracted_text: string
          document_type: string
          classification_confidence: number
          intent_analysis: Json
          simplified_content: Json
          translations: Json
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          document_id: string
          user_id: string
          extracted_text: string
          document_type: string
          classification_confidence: number
          intent_analysis: Json
          simplified_content: Json
          translations?: Json
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          document_id?: string
          user_id?: string
          extracted_text?: string
          document_type?: string
          classification_confidence?: number
          intent_analysis?: Json
          simplified_content?: Json
          translations?: Json
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
      }
      subscriptions: {
        Row: {
          id: string
          user_id: string
          stripe_customer_id: string
          stripe_subscription_id: string
          plan_type: string
          status: string
          current_period_start: string
          current_period_end: string
          cancel_at_period_end: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          stripe_customer_id: string
          stripe_subscription_id: string
          plan_type?: string
          status?: string
          current_period_start: string
          current_period_end: string
          cancel_at_period_end?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string
          plan_type?: string
          status?: string
          current_period_start?: string
          current_period_end?: string
          cancel_at_period_end?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      payments: {
        Row: {
          id: string
          user_id: string | null
          subscription_id: string | null
          stripe_payment_intent_id: string
          amount: number
          currency: string
          status: string
          payment_method: string | null
          invoice_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          subscription_id?: string | null
          stripe_payment_intent_id: string
          amount: number
          currency?: string
          status?: string
          payment_method?: string | null
          invoice_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          subscription_id?: string | null
          stripe_payment_intent_id?: string
          amount?: number
          currency?: string
          status?: string
          payment_method?: string | null
          invoice_url?: string | null
          created_at?: string
        }
      }
      usage_limits: {
        Row: {
          id: string
          user_id: string
          month: string
          documents_processed: number
          plan_type: string
          limit_value: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          month: string
          documents_processed?: number
          plan_type?: string
          limit_value?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          month?: string
          documents_processed?: number
          plan_type?: string
          limit_value?: number
          created_at?: string
          updated_at?: string
        }
      }
      feedback: {
        Row: {
          id: string
          user_id: string
          document_result_id: string
          rating: string
          comment: string | null
          category: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          document_result_id: string
          rating: string
          comment?: string | null
          category?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          document_result_id?: string
          rating?: string
          comment?: string | null
          category?: string | null
          created_at?: string
        }
      }
      admin_logs: {
        Row: {
          id: string
          event_type: string
          event_data: Json
          user_id: string | null
          ip_address: string | null
          user_agent: string | null
          created_at: string
        }
        Insert: {
          id?: string
          event_type: string
          event_data?: Json
          user_id?: string | null
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          event_type?: string
          event_data?: Json
          user_id?: string | null
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
      }
      prompt_templates: {
        Row: {
          id: string
          name: string
          document_type: string
          language: string
          system_prompt: string
          user_prompt_template: string
          variables: Json
          active: boolean
          version: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          document_type: string
          language: string
          system_prompt: string
          user_prompt_template: string
          variables?: Json
          active?: boolean
          version?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          document_type?: string
          language?: string
          system_prompt?: string
          user_prompt_template?: string
          variables?: Json
          active?: boolean
          version?: number
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_usage_limit: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      increment_usage: {
        Args: { p_user_id: string }
        Returns: void
      }
      cleanup_expired_guests: {
        Args: Record<PropertyKey, never>
        Returns: void
      }
      cleanup_expired_documents: {
        Args: Record<PropertyKey, never>
        Returns: void
      }
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
    }
    Enums: {
      supported_language: 'en' | 'hi' | 'ta' | 'te' | 'kn' | 'mr'
      document_type: 'government_notice' | 'bank_letter' | 'loan_document' | 'insurance_document' | 'legal_notice' | 'academic_document' | 'unknown'
      upload_status: 'pending' | 'uploading' | 'completed' | 'failed'
      processing_status: 'queued' | 'ocr_in_progress' | 'classification_in_progress' | 'simplification_in_progress' | 'translation_in_progress' | 'completed' | 'failed'
      plan_type: 'free' | 'paid'
      subscription_status: 'active' | 'past_due' | 'canceled' | 'incomplete' | 'incomplete_expired' | 'trialing' | 'unpaid'
      payment_status: 'succeeded' | 'pending' | 'failed' | 'refunded'
      feedback_rating: 'helpful' | 'not_helpful'
    }
  }
}
