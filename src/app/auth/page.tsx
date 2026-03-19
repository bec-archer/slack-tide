'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

function AuthForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') || '/dashboard'
  const { signIn, user } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)

  if (user) {
    router.push(redirectTo)
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const { error } = await signIn(email, password)
      if (error) {
        setError(error)
      } else {
        router.push(redirectTo)
      }
    } catch {
      setError('Something went wrong. Try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleForgotPassword() {
    if (!email) {
      setError('Enter your email first, then click forgot password.')
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
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#0a0f1e' }}>
        <div className="max-w-sm w-full text-center">
          <p style={{ color: '#4ecdc4' }} className="text-sm font-medium tracking-widest uppercase mb-4">
            Check your email
          </p>
          <p style={{ color: '#7a8ba6' }} className="text-sm leading-relaxed mb-8">
            We sent a password reset link to{' '}
            <span className="text-white font-medium">{email}</span>.
            Click the link to set a new password.
          </p>
          <button
            onClick={() => setResetSent(false)}
            style={{ color: '#4ecdc4' }}
            className="text-sm hover:opacity-80 transition-opacity"
          >
            Back to sign in
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4 relative"
      style={{ background: '#0a0f1e' }}
    >
      {/* Faint water-like gradient overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 80% 50% at 50% 40%, rgba(78,205,196,0.04) 0%, transparent 70%)',
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(180deg, transparent 0%, rgba(78,205,196,0.02) 50%, transparent 100%)',
        }}
      />

      <div className="relative z-10 w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-10">
          <h1
            className="text-3xl font-bold tracking-tight mb-3"
            style={{
              color: '#e8edf4',
              fontFamily: 'var(--font-plus-jakarta), system-ui, sans-serif',
            }}
          >
            Slack Tide
          </h1>
          <p
            className="text-sm tracking-wide"
            style={{ color: '#5a6b82' }}
          >
            See what&apos;s beneath the surface.
          </p>

          {/* Tide line divider */}
          <div
            className="mx-auto mt-6"
            style={{
              width: '100%',
              maxWidth: '200px',
              height: '1px',
              background: 'linear-gradient(90deg, transparent, rgba(78,205,196,0.3), transparent)',
            }}
          />
        </div>

        {/* Form */}
        <div className="space-y-5">
          {error && (
            <div
              className="rounded-lg px-4 py-3 text-sm"
              style={{
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.2)',
                color: '#f87171',
              }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                className="block text-xs font-medium uppercase tracking-wider mb-2"
                style={{ color: '#5a6b82' }}
              >
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
                className="w-full rounded-lg px-4 py-3 text-sm outline-none transition-all placeholder:opacity-30"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: '#e8edf4',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(78,205,196,0.4)'
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(78,205,196,0.08)'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label
                  className="block text-xs font-medium uppercase tracking-wider"
                  style={{ color: '#5a6b82' }}
                >
                  Password
                </label>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={resetLoading}
                  className="text-xs transition-opacity hover:opacity-80 disabled:opacity-40"
                  style={{ color: '#4ecdc4' }}
                >
                  {resetLoading ? 'Sending...' : 'Forgot?'}
                </button>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
                required
                autoComplete="current-password"
                className="w-full rounded-lg px-4 py-3 text-sm outline-none transition-all placeholder:opacity-30"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: '#e8edf4',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(78,205,196,0.4)'
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(78,205,196,0.08)'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-lg py-3 text-sm font-semibold tracking-wide transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: isSubmitting ? 'rgba(78,205,196,0.15)' : 'rgba(78,205,196,0.12)',
                color: '#4ecdc4',
                border: '1px solid rgba(78,205,196,0.2)',
              }}
              onMouseEnter={(e) => {
                if (!isSubmitting) {
                  e.currentTarget.style.background = 'rgba(78,205,196,0.2)'
                  e.currentTarget.style.borderColor = 'rgba(78,205,196,0.35)'
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(78,205,196,0.12)'
                e.currentTarget.style.borderColor = 'rgba(78,205,196,0.2)'
              }}
            >
              {isSubmitting ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>

      {/* Footer */}
      <p
        className="absolute bottom-6 text-xs"
        style={{ color: '#2a3548' }}
      >
        &copy; Slack Tide
      </p>
    </div>
  )
}

export default function AuthPage() {
  return (
    <Suspense fallback={
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: '#0a0f1e' }}
      >
        <p
          className="text-sm animate-pulse"
          style={{ color: '#4ecdc4' }}
        >
          Slack Tide
        </p>
      </div>
    }>
      <AuthForm />
    </Suspense>
  )
}
