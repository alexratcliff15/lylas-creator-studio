'use client';
import { useState, useEffect } from 'react';
import { Badge, StatCard, Card, Button } from '@/components/ui';
import { DollarSign, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { api } from '@/lib/apiClient';

export default function PaymentsPage() {
  const [pendingPayments, setPendingPayments] = useState([]);
  const [paidPayments, setPaidPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [payingOut, setPayingOut] = useState(false);
  const [actionLoading, setActionLoading] = useState({});

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      setError(null);

      const [pendingRes, paidRes] = await Promise.all([
        api.get('/api/payments?status=PENDING&limit=100'),
        api.get('/api/payments?status=PAID&limit=100'),
      ]);

      setPendingPayments(pendingRes.commissions || []);
      setPaidPayments(paidRes.commissions || []);
    } catch (err) {
      console.error('Failed to fetch payments:', err);
      setError('Failed to load payments');
      setPendingPayments([]);
      setPaidPayments([]);
    } finally {
      setLoading(false);
    }
  };

  const handleProcessAll = async () => {
    try {
      setPayingOut(true);
      await api.post('/api/payments/process-all');
      await fetchPayments();
    } catch (err) {
      console.error('Failed to process payouts:', err);
      alert('Failed to process payouts. Please try again.');
    } finally {
      setPayingOut(false);
    }
  };

  const handlePayNow = async (creatorProfileId) => {
    try {
      setActionLoading({ ...actionLoading, [creatorProfileId]: true });
      const creatorPayments = pendingPayments.filter(
        p => p.creatorProfileId === creatorProfileId
      );
      const totalAmount = creatorPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

      await api.post('/api/payments', {
        creatorProfileId,
        amount: totalAmount,
        commissionIds: creatorPayments.map(p => p.id),
      });
      await fetchPayments();
    } catch (err) {
      console.error('Failed to process payment:', err);
      alert('Failed to process payment. Please try again.');
    } finally {
      setActionLoading({ ...actionLoading, [creatorProfileId]: false });
    }
  };

  // Calculate stats
  const totalPending = pendingPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalPaid = paidPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const avgCommission = pendingPayments.length > 0
    ? (pendingPayments.reduce((sum, p) => sum + (p.rate || 0), 0) / pendingPayments.length).toFixed(1)
    : '0';

  // Group pending payments by creator
  const creatorGroups = {};
  pendingPayments.forEach(payment => {
    const creatorId = payment.creatorProfileId;
    if (!creatorGroups[creatorId]) {
      creatorGroups[creatorId] = {
        creatorProfile: payment.creatorProfile,
        payments: [],
        total: 0,
      };
    }
    creatorGroups[creatorId].payments.push(payment);
    creatorGroups[creatorId].total += payment.amount || 0;
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-brand-charcoal mb-2">
            Payments
          </h1>
          <p className="text-gray-600">
            Manage creator payouts and payment history
          </p>
        </div>
        {pendingPayments.length > 0 && (
          <Button
            onClick={handleProcessAll}
            loading={payingOut}
            className="bg-green-600 hover:bg-green-700"
          >
            Process All Payouts
          </Button>
        )}
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="text-center py-12 text-gray-500">
          Loading payment data...
        </div>
      )}

      {!loading && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={DollarSign}
              label="Total Paid"
              value={`$${totalPaid.toLocaleString('en-US', { maximumFractionDigits: 2 })}`}
              subtitle="All time payments"
            />
            <StatCard
              icon={Clock}
              label="Pending Payout"
              value={`$${totalPending.toLocaleString('en-US', { maximumFractionDigits: 2 })}`}
              subtitle={`${pendingPayments.length} payments`}
            />
            <StatCard
              icon={CheckCircle}
              label="Avg Commission Rate"
              value={`${avgCommission}%`}
              subtitle="Across all tiers"
            />
            <StatCard
              icon={AlertCircle}
              label="Creators Pending Pay"
              value={Object.keys(creatorGroups).length.toString()}
              subtitle="Awaiting payout"
            />
          </div>

          {/* Upcoming Payouts */}
          {pendingPayments.length > 0 ? (
            <Card>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-brand-charcoal">
                  Upcoming Payouts
                </h2>
                <Badge variant="warning" size="sm">
                  {Object.keys(creatorGroups).length} creators
                </Badge>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-200 text-gray-600">
                    <tr>
                      <th className="text-left py-3 px-4 font-semibold">Creator</th>
                      <th className="text-left py-3 px-4 font-semibold">
                        Commissions
                      </th>
                      <th className="text-right py-3 px-4 font-semibold">
                        Amount
                      </th>
                      <th className="text-left py-3 px-4 font-semibold">
                        Status
                      </th>
                      <th className="text-left py-3 px-4 font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {Object.entries(creatorGroups).map(([creatorId, group]) => (
                      <tr key={creatorId} className="hover:bg-gray-50 transition-colors">
                        <td className="py-4 px-4">
                          <div>
                            <p className="font-medium text-brand-charcoal">
                              {group.creatorProfile?.user?.name ||
                                group.creatorProfile?.handle ||
                                'Unknown'}
                            </p>
                            <p className="text-xs text-gray-500">
                              @{group.creatorProfile?.handle}
                            </p>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <span className="font-semibold text-brand-charcoal">
                            {group.payments.length}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <span className="font-bold text-brand-primary">
                            ${group.total.toFixed(2)}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <Badge variant="warning" size="sm">
                            Pending
                          </Badge>
                        </td>
                        <td className="py-4 px-4">
                          <Button
                            variant="secondary"
                            size="sm"
                            loading={actionLoading[creatorId]}
                            onClick={() => handlePayNow(creatorId)}
                          >
                            Pay Now
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <p className="text-sm text-yellow-900">
                  <span className="font-semibold">Next Batch:</span> All pending
                  payouts can be processed manually or automatically at month end
                </p>
              </div>
            </Card>
          ) : (
            <Card className="text-center py-12">
              <p className="text-gray-500">No pending payouts</p>
            </Card>
          )}

          {/* Payment History */}
          {paidPayments.length > 0 && (
            <Card>
              <h2 className="text-lg font-bold text-brand-charcoal mb-6">
                Payment History
              </h2>

              <div className="space-y-3">
                {paidPayments.slice(0, 10).map((payment, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                        <CheckCircle className="w-6 h-6 text-green-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-brand-charcoal">
                          {payment.creatorProfile?.user?.name ||
                            payment.creatorProfile?.handle}
                        </p>
                        <p className="text-xs text-gray-500">
                          {payment.paidAt
                            ? new Date(payment.paidAt).toLocaleDateString()
                            : 'Date unavailable'}
                          {' '}• ${payment.amount?.toFixed(2)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-brand-charcoal">
                        ${(payment.amount || 0).toFixed(2)}
                      </p>
                      <Badge variant="success" size="sm">
                        Completed
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Payment Settings Info */}
          <Card className="bg-blue-50 border-blue-200">
            <h3 className="font-bold text-brand-charcoal mb-3">
              Payment Settings
            </h3>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex gap-2">
                <span className="text-brand-primary font-bold">•</span>
                <span>
                  <strong>Payment Method:</strong> ACH Bank Transfer
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-brand-primary font-bold">•</span>
                <span>
                  <strong>Processing Time:</strong> 2-5 business days
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-brand-primary font-bold">•</span>
                <span>
                  <strong>Minimum Payout:</strong> $50
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-brand-primary font-bold">•</span>
                <span>
                  <strong>Payout Schedule:</strong> Last day of each month or on demand
                </span>
              </li>
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}
