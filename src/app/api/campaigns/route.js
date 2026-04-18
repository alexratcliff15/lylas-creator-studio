import { NextResponse } from "next/server";
import { getAuthUser, isAdmin } from "@/lib/getAuthUser";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createCampaignSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  budget: z.number().positive(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"]).optional(),
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
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    const where = {};
    if (status) where.status = status;

    const skip = (page - 1) * limit;

    const [campaigns, total] = await Promise.all([
      prisma.campaign.findMany({
        where,
        skip,
        take: limit,
        include: {
          brandProfile: {
            select: {
              id: true,
              companyName: true,
            },
          },
          videos: {
            select: {
              id: true,
              title: true,
              status: true,
            },
          },
          _count: {
            select: {
              videos: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.campaign.count({ where }),
    ]);

    const campaignsWithStats = campaigns.map((campaign) => {
      const totalSpent = campaign.spent || 0;
      const videoCount = campaign._count.videos;

      return {
        ...campaign,
        stats: {
          videoCount,
          remaining: Math.max(0, campaign.budget - totalSpent),
          spendPercentage: campaign.budget > 0 ? ((totalSpent / campaign.budget) * 100).toFixed(2) : 0,
        },
      };
    });

    return NextResponse.json({
      campaigns: campaignsWithStats,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("GET /api/campaigns error:", error);
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
    const validated = createCampaignSchema.parse(body);

    // Auto-discover the brand profile from the authenticated user
    let brandProfile = await prisma.brandProfile.findUnique({
      where: { userId: user.userId },
    });

    // If no brand profile exists, create one
    if (!brandProfile) {
      brandProfile = await prisma.brandProfile.create({
        data: {
          userId: user.userId,
          companyName: "My Brand",
        },
      });
    }

    const campaign = await prisma.campaign.create({
      data: {
        brandProfileId: brandProfile.id,
        name: validated.name,
        description: validated.description || "",
        budget: validated.budget,
        spent: 0,
        startDate: validated.startDate ? new Date(validated.startDate) : null,
        endDate: validated.endDate ? new Date(validated.endDate) : null,
        status: validated.status || "DRAFT",
      },
      include: {
        brandProfile: {
          select: { id: true, companyName: true },
        },
        videos: {
          select: { id: true, title: true },
        },
      },
    });

    return NextResponse.json(campaign, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }

    console.error("POST /api/campaigns error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
