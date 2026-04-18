import { NextResponse } from "next/server";
import { getAuthUser, isAdmin } from "@/lib/getAuthUser";
import { prisma } from "@/lib/prisma";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(request) {
  try {
    const user = await getAuthUser(request);

    if (!user || !isAdmin(user)) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get all creators with pending commissions and Stripe account
    const creatorStats = await prisma.creatorProfile.findMany({
      where: {
        stripeAccountId: { not: null },
        commissions: {
          some: {
            status: "PENDING",
          },
        },
      },
      include: {
        commissions: {
          where: { status: "PENDING" },
        },
      },
    });

    const results = {
      successful: 0,
      failed: 0,
      skipped: 0,
      totalAmount: 0,
      errors: [],
      transfers: [],
    };

    for (const creator of creatorStats) {
      try {
        if (!creator.commissions || creator.commissions.length === 0) {
          results.skipped++;
          continue;
        }

        // Calculate total for this creator
        const totalAmount = creator.commissions.reduce((sum, c) => sum + c.amount, 0);

        // Create transfer
        const transfer = await stripe.transfers.create({
          amount: Math.round(totalAmount * 100), // Convert to cents
          currency: "usd",
          destination: creator.stripeAccountId,
          description: `Batch payout to ${creator.handle} for ${creator.commissions.length} commissions`,
        });

        // Update commissions
        await prisma.commission.updateMany({
          where: { id: { in: creator.commissions.map((c) => c.id) } },
          data: {
            status: "PAID",
            stripeTransferId: transfer.id,
            paidAt: new Date(),
          },
        });

        results.successful++;
        results.totalAmount += totalAmount;
        results.transfers.push({
          creatorProfileId: creator.id,
          creatorHandle: creator.handle,
          transferId: transfer.id,
          amount: totalAmount,
          commissionCount: creator.commissions.length,
          status: transfer.status,
        });
      } catch (error) {
        console.error(`Error processing payout for creator ${creator.id}:`, error);
        results.failed++;
        results.errors.push({
          creatorProfileId: creator.id,
          creatorHandle: creator.handle,
          error: error.message,
        });
      }
    }

    return NextResponse.json({
      message: "Batch payout processing completed",
      ...results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("POST /api/payments/process-all error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
