import { NextResponse } from "next/server";
import { getAuthUser, isAdmin } from "@/lib/getAuthUser";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const processPayoutSchema = z.object({
  creatorProfileId: z.string(),
  amount: z.number().positive(),
  commissionIds: z.array(z.string()).optional(),
});

export async function GET(request) {
  try {
    const user = await getAuthUser(request);

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const creatorProfileId = searchParams.get("creatorProfileId");
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    const where = {};
    if (creatorProfileId) where.creatorProfileId = creatorProfileId;
    if (status) where.status = status;

    const skip = (page - 1) * limit;

    const [commissions, total] = await Promise.all([
      prisma.commission.findMany({
        where,
        skip,
        take: limit,
        include: {
          creatorProfile: {
            select: {
              id: true,
              handle: true,
              user: {
                select: { email: true }
              }
            },
          },
          video: {
            select: { id: true, title: true },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.commission.count({ where }),
    ]);

    return NextResponse.json({
      commissions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("GET /api/payments error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const user = await getAuthUser(request);

    if (!user || !isAdmin(user)) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validated = processPayoutSchema.parse(body);

    // Get creator
    const creator = await prisma.creatorProfile.findUnique({
      where: { id: validated.creatorProfileId },
    });

    if (!creator) {
      return NextResponse.json(
        { error: "Creator not found" },
        { status: 404 }
      );
    }

    if (!creator.stripeAccountId) {
      return NextResponse.json(
        { error: "Creator does not have Stripe Connect account" },
        { status: 400 }
      );
    }

    // Get commissions to process
    let commissionsToProcess;
    if (validated.commissionIds && validated.commissionIds.length > 0) {
      commissionsToProcess = await prisma.commission.findMany({
        where: {
          id: { in: validated.commissionIds },
          creatorProfileId: validated.creatorProfileId,
          status: "PENDING",
        },
      });
    } else {
      // Get pending commissions
      commissionsToProcess = await prisma.commission.findMany({
        where: {
          creatorProfileId: validated.creatorProfileId,
          status: "PENDING",
        },
      });
    }

    if (commissionsToProcess.length === 0) {
      return NextResponse.json(
        { error: "No pending commissions to process" },
        { status: 400 }
      );
    }

    // Calculate total
    const totalAmount = commissionsToProcess.reduce((sum, c) => sum + c.amount, 0);

    if (totalAmount > validated.amount) {
      return NextResponse.json(
        { error: "Insufficient payout amount" },
        { status: 400 }
      );
    }

    // Create transfer to connected account
    const transfer = await stripe.transfers.create({
      amount: Math.round(totalAmount * 100), // Convert to cents
      currency: "usd",
      destination: creator.stripeAccountId,
      description: `Payout to ${creator.handle} for ${commissionsToProcess.length} commissions`,
    });

    // Update commission statuses
    await prisma.commission.updateMany({
      where: { id: { in: commissionsToProcess.map((c) => c.id) } },
      data: {
        status: "PAID",
        stripeTransferId: transfer.id,
        paidAt: new Date(),
      },
    });

    return NextResponse.json({
      message: "Payout processed successfully",
      transfer: {
        id: transfer.id,
        amount: transfer.amount / 100,
        status: transfer.status,
      },
      commissionsProcessed: commissionsToProcess.length,
      totalAmount,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }

    console.error("POST /api/payments error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
