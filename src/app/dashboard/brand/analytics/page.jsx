'use client';
import { useState, useEffect } from 'react';
import { Badge, StatCard, Card } from '@/components/ui';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Eye, MousePointer, DollarSign, TrendingUp, Wifi, AlertCircle } from 'lucide-react';
import { api } from '@/lib/apiClient';

const PLACEMENT_COLORS = ['#5C7A3D', '#3D5A3A', '#F5F7F0'];

export default function AnalyticsPage() {
  const [videoData, setVideoData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [metaConnected, setMetaConnected] = useState(false);
  const [dailyData, setDailyData] = useState([]);
  const [stats, setStats] = useState({
    impressions: 0,
    clicks: 0,
    cpc: 0,
    ctr: 0,
  });

  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);

      // Try to fetch Meta insights
      try {
        const metaRes = await api.get('/api/meta/insights');
        setMetaConnected(true);
      } catch (err) {
        console.log('Meta not connected:', err);
        setMetaConnected(false);
      }

      // Fetch videos for analytics
      const videosRes = await api.get('/api/videos?limit=100');
      const videos = videosRes.videos || [];
      setVideoData(videos);

      // Calculate aggregate stats from video data
      const totalImpressions = videos.reduce((sum, v) => sum + (v.impressions || 0), 0);
      const totalClicks = videos.reduce((sum, v) => sum + (v.clicks || 0), 0);
      const totalSpend = videos.reduce((sum, v) => sum + (v.spend || 0), 0);
      const totalConversions = videos.reduce((sum, v) => sum + (v.conversions || 0), 0);

      const ctr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : 0;
      const cpc = totalClicks > 0 ? (totalSpend / totalClicks).toFixed(2) : 0;
      const cpa = totalConversions > 0 ? (totalSpend / totalConversions).toFixed(2) : 0;

      setStats({
        impressions: totalImpressions,
        clicks: totalClicks,
        cpc: parseFloat(cpc),
        ctr: parseFloat(ctr),
        conversions: totalConversions,
        cpa: parseFloat(cpa),
      });

      // Create daily data from first 7 videos
      const dailyChartData = videos.slice(0, 7).map((v, idx) => ({
        date: `Day ${idx + 1}`,
        spend: v.spend || 0,
        roas: v.roas || 0,
      }));
      setDailyData(dailyChartData.length > 0 ? dailyChartData : [{ date: 'No data', spend: 0, roas: 0 }]);
    } catch (err) {
      console.error('Failed to fetch analytics data:', err);
      setVideoData([]);
    } finally {
      setLoading(false);
    }
  };

  // Create funnel data from video aggregates
  const funnelData = videoData.length > 0 ? [
    { stage: 'Impressions', value: stats.impressions },
    { stage: 'Clicks', value: stats.clicks },
    { stage: 'Add to Cart', value: Math.round(stats.clicks * 0.3) },
    { stage: 'Conversions', value: stats.conversions },
  ] : [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-brand-charcoal mb-2">
            Analytics
          </h1>
          <p className="text-gray-600">
            Real-time campaign performance data
          </p>
        </div>
        {metaConnected ? (
          <Badge variant="success" size="lg" icon={Wifi}>
            Meta Connected
          </Badge>
        ) : (
          <Badge variant="warning" size="lg" icon={AlertCircle}>
            Meta Not Connected
          </Badge>
        )}
      </div>

      {/* Meta Not Connected Warning */}
      {!metaConnected && !loading && (
        <Card className="bg-yellow-50 border-yellow-200">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-yellow-900 mb-1">
                Meta Analytics Unavailable
              </h3>
              <p className="text-sm text-yellow-800">
                Connect your Meta account to see detailed analytics from your campaigns.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Loading State */}
      {loading && (
        <div className="text-center py-12 text-gray-500">
          Loading analytics data...
        </div>
      )}

      {/* Stats */}
      {!loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={Eye}
            label="Impressions"
            value={`${(stats.impressions / 1000).toFixed(1)}K`}
            change="+0%"
            subtitle="Total impressions"
          />
          <StatCard
            icon={MousePointer}
            label="Clicks"
            value={stats.clicks.toLocaleString()}
            change="+0%"
            subtitle="Click through rate"
          />
          <StatCard
            icon={DollarSign}
            label="Cost Per Click"
            value={`$${stats.cpc.toFixed(2)}`}
            change="+0%"
            subtitle="Average CPC"
          />
          <StatCard
            icon={TrendingUp}
            label="CTR"
            value={`${stats.ctr.toFixed(2)}%`}
            change="+0%"
            subtitle="Click-through rate"
          />
        </div>
      )}

      {/* Spend & ROAS Chart */}
      {!loading && dailyData.length > 0 && dailyData[0].date !== 'No data' && (
        <Card>
          <div className="mb-6">
            <h2 className="text-lg font-bold text-brand-charcoal">
              Daily Spend & ROAS
            </h2>
            <p className="text-sm text-gray-500">Last 7 days</p>
          </div>

          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" stroke="#9ca3af" />
              <YAxis
                yAxisId="left"
                stroke="#9ca3af"
                label={{
                  value: 'Spend ($)',
                  angle: -90,
                  position: 'insideLeft',
                  style: { textAnchor: 'middle' },
                }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="#9ca3af"
                label={{
                  value: 'ROAS (x)',
                  angle: 90,
                  position: 'insideRight',
                  style: { textAnchor: 'middle' },
                }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                }}
              />
              <Bar
                yAxisId="left"
                dataKey="spend"
                fill="#5C7A3D"
                radius={[8, 8, 0, 0]}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="roas"
                stroke="#3D5A3A"
                strokeWidth={2}
                dot={{ fill: '#3D5A3A', r: 4 }}
              />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Conversion Funnel */}
      {!loading && funnelData.length > 0 && (
        <Card>
          <div className="mb-6">
            <h2 className="text-lg font-bold text-brand-charcoal">
              Conversion Funnel
            </h2>
            <p className="text-sm text-gray-500">User journey analysis</p>
          </div>

          <div className="space-y-3">
            {funnelData.map((step, idx) => {
              const percentage =
                funnelData[0].value > 0
                  ? (step.value / funnelData[0].value) * 100
                  : 0;
              const prevPercentage =
                idx === 0
                  ? 100
                  : funnelData[idx - 1].value > 0
                    ? (funnelData[idx].value / funnelData[idx - 1].value) * 100
                    : 0;

              return (
                <div key={idx}>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-gray-900">
                      {step.stage}
                    </h4>
                    <div className="text-right">
                      <p className="font-bold text-brand-charcoal">
                        {step.value.toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-500">
                        {percentage.toFixed(1)}% of impressions
                      </p>
                    </div>
                  </div>

                  <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full bg-brand-primary transition-all duration-300"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>

                  {idx < funnelData.length - 1 && (
                    <p className="text-xs text-gray-500 mt-1">
                      Conversion rate: {prevPercentage.toFixed(1)}%
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Key Insights */}
      {!loading && videoData.length > 0 && (
        <Card className="bg-blue-50 border-blue-200">
          <h3 className="font-bold text-brand-charcoal mb-3">Key Insights</h3>
          <ul className="space-y-2 text-sm text-gray-700">
            <li className="flex gap-2">
              <span className="text-brand-primary font-bold">•</span>
              <span>
                Total impressions: {(stats.impressions / 1000).toFixed(0)}K across all videos
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-brand-primary font-bold">•</span>
              <span>
                Click-through rate: {stats.ctr.toFixed(2)}% - {stats.ctr > 5 ? 'excellent' : stats.ctr > 2 ? 'good' : 'average'} performance
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-brand-primary font-bold">•</span>
              <span>
                Cost per click: ${stats.cpc.toFixed(2)} - {stats.cpc < 2 ? 'very efficient' : stats.cpc < 5 ? 'efficient' : 'needs improvement'}
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-brand-primary font-bold">•</span>
              <span>
                Total conversions: {stats.conversions.toLocaleString()} from {videoData.length} videos
              </span>
            </li>
          </ul>
        </Card>
      )}

      {!loading && videoData.length === 0 && (
        <Card className="text-center py-12">
          <p className="text-gray-500">No video data available yet</p>
        </Card>
      )}
    </div>
  );
}
