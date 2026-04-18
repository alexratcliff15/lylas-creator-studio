'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { Avatar, Badge } from '@/components/ui';
import {
  Menu,
  X,
  LayoutDashboard,
  Upload,
  TrendingUp,
  Users,
  Award,
  Target,
  Settings,
  LogOut,
  BarChart3,
  Briefcase,
  CreditCard,
  Library,
  ChevronDown,
} from 'lucide-react';

const CREATOR_NAV = [
  { name: 'Dashboard', href: '/dashboard/creator', icon: LayoutDashboard },
  { name: 'My Profile', href: '/dashboard/creator/profile', icon: Users },
  { name: 'Upload', href: '/dashboard/creator/upload', icon: Upload },
  { name: 'Earnings', href: '/dashboard/creator/earnings', icon: TrendingUp },
  { name: 'Creator Feed', href: '/dashboard/creator/feed', icon: Users },
  { name: 'Samples', href: '/dashboard/creator/samples', icon: Award },
  { name: 'Targets', href: '/dashboard/creator/targets', icon: Target },
];

const BRAND_NAV = [
  { name: 'Dashboard', href: '/dashboard/brand', icon: LayoutDashboard },
  { name: 'Creators', href: '/dashboard/brand/creators', icon: Users },
  { name: 'Campaigns', href: '/dashboard/brand/campaigns', icon: Briefcase },
  { name: 'Meta Analytics', href: '/dashboard/brand/analytics', icon: BarChart3 },
  { name: 'Payments', href: '/dashboard/brand/payments', icon: CreditCard },
  { name: 'Content Library', href: '/dashboard/brand/library', icon: Library },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, portalMode, switchPortal, logout } = useApp();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = portalMode === 'creator' ? CREATOR_NAV : BRAND_NAV;

  const isActive = (href) => {
    if (href === '/dashboard/creator' || href === '/dashboard/brand') {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  const NavLinks = () => (
    <>
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className={`
              flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200
              ${
                active
                  ? 'bg-brand-primary text-white shadow-md'
                  : 'text-gray-700 hover:bg-gray-100'
              }
            `}
          >
            <Icon className="w-5 h-5 flex-shrink-0" />
            <span className="font-medium text-sm">{item.name}</span>
          </Link>
        );
      })}
    </>
  );

  return (
    <>
      {/* Mobile Toggle */}
      <div className="md:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50"
        >
          {mobileOpen ? (
            <X className="w-6 h-6 text-brand-primary" />
          ) : (
            <Menu className="w-6 h-6 text-brand-primary" />
          )}
        </button>
      </div>

      {/* Sidebar */}
      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-200
          flex flex-col overflow-y-auto transition-transform duration-300 ease-in-out
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        {/* Logo */}
        <div className="p-6 border-b border-gray-200">
          <Link href={portalMode === 'creator' ? '/dashboard/creator' : '/dashboard/brand'}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg brand-gradient flex items-center justify-center text-white font-bold text-lg">
                LH
              </div>
              <div>
                <p className="font-bold text-brand-charcoal text-sm">Lyla's House</p>
                <p className="text-xs text-gray-500">{portalMode === 'creator' ? 'Creator' : 'Brand'}</p>
              </div>
            </div>
          </Link>
        </div>

        {/* Portal Switcher — only show to brand admins / super admins */}
        {user && (user.role === 'brand_admin' || user.role === 'super_admin') && (
          <div className="p-4 border-b border-gray-200">
            <p className="text-xs font-semibold text-gray-600 mb-3 px-1">PORTAL</p>
            <div className="flex gap-2">
              <button
                onClick={() => switchPortal('creator')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-colors ${
                  portalMode === 'creator'
                    ? 'bg-brand-primary text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Creator
              </button>
              <button
                onClick={() => switchPortal('brand')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-colors ${
                  portalMode === 'brand'
                    ? 'bg-brand-accent text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Brand
              </button>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          <NavLinks />
        </nav>

        {/* User Info */}
        {user && (
          <div className="p-4 border-t border-gray-200 space-y-3">
            <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-gray-50">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar
                  initials={user.name?.split(' ').map(n => n[0]).join('') || 'U'}
                  size="md"
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{user.name}</p>
                  <p className="text-xs text-gray-500 truncate capitalize">{user.role}</p>
                </div>
              </div>
              <Link href="/dashboard/settings" title="Settings">
                <Settings className="w-4 h-4 text-gray-500 hover:text-gray-700 flex-shrink-0" />
              </Link>
            </div>

            {user.tier && (
              <Badge variant={user.tier} size="sm" className="w-full text-center">
                {user.tier.charAt(0).toUpperCase() + user.tier.slice(1)} Tier
              </Badge>
            )}

            <button
              onClick={async () => {
                try { await fetch('/api/logout', { method: 'POST' }); } catch (e) {}
                logout();
                window.location.href = '/';
              }}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm font-medium"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        )}
      </aside>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-30 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
    </>
  );
}
