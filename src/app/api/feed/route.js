import { NextResponse } from "next/server";
import { getAuthUser, isAdmin } from "@/lib/getAuthUser";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createFeedPostSchema = z.object({
  content: z.string().min(1).max(5000),
  creatorProfileId: z.string(),
  videoTitle: z.string().optional(),
  tags: z.array(z.string()).optional(),
  views: z.number().int().nonnegative().optional(),
  roas: z.number().nonnegative().optional(),
});

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const creatorProfileId = searchParams.get("creatorProfileId");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    const where = {};
    if (creatorProfileId) where.creatorProfileId = creatorProfileId;

    const skip = (page - 1) * limit;

    const [posts, total] = await Promise.all([
      prisma.feedPost.findMany({
        where,
        skip,
        take: limit,
        include: {
          creatorProfile: {
            select: {
              id: true,
              handle: true,
              avatar: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.feedPost.count({ where }),
    ]);

    // likes / comments are scalar Int columns on FeedPost — not relations.
    const postsWithStats = posts.map((post) => ({
      ...post,
      stats: {
        likeCount: post.likes ?? 0,
        commentCount: post.comments ?? 0,
        saveCount: post.saves ?? 0,
      },
    }));

    return NextResponse.json({
      posts: postsWithStats,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("GET /api/feed error:", error);
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
    const validated = createFeedPostSchema.parse(body);

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

    // Only creator or admin can post
    if (!isAdmin(user) && creator.userId !== user.userId) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    const post = await prisma.feedPost.create({
      data: {
        content: validated.content,
        creatorProfileId: validated.creatorProfileId,
        videoTitle: validated.videoTitle || null,
        tags: validated.tags || [],
        views: validated.views ?? null,
        roas: validated.roas ?? null,
      },
      include: {
        creatorProfile: {
          select: {
            id: true,
            handle: true,
            avatar: true,
          },
        },
      },
    });

    return NextResponse.json(post, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }

    console.error("POST /api/feed error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
