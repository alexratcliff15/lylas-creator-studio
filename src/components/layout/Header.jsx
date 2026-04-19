'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Search, Bell, Wifi, WifiOff, User, Settings, LogOut, CreditCard } from 'lucide-react';
import { Badge, Avatar } from '@/components/ui';
import { useApp } from '@/context/AppContext';

export function Header() {
  const { user, logout } = useApp();
  const [searchValue, setSearchValue] = useState('');
  const [notificationCount, setNotificationCount] = useState(3);
  const [metaConnected, setMetaConnected] = useState(null); // null = loading
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const isBrand = user?.role === 'brand' || user?.role === 'BRAND_ADMIN';

  // Live Meta status — only check for brand users
  useEffect(() => {
    if (!isBrand) return;
    let cancelled = false;
    async function check() {
      try {
        const res = await fetch('/api/meta/status', { cache: 'no-store' });
        const data = await res.json();
        if (!cancelled) setMetaConnected(!!data.connected);
      } catch {
        if (!cancelled) setMetaConnected(false);
      }
    }
    check();
    return () => {
      cancelled = true;
    };
  }, [isBrand]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function onClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener('mousedown', onClick);
      return () => document.removeEventListener('mousedown', onClick);
    }
  }, [menuOpen]);

  const handleLogout = async () => {
    try {
      await fetch('/api/logout', { method: 'POST' });
    } catch (e) {}
    logout();
    window.location.href = '/';
  };

  const initials =
    user?.name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || 'U';

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-gray-200">
      <div className="px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between gap-4">
          {/* Search */}
          <div className="hidden md:flex flex-1 max-w-md">
            <div className="relative w-full">
              <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                placeholder="Search..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent"
              />
            </div>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-4">
            {/* Meta Connection Status — brand users only */}
            {isBrand && (
              <Link
                href="/dashboard/settings"
                className="hidden sm:flex items-center gap-2"
                title={metaConnected ? 'Meta connected — click for settings' : 'Meta not connected — click to configure'}
              >
                {metaConnected === null ? (
                  <>
                    <Wifi className="w-5 h-5 text-gray-400" />
                    <Badge variant="info" size="sm">Meta Checking…</Badge>
                  </>
                ) : metaConnected ? (
                  <>
                    <Wifi className="w-5 h-5 text-green-600" />
                    <Badge variant="success" size="sm">Meta Connected</Badge>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-5 h-5 text-gray-400" />
                    <Badge variant="warning" size="sm">Meta Not Connected</Badge>
                  </>
                )}
              </Link>
            )}

            {/* Notifications */}
            <button className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <Bell className="w-5 h-5 text-gray-600" />
              {notificationCount > 0 && (
                <span className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-semibold">
                  {notificationCount}
                </span>
              )}
            </button>

            {/* Profile Menu */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Avatar initials={initials} size="sm" />
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-60 bg-white border border-gray-200 rounded-lg shadow-lg py-2 z-40"
                >
                  <div className="px-4 py-2 border-b border-gray-100">
                    <p className="text-sm font-semibold text-brand-charcoal truncate">
                      {user?.name || 'Account'}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{user?.email || ''}</p>
                  </div>

                  {user?.role === 'creator' && (
                    <Link
                      href="/dashboard/creator/profile"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <User className="w-4 h-4" />
                      My Profile
                    </Link>
                  )}

                  {user?.role === 'creator' && (
                    <Link
                      href="/dashboard/creator/earnings"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <CreditCard className="w-4 h-4" />
                      Earnings & Payouts
                    </Link>
                  )}

                  <Link
                    href="/dashboard/settings"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <Settings className="w-4 h-4" />
                    Settings
                  </Link>

                  <div className="my-1 border-t border-gray-100" />

                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      handleLogout();
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Search */}
        <div className="md:hidden mt-3">
          <div className="relative w-full">
            <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent"
            />
          </div>
        </div>
      </div>
    </header>
  );
}
