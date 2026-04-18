import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

const META_WEBHOOK_VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN;

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("hub.mode");
    const token = searchParams.get("hub.verify_token");
    const challenge = searchParams.get("hub.challenge");

    // Verify webhook token
    if (mode === "subscribe" && token === META_WEBHOOK_VERIFY_TOKEN) {
      return new NextResponse(challenge, { status: 200 });
    }

    return NextResponse.json(
      { error: "Webhook verification failed" },
      { status: 403 }
    );
  } catch (error) {
    console.error("GET /api/webhooks/meta error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();

    // Meta sends webhooks in batches
    if (!body.entry) {
      return NextResponse.json({ received: true });
    }

    for (const entry of body.entry) {
      for (const change of entry.changes || []) {
        // Handle different change types
        switch (change.field) {
          case "ad_account_insights":
            await handleAdAccountInsights(change.value);
            break;

          case "ad_campaign_insights":
            await handleAdCampaignInsights(change.value);
            break;

          case "adset_insights":
            await handleAdSetInsights(change.value);
            break;

          case "ad_insights":
            await handleAdInsights(change.value);
            break;

          default:
            console.log(`Unhandled Meta webhook field: ${change.field}`);
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("POST /api/webhooks/meta error:", error);
    // Return 200 anyway to prevent Meta from retrying
    return NextResponse.json({ received: true });
  }
}

async function handleAdAccountInsights(data) {
  try {
    // Account-level metrics update
    if (!data.insights) return;

    const metrics = parseMetricsArray(data.insights);

    console.log("Account insights updated:", metrics);
  } catch (error) {
    console.error("Error handling ad account insights:", error);
  }
}

async function handleAdCampaignInsights(data) {
  try {
    if (!data.campaign_id || !data.insights) return;

    const metrics = parseMetricsArray(data.insights);

    // Find campaign in database
    const campaign = await prisma.campaign.findFirst({
      where: { metaCampaignId: data.campaign_id },
    });

    if (!campaign) {
      console.log(`Campaign not found for Meta ID: ${data.campaign_id}`);
      return;
    }

    // Update campaign spend
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: {
        spend: (metrics.spend || 0) + (campaign.spend || 0),
      },
    });

    console.log(`Campaign ${campaign.id} insights updated`);
  } catch (error) {
    console.error("Error handling campaign insights:", error);
  }
}

async function handleAdSetInsights(data) {
  try {
    if (!data.adset_id || !data.insights) return;

    const metrics = parseMetricsArray(data.insights);

    console.log(`AdSet ${data.adset_id} insights:`, metrics);
  } catch (error) {
    console.error("Error handling adset insights:", error);
  }
}

async function handleAdInsights(data) {
  try {
    if (!data.ad_id || !data.insights) return;

    const metrics = parseMetricsArray(data.insights);

    // Find video by Meta ad ID
    const video = await prisma.video.findFirst({
      where: { metaAdId: data.ad_id },
    });

    if (!video) {
      console.log(`Video not found for Meta ad ID: ${data.ad_id}`);
      return;
    }

    // Create or update ad metric for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await prisma.adMetric.upsert({
      where: {
        videoId_date: {
          videoId: video.id,
          date: today,
        },
      },
      update: {
        impressions: (metrics.impressions || 0) + (await getExistingMetric(video.id, "impressions") || 0),
        clicks: (metrics.clicks || 0) + (await getExistingMetric(video.id, "clicks") || 0),
        conversions: (metrics.conversions || 0) + (await getExistingMetric(video.id, "conversions") || 0),
        spend: (metrics.spend || 0) + (await getExistingMetric(video.id, "spend") || 0),
      },
      create: {
        videoId: video.id,
        date: today,
        impressions: metrics.impressions || 0,
        clicks: metrics.clicks || 0,
        conversions: metrics.conversions || 0,
        spend: metrics.spend || 0,
      },
    });

    // Update video-level aggregates
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

    console.log(`Video ${video.id} metrics updated from Meta`);
  } catch (error) {
    console.error("Error handling ad insights:", error);
  }
}

function parseMetricsArray(insights) {
  const metrics = {
    impressions: 0,
    clicks: 0,
    conversions: 0,
    spend: 0,
  };

  if (!Array.isArray(insights)) return metrics;

  for (const insight of insights) {
    switch (insight.name) {
      case "impressions":
        metrics.impressions = parseInt(insight.values?.[0]?.value || 0);
        break;
      case "clicks":
        metrics.clicks = parseInt(insight.values?.[0]?.value || 0);
        break;
      case "actions":
        metrics.conversions = parseInt(insight.values?.[0]?.value || 0);
        break;
      case "spend":
        metrics.spend = parseFloat(insight.values?.[0]?.value || 0);
        break;
    }
  }

  return metrics;
}

async function getExistingMetric(videoId, field) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const metric = await prisma.adMetric.findUnique({
      where: {
        videoId_date: {
          videoId,
          date: today,
        },
      },
      select: { [field]: true },
    });

    return metric?.[field] || 0;
  } catch {
    return 0;
  }
}
