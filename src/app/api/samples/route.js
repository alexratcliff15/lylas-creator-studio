import { NextResponse } from "next/server";
import { getAuthUser, isAdmin } from "@/lib/getAuthUser";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const applySampleSchema = z.object({
  creatorProfileId: z.string(),
  sampleProductId: z.string(),
  quantity: z.number().int().positive().default(1),
  shippingAddress: z.object({
    line1: z.string(),
    line2: z.string().optional(),
    city: z.string(),
    state: z.string(),
    zip: z.string(),
    country: z.string().length(2),
  }).optional(),
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

    const [samples, total] = await Promise.all([
      prisma.sampleApplication.findMany({
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
          sampleProduct: {
            select: {
              id: true,
              name: true,
              imageUrl: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.sampleApplication.count({ where }),
    ]);

    return NextResponse.json({
      samples,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("GET /api/samples error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const user = await getAuthUser(request);

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validated = applySampleSchema.parse(body);

    // Verify creator exists
    const creator = await prisma.creatorProfile.findUnique({
      where: { id: validated.creatorProfileId },
      include: { user: true },
    });

    if (!creator) {
      return NextResponse.json(
        { error: "Creator not found" },
        { status: 404 }
      );
    }

    // Only creator or admin can apply
    if (!isAdmin(user) && creator.userId !== user.userId) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    // Verify sample product exists
    const sampleProduct = await prisma.sampleProduct.findUnique({
      where: { id: validated.sampleProductId },
    });

    if (!sampleProduct) {
      return NextResponse.json(
        { error: "Sample product not found" },
        { status: 404 }
      );
    }

    // Check if creator already applied for this product
    const existing = await prisma.sampleApplication.findFirst({
      where: {
        creatorProfileId: validated.creatorProfileId,
        sampleProductId: validated.sampleProductId,
        status: { in: ["PENDING", "APPROVED"] },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Creator already has a pending or approved application for this product" },
        { status: 409 }
      );
    }

    const application = await prisma.sampleApplication.create({
      data: {
        creatorProfileId: validated.creatorProfileId,
        sampleProductId: validated.sampleProductId,
        quantity: validated.quantity,
        status: "PENDING",
        shippingAddress: validated.shippingAddress || null,
      },
      include: {
        creatorProfile: {
          select: {
            id: true,
            handle: true,
            tier: true,
          },
        },
        sampleProduct: {
          select: {
            id: true,
            name: true,
            imageUrl: true,
            price: true,
          },
        },
      },
    });

    return NextResponse.json(application, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }

    console.error("POST /api/samples error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
