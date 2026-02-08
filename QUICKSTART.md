# DocEase - Quick Start Guide

## ⚡ Get Running in 15 Minutes

This guide will get you from zero to a working local development environment.

---

## 📋 Prerequisites Checklist

Before starting, make sure you have:
- [ ] Node.js 18+ installed (`node --version`)
- [ ] npm 9+ installed (`npm --version`)
- [ ] A Supabase account (free: https://supabase.com)
- [ ] An OpenAI API key (https://platform.openai.com)
- [ ] A Stripe account for payments (https://stripe.com)

---

## 🚀 Step 1: Install Dependencies (2 minutes)

```bash
cd c:\xampp\htdocs\DocEase
npm install
```

This will install all required packages including Next.js, Supabase, Tesseract, etc.

---

## 🔐 Step 2: Set Up Environment Variables (3 minutes)

1. **Copy the template:**
```bash
copy .env.example .env.local
```

2. **Get your Supabase credentials:**
   - Go to https://supabase.com
   - Create a new project (wait ~2 minutes)
   - Go to Project Settings → API
   - Copy:
     - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
     - Anon public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - Service role key → `SUPABASE_SERVICE_ROLE_KEY`

3. **Get your OpenAI key:**
   - Go to https://platform.openai.com
   - Create API key
   - Copy → `OPENAI_API_KEY`

4. **Generate encryption keys:**
```bash
# Run these in PowerShell
# Encryption key (32 bytes)
-join ((1..64) | ForEach-Object {'{0:x}' -f (Get-Random -Max 16)})

# Encryption IV (16 bytes)
-join ((1..32) | ForEach-Object {'{0:x}' -f (Get-Random -Max 16)})
```

5. **Edit `.env.local` and paste your values:**
```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
OPENAI_API_KEY=sk-...
ENCRYPTION_KEY=your_64_char_hex_from_above
ENCRYPTION_IV=your_32_char_hex_from_above
```

**Note:** Stripe keys can be added later for testing payments.

---

## 🗄️ Step 3: Set Up Database (5 minutes)

1. **Go to your Supabase project**

2. **Open SQL Editor:**
   - Click "SQL Editor" in left sidebar
   - Click "New Query"

3. **Run the schema:**
   - Open `supabase/schema.sql` in a text editor
   - Copy ALL contents
   - Paste into SQL Editor
   - Click "Run"
   - Wait for "Success ✓"

4. **Run the policies:**
   - Open `supabase/policies.sql`
   - Copy ALL contents
   - Paste into a new SQL query
   - Click "Run"
   - Wait for "Success ✓"

5. **Create storage bucket:**
   - Click "Storage" in left sidebar
   - Click "Create bucket"
   - Name: `documents`
   - Public: **No** (leave unchecked)
   - Click "Create bucket"

6. **Verify tables created:**
   - Click "Table Editor"
   - You should see: profiles, documents, document_results, subscriptions, payments, usage_limits, feedback, admin_logs, prompt_templates

---

## ▶️ Step 4: Run Development Server (1 minute)

```bash
npm run dev
```

Open http://localhost:3000

You should see the DocEase homepage! 🎉

---

## ✅ Step 5: Test It Works (5 minutes)

### Test 1: Homepage
- Visit http://localhost:3000
- Should see homepage with features

### Test 2: Authentication (Optional - requires email setup)
- Click "Get Started"
- Try to sign up
- (Will need email configured in Supabase)

### Test 3: Upload (Guest Mode)
If guest mode is enabled:
- Go to http://localhost:3000/dashboard
- Try uploading a test PDF or image

### Test 4: Check Database
- Go to Supabase → Table Editor → documents
- See if your upload appears

---

## 🐛 Common Issues & Fixes

### "Module not found" errors
```bash
rm -rf node_modules
rm package-lock.json
npm install
```

### "Supabase connection failed"
- Check `.env.local` has correct URL and keys
- Verify Supabase project is running (not paused)

### "OCR not working"
- Tesseract.js downloads on first use
- Wait ~30 seconds on first document
- Check browser console for errors

### "Type errors"
```bash
npm run type-check
```
Fix any reported errors

---

## 📦 What Works Right Now

With this basic setup, you have:
- ✅ Homepage
- ✅ File upload UI
- ✅ Database structure
- ✅ OCR capability
- ✅ AI processing (if OpenAI key set)
- ✅ Document storage

---

## 🚧 What Needs Additional Setup

These features need extra configuration:

### For Email/OTP Login:
- Configure Supabase Auth email settings
- Add email templates

### For Payments:
- Add Stripe keys to `.env.local`
- Create products in Stripe
- Set up webhooks

### For Production:
- Follow full `DEPLOYMENT.md` guide
- Set up monitoring
- Configure domain

---

## 🎯 Next Steps

1. **Test file upload and processing:**
   - Upload a test PDF
   - Check if OCR extracts text
   - Verify AI classification works

2. **Customize the app:**
   - Edit homepage copy
   - Adjust colors in `tailwind.config.js`
   - Modify prompts in `services/llm.service.ts`

3. **Build additional pages:**
   - Dashboard
   - Results display
   - User profile
   - Document history

4. **Set up Stripe for payments:**
   - Follow Stripe section in `DEPLOYMENT.md`
   - Test with test cards

5. **Deploy to production:**
   - Follow full `DEPLOYMENT.md`
   - Deploy to Vercel
   - Go live!

---

## 📚 Documentation

- **Full README:** `README.md`
- **Deployment Guide:** `DEPLOYMENT.md`
- **Project Summary:** `PROJECT_SUMMARY.md`
- **Code Documentation:** Inline comments in all files

---

## 💡 Tips

- Use Supabase Table Editor to inspect data
- Check browser console for errors
- Use Supabase logs for backend errors
- Start with test documents (simple PDFs)
- Use OpenAI playground to test prompts

---

## 🆘 Need Help?

1. Check console logs (F12 in browser)
2. Check Supabase logs (Logs → API)
3. Review error messages carefully
4. Verify all environment variables are set
5. Ensure database schema was applied correctly

---

## 🎉 You're Ready!

You now have a working local development environment for DocEase.

**Happy coding!** 🚀

---

**Time spent: ~15 minutes**
**Next: Build amazing features!**
