-- Create Storage Bucket for Documents
-- Run this in Supabase SQL Editor OR use the Storage UI

-- OPTION 1: Create via SQL (may require manual bucket creation in UI)
-- Note: Storage buckets are usually created via the Supabase dashboard UI
-- Go to Storage > Create Bucket

-- OPTION 2: Use this query to check if bucket exists
SELECT * FROM storage.buckets WHERE name = 'documents';

-- If the query above returns no rows, you need to:
-- 1. Go to: https://supabase.com/dashboard/project/fqskhidppeaubmaehxmn/storage/buckets
-- 2. Click "New bucket"
-- 3. Name: documents
-- 4. Public: UNCHECKED (keep it private)
-- 5. Click "Create bucket"

-- After creating the bucket, set up the storage policies:

-- Allow authenticated users to upload files
CREATE POLICY "Users can upload documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to read their own files
CREATE POLICY "Users can read own documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to delete their own files
CREATE POLICY "Users can delete own documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow service role to access all files (for admin operations)
CREATE POLICY "Service role has full access"
ON storage.objects
TO service_role
USING (bucket_id = 'documents');
