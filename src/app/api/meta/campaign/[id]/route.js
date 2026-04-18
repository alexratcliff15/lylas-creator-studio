import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/getAuthUser";
import { prisma } from "@/lib/prisma";

const META_GRAPH_API = "https://graph.instagram.com/v18.0";

async function fetchCampaignInsights(campaignId, accessToken) {
  try {
    const response = await fetch(
      `${META_GRAPH_API}/${campaignId}?fields=insights.metric(impressions,clicks,actions,spend).limit(100)&access_token=${accessToken}`,
      { method: "GET" }
    );

    if (!response.ok) {
      throw new Error(`Meta API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.insights?.data || [];
  } catch (error) {
    console.error(`Error fetching campaign insights for ${campaignId}:`, error);
    return [];
  }
}

export async function GET(request, { params }) {
  try {
    const user = await getAuthUser(request);

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get campaign from database
    const campaign = await prisma.campaign.findUnique({
      where: { id: params.id },
      include: {
        videos: {
          include: {
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

    const metaAccessToken = process.env.META_ACCESS_TOKEN;

    if (!metaAccessToken) {
      return NextResponse.json(
        { error: "Meta API token not configured" },
        { status: 500 }
      );
    }

    // Fetch from Meta API if campaign has Meta ID
    let metaInsights = [];
    if (campaign.metaCampaignId) {
      metaInsights = await fetchCampaignInsights(campaign.metaCampaignId, metaAccessToken);
    }

    // Aggregate metrics from database
    const dbMetrics = {
      impressions: 0,
      clicks: 0,
      conversions: 0,
      spend: 0,
    };

    campaign.videos.forEach((video) => {
      video.adMetrics.forEach((metric) => {
        dbMetrics.impressions += metric.impressions || 0;
        dbMetrics.clicks += metric.clicks || 0;
        dbMetrics.conversions += metric.conversions || 0;
        dbMetrics.spend += metric.spend || 0;
      });
    });

    // Parse Meta insights if available
    const metaMetrics = {
      impressions: 0,
      clicks: 0,
      conversions: 0,
      spend: 0,
    };

    for (const insight of metaInsights) {
      const value = insight.values?.[0]?.value || 0;

      switch (insight.name) {
        case "impressions":
          metaMetrics.impressions += value;
          break;
        case "clicks":
          metaMetrics.clicks += value;
          break;
        case "actions":
          metaMetrics.conversions += value;
          break;
        case "spend":
          metaMetrics.spend += value;
          break;
      }
    }

    // Calculate derived metrics
    const calculateMetrics = (metrics) => ({
      ...metrics,
      ctr: metrics.impressions > 0
        ? (metrics.clicks / metrics.impressions * 100).toFixed(2)
        : "0",
      conversionRate: metrics.clicks > 0
        ? (metrics.conversions / metrics.clicks * 100).toFixed(2)
        : "0",
      cpc: metrics.clicks > 0
        ? (metrics.spend / metrics.clicks).toFixed(2)
        : "0",
      cpa: metrics.conversions > 0
        ? (metrics.spend / metrics.conversions).toFixed(2)
        : "0",
      roas: metrics.spend > 0
        ? (metrics.conversions / metrics.spend).toFixed(2)
        : "0",
    });

    return NextResponse.json({
      campaign: {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        budget: campaign.budget,
        startDate: campaign.startDate,
        endDate: campaign.endDate,
      },
      database: calculateMetrics(dbMetrics),
      meta: metaInsights.length > 0 ? calculateMetrics(metaMetrics) : null,
      videoCount: campaign.videos.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("GET /api/meta/campaign/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
