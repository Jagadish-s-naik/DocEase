-- =====================================================
-- Add Missing Columns to Existing Schema
-- =====================================================
-- Run this AFTER verifying your schema exists but BEFORE functions.sql
-- This adds columns needed by the DocEase application
-- =====================================================

-- Add role column to profiles (for admin/user roles)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'role'
    ) THEN
        ALTER TABLE profiles ADD COLUMN role TEXT DEFAULT 'user' NOT NULL;
        CREATE INDEX idx_profiles_role ON profiles(role);
        COMMENT ON COLUMN profiles.role IS 'User role: admin or user';
    END IF;
END $$;

-- Add email column to profiles (for caching auth.users email)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'email'
    ) THEN
        ALTER TABLE profiles ADD COLUMN email TEXT;
        CREATE INDEX idx_profiles_email ON profiles(email);
        COMMENT ON COLUMN profiles.email IS 'Cached email from auth.users';
    END IF;
END $$;

-- Add documents_processed column to profiles (for quick access)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'documents_processed'
    ) THEN
        ALTER TABLE profiles ADD COLUMN documents_processed INTEGER DEFAULT 0 NOT NULL;
        COMMENT ON COLUMN profiles.documents_processed IS 'Cached count of documents processed this month';
    END IF;
END $$;

-- Add monthly_limit column to profiles (for quick access)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'monthly_limit'
    ) THEN
        ALTER TABLE profiles ADD COLUMN monthly_limit INTEGER DEFAULT 3 NOT NULL;
        COMMENT ON COLUMN profiles.monthly_limit IS 'Monthly document processing limit';
    END IF;
END $$;

-- Add profile_picture_url column to profiles (for profile pictures)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'profile_picture_url'
    ) THEN
        ALTER TABLE profiles ADD COLUMN profile_picture_url TEXT;
        COMMENT ON COLUMN profiles.profile_picture_url IS 'URL to profile picture in storage';
    END IF;
END $$;

-- Add notifications table if it doesn't exist
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info' NOT NULL,
  is_read BOOLEAN DEFAULT false NOT NULL,
  action_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- Update handle_new_user function to include new columns
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (
    id, 
    full_name, 
    email,
    preferred_language, 
    role,
    documents_processed,
    monthly_limit
  )
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    'en',
    'user',
    0,
    3
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Populate email column for existing users
UPDATE profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND p.email IS NULL;

-- =====================================================
-- VERIFICATION
-- =====================================================
-- Check that all columns were added
SELECT 
  column_name, 
  data_type, 
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles'
ORDER BY ordinal_position;

-- Check notifications table exists
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables 
  WHERE table_name = 'notifications'
) AS notifications_table_exists;

-- SUCCESS MESSAGE
SELECT 'Migration completed successfully!' AS status;