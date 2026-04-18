import Stripe from 'stripe';
import { prisma } from './prisma.js';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY environment variable is required');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-04-10',
  maxNetworkRetries: 3,
  timeout: 30000,
});

/**
 * Creator Stripe Connect Functions
 */

/**
 * Create a Stripe Connect Express account for a creator
 */
export async function createConnectAccount(creatorId, email, options = {}) {
  try {
    const account = await stripe.accounts.create({
      type: 'express',
      email,
      country: options.country || 'US',
      business_type: options.businessType || 'individual',
      capabilities: {
        transfers: { requested: true },
        card_payments: { requested: true },
      },
      settings: {
        payouts: {
          debit_negative_balances: true,
        },
      },
    });

    // Store account reference in database
    await prisma.creator.update({
      where: { id: creatorId },
      data: {
        stripeAccountId: account.id,
        stripeConnectStatus: 'pending_onboarding',
      },
    });

    return account;
  } catch (error) {
    console.error(`Failed to create Stripe account for creator ${creatorId}:`, error.message);
    throw error;
  }
}

/**
 * Create an onboarding link for a Stripe Connect account
 */
export async function createOnboardingLink(accountId, returnUrl) {
  try {
    const link = await stripe.accountLinks.create({
      account: accountId,
      type: 'account_onboarding',
      return_url: returnUrl,
      refresh_url: returnUrl,
      collect: 'eventually', // Collect info as needed, not all at once
    });

    return link.url;
  } catch (error) {
    console.error(`Failed to create onboarding link for account ${accountId}:`, error.message);
    throw error;
  }
}

/**
 * Create a payout to a creator's connected account
 */
export async function createPayout(accountId, amount, description = '') {
  try {
    const payout = await stripe.payouts.create(
      {
        amount: Math.round(amount * 100), // Convert to cents
        currency: 'usd',
        description: description || 'Creator payout',
        statement_descriptor: description || 'LYLAS PAYOUT',
      },
      {
        stripeAccount: accountId,
      }
    );

    // Record payout in database
    await prisma.payout.create({
      data: {
        stripePayoutId: payout.id,
        stripeAccountId: accountId,
        amount,
        currency: 'usd',
        status: payout.status,
        description,
        arrivalDate: payout.arrival_date ? new Date(payout.arrival_date * 1000) : null,
      },
    });

    return payout;
  } catch (error) {
    console.error(`Failed to create payout for account ${accountId}:`, error.message);
    throw error;
  }
}

/**
 * Get account balance for a creator
 */
export async function getAccountBalance(accountId) {
  try {
    const balance = await stripe.balance.retrieve({
      stripeAccount: accountId,
    });

    return {
      available: balance.available.reduce((sum, bal) => {
        return sum + (bal.currency === 'usd' ? bal.amount / 100 : 0);
      }, 0),
      pending: balance.pending.reduce((sum, bal) => {
        return sum + (bal.currency === 'usd' ? bal.amount / 100 : 0);
      }, 0),
      currency: 'usd',
    };
  } catch (error) {
    console.error(`Failed to fetch balance for account ${accountId}:`, error.message);
    throw error;
  }
}

/**
 * Promo Code Functions
 */

/**
 * Create a Stripe coupon and promotion code for a campaign
 */
export async function createPromoCode(code, discountType, discountValue, campaignId, options = {}) {
  try {
    // Create coupon first
    const couponData = {
      name: options.name || code,
      duration: options.duration || 'repeating', // 'repeating', 'once', 'forever'
      duration_in_months: options.durationMonths || 1,
      max_redemptions: options.maxRedemptions,
      redeem_by: options.redeemBy ? Math.floor(new Date(options.redeemBy).getTime() / 1000) : undefined,
    };

    // Set discount based on type
    if (discountType === 'percentage') {
      couponData.percent_off = discountValue;
    } else if (discountType === 'fixed') {
      couponData.amount_off = Math.round(discountValue * 100); // Convert to cents
      couponData.currency = 'usd';
    } else {
      throw new Error('Invalid discount type. Use "percentage" or "fixed".');
    }

    const coupon = await stripe.coupons.create(couponData);

    // Create promotion code
    const promoCode = await stripe.promotionCodes.create({
      coupon: coupon.id,
      code: code.toUpperCase(),
      max_redemptions: options.maxRedemptions,
      restrictions: options.restrictions, // e.g., { first_time_transaction: true }
    });

    // Store in database
    await prisma.promoCode.create({
      data: {
        code: code.toUpperCase(),
        stripePromotionCodeId: promoCode.id,
        stripeCouponId: coupon.id,
        campaignId,
        discountType,
        discountValue,
        maxRedemptions: options.maxRedemptions,
        expiresAt: options.redeemBy ? new Date(options.redeemBy) : null,
        active: true,
      },
    });

    return {
      promoCode: promoCode.code,
      couponId: coupon.id,
      promotionCodeId: promoCode.id,
      coupon,
    };
  } catch (error) {
    console.error(`Failed to create promo code ${code}:`, error.message);
    throw error;
  }
}

/**
 * Deactivate a promotion code
 */
export async function deactivatePromoCode(promoCodeId) {
  try {
    const promoCode = await stripe.promotionCodes.update(promoCodeId, {
      active: false,
    });

    // Update database
    await prisma.promoCode.update({
      where: { stripePromotionCodeId: promoCodeId },
      data: { active: false },
    });

    return promoCode;
  } catch (error) {
    console.error(`Failed to deactivate promo code ${promoCodeId}:`, error.message);
    throw error;
  }
}

/**
 * Get redemption statistics for a promotion code
 */
export async function getPromoCodeStats(promoCodeId) {
  try {
    const promoCode = await stripe.promotionCodes.retrieve(promoCodeId);

    // Fetch redemptions from Stripe coupons API
    const coupon = await stripe.coupons.retrieve(promoCode.coupon);

    return {
      code: promoCode.code,
      active: promoCode.active,
      timesRedeemed: coupon.times_redeemed || 0,
      maxRedemptions: promoCode.max_redemptions,
      createdAt: new Date(promoCode.created * 1000),
      expiresAt: promoCode.expires_at ? new Date(promoCode.expires_at * 1000) : null,
      discount: {
        type: coupon.percent_off ? 'percentage' : 'fixed',
        value: coupon.percent_off || coupon.amount_off / 100,
        currency: coupon.currency,
      },
      redeemtionRate: coupon.times_redeemed && promoCode.max_redemptions
        ? (coupon.times_redeemed / promoCode.max_redemptions) * 100
        : null,
    };
  } catch (error) {
    console.error(`Failed to get stats for promo code ${promoCodeId}:`, error.message);
    throw error;
  }
}

/**
 * Webhook Helpers
 */

/**
 * Construct and verify a webhook event from Stripe
 */
export function constructWebhookEvent(body, signature) {
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    throw new Error('STRIPE_WEBHOOK_SECRET environment variable is required');
  }

  try {
    const event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET);
    return event;
  } catch (error) {
    console.error('Webhook signature verification failed:', error.message);
    throw error;
  }
}

/**
 * Handle checkout.session.completed webhook
 */
export async function handleCheckoutCompleted(event) {
  const session = event.data.object;

  try {
    // Extract promo code if applied
    let promoCodeId = null;
    if (session.discount) {
      const discountId = session.discount;
      const discount = await stripe.discounts.retrieve(discountId);
      promoCodeId = discount.promotion_code;
    }

    // Find the campaign and creator associated with this promo code
    let creatorId = null;
    if (promoCodeId) {
      const promoCode = await prisma.promoCode.findUnique({
        where: { stripePromotionCodeId: promoCodeId },
      });

      if (promoCode?.campaignId) {
        const campaign = await prisma.campaign.findUnique({
          where: { id: promoCode.campaignId },
          select: { creatorId: true },
        });
        creatorId = campaign?.creatorId;
      }
    }

    // Fallback to metadata if promo code method doesn't work
    if (!creatorId && session.metadata?.creatorId) {
      creatorId = session.metadata.creatorId;
    }

    // Record the conversion
    if (creatorId) {
      await prisma.conversion.create({
        data: {
          creatorId,
          stripeSessionId: session.id,
          stripeCustomerId: session.customer,
          amount: session.amount_total / 100, // Convert from cents
          currency: session.currency,
          promoCodeId,
          metadata: session.metadata,
        },
      });

      // Update creator conversion stats
      await prisma.creator.update({
        where: { id: creatorId },
        data: {
          totalConversions: {
            increment: 1,
          },
          totalRevenue: {
            increment: session.amount_total / 100,
          },
        },
      });
    }

    return { success: true, creatorId };
  } catch (error) {
    console.error('Failed to handle checkout.session.completed:', error.message);
    throw error;
  }
}

/**
 * Handle payment_intent.succeeded webhook
 */
export async function handlePaymentSucceeded(event) {
  const paymentIntent = event.data.object;

  try {
    // Find or create transaction record
    const transaction = await prisma.transaction.upsert({
      where: { stripePaymentIntentId: paymentIntent.id },
      update: {
        status: 'succeeded',
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency,
      },
      create: {
        stripePaymentIntentId: paymentIntent.id,
        stripeCustomerId: paymentIntent.customer,
        status: 'succeeded',
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency,
        metadata: paymentIntent.metadata,
      },
    });

    // Attribute to creator if metadata provided
    if (paymentIntent.metadata?.creatorId) {
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          creatorId: paymentIntent.metadata.creatorId,
        },
      });
    }

    return { success: true, transactionId: transaction.id };
  } catch (error) {
    console.error('Failed to handle payment_intent.succeeded:', error.message);
    throw error;
  }
}

/**
 * Initialize Stripe customer for user
 */
export async function createOrGetStripeCustomer(userId, email) {
  try {
    // Check if customer already exists
    const existingCustomer = await prisma.user.findUnique({
      where: { id: userId },
      select: { stripeCustomerId: true },
    });

    if (existingCustomer?.stripeCustomerId) {
      return existingCustomer.stripeCustomerId;
    }

    // Create new customer
    const customer = await stripe.customers.create({
      email,
      metadata: {
        userId,
      },
    });

    // Store in database
    await prisma.user.update({
      where: { id: userId },
      data: { stripeCustomerId: customer.id },
    });

    return customer.id;
  } catch (error) {
    console.error(`Failed to create/get Stripe customer for user ${userId}:`, error.message);
    throw error;
  }
}

export default stripe;
