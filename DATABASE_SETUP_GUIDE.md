# 🗄️ Database Setup Guide - DocEase

Complete this guide to finish setting up your DocEase application.

---

## 📋 Table of Contents
1. [Execute Database Functions](#1-execute-database-functions)
2. [Create Storage Buckets](#2-create-storage-buckets)
3. [Set Admin Role](#3-set-admin-role)
4. [Configure Optional Services](#4-optional-services)

---

## 1. Execute Database Functions

### Step 1: Open Supabase SQL Editor

1. Go to https://app.supabase.com
2. Login to your account
3. Select your project: `fqskhidppeaubmaehxmn`
4. Click **SQL Editor** in the left sidebar
5. Click **New Query**

### Step 2: Execute the SQL Script

Copy the **ENTIRE** content from `supabase/functions.sql` and paste it into the SQL Editor.

**Quick Copy:**
- Open: `C:\xampp\htdocs\DocEase\supabase\functions.sql`
- Select All (Ctrl+A)
- Copy (Ctrl+C)
- Paste into Supabase SQL Editor
- Click **Run** (or press F5)

### Step 3: Verify Execution

You should see success messages for:
- ✅ `handle_new_user()` function created
- ✅ `on_auth_user_created` trigger created
- ✅ `reset_monthly_usage()` function created
- ✅ `check_usage_limit()` function created
- ✅ `increment_usage()` function created
- ✅ `delete_expired_documents()` function created
- ✅ `get_user_analytics()` function created
- ✅ 6 indexes created

**If you see errors:**
- Some functions may already exist - this is OK
- You can drop existing functions first with: `DROP FUNCTION IF EXISTS function_name CASCADE;`
- Or ignore "already exists" errors

---

## 2. Create Storage Buckets

### Bucket 1: `documents` (Should Already Exist ✅)

This bucket was created when you first set up the project. Verify it exists:

1. Go to **Storage** in left sidebar
2. You should see `documents` bucket
3. If not, create it:
   - Click **New Bucket**
   - Name: `documents`
   - Public: **No** (private)
   - File size limit: 10MB
   - Allowed MIME types: `application/pdf,image/jpeg,image/png,image/jpg`

### Bucket 2: `profile-pictures` (YOU NEED TO CREATE THIS)

1. Go to **Storage** in left sidebar
2. Click **New Bucket**
3. Fill in the details:

   ```
   Bucket Name: profile-pictures
   Public Bucket: ✅ YES (check this!)
   File Size Limit: 5 MB
   Allowed MIME Types: image/jpeg,image/png,image/jpg,image/gif
   ```

4. Click **Create Bucket**

### Step 3: Set Storage Policies for `profile-pictures`

After creating the bucket, you need to set up Row Level Security (RLS) policies:

1. Click on the `profile-pictures` bucket
2. Click **Policies** tab
3. Click **New Policy**
4. Click **Create a policy from scratch**

**Policy 1: Allow Users to Upload Their Own Profile Picture**

```sql
Policy Name: Users can upload their own profile picture
Allowed operation: INSERT
Target roles: authenticated
WITH CHECK expression:
bucket_id = 'profile-pictures' AND auth.uid()::text = (storage.foldername(name))[1]
```

Click **Review** → **Save Policy**

**Policy 2: Allow Anyone to View Profile Pictures**

```sql
Policy Name: Anyone can view profile pictures
Allowed operation: SELECT
Target roles: public
USING expression:
bucket_id = 'profile-pictures'
```

Click **Review** → **Save Policy**

**Policy 3: Allow Users to Update Their Own Profile Picture**

```sql
Policy Name: Users can update their own profile picture
Allowed operation: UPDATE
Target roles: authenticated
USING expression:
bucket_id = 'profile-pictures' AND auth.uid()::text = (storage.foldername(name))[1]
```

Click **Review** → **Save Policy**

**OR Use SQL Editor (Faster):**

Go to SQL Editor and run this:

```sql
-- Allow users to upload their own profile picture
INSERT INTO storage.policies (name, bucket_id, operation, definition)
VALUES (
  'Users can upload their own profile picture',
  'profile-pictures',
  'INSERT',
  'bucket_id = ''profile-pictures'' AND auth.uid()::text = (storage.foldername(name))[1]'
);

-- Allow anyone to view profile pictures
INSERT INTO storage.policies (name, bucket_id, operation, definition)
VALUES (
  'Anyone can view profile pictures',
  'profile-pictures',
  'SELECT',
  'bucket_id = ''profile-pictures'''
);

-- Allow users to update their own profile picture
INSERT INTO storage.policies (name, bucket_id, operation, definition)
VALUES (
  'Users can update their own profile picture',
  'profile-pictures',
  'UPDATE',
  'bucket_id = ''profile-pictures'' AND auth.uid()::text = (storage.foldername(name))[1]'
);
```

---

## 3. Set Admin Role

You need to set your user account to `admin` role to access the admin panel.

### Option A: Using SQL Editor (Recommended)

1. First, find your user ID:
   - Go to **Authentication** → **Users**
   - Find your email address
   - Copy your **User UID** (it looks like: `123e4567-e89b-12d3-a456-426614174000`)

2. Go to **SQL Editor** → **New Query**

3. Run this command (replace `YOUR-USER-ID` with your actual UID):

```sql
-- Set your user as admin
UPDATE profiles 
SET role = 'admin' 
WHERE id = 'YOUR-USER-ID';

-- Verify it worked
SELECT id, full_name, role FROM profiles WHERE id = 'YOUR-USER-ID';
```

Example:
```sql
UPDATE profiles 
SET role = 'admin' 
WHERE id = '123e4567-e89b-12d3-a456-426614174000';
```

### Option B: Using Table Editor

1. Go to **Table Editor** in left sidebar
2. Select `profiles` table
3. Find your user row (search by email or name)
4. Click on the row to edit
5. Find the `role` column
6. Change value from `user` to `admin`
7. Click **Save**

### Verify Admin Access

1. Refresh your DocEase app (http://localhost:3000)
2. Login with your account
3. You should now see **Admin** link in the navigation bar
4. Click it to access the admin panel

---

## 4. Optional Services

### A. Email Notifications (SMTP)

If you want email notifications when documents are processed:

#### Option 1: Gmail (Free)

1. **Enable 2-Factor Authentication:**
   - Go to https://myaccount.google.com/security
   - Enable 2-Step Verification

2. **Generate App Password:**
   - Go to https://myaccount.google.com/apppasswords
   - Select app: **Mail**
   - Select device: **Other (Custom name)**
   - Type: `DocEase`
   - Click **Generate**
   - Copy the 16-character password

3. **Update `.env.local`:**

```env
# SMTP Configuration (Gmail)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-16-char-app-password
SMTP_FROM=DocEase <your-email@gmail.com>
```

#### Option 2: SendGrid (Recommended for Production)

1. Sign up at https://sendgrid.com (free tier: 100 emails/day)
2. Create API key
3. Update `.env.local`:

```env
# SMTP Configuration (SendGrid)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
SMTP_FROM=noreply@yourdomain.com
```

#### Option 3: Resend (Modern Alternative)

1. Sign up at https://resend.com (free tier: 3000 emails/month)
2. Get API key
3. Update `.env.local`:

```env
# Resend Configuration
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxx
SMTP_FROM=noreply@yourdomain.com
```

**After configuring, restart your dev server:**
```powershell
# Stop server (Ctrl+C)
npm run dev
```

---

### B. SMS Notifications (Twilio)

If you want SMS notifications:

1. **Sign up for Twilio:**
   - Go to https://www.twilio.com/try-twilio
   - Sign up for free trial (gets $15 credit)
   - Verify your phone number

2. **Get Credentials:**
   - Dashboard: https://console.twilio.com
   - Copy **Account SID**
   - Copy **Auth Token**
   - Get a **Phone Number** from Twilio

3. **Update `.env.local`:**

```env
# Twilio Configuration
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+1234567890
```

4. **Restart dev server**

---

### C. Error Monitoring (Sentry)

If you want error tracking and monitoring:

1. **Sign up for Sentry:**
   - Go to https://sentry.io/signup/
   - Create account (free tier available)

2. **Create New Project:**
   - Select **Next.js**
   - Name it `DocEase`
   - Click **Create Project**

3. **Get DSN:**
   - Copy the **DSN** URL (looks like: `https://xxxxx@sentry.io/xxxxx`)

4. **Update `.env.local`:**

```env
# Sentry Configuration
SENTRY_DSN=https://xxxxx@sentry.io/xxxxx
NEXT_PUBLIC_SENTRY_DSN=https://xxxxx@sentry.io/xxxxx
SENTRY_ORG=your-org-name
SENTRY_PROJECT=docease
```

5. **Initialize Sentry:**

The Sentry integration is already set up in `lib/sentry.ts`. After adding the DSN, all errors will be automatically tracked.

6. **Restart dev server**

---

## ✅ Verification Checklist

After completing the setup, verify everything works:

### Database Functions
- [ ] Go to SQL Editor → Database Functions → You should see 7 functions listed
- [ ] Create a test user → Profile should be auto-created (handle_new_user trigger works)

### Storage Buckets
- [ ] Go to Storage → See both `documents` and `profile-pictures` buckets
- [ ] Upload a profile picture from your profile page → Should work without errors

### Admin Role
- [ ] Login to DocEase
- [ ] See "Admin" link in navigation
- [ ] Click Admin → See admin dashboard with user stats

### Email Notifications (if configured)
- [ ] Upload a document
- [ ] Wait for processing to complete
- [ ] Check your email → Should receive "Document processed" email
- [ ] Check in-app notifications (bell icon) → Should see notification

### SMS Notifications (if configured)
- [ ] Add phone number to your profile
- [ ] Upload a document
- [ ] Should receive SMS when processing completes

### Error Monitoring (if configured)
- [ ] Go to Sentry dashboard
- [ ] Should see events when errors occur
- [ ] Test by uploading an invalid file

---

## 🚀 You're All Set!

Once you've completed these steps, your DocEase application is **100% production-ready**!

### Quick Test:
1. Login to http://localhost:3000
2. Upload a PDF document
3. Watch it process (30-60 seconds with real AI)
4. View simplified results
5. Check notifications
6. Go to Admin panel
7. View analytics dashboard

**Need Help?**
- Check `TESTING_CHECKLIST.md` for comprehensive testing
- See `PRODUCTION_READY.md` for deployment guide
- Review `HOW_TO_ACCESS_FEATURES.md` for feature access

---

## 📞 Support

If you encounter any issues:

1. **Check Logs:**
   - Browser Console (F12)
   - Terminal where `npm run dev` is running
   - Supabase Logs (Database → Logs)

2. **Common Issues:**
   - "Bucket not found" → Create profile-pictures bucket
   - "Unauthorized" → Set admin role properly
   - "Function does not exist" → Execute functions.sql
   - "Rate limit exceeded" → Wait 1 minute or adjust rate limits in `lib/rate-limit.ts`

3. **Database Issues:**
   - Check Supabase → Database → Tables
   - Verify all tables exist: profiles, documents, document_results, notifications, feedback
   - Check RLS policies are enabled

**Everything working?** 🎉 Your DocEase is ready to simplify documents with real AI!
