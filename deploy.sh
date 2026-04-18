#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# Lyla's Creator Studio — Push to GitHub & Deploy to Vercel
# Run this AFTER setup.sh has completed successfully
# ═══════════════════════════════════════════════════════════════

set -e

echo ""
echo "╔═══════════════════════════════════════════════╗"
echo "║   Deploy to GitHub + Vercel                    ║"
echo "╚═══════════════════════════════════════════════╝"
echo ""

# ─── Step 1: Initialize Git ───
if [ ! -d .git ]; then
  echo "📁 Initializing git repository..."
  git init
  git add .
  git commit -m "Initial commit: Lyla's Creator Studio — UGC Platform"
  echo "✅ Git repository initialized"
else
  echo "✅ Git already initialized"
fi
echo ""

# ─── Step 2: Create GitHub repo ───
echo "📋 Next steps to push to GitHub:"
echo ""
echo "   Option A — GitHub CLI (if you have 'gh' installed):"
echo "   ┌──────────────────────────────────────────────────────┐"
echo "   │ gh repo create lylas-creator-studio --private --push │"
echo "   └──────────────────────────────────────────────────────┘"
echo ""
echo "   Option B — Manual:"
echo "   1. Go to https://github.com/new"
echo "   2. Name it 'lylas-creator-studio', set to Private"
echo "   3. Run these commands:"
echo "   ┌──────────────────────────────────────────────────────────────────────────┐"
echo "   │ git remote add origin https://github.com/YOUR-USERNAME/lylas-creator-studio.git │"
echo "   │ git branch -M main                                                       │"
echo "   │ git push -u origin main                                                  │"
echo "   └──────────────────────────────────────────────────────────────────────────┘"
echo ""
read -p "Press Enter after your code is on GitHub..."
echo ""

# ─── Step 3: Deploy to Vercel ───
echo "🚀 Deploying to Vercel:"
echo ""
echo "   1. Go to https://vercel.com/new"
echo "   2. Import your 'lylas-creator-studio' repository"
echo "   3. Framework Preset: Next.js (should auto-detect)"
echo "   4. Add ALL environment variables from .env"
echo "   5. Click Deploy"
echo ""
echo "   After deployment:"
echo "   6. Go to Settings → Domains"
echo "   7. Add: creators.lylashouse.ca"
echo "   8. Add the DNS records to your domain registrar"
echo ""
echo "   Stripe webhook (IMPORTANT):"
echo "   9. Go to https://dashboard.stripe.com/webhooks"
echo "   10. Add endpoint: https://creators.lylashouse.ca/api/webhooks/stripe"
echo "   11. Select events: checkout.session.completed, payment_intent.succeeded,"
echo "       transfer.created, transfer.failed"
echo "   12. Copy the signing secret → update STRIPE_WEBHOOK_SECRET in Vercel env vars"
echo ""
echo "╔═══════════════════════════════════════════════╗"
echo "║   🎉 You're live!                              ║"
echo "╚═══════════════════════════════════════════════╝"
