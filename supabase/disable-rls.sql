-- ============================================
-- DISABLE RLS FOR DEVELOPMENT
-- Run this in Supabase SQL Editor to fix login issues
-- ============================================

-- Disable RLS on profiles table
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- Disable RLS on other tables
ALTER TABLE documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE document_results DISABLE ROW LEVEL SECURITY;
ALTER TABLE usage_limits DISABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions DISABLE ROW LEVEL SECURITY;
ALTER TABLE payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE feedback DISABLE ROW LEVEL SECURITY;
ALTER TABLE processing_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage DISABLE ROW LEVEL SECURITY;

-- Verify RLS is disabled
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
