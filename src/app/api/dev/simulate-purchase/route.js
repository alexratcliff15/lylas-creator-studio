// Dev-only endpoint. Simulates a completed Stripe checkout so we can verify
// the end-to-end commission flow (creator profile → commission → earnings page)
// without needing the Stripe CLI forwarding webhooks locally.
//
// Disabled automatically in production (NODE_ENV === 'production').
//
// Usage:
//   POST /api/dev/simulate-purchase  { amount: 120, promoCode?: 'ALEX10' }
// The current auth user's creatorProfile is used as the recipient.

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/getAuthUser';
import { recordCommission } from '@/app/api/webhooks/stripe/route';

export async function POST(request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'disabled in production' }, { status: 403 });
  }

  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const amount = Number(body.amount ?? 100);
    const promoCode = body.promoCode;

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'amount must be > 0' }, { status: 400 });
    }

    let creatorProfileId = body.creatorProfileId;

    // If a promo code was provided, resolve the creator from it (mirrors real webhook behaviour).
    if (!creatorProfileId && promoCode) {
      const promoRow = await prisma.promoCode.findUnique({
        where: { code: promoCode.toUpperCase() },
      });
      if (!promoRow) {
        return NextResponse.json({ error: `Promo code "${promoCode}" not found` }, { status: 404 });
      }
      if (!promoRow.creatorProfileId) {
        return NextResponse.json(
          { error: `Promo code "${promoCode}" is not assigned to any creator` },
          { status: 400 }
        );
      }
      creatorProfileId = promoRow.creatorProfileId;
    }

    if (!creatorProfileId) {
      const profile = await prisma.creatorProfile.findUnique({
        where: { userId: authUser.userId },
      });
      if (!profile) {
        return NextResponse.json(
          { error: 'No creator profile for current user. Pass creatorProfileId explicitly or log in as a creator.' },
          { status: 404 }
        );
      }
      creatorProfileId = profile.id;
    }

    // Unique fake payment ID so the Attribution row can be created without colliding.
    const fakePaymentId = `cs_test_sim_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const result = await recordCommission({
      creatorProfileId,
      amount,
      stripePaymentId: fakePaymentId,
      promoCode,
    });

    return NextResponse.json({
      message: 'Simulated purchase recorded',
      amount,
      tier: result.commission && (await prisma.creatorProfile.findUnique({ where: { id: creatorProfileId } }))?.tier,
      commissionRate: result.rate,
      commissionAmount: result.creatorCut,
      commissionId: result.commission.id,
      stripePaymentId: fakePaymentId,
    });
  } catch (error) {
    console.error('[dev/simulate-purchase] error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
