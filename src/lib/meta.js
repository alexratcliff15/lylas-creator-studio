import { prisma } from './prisma.js';

/**
 * Meta Marketing API Client
 * Handles all interactions with Meta's Graph API for ad insights, creative performance, and audience management
 */
export class MetaApiClient {
  constructor(accessToken, apiVersion = 'v19.0') {
    this.accessToken = accessToken;
    this.apiVersion = apiVersion;
    this.baseUrl = `https://graph.facebook.com/${apiVersion}`;
    this.rateLimitRemaining = 200;
    this.rateLimitResetTime = Date.now();
  }

  /**
   * Generic fetch wrapper with rate limit handling
   */
  async request(endpoint, params = {}) {
    // Check rate limit before making request
    if (this.rateLimitRemaining < 10) {
      const waitTime = this.rateLimitResetTime - Date.now();
      if (waitTime > 0) {
        console.warn(`Rate limit approaching. Waiting ${waitTime}ms...`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }

    const url = new URL(`${this.baseUrl}${endpoint}`);
    url.searchParams.append('access_token', this.accessToken);

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, value);
      }
    });

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      // Update rate limit from response headers
      const remaining = response.headers.get('x-business-use-case-usage')?.split('call_count')[1];
      if (remaining) {
        this.rateLimitRemaining = parseInt(remaining) || this.rateLimitRemaining;
      }

      const resetTime = response.headers.get('x-rate-limit-reset');
      if (resetTime) {
        this.rateLimitResetTime = parseInt(resetTime) * 1000;
      }

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Meta API Error: ${error.error?.message || response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Meta API request failed for ${endpoint}:`, error.message);
      throw error;
    }
  }

  /**
   * Post request wrapper with error handling
   */
  async post(endpoint, data = {}) {
    const url = `${this.baseUrl}${endpoint}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          access_token: this.accessToken,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Meta API Error: ${error.error?.message || response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Meta API post failed for ${endpoint}:`, error.message);
      throw error;
    }
  }

  /**
   * Get account-level insights (impressions, clicks, spend, etc.)
   */
  async getAdAccountInsights(adAccountId, dateRange = {}) {
    const { startDate, endDate } = dateRange;

    const params = {
      fields: [
        'account_id',
        'impressions',
        'clicks',
        'spend',
        'actions',
        'action_values',
        'ctr',
        'cpm',
        'cpp',
        'cost_per_action_type',
        'reach',
        'frequency',
      ].join(','),
      time_range: startDate
        ? JSON.stringify({ since: startDate, until: endDate })
        : undefined,
      date_preset: !startDate ? 'last_30d' : undefined,
    };

    const data = await this.request(`/${adAccountId}/insights`, params);
    return data.data || [];
  }

  /**
   * Get campaign-level insights
   */
  async getCampaignInsights(campaignId, dateRange = {}) {
    const { startDate, endDate } = dateRange;

    const params = {
      fields: [
        'campaign_id',
        'campaign_name',
        'impressions',
        'clicks',
        'spend',
        'actions',
        'action_values',
        'ctr',
        'cpc',
        'cpm',
        'cpp',
        'cost_per_action_type',
        'reach',
        'frequency',
        'objective',
      ].join(','),
      time_range: startDate
        ? JSON.stringify({ since: startDate, until: endDate })
        : undefined,
      date_preset: !startDate ? 'last_30d' : undefined,
    };

    const data = await this.request(`/${campaignId}/insights`, params);
    return data.data || [];
  }

  /**
   * Get individual ad performance metrics
   */
  async getAdInsights(adId, dateRange = {}) {
    const { startDate, endDate } = dateRange;

    const params = {
      fields: [
        'ad_id',
        'ad_name',
        'impressions',
        'clicks',
        'spend',
        'actions',
        'action_values',
        'ctr',
        'cpc',
        'cpm',
        'cpp',
        'cost_per_action_type',
        'reach',
        'frequency',
        'quality_ranking',
        'quality_score_ectr',
        'quality_score_ecc',
        'quality_score_organic',
      ].join(','),
      time_range: startDate
        ? JSON.stringify({ since: startDate, until: endDate })
        : undefined,
      date_preset: !startDate ? 'last_7d' : undefined,
    };

    const data = await this.request(`/${adId}/insights`, params);
    return data.data?.[0] || null;
  }

  /**
   * Get creative-level performance data
   */
  async getAdCreativePerformance(creativeId, dateRange = {}) {
    const { startDate, endDate } = dateRange;

    const params = {
      fields: [
        'creative{id,name,image_hash,image_url,video_data,title,body,call_to_action_type}',
        'impressions',
        'clicks',
        'spend',
        'actions',
        'action_values',
        'ctr',
        'cpc',
        'cpm',
        'reach',
        'frequency',
        'quality_ranking',
      ].join(','),
      time_range: startDate
        ? JSON.stringify({ since: startDate, until: endDate })
        : undefined,
      date_preset: !startDate ? 'last_30d' : undefined,
    };

    const data = await this.request(`/${creativeId}`, params);
    return data || null;
  }

  /**
   * Sync ad metrics back to database for a specific video/ad
   */
  async syncAdMetrics(videoId, metaAdId, dateRange = {}) {
    try {
      const insights = await this.getAdInsights(metaAdId, dateRange);

      if (!insights) {
        console.warn(`No insights found for ad ${metaAdId}`);
        return null;
      }

      // Update or create ad metrics in database
      const metrics = await prisma.adMetrics.upsert({
        where: {
          videoId_metaAdId: {
            videoId,
            metaAdId,
          },
        },
        update: {
          impressions: parseInt(insights.impressions) || 0,
          clicks: parseInt(insights.clicks) || 0,
          spend: parseFloat(insights.spend) || 0,
          conversions: this.parseActions(insights.actions),
          conversionValue: parseFloat(insights.action_values?.[0]?.value) || 0,
          ctr: parseFloat(insights.ctr) || 0,
          cpc: parseFloat(insights.cpc) || 0,
          cpm: parseFloat(insights.cpm) || 0,
          qualityRanking: insights.quality_ranking,
          lastSyncedAt: new Date(),
        },
        create: {
          videoId,
          metaAdId,
          impressions: parseInt(insights.impressions) || 0,
          clicks: parseInt(insights.clicks) || 0,
          spend: parseFloat(insights.spend) || 0,
          conversions: this.parseActions(insights.actions),
          conversionValue: parseFloat(insights.action_values?.[0]?.value) || 0,
          ctr: parseFloat(insights.ctr) || 0,
          cpc: parseFloat(insights.cpc) || 0,
          cpm: parseFloat(insights.cpm) || 0,
          qualityRanking: insights.quality_ranking,
          lastSyncedAt: new Date(),
        },
      });

      return metrics;
    } catch (error) {
      console.error(`Failed to sync metrics for video ${videoId}:`, error.message);
      throw error;
    }
  }

  /**
   * Parse actions array from Meta API response
   */
  parseActions(actions) {
    if (!Array.isArray(actions)) return 0;

    return actions.reduce((total, action) => {
      return total + (parseInt(action.value) || 0);
    }, 0);
  }

  /**
   * Get performance breakdown by placement (Reels, Stories, Feed, etc.)
   */
  async getPlacementBreakdown(campaignId, dateRange = {}) {
    const { startDate, endDate } = dateRange;

    const params = {
      fields: [
        'impression_device',
        'impressions',
        'clicks',
        'spend',
        'actions',
        'action_values',
        'ctr',
        'cpm',
        'cpc',
      ].join(','),
      breakdowns: 'impression_device',
      time_range: startDate
        ? JSON.stringify({ since: startDate, until: endDate })
        : undefined,
      date_preset: !startDate ? 'last_30d' : undefined,
    };

    const data = await this.request(`/${campaignId}/insights`, params);

    // Map device names to placements
    const placementMap = {
      'iphone': 'Mobile Feed',
      'android': 'Mobile Feed',
      'desktop': 'Desktop Feed',
    };

    const breakdown = {};
    (data.data || []).forEach((item) => {
      const placement = placementMap[item.impression_device] || item.impression_device;
      breakdown[placement] = {
        impressions: parseInt(item.impressions) || 0,
        clicks: parseInt(item.clicks) || 0,
        spend: parseFloat(item.spend) || 0,
        conversions: this.parseActions(item.actions),
        ctr: parseFloat(item.ctr) || 0,
        cpm: parseFloat(item.cpm) || 0,
      };
    });

    return breakdown;
  }

  /**
   * Get conversion funnel data (impressions -> clicks -> conversions)
   */
  async getConversionFunnel(campaignId, dateRange = {}) {
    const { startDate, endDate } = dateRange;

    const insights = await this.getCampaignInsights(campaignId, { startDate, endDate });
    if (!insights || insights.length === 0) {
      return null;
    }

    const data = insights[0];

    const impressions = parseInt(data.impressions) || 0;
    const clicks = parseInt(data.clicks) || 0;
    const conversions = this.parseActions(data.actions);

    return {
      impressions,
      clicks,
      conversions,
      conversionValue: parseFloat(data.action_values?.[0]?.value) || 0,
      clickThroughRate: impressions > 0 ? (clicks / impressions) * 100 : 0,
      conversionRate: clicks > 0 ? (conversions / clicks) * 100 : 0,
      costPerConversion: conversions > 0 ? parseFloat(data.spend) / conversions : 0,
      roas: data.action_values?.[0]?.value ? parseFloat(data.action_values[0].value) / parseFloat(data.spend) : 0,
    };
  }

  /**
   * Create a custom audience for lookalike targeting
   */
  async createCustomAudience(adAccountId, name, data) {
    const payload = {
      name,
      description: data.description || '',
      customer_file_source: 'USER_PROVIDED_ONLY',
      subtype: data.subtype || 'CUSTOM',
    };

    // Add hashed customer data if provided
    if (data.hashes) {
      payload.hashes = data.hashes; // Pre-hashed email/phone/name data
    }

    // Add pixel-based data if provided
    if (data.pixelId) {
      payload.pixel_id = data.pixelId;
    }

    const result = await this.post(`/${adAccountId}/customaudiences`, payload);
    return result;
  }

  /**
   * Get demographic and interest data for an audience
   */
  async getAudienceInsights(adSetId) {
    const params = {
      fields: [
        'audience_size',
        'audience_name',
        'targeting',
        'daily_outcomes_curve',
        'audience_size_upper_bound',
        'audience_size_lower_bound',
      ].join(','),
    };

    const data = await this.request(`/${adSetId}`, params);

    // Parse targeting to extract demographics
    const targeting = data.targeting || {};

    return {
      audienceSize: data.audience_size,
      audienceName: data.audience_name,
      demographics: {
        ageRanges: targeting.age_range,
        genders: targeting.genders,
        locations: targeting.locations,
        languages: targeting.languages,
      },
      interests: targeting.interests || [],
      behaviors: targeting.behaviors || [],
      excluded: {
        locations: targeting.excluded_locations,
        interests: targeting.excluded_interests,
      },
    };
  }
}

/**
 * Factory function to create Meta API client with token from environment
 */
export function createMetaClient(accessToken) {
  if (!accessToken) {
    throw new Error('Meta access token is required');
  }
  return new MetaApiClient(accessToken);
}

export default MetaApiClient;
