import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Commission rates by creator tier. Earned on click-driven conversions.
const COMMISSION_RATES = {
  BRONZE: 0.05,
  SILVER: 0.08,
  GOLD: 0.12,
  PLATINUM: 0.15,
};

/**
 * Record a commission for a creator from a completed Stripe payment.
 * Shared logic between the live webhook handler and the dev simulator endpoint.
 *
 * @param {Object} params
 * @param {string} params.creatorProfileId - Creator who drove the purchase (from checkout metadata).
 * @param {number} params.amount - Gross purchase amount in dollars.
 * @param {string} [params.stripePaymentId] - Stripe session / payment intent ID for audit.
 * @param {string} [params.promoCode] - Optional promo code used.
 */
export async function recordCommission({ creatorProfileId, amount, stripePaymentId, promoCode }) {
  const creatorProfile = await prisma.creatorProfile.findUnique({
    where: { id: creatorProfileId },
  });

  if (!creatorProfile) {
    throw new Error(`Creator profile not found: ${creatorProfileId}`);
  }

  const rate = COMMISSION_RATES[creatorProfile.tier] ?? COMMISSION_RATES.BRONZE;
  const creatorCut = Math.round(amount * rate * 100) / 100;
  const brandCut = Math.round((amount - creatorCut) * 100) / 100;

  // Period = current calendar month (commissions are paid out monthly).
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  // Create the commission row the earnings page reads.
  const commission = await prisma.commission.create({
    data: {
      creatorProfileId,
      amount: creatorCut,
      conversions: 1,
      rate,
      status: 'PENDING',
      periodStart,
      periodEnd,
    },
  });

  // Attribution audit row (tracks revenue split per transaction).
  let promoCodeRecord = null;
  if (promoCode) {
    promoCodeRecord = await prisma.promoCode.findUnique({ where: { code: promoCode } });
  }

  if (stripePaymentId) {
    // Guard against duplicate webhook deliveries — stripePaymentId is @unique.
    const existing = await prisma.attribution.findUnique({ where: { stripePaymentId } });
    if (!existing) {
      await prisma.attribution.create({
        data: {
          promoCodeId: promoCodeRecord?.id ?? null,
          stripePaymentId,
          amount,
          creatorCut,
          brandCut,
          source: 'stripe_checkout',
        },
      });
    }
  }

  // Roll up the creator's lifetime totals for dashboard summary cards.
  await prisma.creatorProfile.update({
    where: { id: creatorProfileId },
    data: {
      totalEarnings: { increment: creatorCut },
      totalConversions: { increment: 1 },
    },
  });

  // If the promo code was used, bump its counters.
  if (promoCodeRecord) {
    await prisma.promoCode.update({
      where: { id: promoCodeRecord.id },
      data: {
        timesRedeemed: { increment: 1 },
        revenue: { increment: amount },
      },
    });
  }

  return { commission, creatorCut, rate };
}

export async function POST(request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature || !webhookSecret) {
      return NextResponse.json(
        { error: 'Missing stripe-signature header or STRIPE_WEBHOOK_SECRET' },
        { status: 400 }
      );
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (error) {
      console.error('Webhook signature verification failed:', error);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;

        // Three ways we can figure out who to credit, tried in order:
        //   1. Explicit metadata.creatorProfileId (set by the brand when creating the checkout)
        //   2. client_reference_id (commonly used by marketplaces)
        //   3. Promo code from Stripe's discount breakdown → look up the PromoCode row
        let creatorProfileId =
          session.metadata?.creatorProfileId || session.client_reference_id || null;
        let promoCodeString = session.metadata?.promo_code || null;

        if (!creatorProfileId) {
          // Pull the full session with expansions so we can see the applied promotion code.
          let stripePromoId = null;
          try {
            const full = await stripe.checkout.sessions.retrieve(session.id, {
              expand: ['total_details.breakdown.discounts.discount.promotion_code'],
            });
            const discount = full?.total_details?.breakdown?.discounts?.[0]?.discount;
            stripePromoId = discount?.promotion_code?.id || discount?.promotion_code || null;
            if (!promoCodeString && discount?.promotion_code?.code) {
              promoCodeString = discount.promotion_code.code;
            }
          } catch (err) {
            console.warn('[stripe webhook] could not expand session discounts:', err.message);
          }

          const promoRow =
            (promoCodeString && await prisma.promoCode.findUnique({ where: { code: promoCodeString } })) ||
            (stripePromoId && await prisma.promoCode.findFirst({ where: { stripePromoId } }));

          if (promoRow?.creatorProfileId) {
            creatorProfileId = promoRow.creatorProfileId;
            promoCodeString = promoRow.code;
          }
        }

        if (!creatorProfileId) {
          console.log('[stripe webhook] checkout.session.completed without creator attribution — skipping');
          break;
        }

        await recordCommission({
          creatorProfileId,
          amount: (session.amount_total ?? 0) / 100,
          stripePaymentId: session.id,
          promoCode: promoCodeString ?? undefined,
        });
        console.log(`[stripe webhook] commission recorded for creator ${creatorProfileId}`);
        break;
      }

      case 'payment_intent.succeeded': {
        const pi = event.data.object;
        // If the attribution already exists, mark the related commission CONFIRMED-equivalent (still PENDING until monthly payout).
        const attribution = await prisma.attribution.findUnique({ where: { stripePaymentId: pi.id } });
        if (attribution) {
          console.log(`[stripe webhook] payment_intent.succeeded matched attribution ${attribution.id}`);
        }
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object;
        const attribution = await prisma.attribution.findUnique({
          where: { stripePaymentId: charge.payment_intent },
        });
        if (attribution) {
          console.log(`[stripe webhook] refund for attribution ${attribution.id} — reversal not yet implemented`);
          // TODO: decrement creator totals & mark commission FAILED when we build refund policy.
        }
        break;
      }

      default:
        console.log(`[stripe webhook] unhandled event: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[stripe webhook] error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
