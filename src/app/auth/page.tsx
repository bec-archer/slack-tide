'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import QRSTKRLogo from '@/components/QRSTKRLogo'

function AuthForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') || '/my-items'
  const { signIn, signUp, user } = useAuth()

  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [signupSuccess, setSignupSuccess] = useState(false)
  const [oauthLoading, setOauthLoading] = useState<string | null>(null)
  const [resetSent, setResetSent] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)

  // If already logged in, redirect
  if (user) {
    router.push(redirectTo)
    return null
  }

  async function handleOAuth(provider: 'google' | 'apple') {
    setError(null)
    setOauthLoading(provider)

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}${redirectTo}`,
        },
      })

      if (error) {
        setError(error.message)
        setOauthLoading(null)
      }
    } catch {
      setError('Something went wrong. Try again.')
      setOauthLoading(null)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    if (mode === 'signup' && password !== confirmPassword) {
      setError('Passwords do not match')
      setIsSubmitting(false)
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      setIsSubmitting(false)
      return
    }

    try {
      if (mode === 'signup') {
        const { error } = await signUp(email, password)
        if (error) {
          setError(error)
        } else {
          setSignupSuccess(true)
        }
      } else {
        const { error } = await signIn(email, password)
        if (error) {
          setError(error)
        } else {
          router.push(redirectTo)
        }
      }
    } catch {
      setError('Something went wrong. Try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleForgotPassword() {
    if (!email) {
      setError('Enter your email address first, then click Forgot Password')
      return
    }
    setError(null)
    setResetLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) {
        setError(error.message)
      } else {
        setResetSent(true)
      }
    } catch {
      setError('Something went wrong. Try again.')
    } finally {
      setResetLoading(false)
    }
  }

  if (resetSent) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4">
        <div className="max-w-md w-full card-static p-8 text-center animate-fade-in">
          <div className="text-5xl mb-4">🔑</div>
          <h1 className="text-2xl font-bold text-text-primary mb-2">Check Your Email</h1>
          <p className="text-text-secondary mb-6">
            We sent a password reset link to <span className="text-text-primary font-medium">{email}</span>.
            Click the link to set a new password.
          </p>
          <button
            onClick={() => {
              setResetSent(false)
              setMode('signin')
            }}
            className="text-accent hover:text-accent-secondary text-sm transition-colors"
          >
            Back to Sign In
          </button>
        </div>
      </div>
    )
  }

  if (signupSuccess) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4">
        <div className="max-w-md w-full card-static p-8 text-center animate-fade-in">
          <div className="text-5xl mb-4">📬</div>
          <h1 className="text-2xl font-bold text-text-primary mb-2">Check Your Email</h1>
          <p className="text-text-secondary mb-6">
            We sent a confirmation link to <span className="text-text-primary font-medium">{email}</span>.
            Click the link to activate your account.
          </p>
          <button
            onClick={() => {
              setSignupSuccess(false)
              setMode('signin')
            }}
            className="text-accent hover:text-accent-secondary text-sm transition-colors"
          >
            Back to Sign In
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4">
      <div className="max-w-md w-full animate-fade-in">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block mb-3">
            <QRSTKRLogo id="auth" height={36} />
          </Link>
          <p className="text-text-secondary">
            {mode === 'signin' ? 'Sign in to manage your items' : 'Create your account'}
          </p>
        </div>

        <div className="card-static p-6">
          {/* OAuth buttons */}
          <div className="space-y-3 mb-6">
            <button
              onClick={() => handleOAuth('google')}
              disabled={oauthLoading !== null}
              className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 disabled:bg-gray-200 disabled:cursor-not-allowed text-gray-800 font-medium py-3 px-6 rounded-xl transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              {oauthLoading === 'google' ? 'Redirecting...' : 'Continue with Google'}
            </button>

            <button
              onClick={() => handleOAuth('apple')}
              disabled={oauthLoading !== null}
              className="w-full flex items-center justify-center gap-3 bg-black hover:bg-gray-900 disabled:bg-gray-800 disabled:cursor-not-allowed text-white font-medium py-3 px-6 rounded-xl transition-colors border border-gray-700"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
              </svg>
              {oauthLoading === 'apple' ? 'Redirecting...' : 'Continue with Apple'}
            </button>
          </div>

          {/* Shop portal link */}
          <div className="text-center mb-4">
            <Link
              href="/shop"
              className="text-sm text-text-tertiary hover:text-accent transition-colors"
            >
              Are you a repair shop?{' '}
              <span className="text-accent font-medium">Go to Shop Portal →</span>
            </Link>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-border-default"></div>
            <span className="text-text-tertiary text-sm">or</span>
            <div className="flex-1 h-px bg-border-default"></div>
          </div>

          {/* Mode toggle */}
          <div className="flex rounded-xl bg-bg-tertiary p-1 mb-6">
            <button
              onClick={() => { setMode('signin'); setError(null) }}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                mode === 'signin'
                  ? 'bg-bg-elevated text-text-primary shadow-sm'
                  : 'text-text-tertiary hover:text-text-secondary'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setMode('signup'); setError(null) }}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                mode === 'signup'
                  ? 'bg-bg-elevated text-text-primary shadow-sm'
                  : 'text-text-tertiary hover:text-text-secondary'
              }`}
            >
              Sign Up
            </button>
          </div>

          {error && (
            <div className="bg-error/10 border border-error/30 rounded-xl p-4 mb-4">
              <p className="text-error text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="input"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'signup' ? 'At least 6 characters' : 'Your password'}
                className="input"
                required
              />
            </div>

            {mode === 'signin' && (
              <div className="text-right -mt-2">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={resetLoading}
                  className="text-accent hover:text-accent-secondary text-xs transition-colors"
                >
                  {resetLoading ? 'Sending...' : 'Forgot password?'}
                </button>
              </div>
            )}

            {mode === 'signup' && (
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  className="input"
                  required
                />
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary w-full"
            >
              {isSubmitting
                ? (mode === 'signin' ? 'Signing in...' : 'Creating account...')
                : (mode === 'signin' ? 'Sign In' : 'Create Account')}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default function AuthPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-bg-primary">
        <div className="animate-pulse-bullseye">
          <QRSTKRLogo id="auth-loading" height={32} />
        </div>
      </div>
    }>
      <AuthForm />
    </Suspense>
  )
}
