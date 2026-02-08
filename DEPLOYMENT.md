# DocEase Deployment Guide

## 📋 Pre-Deployment Checklist

- [ ] Supabase project created
- [ ] Database schema applied
- [ ] RLS policies configured
- [ ] Storage bucket created
- [ ] Stripe account set up
- [ ] OpenAI API key obtained
- [ ] Domain name ready (optional)
- [ ] Environment variables documented

---

## 🗄️ Step 1: Supabase Setup

### 1.1 Create Supabase Project

1. Go to https://supabase.com
2. Click "New Project"
3. Fill in:
   - Project name: `docease-prod`
   - Database password: (save securely)
   - Region: (closest to your users, e.g., Mumbai for India)
4. Wait for project to be created (~2 minutes)

### 1.2 Get API Credentials

1. Go to Project Settings → API
2. Copy and save:
   - **Project URL**: `https://xxx.supabase.co`
   - **Anon (public) key**: `eyJ...`
   - **Service role key**: `eyJ...` (⚠️ Keep secret!)

### 1.3 Apply Database Schema

1. Go to SQL Editor → New Query
2. Copy entire contents of `supabase/schema.sql`
3. Paste and click "Run"
4. Wait for completion (should see "Success")
5. Repeat for `supabase/policies.sql`

### 1.4 Verify Tables Created

Go to Table Editor and verify these tables exist:
- profiles
- documents
- document_results
- subscriptions
- payments
- usage_limits
- feedback
- admin_logs
- prompt_templates

### 1.5 Create Storage Bucket

1. Go to Storage
2. Click "New Bucket"
3. Name: `documents`
4. Public: **No** (private)
5. Click "Create bucket"

### 1.6 Set Storage Policies

1. Click on `documents` bucket
2. Go to "Policies" tab
3. Add these policies:

**Upload Policy:**
```sql
CREATE POLICY "Users can upload to own folder"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);
```

**Select Policy:**
```sql
CREATE POLICY "Users can read own documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);
```

**Delete Policy:**
```sql
CREATE POLICY "Users can delete own documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);
```

### 1.7 Enable Authentication

1. Go to Authentication → Providers
2. Enable:
   - **Email** (for OTP)
   - **Google** (optional)
   
For Google OAuth:
- Go to Google Cloud Console
- Create OAuth 2.0 credentials
- Add authorized redirect: `https://xxx.supabase.co/auth/v1/callback`
- Copy Client ID and Secret
- Paste in Supabase Auth settings

### 1.8 Configure Email Templates

Go to Authentication → Email Templates

Customize:
- Confirm signup
- Magic Link
- Change Email

### 1.9 Set App URL

Go to Project Settings → API → Site URL
Set to: `https://your-domain.com` (or Vercel URL)

---

## 💳 Step 2: Stripe Setup

### 2.1 Create Stripe Account

1. Go to https://stripe.com
2. Sign up / Login
3. Complete business verification

### 2.2 Create Products

1. Go to Products → Add Product
2. Create:
   - Name: **DocEase Premium**
   - Description: Unlimited document processing
   - Price: **₹99 INR** per month (recurring)
3. Save the **Price ID** (starts with `price_...`)

### 2.3 Enable Payment Methods

1. Go to Settings → Payment Methods
2. Enable:
   - **Cards**
   - **UPI** (India)
   - **Wallets**

### 2.4 Set Up Webhooks

1. Go to Developers → Webhooks
2. Click "Add endpoint"
3. Endpoint URL: `https://your-domain.com/api/webhooks/stripe`
4. Select events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Save **Webhook signing secret** (starts with `whsec_...`)

### 2.5 Get API Keys

Go to Developers → API Keys

Copy:
- **Publishable key**: `pk_live_...` (safe to expose)
- **Secret key**: `sk_live_...` (⚠️ Keep secret!)

⚠️ Use TEST keys for development!

---

## 🤖 Step 3: OpenAI Setup

### 3.1 Get API Key

1. Go to https://platform.openai.com
2. Sign up / Login
3. Go to API Keys
4. Create new secret key
5. Copy and save (only shown once!)

### 3.2 Set Usage Limits

1. Go to Settings → Limits
2. Set monthly budget (e.g., $100)
3. Enable email notifications

### 3.3 Choose Model

Recommended: `gpt-4-turbo-preview` (best quality)
Budget option: `gpt-3.5-turbo` (faster, cheaper)

---

## 🔐 Step 4: Environment Variables

### 4.1 Create Production .env

Create `.env.production` with:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4-turbo-preview
OPENAI_MAX_TOKENS=2000

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID_MONTHLY=price_...

# Encryption (generate with: openssl rand -hex 32)
ENCRYPTION_KEY=your_32_byte_hex_key_here
ENCRYPTION_IV=your_16_byte_hex_iv_here

# App
NEXT_PUBLIC_APP_URL=https://your-domain.com
NODE_ENV=production

# Limits
FREE_TIER_DOCUMENT_LIMIT=3
PAID_TIER_DOCUMENT_LIMIT=999999
MAX_FILE_SIZE_MB=10
MAX_PAGES_PER_DOCUMENT=50

# Admin
ADMIN_EMAILS=admin@yourdomain.com

# Features
ENABLE_GUEST_MODE=true
ENABLE_AUTO_DELETE=true
ENABLE_ANALYTICS=true
```

### 4.2 Generate Encryption Keys

```bash
# Generate encryption key
openssl rand -hex 32

# Generate IV
openssl rand -hex 16
```

---

## 🚀 Step 5: Vercel Deployment

### 5.1 Install Vercel CLI

```bash
npm install -g vercel
```

### 5.2 Login to Vercel

```bash
vercel login
```

### 5.3 Deploy to Production

```bash
# From project root
vercel --prod
```

Follow prompts:
- Set up and deploy: Y
- Which scope: (your account)
- Link to existing project: N
- Project name: docease
- In which directory: ./
- Override settings: N

### 5.4 Add Environment Variables

Option 1: Vercel Dashboard
1. Go to project settings
2. Environment Variables
3. Add each variable from `.env.production`

Option 2: CLI
```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL production
# Repeat for each variable
```

### 5.5 Redeploy with Variables

```bash
vercel --prod
```

### 5.6 Get Deployment URL

Note the URL: `https://docease.vercel.app`

### 5.7 Add Custom Domain (Optional)

1. Go to Vercel Dashboard → Project → Settings → Domains
2. Add your domain: `docease.com`
3. Follow DNS configuration instructions
4. Wait for SSL certificate (auto-generated)

---

## ✅ Step 6: Post-Deployment Verification

### 6.1 Test Homepage

Visit: `https://your-domain.com`

Check:
- [ ] Page loads
- [ ] No console errors
- [ ] Links work
- [ ] Images load

### 6.2 Test Authentication

1. Click "Sign Up"
2. Enter email
3. Check email for OTP
4. Login successful?

### 6.3 Test File Upload

1. Login
2. Upload a test PDF
3. Check Supabase Storage bucket
4. File appears?

### 6.4 Test Processing

1. Upload document
2. Click "Process"
3. Wait 30-60 seconds
4. Results appear?
5. Check quality of output

### 6.5 Test Payments

1. Go to `/subscription`
2. Click "Upgrade"
3. Use Stripe test card: `4242 4242 4242 4242`
4. Expiry: any future date
5. CVC: any 3 digits
6. Payment succeeds?

### 6.6 Test Webhooks

1. Make a test payment
2. Check Stripe Dashboard → Webhooks
3. Last event delivered successfully?
4. Check Supabase `subscriptions` table

---

## 🔍 Step 7: Monitoring Setup

### 7.1 Enable Vercel Analytics

1. Go to Vercel Dashboard → Analytics
2. Enable Web Analytics
3. Add snippet to layout.tsx (already included)

### 7.2 Set Up Error Tracking

#### Option 1: Sentry

```bash
npm install @sentry/nextjs
npx @sentry/wizard -i nextjs
```

Add to `.env.production`:
```
SENTRY_DSN=https://...
```

#### Option 2: Vercel Error Tracking

Automatically enabled in production

### 7.3 Database Monitoring

Supabase Dashboard → Database → Metrics
- Monitor query performance
- Check slow queries
- Watch connection pool

### 7.4 Set Up Alerts

1. Supabase: Settings → Alerts
   - High CPU usage
   - Low disk space
   - Failed backups

2. Stripe: Settings → Notifications
   - Failed payments
   - Subscription changes

3. Vercel: Settings → Notifications
   - Failed deployments
   - High error rate

---

## 🧹 Step 8: Cleanup & Optimization

### 8.1 Enable Cron Jobs

In Supabase SQL Editor:

```sql
-- Clean up expired guests daily at midnight
SELECT cron.schedule(
  'cleanup-expired-guests',
  '0 0 * * *',
  $$ SELECT cleanup_expired_guests(); $$
);

-- Clean up expired documents every 6 hours
SELECT cron.schedule(
  'cleanup-expired-documents',
  '0 */6 * * *',
  $$ SELECT cleanup_expired_documents(); $$
);
```

### 8.2 Database Backups

Supabase automatically backs up daily.

To download:
1. Database → Backups
2. Click download on desired backup

### 8.3 Enable CDN Caching

Vercel automatically uses CDN. No setup needed.

### 8.4 Image Optimization

Already handled by Next.js Image component.

---

## 📊 Step 9: Admin Access

### 9.1 Set Admin Emails

In `.env.production`:
```
ADMIN_EMAILS=admin@yourdomain.com,admin2@yourdomain.com
```

### 9.2 Access Admin Dashboard

Visit: `https://your-domain.com/admin/dashboard`

Only emails in `ADMIN_EMAILS` can access.

---

## 🚨 Troubleshooting

### Build Fails

```bash
# Check for TypeScript errors
npm run type-check

# Check for linting errors
npm run lint

# Try local build
npm run build
```

### Database Connection Issues

- Check Supabase URL is correct
- Verify service role key is set
- Check IP allowlist (usually not needed)

### Stripe Webhooks Not Working

- Verify webhook URL is correct
- Check signing secret matches
- Ensure endpoint is POST
- Check Vercel logs for errors

### Upload Fails

- Check Storage bucket exists
- Verify RLS policies
- Check file size limits
- Try smaller test file

### OCR/AI Not Working

- Verify API keys are set
- Check API quota not exceeded
- Review error logs
- Test with simpler document

---

## 📈 Scaling Considerations

### For High Traffic

1. **Upgrade Supabase Plan**
   - Pro plan for more connections
   - Custom plan for enterprise

2. **Add Redis Cache**
   - Cache frequent queries
   - Store session data

3. **Queue Processing**
   - Use Bull or AWS SQS
   - Process documents asynchronously

4. **CDN for Static Assets**
   - Already enabled via Vercel

5. **Database Optimization**
   - Add indexes (already done)
   - Use read replicas

---

## 🔒 Security Hardening

### Production Checklist

- [ ] All secrets in environment variables
- [ ] No API keys in client code
- [ ] RLS enabled on all tables
- [ ] Storage policies configured
- [ ] HTTPS only (enforced)
- [ ] Rate limiting enabled
- [ ] Input validation in place
- [ ] XSS protection enabled
- [ ] CSRF tokens used
- [ ] Secure headers set (next.config.js)
- [ ] Regular dependency updates
- [ ] Malware scanning enabled
- [ ] Auto-logout on inactivity
- [ ] Password complexity enforced
- [ ] 2FA available (future)

---

## 📞 Support Contacts

- **Vercel Support**: https://vercel.com/support
- **Supabase Support**: https://supabase.com/support
- **Stripe Support**: https://support.stripe.com
- **OpenAI Support**: https://help.openai.com

---

## 🎉 You're Live!

Congratulations! DocEase is now deployed and running in production.

**Next Steps:**
1. Share with beta users
2. Collect feedback
3. Monitor analytics
4. Iterate and improve

**Marketing URLs:**
- Homepage: `https://your-domain.com`
- Sign Up: `https://your-domain.com/auth/signup`
- Dashboard: `https://your-domain.com/dashboard`

---

**Made with ❤️ in India**
