'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import { Mail, Lock, Chrome } from 'lucide-react';
import { useApp } from '@/context/AppContext';

export default function LoginPage() {
  const router = useRouter();
  const { setUser } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [signInRole, setSignInRole] = useState(null);

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import { Mail, Lock, Chrome } from 'lucide-react';
import { useApp } from '@/context/AppContext';

export default function LoginPage() {
  const router = useRouter();
  const { setUser } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [signInRole, setSignInRole] = useState(null);

  const handleEmailSignIn = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      // Update AppContext synchronously so DashboardLayout doesn't redirect us back
      setUser(data.user);

      // Use a full page load so middleware + AppContext both read the fresh cookie/localStorage
      window.location.href = data.user.role === 'creator' ? '/dashboard/creator' : '/dashboard/brand';
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      window.location.href = '/api/auth/google';
    } catch (err) {
      setError('Google sign-in failed');
      setLoading(false);
    }
  };

  const handleDemoLogin = async (role) => {
    setSignInRole(role);
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/demo-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Demo login failed');

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setUser(data.user);

      window.location.href = role === 'creator' ? '/dashboard/creator' : '/dashboard/brand';
    } catch (err) {
      setError(err.message);
      setLoading(false);
      setSignInRole(null);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 brand-gradient flex-col justify-between p-12 text-white">
        <div>
          <div className="text-4xl font-bold mb-2">LH</div>
          <h1 className="text-5xl font-bold mb-4">Lyla's House</h1>
          <p className="text-lg opacity-90">Creator Studio</p>
        </div>

        <div className="space-y-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
              <span className="text-2xl">ð¬</span>
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-1">Create & Monetize</h3>
              <p className="opacity-90">Upload UGC content and earn on every conversion</p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
              <span className="text-2xl">ð</span>
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-1">Real-Time Analytics</h3>
              <p className="opacity-90">Track performance, ROAS, and earnings instantly</p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
              <span className="text-2xl">ð°</span>
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-1">Unlock Rewards</h3>
              <p className="opacity-90">Reach milestones and unlock premium tier benefits</p>
            </div>
          </div>
        </div>

        <p className="text-sm opacity-75">Â© 2024 Lyla's House. All rights reserved.</p>
      </div>

      {/* Right side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-brand-charcoal mb-2">Welcome Back</h2>
            <p className="text-gray-600">Sign in to your Lyla's House account</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleEmailSignIn} className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-brand-charcoal mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-brand-charcoal mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="â¢â¢â¢â¢â¢â¢â¢â¢"
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Or continue with</span>
            </div>
          </div>

          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors mb-6"
          >
            <Chrome className="w-5 h-5" />
            <span className="font-medium">Google</span>
          </button>

          <div className="space-y-2 mb-8">
            <p className="text-xs text-gray-600 font-medium">Demo Access:</p>
            <div className="flex gap-2">
              <button
                onClick={() => handleDemoLogin('creator')}
                className="flex-1 py-2 px-3 text-sm font-semibold border border-brand-primary text-brand-primary rounded-lg hover:bg-brand-cream transition-colors"
              >
                Creator Demo
              </button>
              <button
                onClick={() => handleDemoLogin('brand')}
                className="flex-1 py-2 px-3 text-sm font-semibold border border-brand-accent text-brand-accent rounded-lg hover:bg-brand-cream transition-colors"
              >
                Brand Demo
              </button>
            </div>
          </div>

          <p className="text-center text-sm text-gray-600">
            Don't have an account?{' '}
            <a href="/signup" className="text-brand-primary font-semibold hover:underline">
              Sign up
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
