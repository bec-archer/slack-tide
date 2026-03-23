'use client'

import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { useShop } from '@/contexts/ShopContext'
import NotificationBell from './NotificationBell'

const ADMIN_EMAILS = ['beckeeper78@gmail.com']

function BullseyeIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
      <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="1.5" opacity="0.6"/>
      <circle cx="12" cy="12" r="2" fill="currentColor"/>
    </svg>
  )
}

export default function Nav() {
  const { user, signOut, isLoading } = useAuth()
  const { isShopUser, shopName, shopVerified } = useShop()

  const isAdmin = user && ADMIN_EMAILS.includes(user.email || '')

  return (
    <nav className="bg-bg-secondary border-b border-border-subtle relative">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link
          href="/"
          className="text-lg font-bold tracking-tight text-text-primary hover:opacity-80 transition-opacity"
        >
          Slack Tide
        </Link>

        <div className="flex items-center gap-4">
          {isLoading ? (
            <div className="text-text-tertiary text-sm">
              <span className="animate-pulse-bullseye inline-block">
                <BullseyeIcon className="w-4 h-4" />
              </span>
            </div>
          ) : user ? (
            <>
              {isAdmin && (
                <Link
                  href="/dashboard"
                  className="text-text-secondary hover:text-accent text-sm font-medium transition-colors"
                >
                  Dashboard
                </Link>
              )}
              {isAdmin && (
                <Link
                  href="/admin"
                  className="text-warning hover:text-amber-300 text-sm font-semibold transition-colors"
                >
                  Admin
                </Link>
              )}
              {isShopUser && (
                <Link
                  href="/shop"
                  className="text-emerald-400 hover:text-emerald-300 text-sm font-semibold transition-colors relative"
                >
                  {shopName || 'Shop'}
                  {!shopVerified && (
                    <span className="ml-1 text-warning text-xs" title="Shop not verified">!</span>
                  )}
                </Link>
              )}
              <NotificationBell />
              <Link
                href="/account"
                className="text-text-secondary hover:text-accent text-sm font-medium transition-colors"
              >
                Account
              </Link>
              <button
                onClick={() => signOut()}
                className="text-text-tertiary hover:text-text-primary text-sm transition-colors"
              >
                Sign Out
              </button>
            </>
          ) : (
            <Link
              href="/auth"
              className="btn-primary !py-2 !px-5 !text-sm"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </nav>
  )
}
