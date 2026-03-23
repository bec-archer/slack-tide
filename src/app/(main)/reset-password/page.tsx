'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase'
import Link from 'next/link'
import QRSTKRLogo from '@/components/QRSTKRLogo'

export default function ResetPasswordPage() {
  const router = useRouter()
  const supabase = createBrowserClient()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)

  // Supabase processes the recovery token from the URL hash automatically
  // We just need to wait for the session to be established
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setSessionReady(true)
      }
    })

    // Also check if we already have a session (user clicked link and session is already active)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessionReady(true)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setIsSubmitting(true)

    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) {
        setError(error.message)
      } else {
        setSuccess(true)
        setTimeout(() => router.push('/my-items'), 3000)
      }
    } catch {
      setError('Something went wrong. Try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4">
        <div className="max-w-md w-full card-static p-8 text-center animate-fade-in">
          <div className="text-5xl mb-4">✅</div>
          <h1 className="text-2xl font-bold text-text-primary mb-2">Password Updated</h1>
          <p className="text-text-secondary mb-6">
            Your password has been reset successfully. Redirecting you now...
          </p>
          <Link href="/my-items" className="text-accent hover:text-accent-secondary text-sm transition-colors">
            Go to My Items
          </Link>
        </div>
      </div>
    )
  }

  if (!sessionReady) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4">
        <div className="max-w-md w-full card-static p-8 text-center animate-fade-in">
          <div className="text-5xl mb-4">🔑</div>
          <h1 className="text-2xl font-bold text-text-primary mb-2">Reset Your Password</h1>
          <p className="text-text-secondary mb-6">
            Processing your reset link...
          </p>
          <p className="text-text-tertiary text-sm">
            If nothing happens, your reset link may have expired.{' '}
            <Link href="/auth" className="text-accent hover:text-accent-secondary transition-colors">
              Request a new one
            </Link>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4">
      <div className="max-w-md w-full animate-fade-in">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block mb-3">
            <QRSTKRLogo id="reset" height={36} />
          </Link>
          <p className="text-text-secondary">Choose a new password</p>
        </div>

        <div className="card-static p-6">
          {error && (
            <div className="bg-error/10 border border-error/30 rounded-xl p-4 mb-4">
              <p className="text-error text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleReset} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                New Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="input"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Confirm New Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your new password"
                className="input"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary w-full"
            >
              {isSubmitting ? 'Updating...' : 'Set New Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
