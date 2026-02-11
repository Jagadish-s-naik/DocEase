-- ============================================
-- DOCEASE - QUICK SETUP SCRIPTS
-- Run these in Supabase SQL Editor
-- ============================================

-- ============================================
-- SECTION 1: CREATE PROFILE-PICTURES BUCKET
-- ============================================

-- Note: You can also create this via UI:
-- Storage → New Bucket → Name: profile-pictures → Public: YES

-- Check if bucket exists
SELECT * FROM storage.buckets WHERE name = 'profile-pictures';

-- If it doesn't exist, create it via SQL:
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-pictures', 'profile-pictures', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- SECTION 2: SET STORAGE POLICIES
-- ============================================

-- Delete existing policies (if any) to avoid conflicts
DELETE FROM storage.policies WHERE bucket_id = 'profile-pictures';

-- Policy 1: Allow users to upload their own profile picture
INSERT INTO storage.policies (name, bucket_id, definition)
VALUES (
  'Users can upload their own profile picture',
  'profile-pictures',
  '(bucket_id = ''profile-pictures''::text) AND ((auth.uid())::text = (storage.foldername(name))[1])'
);

-- Policy 2: Allow anyone to view profile pictures (public read)
INSERT INTO storage.policies (name, bucket_id, definition)
VALUES (
  'Public Access',
  'profile-pictures',
  '(bucket_id = ''profile-pictures''::text)'
);

-- Policy 3: Allow users to update their own profile picture
INSERT INTO storage.policies (name, bucket_id, definition)
VALUES (
  'Users can update own picture',
  'profile-pictures',
  '(bucket_id = ''profile-pictures''::text) AND ((auth.uid())::text = (storage.foldername(name))[1])'
);

-- Policy 4: Allow users to delete their own profile picture
INSERT INTO storage.policies (name, bucket_id, definition)
VALUES (
  'Users can delete own picture',
  'profile-pictures',
  '(bucket_id = ''profile-pictures''::text) AND ((auth.uid())::text = (storage.foldername(name))[1])'
);

-- Verify policies created
SELECT * FROM storage.policies WHERE bucket_id = 'profile-pictures';

-- ============================================
-- SECTION 3: SET YOUR USER AS ADMIN
-- ============================================

-- STEP 1: Find your user ID
-- Go to: Authentication → Users → Copy your User UID
-- OR run this to see all users:
SELECT id, email, created_at FROM auth.users ORDER BY created_at DESC;

-- STEP 2: Set admin role (REPLACE 'YOUR-USER-ID' with your actual ID)
-- Example: UPDATE profiles SET role = 'admin' WHERE id = '123e4567-e89b-12d3-a456-426614174000';

UPDATE profiles 
SET role = 'admin' 
WHERE id = 'YOUR-USER-ID';

-- STEP 3: Verify it worked
SELECT id, full_name, role FROM profiles WHERE role = 'admin';

-- Set admin role by email (alternative method)
UPDATE profiles 
SET role = 'admin' 
WHERE id IN (
  SELECT id FROM auth.users WHERE email = 'your-email@example.com'
);

-- ============================================
-- SECTION 4: VERIFY DATABASE SETUP
-- ============================================

-- Check all tables exist
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;

-- Expected tables:
-- - profiles
-- - documents
-- - document_results
-- - notifications
-- - feedback
-- - processing_logs

-- Check all functions exist
SELECT proname FROM pg_proc 
WHERE pronamespace = 'public'::regnamespace
ORDER BY proname;

-- Expected functions:
-- - handle_new_user
-- - reset_monthly_usage
-- - check_usage_limit
-- - increment_usage
-- - delete_expired_documents
-- - get_user_analytics

-- Check triggers
SELECT trigger_name, event_object_table 
FROM information_schema.triggers 
WHERE trigger_schema = 'public';

-- Expected triggers:
-- - on_auth_user_created (on profiles)

-- Count your data
SELECT 
  (SELECT COUNT(*) FROM profiles) as total_profiles,
  (SELECT COUNT(*) FROM documents) as total_documents,
  (SELECT COUNT(*) FROM document_results) as total_results,
  (SELECT COUNT(*) FROM notifications) as total_notifications,
  (SELECT COUNT(*) FROM feedback) as total_feedback;

-- ============================================
-- SECTION 5: OPTIONAL - RESET DATA FOR TESTING
-- ============================================

-- WARNING: This will delete all your data!
-- Only run if you want to start fresh

-- Uncomment to reset:
-- DELETE FROM feedback;
-- DELETE FROM notifications;
-- DELETE FROM processing_logs;
-- DELETE FROM document_results;
-- DELETE FROM documents;
-- DELETE FROM profiles WHERE role != 'admin'; -- Keep admin user

-- Reset usage counts
-- UPDATE profiles SET documents_processed_this_month = 0;

-- ============================================
-- SECTION 6: SAMPLE QUERIES FOR DEBUGGING
-- ============================================

-- See all profiles
SELECT id, full_name, role, documents_processed_this_month, monthly_document_limit 
FROM profiles 
ORDER BY created_at DESC;

-- See all documents
SELECT id, file_name, processing_status, created_at 
FROM documents 
ORDER BY created_at DESC 
LIMIT 10;

-- See all notifications
SELECT id, user_id, type, title, message, read, created_at 
FROM notifications 
ORDER BY created_at DESC 
LIMIT 20;

-- See all feedback
SELECT f.*, p.full_name, d.file_name
FROM feedback f
LEFT JOIN profiles p ON f.user_id = p.id
LEFT JOIN documents d ON f.document_id = d.id
ORDER BY f.created_at DESC;

-- Check storage usage
SELECT 
  bucket_id,
  COUNT(*) as file_count,
  SUM(metadata->>'size')::bigint / 1024 / 1024 as total_mb
FROM storage.objects
GROUP BY bucket_id;

-- ============================================
-- SECTION 7: ENABLE ROW LEVEL SECURITY
-- ============================================

-- Ensure RLS is enabled on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for profiles (users can read own profile)
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile"
ON profiles FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Create RLS policy for profiles (users can update own profile)
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Create RLS policy for documents (users can access own documents)
DROP POLICY IF EXISTS "Users can manage own documents" ON documents;
CREATE POLICY "Users can manage own documents"
ON documents FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create RLS policy for document_results (users can access own results)
DROP POLICY IF EXISTS "Users can view own results" ON document_results;
CREATE POLICY "Users can view own results"
ON document_results FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Create RLS policy for notifications (users can access own notifications)
DROP POLICY IF EXISTS "Users can manage own notifications" ON notifications;
CREATE POLICY "Users can manage own notifications"
ON notifications FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create RLS policy for feedback (users can create feedback)
DROP POLICY IF EXISTS "Users can create feedback" ON feedback;
CREATE POLICY "Users can create feedback"
ON feedback FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Admins can view all feedback
DROP POLICY IF EXISTS "Admins can view all feedback" ON feedback;
CREATE POLICY "Admins can view all feedback"
ON feedback FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- ============================================
-- DONE! ✅
-- ============================================

-- Your database is now fully configured!
-- 
-- Next steps:
-- 1. Verify all storage buckets exist
-- 2. Set your user as admin (Section 3)
-- 3. Test the application
-- 4. Check notifications work
-- 5. Access admin panel
-- 
-- Happy coding! 🚀
