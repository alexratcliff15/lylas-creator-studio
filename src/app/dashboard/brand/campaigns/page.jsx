'use client';
import { useState, useEffect } from 'react';
import { Badge, ProgressBar, Card, Button } from '@/components/ui';
import { Plus, X, Tag, ChevronDown, ChevronUp, Copy } from 'lucide-react';
import { api } from '@/lib/apiClient';

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newCampaignOpen, setNewCampaignOpen] = useState(false);
  const [savingCampaign, setSavingCampaign] = useState(false);
  const [actionLoading, setActionLoading] = useState({});
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    budget: '',
    startDate: '',
    endDate: '',
  });

  // Promo-code state
  const [creators, setCreators] = useState([]);
  const [expandedCampaignId, setExpandedCampaignId] = useState(null);
  const [promoCodesByCampaign, setPromoCodesByCampaign] = useState({});
  const [loadingCodes, setLoadingCodes] = useState({});
  const [newPromoOpen, setNewPromoOpen] = useState(false);
  const [promoCampaignId, setPromoCampaignId] = useState(null);
  const [savingPromo, setSavingPromo] = useState(false);
  const [promoError, setPromoError] = useState(null);
  const [promoForm, setPromoForm] = useState({
    code: '',
    creatorProfileId: '',
    discountType: 'PERCENTAGE',
    discountValue: 10,
    maxRedemptions: '',
    expiresAt: '',
  });

  useEffect(() => {
    fetchCampaigns();
    // Load creators once for the assignment dropdown
    api.get('/api/creators?limit=100')
      .then((res) => setCreators(res.creators || []))
      .catch((err) => console.error('Failed to load creators:', err));
  }, []);

  const loadPromoCodes = async (campaignId) => {
    setLoadingCodes((s) => ({ ...s, [campaignId]: true }));
    try {
      const res = await api.get(`/api/stripe/promo-codes?campaignId=${campaignId}`);
      setPromoCodesByCampaign((s) => ({ ...s, [campaignId]: res.promoCodes || [] }));
    } catch (err) {
      console.error('Failed to load promo codes:', err);
    } finally {
      setLoadingCodes((s) => ({ ...s, [campaignId]: false }));
    }
  };

  const togglePromoSection = (campaignId) => {
    if (expandedCampaignId === campaignId) {
      setExpandedCampaignId(null);
    } else {
      setExpandedCampaignId(campaignId);
      if (!promoCodesByCampaign[campaignId]) loadPromoCodes(campaignId);
    }
  };

  const openNewPromoModal = (campaignId) => {
    setPromoCampaignId(campaignId);
    setPromoError(null);
    setPromoForm({
      code: '',
      creatorProfileId: '',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      maxRedemptions: '',
      expiresAt: '',
    });
    setNewPromoOpen(true);
  };

  const handleCreatePromoCode = async (e) => {
    e.preventDefault();
    setPromoError(null);

    if (!promoForm.creatorProfileId) {
      setPromoError('Please assign this code to a creator.');
      return;
    }

    setSavingPromo(true);
    try {
      const body = {
        code: promoForm.code.trim().toUpperCase(),
        campaignId: promoCampaignId,
        creatorProfileId: promoForm.creatorProfileId,
        discountType: promoForm.discountType,
        discountValue: parseFloat(promoForm.discountValue),
      };
      if (promoForm.maxRedemptions) body.maxRedemptions = parseInt(promoForm.maxRedemptions, 10);
      if (promoForm.expiresAt) body.expiresAt = new Date(promoForm.expiresAt).toISOString();

      await api.post('/api/stripe/promo-codes', body);
      setNewPromoOpen(false);
      await loadPromoCodes(promoCampaignId);
    } catch (err) {
      console.error('Failed to create promo code:', err);
      setPromoError(err.message || 'Failed to create promo code.');
    } finally {
      setSavingPromo(false);
    }
  };

  const copyCode = (code) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(code).catch(() => {});
    }
  };

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/api/campaigns?limit=100');
      setCampaigns(res.campaigns || []);
    } catch (err) {
      console.error('Failed to fetch campaigns:', err);
      setError('Failed to load campaigns');
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCampaign = async (e) => {
    e.preventDefault();
    try {
      setSavingCampaign(true);
      await api.post('/api/campaigns', {
        name: formData.name,
        description: formData.description,
        budget: parseFloat(formData.budget),
        startDate: formData.startDate,
        endDate: formData.endDate,
        status: 'DRAFT',
      });
      setNewCampaignOpen(false);
      setFormData({ name: '', description: '', budget: '', startDate: '', endDate: '' });
      await fetchCampaigns();
    } catch (err) {
      console.error('Failed to create campaign:', err);
      alert('Failed to create campaign. Please try again.');
    } finally {
      setSavingCampaign(false);
    }
  };

  const handleUpdateCampaignStatus = async (campaignId, newStatus) => {
    try {
      setActionLoading({ ...actionLoading, [campaignId]: true });
      const campaign = campaigns.find(c => c.id === campaignId);
      await api.put(`/api/campaigns/${campaignId}`, {
        name: campaign.name,
        description: campaign.description,
        budget: campaign.budget,
        startDate: campaign.startDate,
        endDate: campaign.endDate,
        status: newStatus,
      });
      await fetchCampaigns();
    } catch (err) {
      console.error('Failed to update campaign:', err);
      alert('Failed to update campaign. Please try again.');
    } finally {
      setActionLoading({ ...actionLoading, [campaignId]: false });
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toUpperCase()) {
      case 'ACTIVE':
        return 'success';
      case 'DRAFT':
        return 'info';
      case 'COMPLETED':
      case 'ARCHIVED':
        return 'default';
      case 'PAUSED':
        return 'warning';
      default:
        return 'warning';
    }
  };

  return (
    <div className="space-y-8">
      {/* New Promo Code Modal */}
      {newPromoOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md max-h-screen overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-brand-charcoal">
                Create Promo Code
              </h2>
              <button
                onClick={() => setNewPromoOpen(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePromoCode} className="space-y-4">
              {promoError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
                  {promoError}
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Code
                </label>
                <input
                  type="text"
                  required
                  value={promoForm.code}
                  onChange={(e) =>
                    setPromoForm({ ...promoForm, code: e.target.value.toUpperCase() })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg font-mono uppercase focus:outline-none focus:ring-2 focus:ring-brand-primary"
                  placeholder="ALEX10"
                  minLength={3}
                  maxLength={30}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Customers enter this at checkout. 3–30 characters.
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Assign to Creator
                </label>
                <select
                  required
                  value={promoForm.creatorProfileId}
                  onChange={(e) =>
                    setPromoForm({ ...promoForm, creatorProfileId: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary"
                >
                  <option value="">Select a creator…</option>
                  {creators.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.user?.name || c.handle} ({c.tier})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  This creator earns commission on every redemption.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Discount Type
                  </label>
                  <select
                    value={promoForm.discountType}
                    onChange={(e) =>
                      setPromoForm({ ...promoForm, discountType: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary"
                  >
                    <option value="PERCENTAGE">Percentage (%)</option>
                    <option value="FIXED_AMOUNT">Fixed Amount ($)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Discount Value
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step={promoForm.discountType === 'PERCENTAGE' ? '1' : '0.01'}
                    value={promoForm.discountValue}
                    onChange={(e) =>
                      setPromoForm({ ...promoForm, discountValue: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary"
                    placeholder={promoForm.discountType === 'PERCENTAGE' ? '10' : '5.00'}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Max Redemptions
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={promoForm.maxRedemptions}
                    onChange={(e) =>
                      setPromoForm({ ...promoForm, maxRedemptions: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary"
                    placeholder="Optional"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Expires At
                  </label>
                  <input
                    type="datetime-local"
                    value={promoForm.expiresAt}
                    onChange={(e) =>
                      setPromoForm({ ...promoForm, expiresAt: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setNewPromoOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" loading={savingPromo}>
                  Create Code
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* New Campaign Modal */}
      {newCampaignOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md max-h-screen overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-brand-charcoal">
                Create Campaign
              </h2>
              <button
                onClick={() => setNewCampaignOpen(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCampaign} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Campaign Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary"
                  placeholder="Summer Beauty Collection"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary"
                  placeholder="Campaign description..."
                  rows="3"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Budget
                  </label>
                  <input
                    type="number"
                    required
                    value={formData.budget}
                    onChange={(e) =>
                      setFormData({ ...formData, budget: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary"
                    placeholder="10000"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Start Date
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.startDate}
                    onChange={(e) =>
                      setFormData({ ...formData, startDate: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  End Date
                </label>
                <input
                  type="date"
                  required
                  value={formData.endDate}
                  onChange={(e) =>
                    setFormData({ ...formData, endDate: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary"
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setNewCampaignOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  loading={savingCampaign}
                >
                  Create
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-brand-charcoal mb-2">
            Campaigns
          </h1>
          <p className="text-gray-600">
            Create and manage your UGC campaigns
          </p>
        </div>
        <Button icon={Plus} onClick={() => setNewCampaignOpen(true)}>
          New Campaign
        </Button>
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
          Loading campaigns...
        </div>
      )}

      {/* Campaign Cards */}
      {!loading && (
        <div className="space-y-4">
          {campaigns.length > 0 ? (
            campaigns.map((campaign) => {
              const budgetUsed = campaign.budget > 0 ? (campaign.spent / campaign.budget) * 100 : 0;

              return (
                <Card key={campaign.id}>
                  <div className="flex items-start justify-between mb-4 pb-4 border-b border-gray-200">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-bold text-brand-charcoal">
                          {campaign.name}
                        </h3>
                        <Badge
                          variant={getStatusColor(campaign.status)}
                          size="sm"
                        >
                          {campaign.status
                            ? campaign.status.charAt(0).toUpperCase() +
                              campaign.status.slice(1).toLowerCase()
                            : 'Unknown'}
                        </Badge>
                      </div>

                      <p className="text-sm text-gray-600">
                        {campaign.startDate ? new Date(campaign.startDate).toLocaleDateString() : 'N/A'} →{' '}
                        {campaign.endDate ? new Date(campaign.endDate).toLocaleDateString() : 'N/A'}
                      </p>
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                    <div>
                      <p className="text-xs text-gray-600 font-semibold mb-1">
                        SPEND
                      </p>
                      <p className="text-lg font-bold text-brand-charcoal">
                        ${(campaign.spent || 0).toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-500">
                        of ${(campaign.budget || 0).toLocaleString()}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-600 font-semibold mb-1">
                        ROAS
                      </p>
                      <p className="text-lg font-bold text-brand-primary">
                        {campaign.stats?.spendPercentage > 0 ? '–' : '–'}
                      </p>
                      <p className="text-xs text-gray-500">Return on ad spend</p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-600 font-semibold mb-1">
                        VIDEOS
                      </p>
                      <p className="text-lg font-bold text-brand-charcoal">
                        {campaign._count?.videos || 0}
                      </p>
                      <p className="text-xs text-gray-500">Published</p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-600 font-semibold mb-1">
                        REMAINING
                      </p>
                      <p className="text-lg font-bold text-brand-charcoal">
                        ${Math.max(0, (campaign.budget || 0) - (campaign.spent || 0)).toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-500">Budget left</p>
                    </div>
                  </div>

                  {/* Budget Progress */}
                  {campaign.budget > 0 && (
                    <div className="mb-6">
                      <ProgressBar
                        value={campaign.spent || 0}
                        max={campaign.budget}
                        label="Budget Usage"
                        showPercent={true}
                        color={
                          budgetUsed > 100
                            ? 'bg-red-600'
                            : budgetUsed > 80
                              ? 'bg-yellow-600'
                              : 'bg-brand-primary'
                        }
                        size="md"
                      />
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-4 border-t border-gray-200">
                    <Button variant="secondary" size="sm" className="flex-1">
                      View Details
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={expandedCampaignId === campaign.id ? ChevronUp : ChevronDown}
                      onClick={() => togglePromoSection(campaign.id)}
                    >
                      <Tag className="w-4 h-4 inline mr-1" />
                      Codes
                      {promoCodesByCampaign[campaign.id]?.length > 0 && (
                        <span className="ml-1 text-xs text-gray-500">
                          ({promoCodesByCampaign[campaign.id].length})
                        </span>
                      )}
                    </Button>
                    {campaign.status?.toUpperCase() === 'PLANNING' && (
                      <Button
                        size="sm"
                        className="flex-1"
                        loading={actionLoading[campaign.id]}
                        onClick={() =>
                          handleUpdateCampaignStatus(campaign.id, 'ACTIVE')
                        }
                      >
                        Launch Campaign
                      </Button>
                    )}
                    {campaign.status?.toUpperCase() === 'ACTIVE' && (
                      <Button
                        variant="danger"
                        size="sm"
                        className="flex-1"
                        loading={actionLoading[campaign.id]}
                        onClick={() =>
                          handleUpdateCampaignStatus(campaign.id, 'PAUSED')
                        }
                      >
                        Pause Campaign
                      </Button>
                    )}
                  </div>

                  {/* Expanded Promo Codes section */}
                  {expandedCampaignId === campaign.id && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-bold text-brand-charcoal">
                          Promo Codes
                        </h4>
                        <Button
                          size="sm"
                          icon={Plus}
                          onClick={() => openNewPromoModal(campaign.id)}
                        >
                          Add Code
                        </Button>
                      </div>

                      {loadingCodes[campaign.id] ? (
                        <p className="text-sm text-gray-500 py-2">Loading codes…</p>
                      ) : promoCodesByCampaign[campaign.id]?.length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-left text-xs text-gray-600 font-semibold border-b border-gray-200">
                                <th className="py-2 pr-3">Code</th>
                                <th className="py-2 pr-3">Creator</th>
                                <th className="py-2 pr-3">Discount</th>
                                <th className="py-2 pr-3">Redemptions</th>
                                <th className="py-2 pr-3">Revenue</th>
                                <th className="py-2 pr-3"></th>
                              </tr>
                            </thead>
                            <tbody>
                              {promoCodesByCampaign[campaign.id].map((pc) => (
                                <tr key={pc.id} className="border-b border-gray-100">
                                  <td className="py-2 pr-3 font-mono font-semibold text-brand-charcoal">
                                    {pc.code}
                                  </td>
                                  <td className="py-2 pr-3">
                                    {pc.creatorProfile?.user?.name || pc.creatorProfile?.handle || '—'}
                                    {pc.creatorProfile?.tier && (
                                      <span className="ml-1 text-xs text-gray-500">
                                        ({pc.creatorProfile.tier})
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2 pr-3">
                                    {pc.discountType === 'PERCENTAGE'
                                      ? `${pc.discountValue}%`
                                      : `$${pc.discountValue}`}
                                  </td>
                                  <td className="py-2 pr-3">
                                    {pc.timesRedeemed}
                                    {pc.maxRedemptions ? ` / ${pc.maxRedemptions}` : ''}
                                  </td>
                                  <td className="py-2 pr-3">
                                    ${(pc.revenue || 0).toLocaleString()}
                                  </td>
                                  <td className="py-2 pr-3">
                                    <button
                                      onClick={() => copyCode(pc.code)}
                                      className="p-1 hover:bg-gray-100 rounded"
                                      title="Copy code"
                                    >
                                      <Copy className="w-4 h-4 text-gray-500" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 py-2">
                          No promo codes yet. Create one to start tracking creator-driven sales.
                        </p>
                      )}
                    </div>
                  )}
                </Card>
              );
            })
          ) : (
            <Card className="text-center py-12">
              <p className="text-gray-500">No campaigns yet. Create one to get started!</p>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
