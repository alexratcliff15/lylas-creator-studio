import { NextResponse } from "next/server";
import { getAuthUser, isAdmin } from "@/lib/getAuthUser";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const creatorSchema = z.object({
  handle: z.string().min(1),
  bio: z.string().optional(),
  tier: z.enum(["BRONZE", "SILVER", "GOLD", "PLATINUM"]).optional(),
  avatar: z.string().optional(),
  specialties: z.array(z.string()).optional(),
});

export async function GET(request) {
  try {
    const user = await getAuthUser(request);

    if (!user || !isAdmin(user)) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const tier = searchParams.get("tier");
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    const where = {};

    if (tier) where.tier = tier;
    if (search) {
      where.OR = [
        { handle: { contains: search, mode: "insensitive" } },
        { user: { name: { contains: search, mode: "insensitive" } } },
      ];
    }

    const skip = (page - 1) * limit;

    const [creators, total] = await Promise.all([
      prisma.creatorProfile.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
          _count: {
            select: {
              videos: true,
              sampleApplications: true,
              commissions: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.creatorProfile.count({ where }),
    ]);

    return NextResponse.json({
      creators,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("GET /api/creators error:", error);
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
    const validated = creatorSchema.parse(body);

    // Check if creator profile with this handle already exists
    const existingCreator = await prisma.creatorProfile.findUnique({
      where: { handle: validated.handle },
    });

    if (existingCreator) {
      return NextResponse.json(
        { error: "Creator with this handle already exists" },
        { status: 409 }
      );
    }

    // Get or create user (for creator profiles, we expect userId to be passed or inferred)
    // For now, create a user with the handle as name
    const newUser = await prisma.user.create({
      data: {
        email: `${validated.handle}@creators.local`,
        name: validated.handle,
        role: "CREATOR",
      },
    });

    const creator = await prisma.creatorProfile.create({
      data: {
        userId: newUser.id,
        handle: validated.handle,
        bio: validated.bio || "",
        tier: validated.tier || "BRONZE",
        avatar: validated.avatar || null,
        specialties: validated.specialties || [],
        rating: 0,
        stripeAccountId: null,
        stripeOnboarded: false,
        totalEarnings: 0,
        totalConversions: 0,
        totalViews: 0,
        avgRoas: 0,
        isApproved: false,
      },
      include: {
        user: {
          select: { id: true, email: true, name: true },
        },
      },
    });

    return NextResponse.json(creator, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }

    console.error("POST /api/creators error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
