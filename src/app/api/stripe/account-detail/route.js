import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/getAuthUser';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function GET(request) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const profile = await prisma.creatorProfile.findUnique({ where: { userId: authUser.userId } });
    if (!profile?.stripeAccountId) return NextResponse.json({ error: 'No stripe account' }, { status: 404 });

    const account = await stripe.accounts.retrieve(profile.stripeAccountId);
    return NextResponse.json({
      id: account.id,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      details_submitted: account.details_submitted,
      requirements: account.requirements,
      capabilities: account.capabilities,
      external_accounts_count: account.external_accounts?.data?.length ?? 0,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
