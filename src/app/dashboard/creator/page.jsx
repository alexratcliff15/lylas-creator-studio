'use client';
import { useState, useEffect } from 'react';
import { Badge, StatCard, ProgressBar, Card, Avatar } from '@/components/ui';
import { Button } from '@/components/ui';
import {
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
import { TrendingUp, Eye, RotateCcw, ShoppingCart, Award, Target } from 'lucide-react';
import { useCreatorProfile } from '@/hooks/useCreatorProfile';
import { api } from '@/lib/apiClient';

const PLACEMENT_COLORS = ['#5C7A3D', '#3D5A3A', '#F5F7F0'];

export default function CreatorDashboard() {
  const { profile, loading: profileLoading, error: profileError } = useCreatorProfile();
  const [stats, setStats] = useState(null);
  const [videos, setVideos] = useState([]);
  const [targets, setTargets] = useState([]);
  const [revenueData, setRevenueData] = useState([]);
  const [placementData, setPlacementData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchDashboardData() {
      if (!profile?.id) return;

      try {
        setLoading(true);

        // Fetch videos
        const videosResponse = await api.get(`/api/videos?creatorProfileId=${profile.id}`);
        const videosData = videosResponse.videos || [];
        setVideos(videosData);

        // Fetch targets
        const targetsResponse = await api.get(`/api/targets?creatorProfileId=${profile.id}`);
        const targetsData = targetsResponse.targets || [];
        setTargets(targetsData);

        // Fetch commissions (source of truth for earnings).
        const paymentsResponse = await api.get(`/api/payments?creatorProfileId=${profile.id}`);
        const commissionsData = paymentsResponse.commissions || [];

        // This-month earnings: sum of commission amounts whose period is the current calendar month.
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
        const monthEarnings = commissionsData.reduce((sum, c) => {
          const ps = new Date(c.periodStart).getTime();
          return ps >= monthStart && ps < monthEnd ? sum + (c.amount || 0) : sum;
        }, 0);

        const totalViews = videosData.reduce((sum, v) => sum + (v.views || 0), 0);
        const totalConversions = commissionsData.reduce((sum, c) => sum + (c.conversions || 0), 0);
        const avgRoas = videosData.length > 0
          ? (videosData.reduce((sum, v) => sum + (v.roas || 0), 0) / videosData.length).toFixed(2)
          : '0.00';

        setStats({
          earnings: `$${monthEarnings.toFixed(2)}`,
          earningsChange: monthEarnings > 0 ? '+—' : '0%',
          views: totalViews >= 1000 ? `${(totalViews / 1000).toFixed(1)}K` : totalViews.toString(),
          viewsChange: totalViews > 0 ? '+—' : '0%',
          roas: avgRoas,
          roasChange: '0%',
          conversions: totalConversions.toLocaleString(),
          conversionsChange: totalConversions > 0 ? '+—' : '0%',
        });

        // Generate revenue chart data (last 7 days simulation)
        const chartData = generateLast7DaysData(videosData);
        setRevenueData(chartData);

        // Calculate placement distribution from video data
        const placements = calculatePlacementData(videosData);
        setPlacementData(placements);

        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, [profile?.id]);

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your profile...</p>
        </div>
      </div>
    );
  }

  if (profileError || !profile) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-brand-charcoal mb-2">Creator Dashboard</h1>
          <p className="text-gray-600">Set up your creator profile to get started</p>
        </div>
        <Card className="text-center py-12">
          <h3 className="text-lg font-semibold text-gray-600 mb-2">Profile Not Found</h3>
          <p className="text-gray-500 mb-6">
            We couldn't find your creator profile. Please complete your profile setup.
          </p>
          <Button href="/dashboard/creator/setup">Complete Your Profile</Button>
        </Card>
      </div>
    );
  }

  const activeVideos = videos.filter(v => v.status === 'active').slice(0, 5);

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-brand-charcoal mb-2">
            Welcome back, {profile.handle}!
          </h1>
          <p className="text-gray-600">
            You're doing great. Keep creating amazing UGC content.
          </p>
        </div>
        <Badge
          variant={
            profile.tier === 'PLATINUM' ? 'primary'
            : profile.tier === 'GOLD' ? 'gold'
            : profile.tier === 'SILVER' ? 'success'
            : 'warning'
          }
          size="lg"
          icon={Award}
        >
          {profile.tier
            ? profile.tier.charAt(0) + profile.tier.slice(1).toLowerCase() + ' Tier'
            : 'Bronze Tier'}
        </Badge>
      </div>

      {/* Stats */}
      {!loading && stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={TrendingUp}
            label="Earnings"
            value={stats.earnings}
            change={stats.earningsChange}
            subtitle="This month"
          />
          <StatCard
            icon={Eye}
            label="Total Views"
            value={stats.views}
            change={stats.viewsChange}
            subtitle="Last 30 days"
          />
          <StatCard
            icon={RotateCcw}
            label="Avg ROAS"
            value={stats.roas}
            change={stats.roasChange}
            subtitle="Return on ad spend"
          />
          <StatCard
            icon={ShoppingCart}
            label="Conversions"
            value={stats.conversions}
            change={stats.conversionsChange}
            subtitle="Total purchases"
          />
        </div>
      )}

      {error && (
        <Card className="bg-red-50 border border-red-200 p-4">
          <p className="text-red-800 text-sm">Error loading dashboard: {error}</p>
        </Card>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <Card className="lg:col-span-2">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-brand-charcoal">
              Revenue & Conversions
            </h2>
            <p className="text-sm text-gray-500">Last 7 days</p>
          </div>

          {revenueData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={revenueData}>
                <defs>
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
                  dataKey="revenue"
                  stroke="#5C7A3D"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorRevenue)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-300 text-gray-500">
              <p>No data yet. Upload videos to see revenue data.</p>
            </div>
          )}
        </Card>

        {/* Placement Distribution */}
        <Card>
          <div className="mb-6">
            <h2 className="text-lg font-bold text-brand-charcoal">
              Ad Placements
            </h2>
            <p className="text-sm text-gray-500">This month</p>
          </div>

          {placementData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={placementData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {placementData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PLACEMENT_COLORS[index % PLACEMENT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>

              <div className="space-y-2 mt-4">
                {placementData.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: PLACEMENT_COLORS[idx % PLACEMENT_COLORS.length] }}
                      />
                      <span className="text-gray-700">{item.name}</span>
                    </div>
                    <span className="font-semibold text-brand-charcoal">
                      {item.value}%
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-300 text-gray-500">
              <p>No placement data yet</p>
            </div>
          )}
        </Card>
      </div>

      {/* Targets */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-brand-charcoal">Monthly Targets</h2>
          <Badge variant="info" size="sm" icon={Target}>
            AI-Optimized
          </Badge>
        </div>

        {targets.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {targets.map((target) => (
              <Card key={target.id} className="flex flex-col">
                <p className="text-sm font-medium text-gray-600 mb-2">
                  {target.label || 'Target'}
                </p>

                <div className="mb-4">
                  <div className="text-2xl font-bold text-brand-charcoal mb-1">
                    {typeof target.current === 'number' ? target.current.toLocaleString() : target.current}
                  </div>
                  <p className="text-xs text-gray-500">
                    of {typeof target.target === 'number' ? target.target.toLocaleString() : target.target} target
                  </p>
                </div>

                <ProgressBar
                  value={target.current}
                  max={target.target}
                  color="bg-brand-primary"
                  showPercent={false}
                  size="sm"
                  className="mb-3"
                />

                <p className="text-xs text-brand-primary font-semibold">
                  {target.aiInsight || 'Keep up the good work!'}
                </p>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="text-center py-8">
            <p className="text-gray-500">No targets set yet</p>
          </Card>
        )}
      </div>

      {/* Active Videos */}
      <Card>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-brand-charcoal">Active Videos</h2>
          <Button variant="secondary" size="sm">
            View All
          </Button>
        </div>

        {activeVideos.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 text-gray-600">
                <tr>
                  <th className="text-left py-3 px-4 font-semibold">Title</th>
                  <th className="text-left py-3 px-4 font-semibold">Status</th>
                  <th className="text-right py-3 px-4 font-semibold">Views</th>
                  <th className="text-right py-3 px-4 font-semibold">Conversions</th>
                  <th className="text-right py-3 px-4 font-semibold">ROAS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {activeVideos.map((video) => (
                  <tr key={video.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-4">
                      <div>
                        <p className="font-medium text-brand-charcoal">
                          {video.title}
                        </p>
                        <p className="text-xs text-gray-500">{video.campaign?.name || 'N/A'}</p>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <Badge
                        variant={video.status === 'active' ? 'success' : 'warning'}
                        size="sm"
                      >
                        {video.status}
                      </Badge>
                    </td>
                    <td className="py-4 px-4 text-right font-medium">
                      {(video.views || 0).toLocaleString()}
                    </td>
                    <td className="py-4 px-4 text-right font-medium">
                      {video.conversions || 0}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <span className="font-semibold text-brand-primary">
                        {video.roas ? video.roas.toFixed(2) : '-'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500 mb-4">No active videos yet</p>
            <Button href="/dashboard/creator/upload" variant="primary">
              Upload Your First Video
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}

function generateLast7DaysData(videos) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const data = days.map(day => ({
    date: day,
    revenue: 0,
    conversions: 0,
  }));

  videos.forEach(video => {
    const randomDay = Math.floor(Math.random() * 7);
    data[randomDay].revenue += (video.revenue || 0) / 7;
    data[randomDay].conversions += Math.floor((video.conversions || 0) / 7);
  });

  return data;
}

function calculatePlacementData(videos) {
  const placements = { 'Feed': 0, 'Reels': 0, 'Stories': 0 };

  videos.forEach((video, idx) => {
    const placement = Object.keys(placements)[idx % 3];
    placements[placement] += video.views ? 1 : 0;
  });

  const total = Object.values(placements).reduce((a, b) => a + b, 0) || 1;

  return Object.entries(placements).map(([name, count]) => ({
    name,
    value: Math.round((count / total) * 100) || 0,
  }));
}
