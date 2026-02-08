-- Fix unconfirmed users and disable email confirmation requirement
-- Run this in Supabase SQL Editor

-- 1. Confirm all existing unconfirmed users (fftropical79@gmail.com and any others)
UPDATE auth.users 
SET email_confirmed_at = NOW(),
    confirmed_at = NOW()
WHERE email_confirmed_at IS NULL;

-- 2. Check the results
SELECT id, email, email_confirmed_at, confirmed_at, created_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 10;
