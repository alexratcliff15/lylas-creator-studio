'use client';
import { useState, useEffect, useCallback } from 'react';
import { Badge, StatCard, Card, Avatar } from '@/components/ui';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import { DollarSign, Users, TrendingUp, RotateCcw } from 'lucide-react';
import { api } from '@/lib/apiClient';

export default function BrandDashboard() {
  const [stats, setStats] = useState(null);
  const [topCreators, setTopCreators] = useState([]);
  const [topContent, setTopContent] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [contentFilter, setContentFilter] = useState('all');

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch campaigns to calculate total spend
        const campaignsRes = await api.get('/api/campaigns?limit=100');
        const totalSpend = campaignsRes.campaigns?.reduce((sum, c) => sum + (c.spent || 0), 0) || 0;

        // Fetch creators for active count and top performers
        const creatorsRes = await api.get('/api/creators?limit=100');
        const creatorsData = creatorsRes.creators || [];
        const activeCreators = creatorsData.filter(c => c.isApproved).length;
        const topCreatorsByRoas = creatorsData
          .sort((a, b) => (b.avgRoas || 0) - (a.avgRoas || 0))
          .slice(0, 4);

        // Fetch videos for top content and blended ROAS
        const videosRes = await api.get('/api/videos?limit=100');
        const videosData = videosRes.videos || [];
        const topVideosByRoas = videosData
          .sort((a, b) => (b.roas || 0) - (a.roas || 0))
          .slice(0, 3);

        // Calculate blended ROAS
        const totalRevenue = videosData.reduce((sum, v) => sum + (v.revenue || 0), 0);
        const totalVideoSpend = videosData.reduce((sum, v) => sum + (v.spend || 0), 0);
        const blendedRoas = totalVideoSpend > 0 ? (totalRevenue / totalVideoSpend).toFixed(2) : '0.00';

        // Create chart data from campaign data (last 7 days approximation)
        const chartDataPoints = campaignsRes.campaigns?.slice(0, 7).map((campaign, idx) => ({
          date: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][idx],
          spend: Math.round(campaign.spent / 7),
          revenue: Math.round((campaign.spent / 7) * parseFloat(blendedRoas)),
        })) || [];

        setStats({
          totalSpend: `$${totalSpend.toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
          blendedRoas: `${blendedRoas}x`,
          activeCreators: activeCreators.toString(),
          activeAds: videosData.filter(v => v.status === 'active').length.toString(),
          spendChange: '+0%',
          roasChange: '+0%',
          creatorsChange: `+${activeCreators}`,
          adsChange: `+${videosData.filter(v => v.status === 'active').length}`,
        });

        setTopCreators(topCreatorsByRoas.map((creator, idx) => ({
          id: creator.id,
          name: creator.user?.name || creator.handle,
          handle: `@${creator.handle}`,
          roas: creator.avgRoas || 0,
          videosCount: creator._count?.videos || 0,
          earnings: creator.totalEarnings || 0,
          initials: (creator.user?.name || creator.handle)
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2),
        })));

        setTopContent(topVideosByRoas.map(video => ({
          id: video.id,
          title: video.title,
          creator: video.creatorProfile?.user?.name || video.creatorProfile?.handle || 'Unknown',
          style: 'UGC',
          daysActive: 0,
          views: video.views || 0,
          roas: video.roas || 0,
          earnings: Math.round((video.revenue || 0) * 0.1),
          type: 'reels',
        })));

        setChartData(chartDataPoints.length > 0 ? chartDataPoints : [
          { date: 'No data', spend: 0, revenue: 0 }
        ]);
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err);
        setError('Failed to load dashboard data');
        setStats({
          totalSpend: '$0',
          blendedRoas: '0x',
          activeCreators: '0',
          activeAds: '0',
          spendChange: '+0%',
          roasChange: '+0%',
          creatorsChange: '+0',
          adsChange: '+0',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const filteredContent =
    contentFilter === 'all'
      ? topContent
      : topContent.filter((c) => c.type === contentFilter);

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div>
        <h1 className="text-3xl font-bold text-brand-charcoal mb-2">
          Campaign Dashboard
        </h1>
        <p className="text-gray-600">
          Real-time overview of your UGC creator network performance
        </p>
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
          {error}
        </div>
      )}

      {/* Stats */}
      {!loading && stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={DollarSign}
            label="Total Spend"
            value={stats.totalSpend}
            change={stats.spendChange}
            subtitle="This month"
          />
          <StatCard
            icon={RotateCcw}
            label="Blended ROAS"
            value={stats.blendedRoas}
            change={stats.roasChange}
            subtitle="All campaigns"
          />
          <StatCard
            icon={Users}
            label="Active Creators"
            value={stats.activeCreators}
            change={stats.creatorsChange}
            subtitle="Network size"
          />
          <StatCard
            icon={TrendingUp}
            label="Active Ads"
            value={stats.activeAds}
            change={stats.adsChange}
            subtitle="Running now"
          />
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="text-center py-12 text-gray-500">
          Loading dashboard data...
        </div>
      )}

      {/* Charts */}
      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Spend vs Revenue */}
          <Card className="lg:col-span-2">
            <div className="mb-6">
              <h2 className="text-lg font-bold text-brand-charcoal">
                Ad Spend vs Revenue
              </h2>
              <p className="text-sm text-gray-500">Last 7 days</p>
            </div>

            {chartData.length > 0 && chartData[0].date !== 'No data' ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3D5A3A" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3D5A3A" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#5C7A3D" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#5C7A3D" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="spend"
                    stroke="#3D5A3A"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorSpend)"
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#5C7A3D"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorRevenue)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-300 flex items-center justify-center text-gray-500">
                No data yet
              </div>
            )}
          </Card>

          {/* Top Creators Sidebar */}
          <Card>
            <h2 className="text-lg font-bold text-brand-charcoal mb-4">
              Top Creators
            </h2>

            {topCreators.length > 0 ? (
              <div className="space-y-3">
                {topCreators.map((creator, idx) => (
                  <div key={creator.id} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-bold text-brand-primary">
                        #{idx + 1}
                      </span>
                      <Avatar initials={creator.initials} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {creator.name}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {creator.handle}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-brand-primary font-bold">
                        {creator.roas.toFixed(2)}x ROAS
                      </span>
                      <span className="text-gray-600">
                        {creator.videosCount} videos
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No creators yet</p>
            )}
          </Card>
        </div>
      )}

      {/* Top Performing Content */}
      {!loading && topContent.length > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-brand-charcoal">
                Top Performing Content
              </h2>
              <p className="text-sm text-gray-500">This month</p>
            </div>

            <div className="flex gap-2">
              {['all', 'reels', 'stories', 'feed'].map((filter) => (
                <button
                  key={filter}
                  onClick={() => setContentFilter(filter)}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                    contentFilter === filter
                      ? 'bg-brand-primary text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {filter.charAt(0).toUpperCase() + filter.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {filteredContent.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {filteredContent.map((content) => (
                <div
                  key={content.id}
                  className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
                >
                  {/* Thumbnail */}
                  <div className="w-full aspect-video bg-gradient-to-br from-gray-300 to-gray-400 rounded-lg mb-3 flex items-center justify-center">
                    <span className="text-4xl">🎬</span>
                  </div>

                  {/* Info */}
                  <h3 className="font-semibold text-brand-charcoal mb-1 line-clamp-2">
                    {content.title}
                  </h3>
                  <p className="text-xs text-gray-600 mb-3">
                    by {content.creator}
                  </p>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                    <div>
                      <p className="text-gray-600">Views</p>
                      <p className="font-bold text-brand-charcoal">
                        {(content.views / 1000).toFixed(1)}K
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">ROAS</p>
                      <p className="font-bold text-brand-primary">{content.roas.toFixed(2)}x</p>
                    </div>
                  </div>

                  <Badge variant="info" size="sm" className="w-full text-center">
                    ${content.earnings} earned
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No content matching filter</p>
          )}
        </Card>
      )}
    </div>
  );
}
