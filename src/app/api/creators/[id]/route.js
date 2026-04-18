import { NextResponse } from "next/server";
import { getAuthUser, isAdmin } from "@/lib/getAuthUser";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateCreatorSchema = z.object({
  bio: z.string().optional(),
  tier: z.enum(["BRONZE", "SILVER", "GOLD", "PLATINUM"]).optional(),
  avatar: z.string().optional(),
  specialties: z.array(z.string()).optional(),
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

    const creator = await prisma.creatorProfile.findUnique({
      where: { id: params.id },
      include: {
        user: {
          select: { id: true, email: true, name: true },
        },
        videos: {
          select: {
            id: true,
            title: true,
            status: true,
            views: true,
            clicks: true,
            conversions: true,
            createdAt: true,
          },
        },
        commissions: {
          select: {
            id: true,
            amount: true,
            status: true,
            createdAt: true,
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
    });

    if (!creator) {
      return NextResponse.json(
        { error: "Creator not found" },
        { status: 404 }
      );
    }

    // Calculate stats
    const totalViews = creator.videos.reduce((sum, v) => sum + (v.views || 0), 0);
    const totalClicks = creator.videos.reduce((sum, v) => sum + (v.clicks || 0), 0);
    const totalConversions = creator.videos.reduce((sum, v) => sum + (v.conversions || 0), 0);
    const totalCommissions = creator.commissions.reduce((sum, c) => sum + (c.amount || 0), 0);

    return NextResponse.json({
      ...creator,
      stats: {
        totalViews,
        totalClicks,
        totalConversions,
        totalCommissions,
        avgCtr: totalViews > 0 ? (totalClicks / totalViews * 100).toFixed(2) : 0,
        avgConversionRate: totalClicks > 0 ? (totalConversions / totalClicks * 100).toFixed(2) : 0,
      },
    });
  } catch (error) {
    console.error("GET /api/creators/[id] error:", error);
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

    const creator = await prisma.creatorProfile.findUnique({
      where: { id: params.id },
    });

    if (!creator) {
      return NextResponse.json(
        { error: "Creator not found" },
        { status: 404 }
      );
    }

    // Only admin or creator themselves can update
    if (!isAdmin(user) && user.userId !== creator.userId) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validated = updateCreatorSchema.parse(body);

    const updated = await prisma.creatorProfile.update({
      where: { id: params.id },
      data: validated,
      include: {
        user: {
          select: { id: true, email: true, name: true },
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

    console.error("PUT /api/creators/[id] error:", error);
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

    const creator = await prisma.creatorProfile.findUnique({
      where: { id: params.id },
    });

    if (!creator) {
      return NextResponse.json(
        { error: "Creator not found" },
        { status: 404 }
      );
    }

    await prisma.creatorProfile.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ message: "Creator deleted successfully" });
  } catch (error) {
    console.error("DELETE /api/creators/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
