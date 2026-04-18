import { NextResponse } from "next/server";
import { getAuthUser, isAdmin } from "@/lib/getAuthUser";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateCampaignSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  budget: z.number().positive().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"]).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export async function GET(request, { params }) {
  try {
    const user = await getAuthUser(request);

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const campaign = await prisma.campaign.findUnique({
      where: { id: params.id },
      include: {
        videos: {
          include: {
            creatorProfile: {
              select: {
                id: true,
                handle: true,
              },
            },
            adMetrics: true,
          },
        },
      },
    });

    if (!campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    // Calculate comprehensive analytics
    const totalImpressions = campaign.videos.reduce((sum, v) =>
      sum + v.adMetrics.reduce((m, metric) => m + (metric.impressions || 0), 0), 0
    );
    const totalClicks = campaign.videos.reduce((sum, v) =>
      sum + v.adMetrics.reduce((m, metric) => m + (metric.clicks || 0), 0), 0
    );
    const totalConversions = campaign.videos.reduce((sum, v) =>
      sum + v.adMetrics.reduce((m, metric) => m + (metric.conversions || 0), 0), 0
    );

    const analytics = {
      totalImpressions,
      totalClicks,
      totalConversions,
      spent: campaign.spent,
      remaining: Math.max(0, campaign.budget - campaign.spent),
      ctr: totalImpressions > 0 ? (totalClicks / totalImpressions * 100).toFixed(2) : "0",
      conversionRate: totalClicks > 0 ? (totalConversions / totalClicks * 100).toFixed(2) : "0",
      cpc: totalClicks > 0 ? (campaign.spent / totalClicks).toFixed(2) : "0",
      cpa: totalConversions > 0 ? (campaign.spent / totalConversions).toFixed(2) : "0",
      roas: campaign.spent > 0 ? (totalConversions / campaign.spent).toFixed(2) : "0",
      budgetUtilization: campaign.budget > 0 ? ((campaign.spent / campaign.budget) * 100).toFixed(2) : "0",
    };

    return NextResponse.json({
      ...campaign,
      analytics,
    });
  } catch (error) {
    console.error("GET /api/campaigns/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(request, { params }) {
  try {
    const user = await getAuthUser(request);

    if (!user || !isAdmin(user)) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const campaign = await prisma.campaign.findUnique({
      where: { id: params.id },
    });

    if (!campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validated = updateCampaignSchema.parse(body);

    const updated = await prisma.campaign.update({
      where: { id: params.id },
      data: {
        ...validated,
        startDate: validated.startDate ? new Date(validated.startDate) : undefined,
        endDate: validated.endDate ? new Date(validated.endDate) : undefined,
      },
      include: {
        videos: {
          select: { id: true, title: true },
        },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }

    console.error("PUT /api/campaigns/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const user = await getAuthUser(request);

    if (!user || !isAdmin(user)) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const campaign = await prisma.campaign.findUnique({
      where: { id: params.id },
    });

    if (!campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    // Archive instead of delete (soft delete)
    const archived = await prisma.campaign.update({
      where: { id: params.id },
      data: { status: "ARCHIVED" },
    });

    return NextResponse.json({
      message: "Campaign archived successfully",
      campaign: archived,
    });
  } catch (error) {
    console.error("DELETE /api/campaigns/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
