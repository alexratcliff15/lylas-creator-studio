#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# Lyla's Creator Studio — Setup & Deploy Script
# Run this after downloading the project folder
# ═══════════════════════════════════════════════════════════════

set -e

echo ""
echo "╔═══════════════════════════════════════════════╗"
echo "║   Lyla's Creator Studio — Setup & Deploy      ║"
echo "╚═══════════════════════════════════════════════╝"
echo ""

# ─── Step 1: Check prerequisites ───
echo "🔍 Checking prerequisites..."

check_command() {
  if ! command -v $1 &> /dev/null; then
    echo "❌ $1 is not installed. Please install it first."
    echo "   $2"
    exit 1
  else
    echo "✅ $1 found"
  fi
}

check_command "node" "Install from https://nodejs.org (v18+)"
check_command "npm" "Comes with Node.js"
check_command "git" "Install from https://git-scm.com"

echo ""

# ─── Step 2: Install dependencies ───
echo "📦 Installing dependencies..."
npm install
echo "✅ Dependencies installed"
echo ""

# ─── Step 3: Environment setup ───
if [ ! -f .env ]; then
  echo "🔧 Creating .env from template..."
  cp .env.example .env
  echo ""
  echo "⚠️  IMPORTANT: You need to fill in your .env file with real values."
  echo "   Open .env in your editor and add:"
  echo ""
  echo "   1. DATABASE_URL      → Get from Supabase (free): https://supabase.com"
  echo "   2. NEXTAUTH_SECRET   → Run: openssl rand -base64 32"
  echo "   3. META_APP_ID       → From https://developers.facebook.com"
  echo "   4. META_APP_SECRET   → Same location"
  echo "   5. META_ACCESS_TOKEN → Graph API Explorer (see DEPLOY.md)"
  echo "   6. META_AD_ACCOUNT_ID → From Meta Ads Manager (starts with act_)"
  echo "   7. STRIPE_SECRET_KEY → From https://dashboard.stripe.com/apikeys"
  echo "   8. STRIPE_PUBLISHABLE_KEY → Same location"
  echo "   9. STRIPE_WEBHOOK_SECRET → After creating webhook endpoint"
  echo "   10. STRIPE_CONNECT_CLIENT_ID → From Stripe Connect settings"
  echo ""
  read -p "Press Enter after you've filled in .env (or Ctrl+C to do it later)..."
else
  echo "✅ .env file already exists"
fi
echo ""

# ─── Step 4: Generate Prisma client ───
echo "🗄️  Generating Prisma client..."
npx prisma generate
echo "✅ Prisma client generated"
echo ""

# ─── Step 5: Push database schema ───
echo "🗄️  Pushing database schema to your database..."
echo "   (Make sure DATABASE_URL is set in .env)"
npx prisma db push
echo "✅ Database tables created"
echo ""

# ─── Step 6: Test locally ───
echo "🚀 Starting dev server..."
echo "   Open http://localhost:3000 in your browser"
echo ""
npm run dev
