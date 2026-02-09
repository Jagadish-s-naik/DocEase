# Fix Upload Error - Storage Bucket Setup

## The Problem
Upload is failing because the Supabase Storage bucket 'documents' doesn't exist yet.

## Solution: Create Storage Bucket

### Step 1: Create the Bucket via Supabase Dashboard
1. Go to: https://supabase.com/dashboard/project/fqskhidppeaubmaehxmn/storage/buckets

2. Click **"New bucket"** button

3. Fill in:
   - **Name**: `documents`
   - **Public**: **UNCHECKED** (keep it private for security)
   - **File size limit**: 10MB
   - **Allowed MIME types**: Leave empty (or add: application/pdf, image/jpeg, image/png)

4. Click **"Create bucket"**

### Step 2: Set Up Storage Policies
1. After creating the bucket, click on the `documents` bucket

2. Go to the **"Policies"** tab

3. Click **"New policy"**

4. Create these 3 policies:

#### Policy 1: Upload Documents
```sql
CREATE POLICY "Users can upload documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
```

#### Policy 2: Read Own Documents
```sql
CREATE POLICY "Users can read own documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
```

#### Policy 3: Delete Own Documents
```sql
CREATE POLICY "Users can delete own documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
```

### Step 3: Test Upload
1. Go back to http://localhost:3000/upload
2. Upload a PDF or image file
3. It should now work! ✅

---

## Quick Verification

Check if bucket exists:
```sql
SELECT * FROM storage.buckets WHERE name = 'documents';
```

If you see a row, the bucket is created! 🎉

---

## Alternative: Create via SQL (Advanced)

If you prefer SQL, run this in Supabase SQL Editor:

```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,
  10485760,  -- 10MB in bytes
  ARRAY['application/pdf', 'image/jpeg', 'image/png']
);
```

Then add the policies from Step 2 above.
