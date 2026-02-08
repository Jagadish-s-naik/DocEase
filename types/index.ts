// ============================================
// DATABASE TYPES (matching Supabase schema)
// ============================================

export interface User {
  id: string;
  email: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
  is_guest: boolean;
  guest_expires_at: string | null;
}

export interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  preferred_language: SupportedLanguage;
  accessibility_settings: AccessibilitySettings;
  privacy_settings: PrivacySettings;
  auto_delete_days: number | null;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  user_id: string;
  file_name: string;
  file_size: number;
  file_type: string;
  file_url: string;
  storage_path: string;
  encrypted: boolean;
  page_count: number;
  upload_status: UploadStatus;
  processing_status: ProcessingStatus;
  ocr_confidence: number | null;
  document_type: DocumentType | null;
  language_detected: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
}

export interface DocumentResult {
  id: string;
  document_id: string;
  user_id: string;
  extracted_text: string;
  document_type: DocumentType;
  classification_confidence: number;
  intent_analysis: IntentAnalysis;
  simplified_content: SimplifiedContent;
  translations: Record<SupportedLanguage, SimplifiedContent>;
  metadata: DocumentMetadata;
  created_at: string;
  updated_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  stripe_customer_id: string;
  stripe_subscription_id: string;
  plan_type: PlanType;
  status: SubscriptionStatus;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  user_id: string;
  subscription_id: string | null;
  stripe_payment_intent_id: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  payment_method: string;
  invoice_url: string | null;
  created_at: string;
}

export interface UsageLimit {
  id: string;
  user_id: string;
  month: string; // YYYY-MM format
  documents_processed: number;
  plan_type: PlanType;
  limit: number;
  created_at: string;
  updated_at: string;
}

export interface Feedback {
  id: string;
  user_id: string;
  document_result_id: string;
  rating: 'helpful' | 'not_helpful';
  comment: string | null;
  category: string | null;
  created_at: string;
}

export interface AdminLog {
  id: string;
  event_type: string;
  event_data: Record<string, any>;
  user_id: string | null;
  ip_address: string | null;
  created_at: string;
}

// ============================================
// ENUMS & CONSTANTS
// ============================================

export enum SupportedLanguage {
  ENGLISH = 'en',
  HINDI = 'hi',
  TAMIL = 'ta',
  TELUGU = 'te',
  KANNADA = 'kn',
  MARATHI = 'mr',
}

export enum DocumentType {
  GOVERNMENT_NOTICE = 'government_notice',
  BANK_LETTER = 'bank_letter',
  LOAN_DOCUMENT = 'loan_document',
  INSURANCE_DOCUMENT = 'insurance_document',
  LEGAL_NOTICE = 'legal_notice',
  ACADEMIC_DOCUMENT = 'academic_document',
  UNKNOWN = 'unknown',
}

export enum UploadStatus {
  PENDING = 'pending',
  UPLOADING = 'uploading',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum ProcessingStatus {
  QUEUED = 'queued',
  OCR_IN_PROGRESS = 'ocr_in_progress',
  CLASSIFICATION_IN_PROGRESS = 'classification_in_progress',
  SIMPLIFICATION_IN_PROGRESS = 'simplification_in_progress',
  TRANSLATION_IN_PROGRESS = 'translation_in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum PlanType {
  FREE = 'free',
  PAID = 'paid',
}

export enum SubscriptionStatus {
  ACTIVE = 'active',
  PAST_DUE = 'past_due',
  CANCELED = 'canceled',
  INCOMPLETE = 'incomplete',
  INCOMPLETE_EXPIRED = 'incomplete_expired',
  TRIALING = 'trialing',
  UNPAID = 'unpaid',
}

export enum PaymentStatus {
  SUCCEEDED = 'succeeded',
  PENDING = 'pending',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

// ============================================
// COMPLEX TYPES
// ============================================

export interface AccessibilitySettings {
  high_contrast: boolean;
  large_fonts: boolean;
  screen_reader_optimized: boolean;
  font_size: 'normal' | 'large' | 'extra-large';
}

export interface PrivacySettings {
  store_history: boolean;
  allow_analytics: boolean;
  data_retention_days: number;
}

export interface IntentAnalysis {
  action_required: boolean;
  deadline: string | null;
  money_involved: number | null;
  currency: string | null;
  penalty_risk: 'none' | 'low' | 'medium' | 'high';
  urgency: 'low' | 'medium' | 'high' | 'critical';
  summary: string;
}

export interface SimplifiedContent {
  language: SupportedLanguage;
  sections: {
    what_is_this: string;
    action_required: string;
    deadlines: string;
    money_matters: string;
    risks_penalties: string;
    simple_explanation: string;
    bullet_points: string[];
    examples: string[];
  };
  confidence_score: number;
  source_references: SourceReference[];
  disclaimers: string[];
}

export interface SourceReference {
  section: string;
  original_text: string;
  page_number: number | null;
  confidence: number;
}

export interface DocumentMetadata {
  processing_time_ms: number;
  ocr_engine: string;
  llm_model: string;
  classification_method: string;
  warnings: string[];
  quality_score: number;
}

// ============================================
// API TYPES
// ============================================

export interface UploadDocumentRequest {
  file: File;
  userId: string | null;
  isGuest: boolean;
}

export interface UploadDocumentResponse {
  success: boolean;
  documentId: string;
  message: string;
  uploadUrl?: string;
}

export interface ProcessDocumentRequest {
  documentId: string;
  targetLanguages: SupportedLanguage[];
}

export interface ProcessDocumentResponse {
  success: boolean;
  resultId: string;
  message: string;
  estimatedTime?: number;
}

export interface GetDocumentResultRequest {
  documentId: string;
  resultId: string;
}

export interface GetDocumentResultResponse {
  success: boolean;
  result: DocumentResult | null;
  message: string;
}

export interface CreateSubscriptionRequest {
  priceId: string;
  paymentMethodId: string;
}

export interface CreateSubscriptionResponse {
  success: boolean;
  subscriptionId: string;
  clientSecret?: string;
  message: string;
}

export interface CheckUsageLimitResponse {
  allowed: boolean;
  current: number;
  limit: number;
  planType: PlanType;
  message: string;
}

// ============================================
// FORM TYPES
// ============================================

export interface LoginFormData {
  phone?: string;
  email?: string;
  otp?: string;
}

export interface ProfileFormData {
  full_name: string;
  preferred_language: SupportedLanguage;
  accessibility_settings: AccessibilitySettings;
  privacy_settings: PrivacySettings;
  auto_delete_days: number | null;
}

export interface FeedbackFormData {
  rating: 'helpful' | 'not_helpful';
  comment: string;
  category: string;
}

// ============================================
// OCR SERVICE TYPES
// ============================================

export interface OCRConfig {
  language: string;
  quality_threshold: number;
  preprocess: boolean;
  auto_rotate: boolean;
  denoise: boolean;
}

export interface OCRResult {
  text: string;
  confidence: number;
  language: string;
  page_count: number;
  processing_time_ms: number;
  warnings: string[];
  pages: OCRPageResult[];
}

export interface OCRPageResult {
  page_number: number;
  text: string;
  confidence: number;
  rotation_applied: number;
  quality_score: number;
}

// ============================================
// LLM SERVICE TYPES
// ============================================

export interface LLMPromptTemplate {
  system: string;
  user: string;
  variables: Record<string, string>;
}

export interface LLMResponse {
  content: string;
  model: string;
  tokens_used: number;
  finish_reason: string;
}

export interface ClassificationResult {
  document_type: DocumentType;
  confidence: number;
  intent_analysis: IntentAnalysis;
  reasoning: string;
}

export interface SimplificationResult {
  simplified_content: SimplifiedContent;
  model_used: string;
  tokens_used: number;
  warnings: string[];
}

// ============================================
// UTILITY TYPES
// ============================================

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface SearchFilters {
  document_type?: DocumentType;
  date_from?: string;
  date_to?: string;
  language?: SupportedLanguage;
  search_query?: string;
}

export interface AnalyticsData {
  total_documents: number;
  documents_by_type: Record<DocumentType, number>;
  documents_by_language: Record<SupportedLanguage, number>;
  active_subscriptions: number;
  revenue_monthly: number;
  average_processing_time: number;
  error_rate: number;
}

// ============================================
// ERROR TYPES
// ============================================

export class AppError extends Error {
  constructor(
    public code: string,
    public message: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export enum ErrorCode {
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UPLOAD_FAILED = 'UPLOAD_FAILED',
  OCR_FAILED = 'OCR_FAILED',
  CLASSIFICATION_FAILED = 'CLASSIFICATION_FAILED',
  SIMPLIFICATION_FAILED = 'SIMPLIFICATION_FAILED',
  TRANSLATION_FAILED = 'TRANSLATION_FAILED',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  LIMIT_EXCEEDED = 'LIMIT_EXCEEDED',
  SERVER_ERROR = 'SERVER_ERROR',
}
