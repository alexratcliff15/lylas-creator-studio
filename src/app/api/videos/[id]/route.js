import { NextResponse } from "next/server";
import { getAuthUser, isAdmin } from "@/lib/getAuthUser";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateVideoSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
  metaAdId: z.string().optional(),
  thumbnailUrl: z.string().url().optional(),
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

    const video = await prisma.video.findUnique({
      where: { id: params.id },
      include: {
        creatorProfile: {
          select: {
            id: true,
            handle: true,
            tier: true,
          },
        },
        campaign: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
        adMetrics: {
          orderBy: { createdAt: "desc" },
          take: 30,
        },
      },
    });

    if (!video) {
      return NextResponse.json(
        { error: "Video not found" },
        { status: 404 }
      );
    }

    // Calculate aggregated metrics
    const totalImpressions = video.adMetrics.reduce((sum, m) => sum + (m.impressions || 0), 0);
    const totalClicks = video.adMetrics.reduce((sum, m) => sum + (m.clicks || 0), 0);
    const totalConversions = video.adMetrics.reduce((sum, m) => sum + (m.conversions || 0), 0);
    const totalSpend = video.adMetrics.reduce((sum, m) => sum + (m.spend || 0), 0);

    return NextResponse.json({
      ...video,
      metrics: {
        totalImpressions,
        totalClicks,
        totalConversions,
        totalSpend,
        ctr: totalImpressions > 0 ? (totalClicks / totalImpressions * 100).toFixed(2) : "0",
        conversionRate: totalClicks > 0 ? (totalConversions / totalClicks * 100).toFixed(2) : "0",
        cpc: totalClicks > 0 ? (totalSpend / totalClicks).toFixed(2) : "0",
        cpa: totalConversions > 0 ? (totalSpend / totalConversions).toFixed(2) : "0",
        roas: totalSpend > 0 ? (video.views / totalSpend).toFixed(2) : "0",
      },
    });
  } catch (error) {
    console.error("GET /api/videos/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(request, { params }) {
  try {
    const user = await getAuthUser(request);

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const video = await prisma.video.findUnique({
      where: { id: params.id },
      include: {
        creatorProfile: true,
      },
    });

    if (!video) {
      return NextResponse.json(
        { error: "Video not found" },
        { status: 404 }
      );
    }

    // Only admin or creator owner can update
    if (!isAdmin(user) && video.creatorProfile.userId !== user.userId) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validated = updateVideoSchema.parse(body);

    const updated = await prisma.video.update({
      where: { id: params.id },
      data: validated,
      include: {
        creatorProfile: {
          select: { id: true, handle: true },
        },
        campaign: {
          select: { id: true, name: true },
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

    console.error("PUT /api/videos/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const user = await getAuthUser(request);

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const video = await prisma.video.findUnique({
      where: { id: params.id },
      include: {
        creatorProfile: true,
      },
    });

    if (!video) {
      return NextResponse.json(
        { error: "Video not found" },
        { status: 404 }
      );
    }

    // Only admin or creator owner can delete
    if (!isAdmin(user) && video.creatorProfile.userId !== user.userId) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    await prisma.video.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ message: "Video deleted successfully" });
  } catch (error) {
    console.error("DELETE /api/videos/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
