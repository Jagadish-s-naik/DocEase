-- ============================================
-- DOCEASE DATABASE SCHEMA
-- AI Document Simplifier for Common People
-- Production-Ready Schema with RLS
-- ============================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE supported_language AS ENUM ('en', 'hi', 'ta', 'te', 'kn', 'mr');
CREATE TYPE document_type AS ENUM (
  'government_notice',
  'bank_letter',
  'loan_document',
  'insurance_document',
  'legal_notice',
  'academic_document',
  'unknown'
);
CREATE TYPE upload_status AS ENUM ('pending', 'uploading', 'completed', 'failed');
CREATE TYPE processing_status AS ENUM (
  'queued',
  'ocr_in_progress',
  'classification_in_progress',
  'simplification_in_progress',
  'translation_in_progress',
  'completed',
  'failed'
);
CREATE TYPE plan_type AS ENUM ('free', 'paid');
CREATE TYPE subscription_status AS ENUM (
  'active',
  'past_due',
  'canceled',
  'incomplete',
  'incomplete_expired',
  'trialing',
  'unpaid'
);
CREATE TYPE payment_status AS ENUM ('succeeded', 'pending', 'failed', 'refunded');
CREATE TYPE feedback_rating AS ENUM ('helpful', 'not_helpful');

-- ============================================
-- PROFILES TABLE
-- Extends Supabase auth.users
-- ============================================

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  preferred_language supported_language DEFAULT 'en' NOT NULL,
  accessibility_settings JSONB DEFAULT '{
    "high_contrast": false,
    "large_fonts": false,
    "screen_reader_optimized": false,
    "font_size": "normal"
  }'::jsonb NOT NULL,
  privacy_settings JSONB DEFAULT '{
    "store_history": true,
    "allow_analytics": true,
    "data_retention_days": 90
  }'::jsonb NOT NULL,
  auto_delete_days INTEGER DEFAULT 90,
  is_guest BOOLEAN DEFAULT false,
  guest_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_profiles_guest ON profiles(is_guest, guest_expires_at) WHERE is_guest = true;

-- ============================================
-- DOCUMENTS TABLE
-- Stores uploaded document metadata
-- ============================================

CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_type TEXT NOT NULL,
  file_url TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  encrypted BOOLEAN DEFAULT true NOT NULL,
  page_count INTEGER DEFAULT 1 NOT NULL,
  upload_status upload_status DEFAULT 'pending' NOT NULL,
  processing_status processing_status DEFAULT 'queued' NOT NULL,
  ocr_confidence DECIMAL(5,2),
  document_type document_type,
  language_detected TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  expires_at TIMESTAMPTZ,
  CONSTRAINT valid_file_size CHECK (file_size > 0 AND file_size <= 10485760), -- 10MB max
  CONSTRAINT valid_page_count CHECK (page_count > 0 AND page_count <= 50),
  CONSTRAINT valid_ocr_confidence CHECK (ocr_confidence >= 0 AND ocr_confidence <= 100)
);

CREATE INDEX idx_documents_user_id ON documents(user_id);
CREATE INDEX idx_documents_status ON documents(processing_status);
CREATE INDEX idx_documents_created_at ON documents(created_at DESC);
CREATE INDEX idx_documents_expires_at ON documents(expires_at) WHERE expires_at IS NOT NULL;

-- ============================================
-- DOCUMENT_RESULTS TABLE
-- Stores OCR, classification, and simplification results
-- ============================================

CREATE TABLE document_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  extracted_text TEXT NOT NULL,
  document_type document_type NOT NULL,
  classification_confidence DECIMAL(5,2) NOT NULL,
  intent_analysis JSONB NOT NULL,
  simplified_content JSONB NOT NULL,
  translations JSONB DEFAULT '{}'::jsonb NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT valid_classification_confidence CHECK (classification_confidence >= 0 AND classification_confidence <= 100),
  CONSTRAINT unique_document_result UNIQUE(document_id)
);

CREATE INDEX idx_document_results_user_id ON document_results(user_id);
CREATE INDEX idx_document_results_document_type ON document_results(document_type);
CREATE INDEX idx_document_results_created_at ON document_results(created_at DESC);

-- ============================================
-- SUBSCRIPTIONS TABLE
-- Manages user subscriptions
-- ============================================

CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  stripe_customer_id TEXT NOT NULL,
  stripe_subscription_id TEXT NOT NULL UNIQUE,
  plan_type plan_type DEFAULT 'paid' NOT NULL,
  status subscription_status DEFAULT 'active' NOT NULL,
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  cancel_at_period_end BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE UNIQUE INDEX idx_unique_user_active_subscription ON subscriptions(user_id, status) 
  WHERE status IN ('active', 'trialing');

-- ============================================
-- PAYMENTS TABLE
-- Tracks all payment transactions
-- ============================================

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  stripe_payment_intent_id TEXT NOT NULL UNIQUE,
  amount INTEGER NOT NULL, -- Amount in smallest currency unit (paise for INR)
  currency TEXT DEFAULT 'inr' NOT NULL,
  status payment_status DEFAULT 'pending' NOT NULL,
  payment_method TEXT,
  invoice_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT valid_amount CHECK (amount > 0)
);

CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_subscription_id ON payments(subscription_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_created_at ON payments(created_at DESC);

-- ============================================
-- USAGE_LIMITS TABLE
-- Tracks monthly document processing limits
-- ============================================

CREATE TABLE usage_limits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  month TEXT NOT NULL, -- Format: YYYY-MM
  documents_processed INTEGER DEFAULT 0 NOT NULL,
  plan_type plan_type DEFAULT 'free' NOT NULL,
  limit_value INTEGER DEFAULT 3 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT valid_documents_processed CHECK (documents_processed >= 0),
  CONSTRAINT unique_user_month UNIQUE(user_id, month)
);

CREATE INDEX idx_usage_limits_user_month ON usage_limits(user_id, month);

-- ============================================
-- FEEDBACK TABLE
-- Stores user feedback on document results
-- ============================================

CREATE TABLE feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  document_result_id UUID REFERENCES document_results(id) ON DELETE CASCADE NOT NULL,
  rating feedback_rating NOT NULL,
  comment TEXT,
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_feedback_user_id ON feedback(user_id);
CREATE INDEX idx_feedback_result_id ON feedback(document_result_id);
CREATE INDEX idx_feedback_rating ON feedback(rating);
CREATE INDEX idx_feedback_created_at ON feedback(created_at DESC);

-- ============================================
-- ADMIN_LOGS TABLE
-- Audit trail for system events
-- ============================================

CREATE TABLE admin_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type TEXT NOT NULL,
  event_data JSONB DEFAULT '{}'::jsonb NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_admin_logs_event_type ON admin_logs(event_type);
CREATE INDEX idx_admin_logs_user_id ON admin_logs(user_id);
CREATE INDEX idx_admin_logs_created_at ON admin_logs(created_at DESC);

-- ============================================
-- PROMPT_TEMPLATES TABLE
-- Manages AI prompt templates (admin only)
-- ============================================

CREATE TABLE prompt_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  document_type document_type NOT NULL,
  language supported_language NOT NULL,
  system_prompt TEXT NOT NULL,
  user_prompt_template TEXT NOT NULL,
  variables JSONB DEFAULT '[]'::jsonb NOT NULL,
  active BOOLEAN DEFAULT true NOT NULL,
  version INTEGER DEFAULT 1 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_prompt_templates_doc_type ON prompt_templates(document_type, language);
CREATE INDEX idx_prompt_templates_active ON prompt_templates(active);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Function: Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all relevant tables
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_document_results_updated_at BEFORE UPDATE ON document_results
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_usage_limits_updated_at BEFORE UPDATE ON usage_limits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_prompt_templates_updated_at BEFORE UPDATE ON prompt_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function: Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, preferred_language)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', 'en');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Function: Clean up expired guest accounts
CREATE OR REPLACE FUNCTION cleanup_expired_guests()
RETURNS void AS $$
BEGIN
  DELETE FROM auth.users
  WHERE id IN (
    SELECT id FROM profiles
    WHERE is_guest = true
    AND guest_expires_at < NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Auto-delete expired documents
CREATE OR REPLACE FUNCTION cleanup_expired_documents()
RETURNS void AS $$
BEGIN
  DELETE FROM documents
  WHERE expires_at IS NOT NULL
  AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Check usage limit
CREATE OR REPLACE FUNCTION check_usage_limit(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_month TEXT;
  v_usage_record RECORD;
  v_subscription RECORD;
  v_plan plan_type;
  v_limit INTEGER;
BEGIN
  v_current_month := TO_CHAR(NOW(), 'YYYY-MM');
  
  -- Check if user has active subscription
  SELECT * INTO v_subscription
  FROM subscriptions
  WHERE user_id = p_user_id
  AND status IN ('active', 'trialing')
  LIMIT 1;
  
  IF FOUND THEN
    v_plan := 'paid';
    v_limit := 999999;
  ELSE
    v_plan := 'free';
    v_limit := 3;
  END IF;
  
  -- Get or create usage record
  SELECT * INTO v_usage_record
  FROM usage_limits
  WHERE user_id = p_user_id
  AND month = v_current_month;
  
  IF NOT FOUND THEN
    INSERT INTO usage_limits (user_id, month, plan_type, limit_value)
    VALUES (p_user_id, v_current_month, v_plan, v_limit);
    RETURN true;
  END IF;
  
  -- Check if under limit
  RETURN v_usage_record.documents_processed < v_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Increment usage
CREATE OR REPLACE FUNCTION increment_usage(p_user_id UUID)
RETURNS void AS $$
DECLARE
  v_current_month TEXT;
BEGIN
  v_current_month := TO_CHAR(NOW(), 'YYYY-MM');
  
  UPDATE usage_limits
  SET documents_processed = documents_processed + 1
  WHERE user_id = p_user_id
  AND month = v_current_month;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- INITIAL DATA
-- ============================================

-- Insert default prompt templates
INSERT INTO prompt_templates (name, document_type, language, system_prompt, user_prompt_template, variables) VALUES
('government_notice_en', 'government_notice', 'en', 
 'You are an expert at simplifying government documents for common people. Explain in simple, clear language without legal jargon.',
 'Document text: {document_text}\n\nProvide a simple explanation covering: what this is about, what action is required, deadlines, money involved, and any risks.',
 '["document_text"]'::jsonb),
 
('bank_letter_en', 'bank_letter', 'en',
 'You are an expert at explaining banking and financial documents in simple terms for ordinary people.',
 'Bank document: {document_text}\n\nExplain clearly: what this letter is about, what action to take, payment details, deadlines, and consequences.',
 '["document_text"]'::jsonb),

('legal_notice_en', 'legal_notice', 'en',
 'You are an expert at translating legal language into plain English for non-lawyers.',
 'Legal document: {document_text}\n\nExplain in simple terms: what this notice means, what you must do, by when, potential penalties, and next steps.',
 '["document_text"]'::jsonb);

COMMENT ON TABLE profiles IS 'User profiles with preferences and settings';
COMMENT ON TABLE documents IS 'Uploaded documents with metadata and processing status';
COMMENT ON TABLE document_results IS 'Processed document results with OCR, classification, and simplification';
COMMENT ON TABLE subscriptions IS 'User subscription management via Stripe';
COMMENT ON TABLE payments IS 'Payment transaction records';
COMMENT ON TABLE usage_limits IS 'Monthly document processing limits per user';
COMMENT ON TABLE feedback IS 'User feedback on document processing results';
COMMENT ON TABLE admin_logs IS 'System audit trail';
COMMENT ON TABLE prompt_templates IS 'AI prompt templates for document processing';
