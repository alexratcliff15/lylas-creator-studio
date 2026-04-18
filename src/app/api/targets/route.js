import { NextResponse } from "next/server";
import { getAuthUser, isAdmin } from "@/lib/getAuthUser";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateTargetsSchema = z.object({
  creatorProfileId: z.string(),
  conversions: z.number().optional(),
  views: z.number().optional(),
  engagement: z.number().optional(),
  period: z.enum(["WEEKLY", "MONTHLY", "QUARTERLY"]).optional(),
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

    const where = {};
    if (creatorProfileId) where.creatorProfileId = creatorProfileId;

    const targets = await prisma.creatorTarget.findMany({
      where,
      include: {
        creatorProfile: {
          select: {
            id: true,
            handle: true,
            tier: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    // Get creator performance vs targets
    const targetsWithProgress = await Promise.all(
      targets.map(async (target) => {
        const videos = await prisma.video.findMany({
          where: { creatorProfileId: target.creatorProfileId },
          include: {
            adMetrics: true,
          },
        });

        const period = target.period || "MONTHLY";
        const now = new Date();
        let periodStart;

        switch (period) {
          case "WEEKLY":
            periodStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case "QUARTERLY":
            periodStart = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
            break;
          case "MONTHLY":
          default:
            periodStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        }

        const periodVideos = videos.filter((v) => v.createdAt >= periodStart);

        const actualConversions = periodVideos.reduce((sum, v) => sum + (v.conversions || 0), 0);
        const actualViews = periodVideos.reduce((sum, v) => sum + (v.views || 0), 0);
        const actualEngagement = periodVideos.reduce((sum, v) => {
          const engagement = v.adMetrics.reduce((m, metric) => m + (metric.clicks || 0), 0);
          return sum + engagement;
        }, 0);

        return {
          ...target,
          period,
          actual: {
            conversions: actualConversions,
            views: actualViews,
            engagement: actualEngagement,
          },
          progress: {
            conversions: target.conversions ? Math.round((actualConversions / target.conversions) * 100) : 0,
            views: target.views ? Math.round((actualViews / target.views) * 100) : 0,
            engagement: target.engagement ? Math.round((actualEngagement / target.engagement) * 100) : 0,
          },
        };
      })
    );

    return NextResponse.json({
      targets: targetsWithProgress,
    });
  } catch (error) {
    console.error("GET /api/targets error:", error);
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
    const validated = updateTargetsSchema.parse(body);

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

    // Only creator or admin can update targets
    if (!isAdmin(user) && creator.userId !== user.userId) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    // Check if targets exist
    const existing = await prisma.creatorTarget.findFirst({
      where: { creatorProfileId: validated.creatorProfileId },
    });

    let target;

    if (existing) {
      // Update existing targets
      target = await prisma.creatorTarget.update({
        where: { id: existing.id },
        data: {
          conversions: validated.conversions !== undefined ? validated.conversions : existing.conversions,
          views: validated.views !== undefined ? validated.views : existing.views,
          engagement: validated.engagement !== undefined ? validated.engagement : existing.engagement,
          period: validated.period || existing.period,
        },
      });
    } else {
      // Create new targets (AI-powered recommendation if no data)
      const videos = await prisma.video.findMany({
        where: { creatorProfileId: validated.creatorProfileId },
        include: { adMetrics: true },
      });

      let aiTargets = {
        conversions: 100,
        views: 10000,
        engagement: 500,
      };

      // If creator has history, use it to generate targets
      if (videos.length > 0) {
        const avgConversions = videos.reduce((sum, v) => sum + (v.conversions || 0), 0) / videos.length;
        const avgViews = videos.reduce((sum, v) => sum + (v.views || 0), 0) / videos.length;
        const avgEngagement = videos.reduce((sum, v) => {
          const eng = v.adMetrics.reduce((m, metric) => m + (metric.clicks || 0), 0);
          return sum + eng;
        }, 0) / videos.length;

        // Set targets at 120% of average (growth goal)
        aiTargets = {
          conversions: Math.round(avgConversions * 1.2),
          views: Math.round(avgViews * 1.2),
          engagement: Math.round(avgEngagement * 1.2),
        };
      }

      // Apply tier-based multipliers
      const tierMultipliers = {
        BRONZE: 1,
        SILVER: 1.5,
        GOLD: 2.0,
        PLATINUM: 2.5,
      };

      const multiplier = tierMultipliers[creator.tier] || 1;

      target = await prisma.creatorTarget.create({
        data: {
          creatorProfileId: validated.creatorProfileId,
          conversions: validated.conversions || Math.round(aiTargets.conversions * multiplier),
          views: validated.views || Math.round(aiTargets.views * multiplier),
          engagement: validated.engagement || Math.round(aiTargets.engagement * multiplier),
          period: validated.period || "MONTHLY",
        },
      });
    }

    return NextResponse.json(target, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }

    console.error("POST /api/targets error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
