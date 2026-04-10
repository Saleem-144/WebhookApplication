'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import useAuthStore from '@/store/authStore';
import { loginRequest, fetchMe } from '@/lib/api';
import { afterAuthPathForUser } from '@/lib/authRedirects';

const apiErrorMessage = (err) => {
  if (err.response?.data?.error) return err.response.data.error;
  if (err.message) return err.message;
  return 'Unable to sign in. Check that the backend is running.';
};

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const login = useAuthStore((state) => state.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionCheck, setSessionCheck] = useState(true);

  const nextRaw = searchParams.get('next');

  const goAfterAuth = (user) => {
    const path = afterAuthPathForUser(user, searchParams.get('next'));
    if (typeof window !== 'undefined') {
      window.location.href = `${window.location.origin}${path}`;
    } else {
      router.replace(path);
      router.refresh();
    }
  };

  useEffect(() => {
    let cancelled = false;

    const checkSession = async () => {
      try {
        const res = await fetchMe();
        if (cancelled) return;
        if (res.success && res.data?.user) {
          const u = res.data.user;
          useAuthStore.getState().login(u);
          const path = afterAuthPathForUser(u, nextRaw);
          if (typeof window !== 'undefined') {
            window.location.href = `${window.location.origin}${path}`;
          } else {
            router.replace(path);
            router.refresh();
          }
          return;
        }
      } catch {
        /* no valid session */
      } finally {
        if (!cancelled) setSessionCheck(false);
      }
    };

    checkSession();
    return () => {
      cancelled = true;
    };
  }, [router, nextRaw]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await loginRequest(email.trim(), password);
      if (res.success && res.data?.user) {
        const u = res.data.user;
        login(u);
        goAfterAuth(u);
        return;
      }
      setError('Unexpected response from server');
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  if (sessionCheck) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1e1e2d] via-[#2a2a40] to-[#1e1e2d]">
        <div
          className="h-9 w-9 animate-spin rounded-full border-2 border-white/20 border-t-white"
          aria-label="Loading"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1e1e2d] via-[#2a2a40] to-[#1e1e2d] px-4">
      <div className="absolute top-20 left-20 w-72 h-72 bg-accent/10 rounded-full blur-3xl" />
      <div className="absolute bottom-20 right-20 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent/20 mb-4">
            <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">360 Digital US</h1>
          <p className="text-sm text-gray-400 tracking-wide uppercase">
            Super Admin Portal
          </p>
        </div>

        <div className="bg-white/[0.07] backdrop-blur-xl border border-white/[0.1] rounded-2xl p-8 shadow-2xl">
          <h2 className="text-xl font-semibold text-white mb-1">Welcome back</h2>
          <p className="text-sm text-gray-400 mb-6">Sign in to your admin account</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Email
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full px-4 py-3 rounded-xl bg-white/[0.06] border border-white/[0.1] text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 transition-all text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.06] border border-white/[0.1] text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 transition-all text-sm pr-12"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3">
                <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                {error}
              </div>
            )}

            <button
              id="login-submit"
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-xl bg-accent hover:bg-accent/90 text-white font-medium text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-accent/25"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  Sign In
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-500 mt-6">
          Authorized access only. All activity is monitored.
        </p>
      </div>
    </div>
  );
}

function LoginFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1e1e2d] via-[#2a2a40] to-[#1e1e2d]">
      <div
        className="h-9 w-9 animate-spin rounded-full border-2 border-white/20 border-t-white"
        aria-label="Loading"
      />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginForm />
    </Suspense>
  );
}
