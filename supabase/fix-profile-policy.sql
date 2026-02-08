-- Fix profile insertion during signup
-- Run this in Supabase SQL Editor

-- Drop the existing insert policy
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

-- Create a new policy that allows profile creation during signup
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (
    auth.uid() = id OR 
    auth.uid() IS NULL  -- Allow during signup when user is being created
  );

-- Also ensure service role can always insert
CREATE POLICY "Service role can insert profiles" ON profiles
  FOR INSERT
  WITH CHECK (auth.jwt()->>'role' = 'service_role');
