'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useApp } from '@/context/AppContext';
import { Card, Button, Badge } from '@/components/ui';
import { api } from '@/lib/apiClient';
import {
  Settings as SettingsIcon,
  User,
  Shield,
  Bell,
  CreditCard,
  Link2,
  LogOut,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Loader2,
} from 'lucide-react';

export default function SettingsPage() {
  const { user, logout } = useApp();

  const isBrand = user?.role === 'brand' || user?.role === 'BRAND_ADMIN';

  const [metaStatus, setMetaStatus] = useState(null);
  const [metaLoading, setMetaLoading] = useState(true);

  const [stripeStatus, setStripeStatus] = useState(null);
  const [stripeLoading, setStripeLoading] = useState(true);
  const [connectingStripe, setConnectingStripe] = useState(false);
  const [error, setError] = useState('');
  const [stripeHint, setStripeHint] = useState(null); // { message, url } | null

  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifyPayout, setNotifyPayout] = useState(true);
  const [notifyCampaigns, setNotifyCampaigns] = useState(true);

  useEffect(() => {
    if (isBrand) fetchMeta();
    fetchStripe();
  }, []);

  async function fetchMeta() {
    try {
      setMetaLoading(true);
      const data = await api.get('/api/meta/status');
      setMetaStatus(data);
    } catch (err) {
      setMetaStatus({ connected: false, message: err.message });
    } finally {
      setMetaLoading(false);
    }
  }

  async function fetchStripe() {
    try {
      setStripeLoading(true);
      const data = await api.get('/api/stripe/connect');
      setStripeStatus(data);
    } catch (err) {
      // Brands/non-creators might not have Stripe info
      setStripeStatus(null);
    } finally {
      setStripeLoading(false);
    }
  }

  async function handleStripeConnect() {
    setConnectingStripe(true);
    setError('');
    setStripeHint(null);
    try {
      // Call fetch directly so we can read the hint/url fields on the error body.
      const res = await fetch('/api/stripe/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to connect Stripe');
        if (data.stripeDashboardUrl || data.hint) {
          setStripeHint({
            message: data.hint || 'Open Stripe to finish configuration.',
            url: data.stripeDashboardUrl || 'https://dashboard.stripe.com/connect',
          });
        }
        return;
      }

      if (data.onboardingUrl) {
        window.location.href = data.onboardingUrl;
      } else if (data.dashboardUrl) {
        window.open(data.dashboardUrl, '_blank');
      }
    } catch (err) {
      setError('Failed to connect Stripe: ' + err.message);
    } finally {
      setConnectingStripe(false);
    }
  }

  async function handleLogout() {
    try {
      await fetch('/api/logout', { method: 'POST' });
    } catch (e) {}
    logout();
    window.location.href = '/';
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-brand-charcoal flex items-center gap-2">
          <SettingsIcon className="w-6 h-6" />
          Settings
        </h1>
        <p className="text-gray-600 mt-1">
          Manage your account, connected services, and notification preferences
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p>{error}</p>
              {stripeHint && (
                <div className="mt-2 flex flex-col sm:flex-row sm:items-center gap-2">
                  <span className="text-red-800/80">{stripeHint.message}</span>
                  <a
                    href={stripeHint.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-brand-primary hover:underline"
                  >
                    Open Stripe Connect <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Account */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-brand-charcoal mb-4 flex items-center gap-2">
          <User className="w-5 h-5" /> Account
        </h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Name</span>
            <span className="font-medium">{user?.name || '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Email</span>
            <span className="font-medium">{user?.email || '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Role</span>
            <span className="font-medium capitalize">{user?.role || '—'}</span>
          </div>
          {user?.tier && (
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Tier</span>
              <Badge variant={user.tier} size="sm">
                {user.tier.charAt(0).toUpperCase() + user.tier.slice(1)}
              </Badge>
            </div>
          )}
        </div>
        {user?.role === 'creator' && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <Link href="/dashboard/creator/profile">
              <Button variant="secondary" size="sm">Edit profile</Button>
            </Link>
          </div>
        )}
      </Card>

      {/* Connected services */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-brand-charcoal mb-4 flex items-center gap-2">
          <Link2 className="w-5 h-5" /> Connected Services
        </h2>

        {/* Meta — brand users only */}
        {isBrand && (
          <div className="flex items-start justify-between gap-4 py-4 border-b border-gray-100">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="font-semibold text-brand-charcoal">Meta (Facebook / Instagram)</p>
                {metaLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                ) : metaStatus?.connected ? (
                  <Badge variant="success" size="sm">Connected</Badge>
                ) : (
                  <Badge variant="danger" size="sm">Not connected</Badge>
                )}
              </div>
              {metaLoading ? (
                <p className="text-xs text-gray-500">Checking connection…</p>
              ) : metaStatus?.connected ? (
                <p className="text-xs text-gray-500">
                  Linked as <span className="font-medium">{metaStatus.user?.name || 'Meta user'}</span>
                  {metaStatus.adAccount?.name && (
                    <> · Ad account: <span className="font-medium">{metaStatus.adAccount.name}</span></>
                  )}
                  {metaStatus.adAccountId && !metaStatus.adAccount && (
                    <> · Ad account ID: <span className="font-medium">{metaStatus.adAccountId}</span></>
                  )}
                </p>
              ) : (
                <p className="text-xs text-gray-500">
                  {metaStatus?.message || 'Meta Graph API token is not valid.'}
                </p>
              )}
            </div>
            <button
              onClick={fetchMeta}
              className="flex items-center gap-1 text-xs font-medium text-brand-primary hover:underline"
              title="Re-check connection"
            >
              <RefreshCw className="w-3 h-3" /> Re-check
            </button>
          </div>
        )}

        {/* Stripe */}
        {user?.role === 'creator' && (
          <div className="flex items-start justify-between gap-4 py-4 border-b border-gray-100">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="font-semibold text-brand-charcoal">Stripe (Payouts)</p>
                {stripeLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                ) : stripeStatus?.stripeOnboarded ? (
                  <Badge variant="success" size="sm">Connected</Badge>
                ) : stripeStatus?.connected ? (
                  <Badge variant="warning" size="sm">Incomplete</Badge>
                ) : (
                  <Badge variant="danger" size="sm">Not connected</Badge>
                )}
              </div>
              <p className="text-xs text-gray-500">
                {stripeStatus?.stripeOnboarded
                  ? 'Your bank account is connected and ready for payouts.'
                  : stripeStatus?.connected
                    ? 'Stripe onboarding not finished. Continue to receive payouts.'
                    : 'Connect your bank to receive commission payouts.'}
              </p>
            </div>
            <div>
              {stripeStatus?.stripeOnboarded ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleStripeConnect}
                  disabled={connectingStripe}
                >
                  <ExternalLink className="w-4 h-4 mr-1" />
                  Dashboard
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={handleStripeConnect}
                  disabled={connectingStripe}
                >
                  <CreditCard className="w-4 h-4 mr-1" />
                  {connectingStripe ? 'Loading…' : stripeStatus?.connected ? 'Continue Setup' : 'Connect Bank'}
                </Button>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* Notifications */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-brand-charcoal mb-4 flex items-center gap-2">
          <Bell className="w-5 h-5" /> Notifications
        </h2>
        <div className="space-y-3">
          <ToggleRow
            label="Email updates"
            description="Get occasional product updates and tips"
            checked={notifyEmail}
            onChange={setNotifyEmail}
          />
          <ToggleRow
            label="Payout notifications"
            description="Get notified when a payout is issued"
            checked={notifyPayout}
            onChange={setNotifyPayout}
          />
          <ToggleRow
            label="Campaign alerts"
            description="Get notified about new campaigns that match your specialties"
            checked={notifyCampaigns}
            onChange={setNotifyCampaigns}
          />
        </div>
        <p className="text-xs text-gray-500 mt-3">
          Notification preferences are stored locally for now — server-side preferences coming soon.
        </p>
      </Card>

      {/* Security */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-brand-charcoal mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5" /> Security
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          To change your password or email, please contact support. Session tokens are stored securely in an httpOnly cookie.
        </p>
        <Button variant="secondary" size="sm" onClick={handleLogout}>
          <LogOut className="w-4 h-4 mr-2" />
          Sign out of this device
        </Button>
      </Card>
    </div>
  );
}

function ToggleRow({ label, description, checked, onChange }) {
  return (
    <label className="flex items-start justify-between gap-4 cursor-pointer py-2">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-brand-charcoal">{label}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
      <span className="relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition-colors"
        style={{ backgroundColor: checked ? '#5C7A3D' : '#d1d5db' }}
        onClick={() => onChange(!checked)}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
            checked ? 'translate-x-4' : ''
          }`}
        />
      </span>
    </label>
  );
}
