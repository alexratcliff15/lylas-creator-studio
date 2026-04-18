// Promo code management. Brand admins create codes for their campaigns and
// assign each code to a specific creator — the creator gets commission
// whenever that code is redeemed at checkout.

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser, isAdmin } from '@/lib/getAuthUser';
import { z } from 'zod';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const createPromoCodeSchema = z.object({
  code: z.string().min(3).max(30).transform((s) => s.toUpperCase()),
  campaignId: z.string().optional(),
  creatorProfileId: z.string(),
  discountType: z.enum(['PERCENTAGE', 'FIXED_AMOUNT']).default('PERCENTAGE'),
  discountValue: z.number().positive(),
  maxRedemptions: z.number().int().positive().optional(),
  expiresAt: z.string().datetime().optional(),
});

export async function GET(request) {
  try {
    const user = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get('campaignId');
    const creatorProfileId = searchParams.get('creatorProfileId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    const where = {};
    if (campaignId) where.campaignId = campaignId;
    if (creatorProfileId) where.creatorProfileId = creatorProfileId;

    const skip = (page - 1) * limit;

    const [promoCodes, total] = await Promise.all([
      prisma.promoCode.findMany({
        where,
        skip,
        take: limit,
        include: {
          campaign: { select: { id: true, name: true } },
          creatorProfile: {
            select: {
              id: true,
              handle: true,
              tier: true,
              user: { select: { name: true, email: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.promoCode.count({ where }),
    ]);

    return NextResponse.json({
      promoCodes,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('GET /api/stripe/promo-codes error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const user = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdmin(user)) {
      return NextResponse.json(
        { error: 'Only brand admins can create promo codes' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const input = createPromoCodeSchema.parse(body);

    // Code uniqueness check
    const existing = await prisma.promoCode.findUnique({ where: { code: input.code } });
    if (existing) {
      return NextResponse.json({ error: `Promo code "${input.code}" already exists` }, { status: 409 });
    }

    // Verify creator profile exists
    const creatorProfile = await prisma.creatorProfile.findUnique({
      where: { id: input.creatorProfileId },
    });
    if (!creatorProfile) {
      return NextResponse.json({ error: 'Creator profile not found' }, { status: 404 });
    }

    // If campaignId provided, verify it exists (and belongs to this brand admin when not SUPER_ADMIN).
    let campaign = null;
    if (input.campaignId) {
      campaign = await prisma.campaign.findUnique({
        where: { id: input.campaignId },
        include: { brandProfile: true },
      });
      if (!campaign) {
        return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
      }
      if (user.role === 'BRAND_ADMIN') {
        const myBrand = await prisma.brandProfile.findUnique({ where: { userId: user.userId } });
        if (!myBrand || myBrand.id !== campaign.brandProfileId) {
          return NextResponse.json(
            { error: 'This campaign does not belong to your brand' },
            { status: 403 }
          );
        }
      }
    }

    // Create Stripe Coupon (the discount rules) + Promotion Code (the user-facing string).
    const coupon = await stripe.coupons.create({
      duration: 'once',
      percent_off: input.discountType === 'PERCENTAGE' ? input.discountValue : undefined,
      amount_off:
        input.discountType === 'FIXED_AMOUNT' ? Math.round(input.discountValue * 100) : undefined,
      currency: input.discountType === 'FIXED_AMOUNT' ? 'cad' : undefined,
      metadata: {
        creatorProfileId: input.creatorProfileId,
        campaignId: input.campaignId ?? '',
      },
    });

    const stripePromo = await stripe.promotionCodes.create({
      coupon: coupon.id,
      code: input.code,
      max_redemptions: input.maxRedemptions,
      expires_at: input.expiresAt ? Math.floor(new Date(input.expiresAt).getTime() / 1000) : undefined,
      metadata: {
        creatorProfileId: input.creatorProfileId,
        campaignId: input.campaignId ?? '',
      },
    });

    const promoCode = await prisma.promoCode.create({
      data: {
        code: input.code,
        campaignId: input.campaignId ?? null,
        creatorProfileId: input.creatorProfileId,
        discountType: input.discountType,
        discountValue: input.discountValue,
        maxRedemptions: input.maxRedemptions ?? null,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        stripeCouponId: coupon.id,
        stripePromoId: stripePromo.id,
      },
      include: {
        campaign: { select: { id: true, name: true } },
        creatorProfile: {
          select: {
            id: true,
            handle: true,
            tier: true,
            user: { select: { name: true, email: true } },
          },
        },
      },
    });

    return NextResponse.json(promoCode, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 });
    }
    console.error('POST /api/stripe/promo-codes error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
