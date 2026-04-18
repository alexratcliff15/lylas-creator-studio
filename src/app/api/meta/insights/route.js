import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/getAuthUser';

const META_GRAPH_API = 'https://graph.facebook.com/v18.0';

/**
 * Fetch ad-account insights from Meta's Marketing API.
 * Docs: https://developers.facebook.com/docs/marketing-api/insights
 */
async function fetchAdAccountInsights({ accessToken, adAccountId, dateRange }) {
  const params = new URLSearchParams({
    fields: 'impressions,clicks,ctr,cpc,spend,reach,actions,action_values',
    access_token: accessToken,
  });

  if (dateRange) {
    params.set('time_range', JSON.stringify({
      since: dateRange.since,
      until: dateRange.until,
    }));
  } else {
    params.set('date_preset', 'last_30d');
  }

  const url = `${META_GRAPH_API}/${adAccountId}/insights?${params.toString()}`;
  const response = await fetch(url, { method: 'GET' });

  const body = await response.json();

  if (!response.ok) {
    const err = new Error(body?.error?.message || `Meta API error: ${response.statusText}`);
    err.metaError = body?.error;
    throw err;
  }

  return body.data || [];
}

const toISODate = (d) => d.toISOString().slice(0, 10);

export async function GET(request) {
  try {
    const user = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const accessToken = process.env.META_ACCESS_TOKEN;
    const adAccountId = process.env.META_AD_ACCOUNT_ID;

    if (!accessToken || !adAccountId) {
      return NextResponse.json(
        { error: 'META_ACCESS_TOKEN or META_AD_ACCOUNT_ID not configured' },
        { status: 500 }
      );
    }

    const dateRange = startDate && endDate
      ? { since: toISODate(new Date(startDate)), until: toISODate(new Date(endDate)) }
      : null;

    const rows = await fetchAdAccountInsights({ accessToken, adAccountId, dateRange });

    // Meta returns an array of row objects — aggregate in case there are multiple.
    const totals = {
      impressions: 0,
      clicks: 0,
      spend: 0,
      reach: 0,
      conversions: 0,
      conversionValue: 0,
    };

    for (const row of rows) {
      totals.impressions += Number(row.impressions || 0);
      totals.clicks += Number(row.clicks || 0);
      totals.spend += Number(row.spend || 0);
      totals.reach += Number(row.reach || 0);

      // Purchase-like conversion actions
      for (const action of row.actions || []) {
        if (['purchase', 'offsite_conversion.fb_pixel_purchase', 'onsite_web_purchase'].includes(action.action_type)) {
          totals.conversions += Number(action.value || 0);
        }
      }
      for (const v of row.action_values || []) {
        if (['purchase', 'offsite_conversion.fb_pixel_purchase', 'onsite_web_purchase'].includes(v.action_type)) {
          totals.conversionValue += Number(v.value || 0);
        }
      }
    }

    const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
    const cpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0;
    const cpa = totals.conversions > 0 ? totals.spend / totals.conversions : 0;
    const conversionRate = totals.clicks > 0 ? (totals.conversions / totals.clicks) * 100 : 0;
    const roas = totals.spend > 0 ? totals.conversionValue / totals.spend : 0;

    return NextResponse.json({
      insights: {
        impressions: totals.impressions,
        clicks: totals.clicks,
        spend: +totals.spend.toFixed(2),
        reach: totals.reach,
        conversions: totals.conversions,
        conversionValue: +totals.conversionValue.toFixed(2),
        ctr: +ctr.toFixed(2),
        cpc: +cpc.toFixed(2),
        cpa: +cpa.toFixed(2),
        conversionRate: +conversionRate.toFixed(2),
        roas: +roas.toFixed(2),
      },
      period: dateRange ?? { date_preset: 'last_30d' },
      adAccountId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('GET /api/meta/insights error:', error);
    return NextResponse.json(
      {
        error: error.message,
        meta: error.metaError ?? null,
      },
      { status: 500 }
    );
  }
}
