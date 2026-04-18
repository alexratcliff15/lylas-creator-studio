'use client';
import { useState, useEffect } from 'react';
import { Badge, Button, Card, Avatar } from '@/components/ui';
import { Users, Mail, Star, X } from 'lucide-react';
import { api } from '@/lib/apiClient';

export default function CreatorsPage() {
  const [creators, setCreators] = useState([]);
  const [filteredCreators, setFilteredCreators] = useState([]);
  const [tierFilter, setTierFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteData, setInviteData] = useState({ email: '', handle: '' });

  useEffect(() => {
    fetchCreators();
  }, []);

  useEffect(() => {
    applyFilter();
  }, [creators, tierFilter]);

  const fetchCreators = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/api/creators?limit=100');
      const data = res.creators || [];
      setCreators(data);
    } catch (err) {
      console.error('Failed to fetch creators:', err);
      setError('Failed to load creators');
      setCreators([]);
    } finally {
      setLoading(false);
    }
  };

  const applyFilter = () => {
    let filtered = creators;
    if (tierFilter !== 'all') {
      filtered = creators.filter(
        (c) => c.tier?.toUpperCase() === tierFilter.toUpperCase()
      );
    }
    setFilteredCreators(filtered);
  };

  const tierCounts = {
    all: creators.length,
    bronze: creators.filter((c) => c.tier?.toUpperCase() === 'BRONZE').length,
    silver: creators.filter((c) => c.tier?.toUpperCase() === 'SILVER').length,
    gold: creators.filter((c) => c.tier?.toUpperCase() === 'GOLD').length,
  };

  const handleInviteCreator = async (e) => {
    e.preventDefault();
    try {
      setInviteLoading(true);
      await api.post('/api/creators', {
        email: inviteData.email,
        handle: inviteData.handle,
      });
      setInviteModalOpen(false);
      setInviteData({ email: '', handle: '' });
      await fetchCreators();
    } catch (err) {
      console.error('Failed to invite creator:', err);
      alert('Failed to invite creator. Please try again.');
    } finally {
      setInviteLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Invite Modal */}
      {inviteModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-brand-charcoal">
                Invite Creator
              </h2>
              <button
                onClick={() => setInviteModalOpen(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleInviteCreator} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={inviteData.email}
                  onChange={(e) =>
                    setInviteData({ ...inviteData, email: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary"
                  placeholder="creator@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Creator Handle
                </label>
                <input
                  type="text"
                  required
                  value={inviteData.handle}
                  onChange={(e) =>
                    setInviteData({ ...inviteData, handle: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary"
                  placeholder="@creatorhandle"
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setInviteModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  loading={inviteLoading}
                >
                  Send Invite
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
            Creators
          </h1>
          <p className="text-gray-600">
            Manage your UGC creator network
          </p>
        </div>
        <Button icon={Mail} onClick={() => setInviteModalOpen(true)}>
          Invite Creator
        </Button>
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
          {error}
        </div>
      )}

      {/* Tier Filter */}
      <div className="flex gap-2">
        {['all', 'bronze', 'silver', 'gold'].map((tier) => (
          <button
            key={tier}
            onClick={() => setTierFilter(tier)}
            className={`
              px-4 py-2 rounded-lg font-medium transition-all text-sm
              ${
                tierFilter === tier
                  ? 'bg-brand-primary text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }
            `}
          >
            {tier.charAt(0).toUpperCase() + tier.slice(1)} ({tierCounts[tier]})
          </button>
        ))}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-12 text-gray-500">
          Loading creators...
        </div>
      )}

      {/* Creator Cards */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCreators.map((creator) => {
            const initials = (creator.user?.name || creator.handle)
              .split(' ')
              .map(n => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2);

            return (
              <Card key={creator.id}>
                {/* Header with Status */}
                <div className="flex items-start justify-between mb-4 pb-4 border-b border-gray-200">
                  <div className="flex items-center gap-3">
                    <Avatar initials={initials} size="md" />
                    <div>
                      <h3 className="font-bold text-brand-charcoal">
                        {creator.user?.name || creator.handle}
                      </h3>
                      <p className="text-xs text-gray-500">@{creator.handle}</p>
                    </div>
                  </div>
                  <Badge
                    variant={creator.isApproved ? 'success' : 'warning'}
                    size="sm"
                  >
                    {creator.isApproved ? 'Approved' : 'Pending'}
                  </Badge>
                </div>

                {/* Tier Badge */}
                <div className="mb-4">
                  <Badge
                    variant={creator.tier?.toLowerCase() || 'bronze'}
                    size="sm"
                  >
                    {creator.tier ? creator.tier.charAt(0).toUpperCase() + creator.tier.slice(1).toLowerCase() : 'Bronze'} Tier
                  </Badge>
                </div>

                {/* Rating */}
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`w-4 h-4 ${
                        i < Math.floor(creator.rating || 0)
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'text-gray-300'
                      }`}
                    />
                  ))}
                  <span className="text-sm font-semibold text-gray-700 ml-1">
                    {(creator.rating || 0).toFixed(1)}
                  </span>
                </div>

                {/* Specialties */}
                <div className="mb-4">
                  <p className="text-xs font-semibold text-gray-600 mb-2">
                    SPECIALTIES
                  </p>
                  {creator.specialties && creator.specialties.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {creator.specialties.map((specialty, idx) => (
                        <Badge key={idx} variant="default" size="sm">
                          {specialty}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500">No specialties yet</p>
                  )}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 mb-4 p-3 bg-gray-50 rounded-lg text-xs">
                  <div>
                    <p className="text-gray-600">Videos</p>
                    <p className="font-bold text-brand-charcoal">
                      {creator._count?.videos || 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Avg ROAS</p>
                    <p className="font-bold text-brand-primary">
                      {(creator.avgRoas || 0).toFixed(2)}x
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Earnings</p>
                    <p className="font-bold text-brand-charcoal">
                      ${(creator.totalEarnings || 0).toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <Button variant="secondary" size="sm" className="w-full">
                  View Profile
                </Button>
              </Card>
            );
          })}
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredCreators.length === 0 && (
        <Card className="text-center py-12">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-600 mb-2">
            No creators found
          </h3>
          <p className="text-gray-500">Try a different tier filter</p>
        </Card>
      )}
    </div>
  );
}
