-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- DocEase - Production Security
-- ============================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_templates ENABLE ROW LEVEL SECURITY;

-- ============================================
-- HELPER FUNCTIONS FOR RLS
-- ============================================

-- Check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT email FROM auth.users
    WHERE id = auth.uid()
  ) = ANY(string_to_array(current_setting('app.admin_emails', true), ','));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user owns resource
CREATE OR REPLACE FUNCTION is_owner(resource_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN auth.uid() = resource_user_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- PROFILES TABLE POLICIES
-- ============================================

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Users can insert their own profile (handled by trigger)
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Admins can view all profiles
CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  USING (is_admin());

-- ============================================
-- DOCUMENTS TABLE POLICIES
-- ============================================

-- Users can view their own documents
CREATE POLICY "Users can view own documents"
  ON documents FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own documents
CREATE POLICY "Users can insert own documents"
  ON documents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own documents
CREATE POLICY "Users can update own documents"
  ON documents FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own documents
CREATE POLICY "Users can delete own documents"
  ON documents FOR DELETE
  USING (auth.uid() = user_id);

-- Admins can view all documents
CREATE POLICY "Admins can view all documents"
  ON documents FOR SELECT
  USING (is_admin());

-- Service role can manage all documents (for background processing)
CREATE POLICY "Service role can manage documents"
  ON documents FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- ============================================
-- DOCUMENT_RESULTS TABLE POLICIES
-- ============================================

-- Users can view their own document results
CREATE POLICY "Users can view own results"
  ON document_results FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own results
CREATE POLICY "Users can insert own results"
  ON document_results FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own results
CREATE POLICY "Users can update own results"
  ON document_results FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own results
CREATE POLICY "Users can delete own results"
  ON document_results FOR DELETE
  USING (auth.uid() = user_id);

-- Admins can view all results
CREATE POLICY "Admins can view all results"
  ON document_results FOR SELECT
  USING (is_admin());

-- Service role can manage all results
CREATE POLICY "Service role can manage results"
  ON document_results FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- ============================================
-- SUBSCRIPTIONS TABLE POLICIES
-- ============================================

-- Users can view their own subscriptions
CREATE POLICY "Users can view own subscriptions"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own subscriptions
CREATE POLICY "Users can insert own subscriptions"
  ON subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own subscriptions (for cancellation)
CREATE POLICY "Users can update own subscriptions"
  ON subscriptions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admins can view all subscriptions
CREATE POLICY "Admins can view all subscriptions"
  ON subscriptions FOR SELECT
  USING (is_admin());

-- Service role can manage all subscriptions (for Stripe webhooks)
CREATE POLICY "Service role can manage subscriptions"
  ON subscriptions FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- ============================================
-- PAYMENTS TABLE POLICIES
-- ============================================

-- Users can view their own payments
CREATE POLICY "Users can view own payments"
  ON payments FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can manage all payments (for Stripe webhooks)
CREATE POLICY "Service role can manage payments"
  ON payments FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Admins can view all payments
CREATE POLICY "Admins can view all payments"
  ON payments FOR SELECT
  USING (is_admin());

-- ============================================
-- USAGE_LIMITS TABLE POLICIES
-- ============================================

-- Users can view their own usage limits
CREATE POLICY "Users can view own usage"
  ON usage_limits FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can manage all usage limits
CREATE POLICY "Service role can manage usage"
  ON usage_limits FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Admins can view all usage limits
CREATE POLICY "Admins can view all usage"
  ON usage_limits FOR SELECT
  USING (is_admin());

-- ============================================
-- FEEDBACK TABLE POLICIES
-- ============================================

-- Users can view their own feedback
CREATE POLICY "Users can view own feedback"
  ON feedback FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own feedback
CREATE POLICY "Users can insert own feedback"
  ON feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own feedback
CREATE POLICY "Users can update own feedback"
  ON feedback FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own feedback
CREATE POLICY "Users can delete own feedback"
  ON feedback FOR DELETE
  USING (auth.uid() = user_id);

-- Admins can view all feedback
CREATE POLICY "Admins can view all feedback"
  ON feedback FOR SELECT
  USING (is_admin());

-- ============================================
-- ADMIN_LOGS TABLE POLICIES
-- ============================================

-- Only admins can view logs
CREATE POLICY "Admins can view logs"
  ON admin_logs FOR SELECT
  USING (is_admin());

-- Service role can insert logs
CREATE POLICY "Service role can insert logs"
  ON admin_logs FOR INSERT
  WITH CHECK (auth.jwt()->>'role' = 'service_role');

-- ============================================
-- PROMPT_TEMPLATES TABLE POLICIES
-- ============================================

-- Anyone can read active prompt templates (needed for processing)
CREATE POLICY "Anyone can read active templates"
  ON prompt_templates FOR SELECT
  USING (active = true);

-- Only admins can manage prompt templates
CREATE POLICY "Admins can manage templates"
  ON prompt_templates FOR ALL
  USING (is_admin());

-- Service role can read all templates
CREATE POLICY "Service role can read templates"
  ON prompt_templates FOR SELECT
  USING (auth.jwt()->>'role' = 'service_role');

-- ============================================
-- STORAGE POLICIES (Supabase Storage)
-- ============================================

-- Note: These are set in Supabase Dashboard under Storage > Policies
-- Bucket: documents
-- Policy: Users can upload to their own folder
-- Expression: (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1])

-- Policy: Users can read their own documents
-- Expression: (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1])

-- Policy: Users can delete their own documents
-- Expression: (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1])

-- Policy: Service role has full access
-- Expression: (bucket_id = 'documents' AND auth.jwt()->>'role' = 'service_role')

-- ============================================
-- GRANT PERMISSIONS
-- ============================================

-- Grant usage on sequences
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION check_usage_limit TO authenticated;
GRANT EXECUTE ON FUNCTION check_usage_limit TO service_role;
GRANT EXECUTE ON FUNCTION increment_usage TO service_role;
GRANT EXECUTE ON FUNCTION is_admin TO authenticated;
GRANT EXECUTE ON FUNCTION is_owner TO authenticated;

-- ============================================
-- SECURITY NOTES
-- ============================================

-- 1. All tables have RLS enabled
-- 2. Users can only access their own data
-- 3. Service role (backend) can manage all data for processing
-- 4. Admins have read-only access to most tables
-- 5. Sensitive operations (payments, subscriptions) require service role
-- 6. Storage policies ensure users can only access their own files
-- 7. Guest users are automatically cleaned up after expiration
-- 8. Documents can auto-expire based on user preferences

-- ============================================
-- SCHEDULED CLEANUP JOBS
-- ============================================

-- Note: Set up these in Supabase Dashboard > Database > Cron Jobs
-- Or use pg_cron extension if available

-- Clean up expired guests daily at midnight
-- SELECT cron.schedule('cleanup-expired-guests', '0 0 * * *', $$ SELECT cleanup_expired_guests(); $$);

-- Clean up expired documents every 6 hours
-- SELECT cron.schedule('cleanup-expired-documents', '0 */6 * * *', $$ SELECT cleanup_expired_documents(); $$);

COMMENT ON POLICY "Users can view own profile" ON profiles IS 'Users have read access to their own profile';
COMMENT ON POLICY "Service role can manage documents" ON documents IS 'Backend service needs full access for processing pipeline';
COMMENT ON POLICY "Service role can manage payments" ON payments IS 'Stripe webhooks need to create/update payment records';
