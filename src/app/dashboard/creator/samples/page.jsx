'use client';
import { useState, useEffect } from 'react';
import { Badge, ProgressBar, Card, Button } from '@/components/ui';
import {
  ShoppingBag,
  Package,
  Calendar,
  DollarSign,
  BookmarkPlus,
} from 'lucide-react';
import { useCreatorProfile } from '@/hooks/useCreatorProfile';
import { api } from '@/lib/apiClient';

export default function SamplesPage() {
  const { profile, loading: profileLoading, error: profileError } = useCreatorProfile();
  const [applications, setApplications] = useState([]);
  const [filterCategory, setFilterCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function fetchSamples() {
      if (!profile?.id) return;

      try {
        setLoading(true);

        const samplesResponse = await api.get(
          `/api/samples?creatorProfileId=${profile.id}`
        );
        const appsData = samplesResponse.applications || [];
        setApplications(appsData);
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchSamples();
  }, [profile?.id]);

  const handleApply = async (sampleProductId) => {
    try {
      setSubmitting(true);

      await api.post('/api/samples', {
        creatorProfileId: profile.id,
        sampleProductId,
        pitch: 'I would love to create UGC content for this product.',
        shippingAddress: 'Address on file',
      });

      // Update local state
      setApplications((prev) =>
        prev.map((app) =>
          app.sampleProductId === sampleProductId
            ? { ...app, status: 'PENDING' }
            : app
        )
      );
    } catch (err) {
      alert('Error submitting application: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading samples...</p>
        </div>
      </div>
    );
  }

  if (profileError || !profile) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-brand-charcoal mb-2">
            Sample Products
          </h1>
          <p className="text-gray-600">
            Apply to create UGC content for products and earn commissions
          </p>
        </div>
        <Card className="text-center py-12">
          <h3 className="text-lg font-semibold text-gray-600 mb-2">Profile Not Found</h3>
          <p className="text-gray-500">Complete your profile to see available samples.</p>
        </Card>
      </div>
    );
  }

  const categories = [
    'all',
    ...new Set(
      applications
        .map((app) => app.sampleProduct?.category)
        .filter(Boolean)
    ),
  ];

  const filtered =
    filterCategory === 'all'
      ? applications
      : applications.filter(
          (app) => app.sampleProduct?.category === filterCategory
        );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-brand-charcoal mb-2">
          Sample Products
        </h1>
        <p className="text-gray-600">
          Apply to create UGC content for products and earn commissions
        </p>
      </div>

      {error && (
        <Card className="bg-red-50 border border-red-200 p-4">
          <p className="text-red-800 text-sm">Error loading samples: {error}</p>
        </Card>
      )}

      {/* Category Filter */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`
                px-4 py-2 rounded-lg font-medium transition-all text-sm
                ${
                  filterCategory === cat
                    ? 'bg-brand-primary text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }
              `}
            >
              {cat === 'all'
                ? 'All Categories'
                : cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>
      )}

      {/* Product Cards */}
      {!loading && filtered.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((app) => {
            const product = app.sampleProduct;
            if (!product) return null;

            const isFull =
              product.filledSlots >= product.totalSlots;
            const fillPercentage =
              (product.filledSlots / product.totalSlots) * 100;
            const isApplied = app.status === 'APPROVED' || app.status === 'PENDING';

            return (
              <Card key={app.id} className="flex flex-col">
                {/* Image Placeholder */}
                <div className="w-full h-40 bg-gradient-to-br from-gray-200 to-gray-300 rounded-lg mb-4 flex items-center justify-center">
                  <ShoppingBag className="w-12 h-12 text-gray-400" />
                </div>

                {/* Content */}
                <div className="flex-1">
                  <div className="mb-3">
                    <h3 className="font-bold text-brand-charcoal mb-1">
                      {product.name}
                    </h3>
                    <p className="text-sm text-gray-600">{product.brand || 'Brand'}</p>
                  </div>

                  <p className="text-xs text-gray-500 mb-3">
                    {product.category || 'General'}
                  </p>

                  {/* Value & Deadline */}
                  <div className="grid grid-cols-2 gap-3 mb-4 p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-brand-primary" />
                      <div>
                        <p className="text-xs text-gray-600">Value</p>
                        <p className="font-bold text-sm text-brand-charcoal">
                          ${product.value || '0.00'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-brand-primary" />
                      <div>
                        <p className="text-xs text-gray-600">Deadline</p>
                        <p className="font-bold text-sm text-brand-charcoal">
                          {product.deadline
                            ? new Date(product.deadline).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                              })
                            : 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Brief */}
                  <p className="text-sm text-gray-700 mb-4 leading-relaxed">
                    {product.brief}
                  </p>

                  {/* Slots */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-gray-700">
                        Slots Available
                      </p>
                      <p className="text-xs font-bold text-brand-charcoal">
                        {product.filledSlots}/{product.totalSlots}
                      </p>
                    </div>
                    <ProgressBar
                      value={product.filledSlots}
                      max={product.totalSlots}
                      color={isFull ? 'bg-gray-400' : 'bg-brand-primary'}
                      showPercent={false}
                      size="sm"
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-4 border-t border-gray-200">
                  {isFull ? (
                    <Button variant="ghost" disabled className="flex-1">
                      <Package className="w-4 h-4 mr-2" />
                      Full
                    </Button>
                  ) : isApplied ? (
                    <Button variant="secondary" disabled className="flex-1">
                      Applied
                    </Button>
                  ) : (
                    <Button
                      onClick={() => handleApply(product.id)}
                      disabled={submitting}
                      className="flex-1"
                    >
                      <BookmarkPlus className="w-4 h-4 mr-2" />
                      {submitting ? 'Applying...' : 'Apply Now'}
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      ) : !loading ? (
        <Card className="text-center py-12">
          <ShoppingBag className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-600 mb-2">
            No products found
          </h3>
          <p className="text-gray-500">
            {filterCategory === 'all'
              ? 'No sample products available yet'
              : 'Try a different category'}
          </p>
        </Card>
      ) : null}
    </div>
  );
}
