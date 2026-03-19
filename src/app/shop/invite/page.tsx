'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useShop } from '@/contexts/ShopContext'
import { createBrowserClient } from '@/lib/supabase'
import Link from 'next/link'
import QRSTKRLogo from '@/components/QRSTKRLogo'

export default function ShopInvitePage() {
  const router = useRouter()
  const { user, isLoading: isAuthLoading } = useAuth()
  const { isShopUser, isShopLoading, refreshShopContext } = useShop()

  const [isAccepting, setIsAccepting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{ shopName: string; role: string } | null>(null)

  if (isAuthLoading || isShopLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-text-tertiary text-sm animate-pulse">Loading...</div>
      </div>
    )
  }

  // Not logged in
  if (!user) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4">
        <div className="card-static p-8 text-center max-w-md">
          <Link href="/" className="inline-block mb-4">
            <QRSTKRLogo id="invite" height={36} />
          </Link>
          <h1 className="text-xl font-bold text-text-primary mb-2">Shop Invitation</h1>
          <p className="text-text-secondary mb-6">
            Sign in or create an account to accept your shop invitation.
          </p>
          <Link href="/auth?redirect=/shop/invite" className="btn-primary">
            Sign In or Sign Up
          </Link>
        </div>
      </div>
    )
  }

  // Already part of a shop
  if (isShopUser && !success) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4">
        <div className="card-static p-8 text-center max-w-md">
          <h1 className="text-xl font-bold text-text-primary mb-2">Already on a Team</h1>
          <p className="text-text-secondary mb-6">
            Your account is already associated with a shop. You can only belong to one
            shop at a time.
          </p>
          <Link href="/shop" className="btn-primary">
            Go to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4">
        <div className="card-static p-8 text-center max-w-md animate-fade-in">
          <div className="text-5xl mb-4">🎉</div>
          <h1 className="text-xl font-bold text-text-primary mb-2">You&apos;re In!</h1>
          <p className="text-text-secondary mb-6">
            You&apos;ve joined <span className="text-text-primary font-medium">{success.shopName}</span> as
            a <span className="text-text-primary font-medium">{success.role}</span>.
          </p>
          <button onClick={() => router.push('/shop')} className="btn-primary">
            Go to Shop Dashboard
          </button>
        </div>
      </div>
    )
  }

  async function handleAccept() {
    setError(null)
    setIsAccepting(true)

    try {
      const supabase = createBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        setError('Session expired. Please sign in again.')
        setIsAccepting(false)
        return
      }

      const res = await fetch('/api/shops/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      })

      const body = await res.json().catch(() => null)

      if (!res.ok) {
        const msg: string = body?.error || `Failed to accept invitation (${res.status})`
        setError(msg)
        setIsAccepting(false)
        return
      }

      setSuccess({ shopName: body.shop_name, role: body.role })
      await refreshShopContext()
    } catch {
      setError('Something went wrong. Please try again.')
      setIsAccepting(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4">
      <div className="card-static p-8 text-center max-w-md">
        <Link href="/" className="inline-block mb-4">
          <QRSTKRLogo id="invite-accept" height={36} />
        </Link>
        <h1 className="text-xl font-bold text-text-primary mb-2">Accept Shop Invitation</h1>
        <p className="text-text-secondary mb-2">
          Signed in as <span className="text-text-primary font-medium">{user.email}</span>
        </p>
        <p className="text-text-secondary text-sm mb-6">
          If your shop admin invited your email or phone number, click below to join the team.
        </p>

        {error && (
          <div className="bg-error/10 border border-error/30 rounded-xl p-4 mb-4">
            <p className="text-error text-sm">{error}</p>
          </div>
        )}

        <button
          onClick={handleAccept}
          disabled={isAccepting}
          className="btn-primary w-full mb-4"
        >
          {isAccepting ? 'Accepting...' : 'Accept Invitation'}
        </button>

        <p className="text-text-tertiary text-xs">
          Wrong account?{' '}
          <Link href="/auth?redirect=/shop/invite" className="text-accent">
            Sign in with a different email
          </Link>
        </p>
      </div>
    </div>
  )
}
