import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/getAuthUser';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// POST /api/stripe/connect — Create Stripe Connect account + onboarding link
export async function POST(request) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find creator profile
    const creatorProfile = await prisma.creatorProfile.findUnique({
      where: { userId: authUser.userId },
      include: { user: true },
    });

    if (!creatorProfile) {
      return NextResponse.json({ error: 'Creator profile not found' }, { status: 404 });
    }

    // If already has a Stripe account, create a new onboarding link
    if (creatorProfile.stripeAccountId) {
      // Check if already fully onboarded
      if (creatorProfile.stripeOnboarded) {
        // Create a login link to the Stripe dashboard instead
        const loginLink = await stripe.accounts.createLoginLink(creatorProfile.stripeAccountId);
        return NextResponse.json({
          message: 'Already onboarded',
          dashboardUrl: loginLink.url,
          stripeOnboarded: true,
        });
      }

      // Not yet onboarded — create a new account link
      const accountLink = await stripe.accountLinks.create({
        account: creatorProfile.stripeAccountId,
        type: 'account_onboarding',
        refresh_url: `${process.env.NEXTAUTH_URL}/dashboard/creator/profile?stripe=refresh`,
        return_url: `${process.env.NEXTAUTH_URL}/dashboard/creator/profile?stripe=success`,
      });

      return NextResponse.json({
        message: 'Continue onboarding',
        onboardingUrl: accountLink.url,
        stripeOnboarded: false,
      });
    }

    // Create new Stripe Connect Express account
    const account = await stripe.accounts.create({
      type: 'express',
      email: creatorProfile.user.email,
      country: 'CA',
      capabilities: {
        transfers: { requested: true },
      },
      metadata: {
        creatorProfileId: creatorProfile.id,
        userId: authUser.userId,
      },
    });

    // Create onboarding link
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      type: 'account_onboarding',
      refresh_url: `${process.env.NEXTAUTH_URL}/dashboard/creator/profile?stripe=refresh`,
      return_url: `${process.env.NEXTAUTH_URL}/dashboard/creator/profile?stripe=success`,
    });

    // Save Stripe account ID to profile
    await prisma.creatorProfile.update({
      where: { id: creatorProfile.id },
      data: { stripeAccountId: account.id },
    });

    return NextResponse.json({
      message: 'Stripe Connect account created',
      onboardingUrl: accountLink.url,
      stripeOnboarded: false,
    });
  } catch (error) {
    console.error('POST /api/stripe/connect error:', error);

    const message = error?.message || 'Stripe error';
    // Detect the common "platform has not enabled Connect" case.
    if (/sign(ed)? up for Connect/i.test(message)) {
      return NextResponse.json(
        {
          error: 'Stripe Connect is not yet enabled on your Stripe platform account.',
          hint: 'Enable Connect at https://dashboard.stripe.com/connect, then try again.',
          stripeDashboardUrl: 'https://dashboard.stripe.com/connect',
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET /api/stripe/connect — Check Stripe onboarding status
export async function GET(request) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const creatorProfile = await prisma.creatorProfile.findUnique({
      where: { userId: authUser.userId },
    });

    if (!creatorProfile) {
      return NextResponse.json({ error: 'Creator profile not found' }, { status: 404 });
    }

    if (!creatorProfile.stripeAccountId) {
      return NextResponse.json({
        connected: false,
        stripeOnboarded: false,
      });
    }

    // Check status with Stripe
    const account = await stripe.accounts.retrieve(creatorProfile.stripeAccountId);
    const isOnboarded = account.details_submitted && account.charges_enabled;

    // Update DB if status changed
    if (isOnboarded && !creatorProfile.stripeOnboarded) {
      await prisma.creatorProfile.update({
        where: { id: creatorProfile.id },
        data: { stripeOnboarded: true },
      });
    }

    return NextResponse.json({
      connected: true,
      stripeOnboarded: isOnboarded,
      stripeAccountId: creatorProfile.stripeAccountId,
      detailsSubmitted: account.details_submitted,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
    });
  } catch (error) {
    console.error('GET /api/stripe/connect error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
