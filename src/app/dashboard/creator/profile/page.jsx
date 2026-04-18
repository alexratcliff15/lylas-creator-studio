'use client';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { Card, Badge, Button } from '@/components/ui';
import { api } from '@/lib/apiClient';
import {
  User,
  AtSign,
  FileText,
  Tag,
  CreditCard,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Save,
  Loader2,
  Banknote,
  Shield,
  Star,
  TrendingUp,
  Eye,
  RotateCcw,
} from 'lucide-react';

const SPECIALTY_OPTIONS = [
  'Unboxing', 'Reviews', 'Tech', 'Demo', 'Lifestyle', 'Wellness',
  'Fashion', 'Style', 'Food', 'Cooking', 'Fitness', 'Health',
  'Beauty', 'Travel', 'Home', 'DIY', 'Education', 'Entertainment',
  'Music', 'Art', 'Photography', 'Vlog',
];

export default function CreatorProfilePage() {
  const { user, setUser } = useApp();
  const searchParams = useSearchParams();
  const stripeParam = searchParams.get('stripe');

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Editable fields
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [bio, setBio] = useState('');
  const [specialties, setSpecialties] = useState([]);

  // Stripe
  const [stripeStatus, setStripeStatus] = useState(null);
  const [stripeLoading, setStripeLoading] = useState(false);

  useEffect(() => {
    fetchProfile();
    fetchStripeStatus();
  }, []);

  useEffect(() => {
    if (stripeParam === 'success') {
      setSuccess('Stripe Connect setup completed! Checking status...');
      fetchStripeStatus();
    } else if (stripeParam === 'refresh') {
      setError('Stripe onboarding expired. Please try again.');
    }
  }, [stripeParam]);

  async function fetchProfile() {
    try {
      setLoading(true);
      const data = await api.get('/api/me');
      setProfile(data);
      setName(data.name || '');
      setHandle(data.creatorProfile?.handle?.replace('@', '') || '');
      setBio(data.creatorProfile?.bio || '');
      setSpecialties(data.creatorProfile?.specialties || []);
    } catch (err) {
      setError('Failed to load profile');
    } finally {
      setLoading(false);
    }
  }

  async function fetchStripeStatus() {
    try {
      const data = await api.get('/api/stripe/connect');
      setStripeStatus(data);
    } catch (err) {
      // Not critical — Stripe might not be configured
      console.log('Stripe status check:', err.message);
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const data = await api.put('/api/me', {
        name,
        handle,
        bio,
        specialties,
      });

      setProfile(data);
      setSuccess('Profile updated successfully!');

      // Update localStorage user
      const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
      storedUser.name = name;
      localStorage.setItem('user', JSON.stringify(storedUser));
      setUser(storedUser);

      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleStripeConnect() {
    setStripeLoading(true);
    setError('');
    try {
      const data = await api.post('/api/stripe/connect', {});
      if (data.onboardingUrl) {
        window.location.href = data.onboardingUrl;
      } else if (data.dashboardUrl) {
        window.open(data.dashboardUrl, '_blank');
        setStripeLoading(false);
      }
    } catch (err) {
      setError('Failed to connect Stripe: ' + err.message);
      setStripeLoading(false);
    }
  }

  function toggleSpecialty(specialty) {
    setSpecialties((prev) =>
      prev.includes(specialty)
        ? prev.filter((s) => s !== specialty)
        : [...prev, specialty]
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
      </div>
    );
  }

  const cp = profile?.creatorProfile;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-brand-charcoal">My Profile</h1>
        <p className="text-gray-600 mt-1">Manage your creator profile, specialties, and banking info</p>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center gap-2">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column — Stats card */}
        <div className="space-y-6">
          <Card className="p-6">
            <div className="text-center mb-4">
              <div className="w-20 h-20 rounded-full brand-gradient flex items-center justify-center text-white text-2xl font-bold mx-auto mb-3">
                {name?.split(' ').map((n) => n[0]).join('') || 'U'}
              </div>
              <h2 className="text-lg font-bold text-brand-charcoal">{name || 'Creator'}</h2>
              <p className="text-gray-500 text-sm">{cp?.handle || '@handle'}</p>
              <div className="mt-2">
                <Badge variant={cp?.tier?.toLowerCase() || 'bronze'} size="sm">
                  {cp?.tier || 'BRONZE'} Tier
                </Badge>
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t border-gray-100">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Earnings</span>
                <span className="font-semibold">${cp?.totalEarnings?.toFixed(2) || '0.00'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 flex items-center gap-2"><Eye className="w-4 h-4" /> Total Views</span>
                <span className="font-semibold">{cp?.totalViews?.toLocaleString() || '0'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 flex items-center gap-2"><RotateCcw className="w-4 h-4" /> Conversions</span>
                <span className="font-semibold">{cp?.totalConversions?.toLocaleString() || '0'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 flex items-center gap-2"><Star className="w-4 h-4" /> Rating</span>
                <span className="font-semibold">{cp?.rating?.toFixed(1) || '0.0'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 flex items-center gap-2"><Star className="w-4 h-4" /> Avg ROAS</span>
                <span className="font-semibold">{cp?.avgRoas?.toFixed(2) || '0.00'}x</span>
              </div>
            </div>
          </Card>

          {/* Stripe Connect Card */}
          <Card className="p-6">
            <h3 className="font-semibold text-brand-charcoal mb-3 flex items-center gap-2">
              <Banknote className="w-5 h-5" />
              Banking & Payouts
            </h3>

            {stripeStatus?.stripeOnboarded ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-green-700 bg-green-50 p-3 rounded-lg">
                  <CheckCircle className="w-5 h-5" />
                  <span className="text-sm font-medium">Bank account connected</span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Payouts</span>
                    <span className={`font-medium ${stripeStatus.payoutsEnabled ? 'text-green-600' : 'text-yellow-600'}`}>
                      {stripeStatus.payoutsEnabled ? 'Enabled' : 'Pending'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Charges</span>
                    <span className={`font-medium ${stripeStatus.chargesEnabled ? 'text-green-600' : 'text-yellow-600'}`}>
                      {stripeStatus.chargesEnabled ? 'Enabled' : 'Pending'}
                    </span>
                  </div>
                </div>
                <button
                  onClick={handleStripeConnect}
                  disabled={stripeLoading}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  {stripeLoading ? 'Opening...' : 'Open Stripe Dashboard'}
                </button>
              </div>
            ) : stripeStatus?.connected ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-yellow-700 bg-yellow-50 p-3 rounded-lg">
                  <AlertCircle className="w-5 h-5" />
                  <span className="text-sm font-medium">Onboarding incomplete</span>
                </div>
                <p className="text-xs text-gray-500">
                  You started connecting your bank but didn't finish. Click below to continue.
                </p>
                <button
                  onClick={handleStripeConnect}
                  disabled={stripeLoading}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 text-sm font-semibold bg-brand-primary text-white rounded-lg hover:opacity-90 transition-colors"
                >
                  <CreditCard className="w-4 h-4" />
                  {stripeLoading ? 'Loading...' : 'Continue Setup'}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-gray-600">
                  Connect your bank account to receive commission payouts directly via Stripe.
                </p>
                <div className="flex items-center gap-2 text-gray-500 bg-gray-50 p-3 rounded-lg text-xs">
                  <Shield className="w-4 h-4 flex-shrink-0" />
                  <span>Secure bank connection powered by Stripe</span>
                </div>
                <button
                  onClick={handleStripeConnect}
                  disabled={stripeLoading}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 text-sm font-semibold bg-brand-primary text-white rounded-lg hover:opacity-90 transition-colors"
                >
                  <CreditCard className="w-4 h-4" />
                  {stripeLoading ? 'Connecting...' : 'Connect Bank Account'}
                </button>
              </div>
            )}
          </Card>
        </div>

        {/* Right column — Edit form */}
        <div className="lg:col-span-2">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-brand-charcoal mb-6">Edit Profile</h3>
            <form onSubmit={handleSave} className="space-y-5">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-brand-charcoal mb-2">
                  <User className="w-4 h-4 inline mr-1" /> Display Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                  required
                />
              </div>

              {/* Handle */}
              <div>
                <label className="block text-sm font-medium text-brand-charcoal mb-2">
                  <AtSign className="w-4 h-4 inline mr-1" /> Creator Handle
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-gray-400">@</span>
                  <input
                    type="text"
                    value={handle}
                    onChange={(e) => setHandle(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                    className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                    required
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">Your unique creator handle (letters, numbers, underscores)</p>
              </div>

              {/* Bio */}
              <div>
                <label className="block text-sm font-medium text-brand-charcoal mb-2">
                  <FileText className="w-4 h-4 inline mr-1" /> Bio
                </label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={4}
                  placeholder="Tell brands about yourself and what kind of content you create..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent resize-none"
                />
              </div>

              {/* Specialties */}
              <div>
                <label className="block text-sm font-medium text-brand-charcoal mb-2">
                  <Tag className="w-4 h-4 inline mr-1" /> Content Specialties
                </label>
                <p className="text-xs text-gray-500 mb-3">Select the types of content you create</p>
                <div className="flex flex-wrap gap-2">
                  {SPECIALTY_OPTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleSpecialty(s)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                        specialties.includes(s)
                          ? 'bg-brand-primary text-white border-brand-primary'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-brand-primary hover:text-brand-primary'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                {specialties.length > 0 && (
                  <p className="mt-2 text-xs text-gray-500">{specialties.length} selected</p>
                )}
              </div>

              {/* Email (read-only) */}
              <div>
                <label className="block text-sm font-medium text-brand-charcoal mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={profile?.email || ''}
                  disabled
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500"
                />
                <p className="mt-1 text-xs text-gray-500">Contact support to change your email</p>
              </div>

              {/* Save button */}
              <div className="pt-4 border-t border-gray-100">
                <Button type="submit" disabled={saving} className="w-full sm:w-auto">
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Profile
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
