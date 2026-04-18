import { NextResponse } from "next/server";
import { getAuthUser, isAdmin } from "@/lib/getAuthUser";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createVideoSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  creatorProfileId: z.string(),
  campaignId: z.string().optional(),
  fileUrl: z.string().url(),
  thumbnailUrl: z.string().url().optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
  metaAdId: z.string().optional(),
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
    const campaignId = searchParams.get("campaignId");
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    const where = {};

    if (creatorProfileId) where.creatorProfileId = creatorProfileId;
    if (campaignId) where.campaignId = campaignId;
    if (status) where.status = status;

    const skip = (page - 1) * limit;

    const [videos, total] = await Promise.all([
      prisma.video.findMany({
        where,
        skip,
        take: limit,
        include: {
          creatorProfile: {
            select: {
              id: true,
              handle: true,
              user: {
                select: {
                  email: true,
                },
              },
            },
          },
          campaign: {
            select: {
              id: true,
              name: true,
            },
          },
          adMetrics: {
            select: {
              impressions: true,
              clicks: true,
              conversions: true,
              spend: true,
            },
          },
          _count: {
            select: {
              adMetrics: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.video.count({ where }),
    ]);

    const videosWithStats = videos.map((video) => {
      const totalImpressions = video.adMetrics.reduce((sum, m) => sum + (m.impressions || 0), 0);
      const totalClicks = video.adMetrics.reduce((sum, m) => sum + (m.clicks || 0), 0);
      const totalConversions = video.adMetrics.reduce((sum, m) => sum + (m.conversions || 0), 0);
      const totalSpend = video.adMetrics.reduce((sum, m) => sum + (m.spend || 0), 0);

      return {
        ...video,
        aggregatedMetrics: {
          impressions: totalImpressions,
          clicks: totalClicks,
          conversions: totalConversions,
          spend: totalSpend,
          ctr: totalImpressions > 0 ? (totalClicks / totalImpressions * 100).toFixed(2) : 0,
          conversionRate: totalClicks > 0 ? (totalConversions / totalClicks * 100).toFixed(2) : 0,
          cpc: totalClicks > 0 ? (totalSpend / totalClicks).toFixed(2) : 0,
          cpa: totalConversions > 0 ? (totalSpend / totalConversions).toFixed(2) : 0,
        },
      };
    });

    return NextResponse.json({
      videos: videosWithStats,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("GET /api/videos error:", error);
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
    const validated = createVideoSchema.parse(body);

    // Verify creator profile exists
    const creator = await prisma.creatorProfile.findUnique({
      where: { id: validated.creatorProfileId },
    });

    if (!creator) {
      return NextResponse.json(
        { error: "Creator not found" },
        { status: 404 }
      );
    }

    // Verify user owns this creator (unless admin)
    if (!isAdmin(user) && creator.userId !== user.userId) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    // Verify campaign if provided
    if (validated.campaignId) {
      const campaign = await prisma.campaign.findUnique({
        where: { id: validated.campaignId },
      });

      if (!campaign) {
        return NextResponse.json(
          { error: "Campaign not found" },
          { status: 404 }
        );
      }
    }

    const video = await prisma.video.create({
      data: {
        title: validated.title,
        description: validated.description || "",
        creatorProfileId: validated.creatorProfileId,
        campaignId: validated.campaignId || null,
        fileUrl: validated.fileUrl,
        thumbnailUrl: validated.thumbnailUrl || null,
        status: validated.status || "DRAFT",
        metaAdId: validated.metaAdId || null,
        views: 0,
        clicks: 0,
        conversions: 0,
      },
      include: {
        creatorProfile: {
          select: { id: true, handle: true },
        },
        campaign: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json(video, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }

    console.error("POST /api/videos error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
