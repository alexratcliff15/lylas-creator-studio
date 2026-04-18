import { NextResponse } from "next/server";
import { getAuthUser, isAdmin } from "@/lib/getAuthUser";
import { prisma } from "@/lib/prisma";

const META_GRAPH_API = "https://graph.instagram.com/v18.0";

async function fetchMetaMetrics(adId, accessToken) {
  try {
    const response = await fetch(
      `${META_GRAPH_API}/${adId}?fields=insights.metric(impressions,clicks,actions,spend).limit(100)&access_token=${accessToken}`,
      { method: "GET" }
    );

    if (!response.ok) {
      throw new Error(`Meta API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.insights?.data || [];
  } catch (error) {
    console.error(`Error fetching Meta metrics for ad ${adId}:`, error);
    return [];
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

    const metaAccessToken = process.env.META_ACCESS_TOKEN;

    if (!metaAccessToken) {
      return NextResponse.json(
        { error: "Meta API token not configured" },
        { status: 500 }
      );
    }

    // Get all published videos with Meta ad IDs
    const videos = await prisma.video.findMany({
      where: {
        status: "PUBLISHED",
        metaAdId: { not: null },
      },
      include: {
        adMetrics: true,
      },
    });

    const results = {
      successful: 0,
      failed: 0,
      skipped: 0,
      errors: [],
    };

    for (const video of videos) {
      try {
        // Fetch metrics from Meta
        const insights = await fetchMetaMetrics(video.metaAdId, metaAccessToken);

        if (insights.length === 0) {
          results.skipped++;
          continue;
        }

        // Process each insight
        for (const insight of insights) {
          const value = insight.values?.[0]?.value || 0;

          let metricData = {
            impressions: 0,
            clicks: 0,
            conversions: 0,
            spend: 0,
          };

          switch (insight.name) {
            case "impressions":
              metricData.impressions = value;
              break;
            case "clicks":
              metricData.clicks = value;
              break;
            case "actions":
              metricData.conversions = value;
              break;
            case "spend":
              metricData.spend = value;
              break;
          }

          // Create or update AdMetric record
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          await prisma.adMetric.upsert({
            where: {
              videoId_date: {
                videoId: video.id,
                date: today,
              },
            },
            update: metricData,
            create: {
              videoId: video.id,
              date: today,
              ...metricData,
            },
          });
        }

        // Recalculate video-level aggregates
        const allMetrics = await prisma.adMetric.findMany({
          where: { videoId: video.id },
        });

        const aggregated = {
          views: allMetrics.reduce((sum, m) => sum + (m.impressions || 0), 0),
          clicks: allMetrics.reduce((sum, m) => sum + (m.clicks || 0), 0),
          conversions: allMetrics.reduce((sum, m) => sum + (m.conversions || 0), 0),
        };

        await prisma.video.update({
          where: { id: video.id },
          data: aggregated,
        });

        results.successful++;
      } catch (error) {
        console.error(`Error syncing video ${video.id}:`, error);
        results.failed++;
        results.errors.push({
          videoId: video.id,
          error: error.message,
        });
      }
    }

    return NextResponse.json({
      message: "Meta sync completed",
      ...results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("POST /api/meta/sync error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
