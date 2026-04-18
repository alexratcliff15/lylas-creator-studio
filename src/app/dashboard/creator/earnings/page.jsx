'use client';
import { useState, useEffect } from 'react';
import { Badge, StatCard, ProgressBar, Card, Button } from '@/components/ui';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { DollarSign, Calendar, Target, Award } from 'lucide-react';
import { useCreatorProfile } from '@/hooks/useCreatorProfile';
import { api } from '@/lib/apiClient';

// Commissions are now earned per CLICK, not per view. Rates: 5% / 8% / 12% / 15%.
const TIER_STRUCTURE = [
  {
    tier: 'Bronze',
    minClicks: 0,
    commission: '5%',
    perClick: '$0.05',
    benefits: ['2 samples/month', 'Community access'],
  },
  {
    tier: 'Silver',
    minClicks: 5000,
    commission: '8%',
    perClick: '$0.08',
    benefits: ['5 samples/month', 'Priority support', 'Monthly bonuses'],
  },
  {
    tier: 'Gold',
    minClicks: 25000,
    commission: '12%',
    perClick: '$0.12',
    benefits: ['10 samples/month', 'Exclusive campaigns', 'Tier bonus'],
  },
  {
    tier: 'Platinum',
    minClicks: 100000,
    commission: '15%',
    perClick: '$0.15',
    benefits: ['Unlimited samples', 'Direct brand contact', 'Max bonus'],
  },
];

export default function EarningsPage() {
  const { profile, loading: profileLoading, error: profileError } = useCreatorProfile();
  const [payments, setPayments] = useState([]);
  const [stats, setStats] = useState({
    balance: '0.00',
    thisMonth: '0.00',
    allTime: '0.00',
    avgPerVideo: '0.00',
    totalClicks: 0,
  });
  const [earningsData, setEarningsData] = useState([]);
  const [requestingPayout, setRequestingPayout] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchEarningsData() {
      if (!profile?.id) return;

      try {
        setLoading(true);

        // Fetch payments/commissions
        const paymentsResponse = await api.get(`/api/payments?creatorProfileId=${profile.id}`);
        const paymentsData = paymentsResponse.commissions || [];
        setPayments(paymentsData);

        // Fetch videos to get total views and calculate stats
        const videosResponse = await api.get(`/api/videos?creatorProfileId=${profile.id}`);
        const videosData = videosResponse.videos || [];

        // Calculate stats
        const totalRevenue = paymentsData.reduce((sum, p) => sum + (p.amount || 0), 0);
        const pendingRevenue = paymentsData
          .filter(p => p.status === 'PENDING')
          .reduce((sum, p) => sum + (p.amount || 0), 0);
        const completedRevenue = paymentsData
          .filter(p => p.status === 'COMPLETED')
          .reduce((sum, p) => sum + (p.amount || 0), 0);

        const totalClicks = videosData.reduce(
          (sum, v) => sum + (v.clicks || v.linkClicks || 0),
          0
        );
        const avgPerVideo = videosData.length > 0 ? totalRevenue / videosData.length : 0;

        // Get current month earnings
        const now = new Date();
        const currentMonth = paymentsData.filter(p => {
          const pDate = new Date(p.periodStart || p.createdAt);
          return pDate.getMonth() === now.getMonth() && pDate.getFullYear() === now.getFullYear();
        });
        const thisMonthEarnings = currentMonth.reduce((sum, p) => sum + (p.amount || 0), 0);

        setStats({
          balance: pendingRevenue.toFixed(2),
          thisMonth: thisMonthEarnings.toFixed(2),
          allTime: totalRevenue.toFixed(2),
          avgPerVideo: avgPerVideo.toFixed(2),
          totalClicks,
        });

        // Generate earnings chart data (last 6 months)
        const chartData = generateLast6MonthsData(paymentsData);
        setEarningsData(chartData);

        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchEarningsData();
  }, [profile?.id]);

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading earnings...</p>
        </div>
      </div>
    );
  }

  if (profileError || !profile) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-brand-charcoal mb-2">Earnings</h1>
          <p className="text-gray-600">Track your revenue and payment history</p>
        </div>
        <Card className="text-center py-12">
          <h3 className="text-lg font-semibold text-gray-600 mb-2">Profile Not Found</h3>
          <p className="text-gray-500">Complete your profile to view earnings data.</p>
        </Card>
      </div>
    );
  }

  // Find the highest tier the creator qualifies for based on total clicks
  const currentTier =
    [...TIER_STRUCTURE]
      .reverse()
      .find((t) => stats.totalClicks >= t.minClicks) || TIER_STRUCTURE[0];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-brand-charcoal mb-2">Earnings</h1>
        <p className="text-gray-600">
          Track your revenue and payment history
        </p>
      </div>

      {error && (
        <Card className="bg-red-50 border border-red-200 p-4">
          <p className="text-red-800 text-sm">Error loading earnings: {error}</p>
        </Card>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={DollarSign}
          label="Current Balance"
          value={`$${stats.balance}`}
          subtitle="Pending payout"
        />
        <StatCard
          icon={Calendar}
          label="This Month"
          value={`$${stats.thisMonth}`}
          change="+18.5%"
          subtitle="Current earnings"
        />
        <StatCard
          icon={Target}
          label="All-Time"
          value={`$${stats.allTime}`}
          change="+145%"
          subtitle="Since joining"
        />
        <StatCard
          icon={Award}
          label="Avg Per Video"
          value={`$${stats.avgPerVideo}`}
          change="+9.2%"
          subtitle="Last 30 days"
        />
      </div>

      {/* Earnings Chart */}
      <Card>
        <div className="mb-6">
          <h2 className="text-lg font-bold text-brand-charcoal">
            Earnings Over Time
          </h2>
          <p className="text-sm text-gray-500">Last 6 months</p>
        </div>

        {earningsData.length > 0 ? (
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={earningsData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                }}
              />
              <Bar
                dataKey="earnings"
                fill="#5C7A3D"
                radius={[8, 8, 0, 0]}
                name="Earnings ($)"
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-350 text-gray-500">
            <p>No earnings data yet</p>
          </div>
        )}
      </Card>

      {/* Commission Structure */}
      <div>
        <h2 className="text-lg font-bold text-brand-charcoal mb-4">
          Commission Tier Structure
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {TIER_STRUCTURE.map((tier, idx) => (
            <Card
              key={idx}
              className={tier.tier === currentTier.tier ? 'ring-2 ring-yellow-400' : ''}
            >
              <div className="flex items-start justify-between mb-4">
                <h3 className="font-bold text-brand-charcoal text-lg">
                  {tier.tier}
                </h3>
                {tier.tier === currentTier.tier && (
                  <Badge variant="gold" size="sm">
                    Your Tier
                  </Badge>
                )}
              </div>

              <div className="space-y-3 mb-4">
                <div>
                  <p className="text-xs text-gray-600">Min Monthly Clicks</p>
                  <p className="font-bold text-brand-charcoal">
                    {tier.minClicks === 0 ? 'Any' : tier.minClicks.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Commission Rate</p>
                  <p className="font-bold text-brand-charcoal">{tier.commission}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Per Click</p>
                  <p className="font-bold text-brand-charcoal">
                    {tier.perClick}
                  </p>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-semibold text-gray-600">BENEFITS</p>
                {tier.benefits.map((benefit, bIdx) => (
                  <p key={bIdx} className="text-xs text-gray-700">
                    • {benefit}
                  </p>
                ))}
              </div>
            </Card>
          ))}
        </div>

        <div className="mt-4 p-4 bg-brand-cream rounded-lg border border-brand-primary/20">
          <p className="text-sm text-brand-charcoal">
            <span className="font-semibold">Current Progress:</span> You have{' '}
            {stats.totalClicks.toLocaleString()} monthly clicks. You're{' '}
            {Math.min(100, Math.round((stats.totalClicks / 100000) * 100))}% of the way to
            Platinum tier!
          </p>
          <ProgressBar
            value={Math.min(stats.totalClicks, 100000)}
            max={100000}
            color="bg-brand-primary"
            showPercent={false}
            size="md"
            className="mt-3"
          />
        </div>
      </div>

      {/* Payment History */}
      <Card>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-brand-charcoal">Payment History</h2>
          <Button
            variant="primary"
            size="sm"
            loading={requestingPayout}
            onClick={() => setRequestingPayout(true)}
          >
            Request Payout
          </Button>
        </div>

        {payments.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 text-gray-600">
                <tr>
                  <th className="text-left py-3 px-4 font-semibold">Date</th>
                  <th className="text-right py-3 px-4 font-semibold">Amount</th>
                  <th className="text-left py-3 px-4 font-semibold">Period</th>
                  <th className="text-left py-3 px-4 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {payments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-4">
                      {payment.paidAt
                        ? new Date(payment.paidAt).toLocaleDateString()
                        : 'Pending'}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <span className="font-bold text-brand-charcoal">
                        ${payment.amount.toFixed(2)}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      {new Date(payment.periodStart).toLocaleDateString()} -{' '}
                      {new Date(payment.periodEnd).toLocaleDateString()}
                    </td>
                    <td className="py-4 px-4">
                      <Badge
                        variant={payment.status === 'COMPLETED' ? 'success' : 'warning'}
                        size="sm"
                      >
                        {payment.status === 'COMPLETED' ? 'Completed' : 'Pending'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500">No payment history yet</p>
          </div>
        )}

        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm text-blue-900">
            <span className="font-semibold">Next Payout:</span> Payouts are processed
            on the last day of each month, within 2-5 business days. Set up Stripe
            Connect to receive payments.
          </p>
        </div>
      </Card>
    </div>
  );
}

function generateLast6MonthsData(payments) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
  const data = months.map(month => ({ month, earnings: 0 }));

  const now = new Date();
  payments.forEach(payment => {
    const pDate = new Date(payment.periodStart || payment.createdAt);
    const monthIndex = pDate.getMonth();
    if (monthIndex < 6) {
      data[monthIndex].earnings += payment.amount || 0;
    }
  });

  return data;
}
