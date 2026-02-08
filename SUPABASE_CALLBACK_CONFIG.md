# Supabase Configuration for Email Confirmation

## CRITICAL: Add Redirect URL in Supabase Dashboard

1. Go to: https://supabase.com/dashboard/project/fqskhidppeaubmaehxmn/auth/url-configuration

2. Under "Redirect URLs", add this URL:
   ```
   http://localhost:3000/auth/callback
   ```

3. For production, also add:
   ```
   https://yourdomain.com/auth/callback
   ```

4. Click "Save"

## This fixes the email confirmation callback error permanently!

Without this URL configured, Supabase will reject the callback and cause the webpack error you saw.

After adding the URL:
1. Restart your dev server (Ctrl+C, then `npm run dev`)
2. Try signing up with a new email
3. Check your email for the confirmation link
4. Click the link - you'll be redirected to /auth/callback which will handle the confirmation
5. Then automatically redirected to /dashboard

✅ This is the complete, production-ready solution!
