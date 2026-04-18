'use client';
import { useState, useEffect } from 'react';
import { Badge, Card, ProgressBar } from '@/components/ui';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Target, TrendingUp, Lightbulb } from 'lucide-react';
import { useCreatorProfile } from '@/hooks/useCreatorProfile';
import { api } from '@/lib/apiClient';

export default function TargetsPage() {
  const { profile, loading: profileLoading, error: profileError } = useCreatorProfile();
  const [targets, setTargets] = useState([]);
  const [performanceData, setPerformanceData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchTargetsData() {
      if (!profile?.id) return;

      try {
        setLoading(true);

        // Fetch targets
        const targetsResponse = await api.get(
          `/api/targets?creatorProfileId=${profile.id}`
        );
        const targetsData = targetsResponse.targets || [];
        setTargets(targetsData);

        // Fetch videos to generate performance chart
        const videosResponse = await api.get(
          `/api/videos?creatorProfileId=${profile.id}`
        );
        const videosData = videosResponse.videos || [];

        // Generate performance data
        const chartData = generatePerformanceData(videosData);
        setPerformanceData(chartData);

        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchTargetsData();
  }, [profile?.id]);

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading targets...</p>
        </div>
      </div>
    );
  }

  if (profileError || !profile) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-brand-charcoal mb-2">
            Monthly Targets
          </h1>
          <p className="text-gray-600">
            AI-optimized targets personalized for your tier
          </p>
        </div>
        <Card className="text-center py-12">
          <h3 className="text-lg font-semibold text-gray-600 mb-2">Profile Not Found</h3>
          <p className="text-gray-500">Complete your profile to view targets.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-brand-charcoal mb-2">
          Monthly Targets
        </h1>
        <p className="text-gray-600">
          AI-optimized targets personalized for your tier
        </p>
      </div>

      {error && (
        <Card className="bg-red-50 border border-red-200 p-4">
          <p className="text-red-800 text-sm">Error loading targets: {error}</p>
        </Card>
      )}

      {/* Explainer Banner */}
      <Card className="bg-gradient-to-r from-brand-primary to-brand-accent text-white p-6 border-0">
        <div className="flex items-start gap-4">
          <Lightbulb className="w-6 h-6 flex-shrink-0 mt-1" />
          <div>
            <h3 className="font-bold text-lg mb-2">How Targets Work</h3>
            <p className="text-sm opacity-90 mb-2">
              Your monthly targets are calculated based on your tier, historical
              performance, and community benchmarks. They adjust as you progress to
              keep you challenged but achievable.
            </p>
            <ul className="text-sm space-y-1 opacity-90">
              <li>• Reach all 4 targets to unlock a tier bonus</li>
              <li>• Gold tier: +$150 bonus if targets met</li>
              <li>• Targets reset on the 1st of each month</li>
            </ul>
          </div>
        </div>
      </Card>

      {/* Target Cards */}
      {!loading && targets.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {targets.map((target) => {
            const percentage = Math.min(
              (target.current / target.target) * 100,
              100
            );
            const isAchieved = target.current >= target.target;

            return (
              <Card key={target.id}>
                {/* Header */}
                <div className="flex items-start justify-between mb-4 pb-4 border-b border-gray-200">
                  <h3 className="font-bold text-lg text-brand-charcoal">
                    {target.label || target.name || 'Target'}
                  </h3>
                  {isAchieved && (
                    <Badge variant="success" size="sm" icon={TrendingUp}>
                      Complete
                    </Badge>
                  )}
                </div>

                {/* Values */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Current</p>
                    <p className="text-2xl font-bold text-brand-charcoal">
                      {typeof target.current === 'string'
                        ? target.current
                        : target.current.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Target</p>
                    <p className="text-2xl font-bold text-brand-primary">
                      {typeof target.target === 'string'
                        ? target.target
                        : target.target.toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Progress */}
                <ProgressBar
                  value={target.current}
                  max={target.target}
                  color={isAchieved ? 'bg-green-600' : 'bg-brand-primary'}
                  showPercent={true}
                  size="md"
                  className="mb-4"
                />

                {/* AI Insight */}
                {target.aiInsight && (
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-xs font-semibold text-blue-900 mb-1">
                      AI Insight
                    </p>
                    <p className="text-xs text-blue-800 leading-relaxed">
                      {target.aiInsight}
                    </p>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      ) : !loading ? (
        <Card className="text-center py-8">
          <p className="text-gray-500">No targets set yet. Complete your profile to get personalized targets.</p>
        </Card>
      ) : null}

      {/* Performance Chart */}
      {performanceData.length > 0 && (
        <Card>
          <div className="mb-6">
            <h2 className="text-lg font-bold text-brand-charcoal">
              Weekly Performance
            </h2>
            <p className="text-sm text-gray-500">This month trend</p>
          </div>

          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={performanceData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="week" stroke="#9ca3af" />
              <YAxis yAxisId="left" stroke="#9ca3af" />
              <YAxis yAxisId="right" orientation="right" stroke="#3D5A3A" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                }}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="views"
                stroke="#5C7A3D"
                strokeWidth={2}
                name="Views"
                dot={{ fill: '#5C7A3D', r: 4 }}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="roas"
                stroke="#3D5A3A"
                strokeWidth={2}
                name="ROAS"
                dot={{ fill: '#3D5A3A', r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Tips Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <h3 className="font-bold text-brand-charcoal mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-brand-primary" />
            Tips to Hit Targets
          </h3>
          <ul className="space-y-2 text-sm text-gray-700">
            <li className="flex gap-2">
              <span className="text-brand-primary font-bold">→</span>
              <span>Upload 2-3 videos per week for consistent views</span>
            </li>
            <li className="flex gap-2">
              <span className="text-brand-primary font-bold">→</span>
              <span>Test different hooks - use A/B testing</span>
            </li>
            <li className="flex gap-2">
              <span className="text-brand-primary font-bold">→</span>
              <span>Focus on first 3 seconds for retention</span>
            </li>
            <li className="flex gap-2">
              <span className="text-brand-primary font-bold">→</span>
              <span>Include clear call-to-action</span>
            </li>
            <li className="flex gap-2">
              <span className="text-brand-primary font-bold">→</span>
              <span>Replicate high-performing content style</span>
            </li>
          </ul>
        </Card>

        <Card>
          <h3 className="font-bold text-brand-charcoal mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-brand-primary" />
            Tier Benefits at Each Level
          </h3>
          <ul className="space-y-2 text-sm text-gray-700">
            <li className="flex gap-2">
              <span className="text-brand-primary font-bold">→</span>
              <span>Bronze: Basic access, 20% commission</span>
            </li>
            <li className="flex gap-2">
              <span className="text-brand-primary font-bold">→</span>
              <span>Silver: 25% commission, priority support</span>
            </li>
            <li className="flex gap-2">
              <span className="text-brand-primary font-bold">→</span>
              <span>Gold: 30% commission, exclusive campaigns</span>
            </li>
            <li className="flex gap-2">
              <span className="text-brand-primary font-bold">→</span>
              <span>Platinum: 35% commission, direct brand contact</span>
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
}

function generatePerformanceData(videos) {
  const weeks = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
  const data = weeks.map(week => ({
    week,
    views: 0,
    conversions: 0,
    roas: 0,
  }));

  videos.forEach((video, idx) => {
    const weekIndex = Math.min(idx % 4, 3);
    data[weekIndex].views += Math.floor((video.views || 0) / 4);
    data[weekIndex].conversions += Math.floor((video.conversions || 0) / 4);
    data[weekIndex].roas += (video.roas || 0) / Math.max(1, videos.length / 4);
  });

  // Calculate average ROAS for each week
  data.forEach(d => {
    d.roas = parseFloat((d.roas / 4).toFixed(2)) || 0;
  });

  return data;
}
