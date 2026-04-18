# Lyla's Creator Studio — Deployment Guide

## Quick Start (Local Development)

```bash
# 1. Clone or copy the project
cd lylas-creator-studio

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Edit .env with your actual keys (see "Environment Setup" below)

# 4. Set up the database
npx prisma db push
npx prisma generate

# 5. Run the dev server
npm run dev
# Open http://localhost:3000
```

## Environment Setup

### 1. Database (Supabase — Free Tier)

1. Go to https://supabase.com and create a new project
2. Go to **Settings → Database → Connection string → URI**
3. Copy the URI and paste it as `DATABASE_URL` in your `.env`
4. Run `npx prisma db push` to create all tables

### 2. NextAuth

```bash
# Generate a secret
openssl rand -base64 32
```

Set `NEXTAUTH_SECRET` to the generated value.
Set `NEXTAUTH_URL` to `http://localhost:3000` for local dev, or your Vercel URL for production.

### 3. Meta / Facebook Ads API

1. Go to https://developers.facebook.com
2. Create a new App (type: Business)
3. Add the **Marketing API** product
4. Go to **Settings → Basic** to get your App ID and App Secret
5. Use the **Graph API Explorer** to generate a long-lived access token:
   - Select your app
   - Add permissions: `ads_management`, `ads_read`, `read_insights`
   - Generate token → Exchange for long-lived token
6. Find your Ad Account ID in Meta Ads Manager (it starts with `act_`)
7. Find your Pixel ID in Events Manager

Set these in `.env`:
```
META_APP_ID=your-app-id
META_APP_SECRET=your-app-secret
META_ACCESS_TOKEN=your-long-lived-token
META_AD_ACCOUNT_ID=act_your-account-id
META_PIXEL_ID=your-pixel-id
```

**Important:** Long-lived tokens expire after 60 days. For production, implement the token refresh flow (the code in `src/lib/meta.js` handles this).

### 4. Stripe

You already have a Stripe account. Here's what you need:

1. **API Keys:** Go to https://dashboard.stripe.com/apikeys
   - Copy the Secret Key → `STRIPE_SECRET_KEY`
   - Copy the Publishable Key → `STRIPE_PUBLISHABLE_KEY`

2. **Stripe Connect (for paying creators):**
   - Go to https://dashboard.stripe.com/settings/connect
   - Enable Express accounts
   - Copy the Platform Client ID → `STRIPE_CONNECT_CLIENT_ID`

3. **Webhooks:**
   - Go to https://dashboard.stripe.com/webhooks
   - Add endpoint: `https://your-domain.com/api/webhooks/stripe`
   - Select events:
     - `checkout.session.completed`
     - `payment_intent.succeeded`
     - `transfer.created`
     - `transfer.failed`
     - `customer.created`
   - Copy the Signing Secret → `STRIPE_WEBHOOK_SECRET`

### 5. Promo Code Integration

Since you have a custom-built ecommerce interface using Stripe, promo codes work like this:

1. **Brand creates a promo code** in the Creator Studio → this creates a Stripe Coupon + Promotion Code via the API
2. **Creator shares the promo code** with their audience
3. **Customer uses the code** at checkout → your ecommerce interface applies the Stripe Promotion Code
4. **Stripe webhook fires** `checkout.session.completed` with the promo code attached
5. **Our webhook handler** (`/api/webhooks/stripe`) attributes the sale to the creator and calculates commission
6. **Commission appears** in the creator's earnings dashboard

To connect this to your existing checkout, make sure your Stripe checkout session includes the promotion code:

```js
// In your existing ecommerce checkout code
const session = await stripe.checkout.sessions.create({
  // ... your existing config
  allow_promotion_codes: true, // This enables promo code input at checkout
  // OR apply a specific code:
  // discounts: [{ promotion_code: 'promo_xxxxx' }],
});
```

## Deploy to Vercel

### Option A: Via Git (Recommended)

```bash
# 1. Initialize git and push to GitHub
git init
git add .
git commit -m "Initial commit: Lyla's Creator Studio"
git remote add origin https://github.com/your-org/lylas-creator-studio.git
git push -u origin main

# 2. Go to https://vercel.com/new
# 3. Import the GitHub repository
# 4. Add ALL environment variables from .env
# 5. Deploy
```

### Option B: Via Vercel CLI

```bash
npm i -g vercel
vercel login
vercel --prod
# Follow prompts to add environment variables
```

### Vercel Environment Variables

In your Vercel project settings (Settings → Environment Variables), add ALL variables from `.env.example` with your production values. Make sure `NEXTAUTH_URL` is set to your Vercel domain (e.g., `https://creators.lylashouse.ca`).

### Custom Domain

1. In Vercel, go to **Settings → Domains**
2. Add `creators.lylashouse.ca` (or your preferred subdomain)
3. Add the DNS records Vercel provides to your domain registrar
4. SSL is automatic

## Post-Deployment Checklist

- [ ] Database tables created (`npx prisma db push`)
- [ ] Create your first Brand Admin account at `/register`
- [ ] Connect Meta Ads account in Brand settings
- [ ] Set up Stripe webhook endpoint pointing to your Vercel URL
- [ ] Test promo code flow end-to-end
- [ ] Create first campaign and invite creators
- [ ] Set up a cron job or Vercel Cron to sync Meta metrics daily:
  ```
  // vercel.json
  {
    "crons": [{
      "path": "/api/meta/sync",
      "schedule": "0 */4 * * *"
    }]
  }
  ```

## Architecture Overview

```
┌──────────────────────────────────────────┐
│           Lyla's Creator Studio           │
│              (Next.js on Vercel)          │
├──────────────┬───────────────────────────┤
│  Frontend    │  API Routes               │
│  React +     │  /api/meta/*    → Meta API│
│  Tailwind +  │  /api/stripe/*  → Stripe  │
│  Recharts    │  /api/creators/*→ Prisma  │
│              │  /api/webhooks/*→ Events  │
├──────────────┴───────────────────────────┤
│            Prisma ORM                     │
├──────────────────────────────────────────┤
│         PostgreSQL (Supabase)             │
└──────────────────────────────────────────┘

External Services:
  → Meta Marketing API (ad performance data)
  → Stripe Connect (creator payouts)
  → Stripe Coupons (promo code tracking)
  → Your Ecommerce (Stripe checkout → webhooks)
```

## File Structure

```
lylas-creator-studio/
├── prisma/
│   └── schema.prisma          # 16 database models
├── src/
│   ├── app/
│   │   ├── api/               # 19 API route files
│   │   │   ├── auth/          # NextAuth
│   │   │   ├── creators/      # Creator CRUD
│   │   │   ├── videos/        # Video management
│   │   │   ├── campaigns/     # Campaign management
│   │   │   ├── meta/          # Meta API proxy
│   │   │   ├── stripe/        # Stripe Connect + promo codes
│   │   │   ├── payments/      # Commission processing
│   │   │   ├── webhooks/      # Stripe + Meta webhooks
│   │   │   ├── feed/          # Creator community feed
│   │   │   ├── samples/       # Sample product applications
│   │   │   └── targets/       # AI-powered targets
│   │   ├── (dashboard)/       # Route group
│   │   │   ├── creator/       # 6 creator pages
│   │   │   └── brand/         # 6 brand admin pages
│   │   ├── layout.jsx         # Root layout
│   │   ├── page.jsx           # Login page
│   │   └── globals.css        # Tailwind + brand styles
│   ├── components/
│   │   ├── ui/                # 6 reusable UI components
│   │   └── layout/            # Sidebar, Header, DashboardLayout
│   ├── context/               # AppContext (global state)
│   ├── hooks/                 # useApi custom hook
│   └── lib/
│       ├── prisma.js          # Database client
│       ├── meta.js            # Meta Marketing API client
│       ├── stripe.js          # Stripe integration
│       ├── auth.js            # NextAuth config
│       └── utils.js           # Helpers
├── .env.example
├── middleware.js               # Auth + role-based routing
├── package.json
├── next.config.js
├── tailwind.config.js
└── DEPLOY.md                  # This file
```
