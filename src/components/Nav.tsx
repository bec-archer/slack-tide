'use client'

import { useState } from 'react'
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
  const [menuOpen, setMenuOpen] = useState(false)

  const isAdmin = user && ADMIN_EMAILS.includes(user.email || '')

  return (
    <nav className="bg-bg-secondary border-b border-border-subtle relative">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link
          href="/"
          className="text-lg font-bold tracking-tight text-text-primary hover:opacity-80 transition-opacity"
          onClick={() => setMenuOpen(false)}
        >
          Slack Tide
        </Link>

        {/* Desktop nav — hidden on mobile */}
        <div className="hidden sm:flex items-center gap-4">
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
                  href="/admin"
                  className="text-warning hover:text-amber-300 text-sm font-semibold transition-colors"
                >
                  ⚡ Admin
                </Link>
              )}
              {isShopUser ? (
                <>
                  <Link
                    href="/shop"
                    className="text-emerald-400 hover:text-emerald-300 text-sm font-semibold transition-colors relative"
                  >
                    🔧 {shopName || 'Shop'}
                    {!shopVerified && (
                      <span className="ml-1 text-warning text-xs" title="Shop not verified">⚠️</span>
                    )}
                  </Link>
                </>
              ) : (
                <>
                  <NotificationBell />
                  <Link
                    href="/my-orders"
                    className="text-text-secondary hover:text-accent text-sm font-medium transition-colors"
                  >
                    My Orders
                  </Link>
                  <Link
                    href="/my-items"
                    className="text-text-secondary hover:text-accent text-sm font-medium transition-colors"
                  >
                    My Items
                  </Link>
                  <Link
                    href="/account"
                    className="text-text-secondary hover:text-accent text-sm font-medium transition-colors"
                  >
                    My Account
                  </Link>
                </>
              )}
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

        {/* Mobile nav — visible on small screens */}
        <div className="sm:hidden">
          {isLoading ? (
            <div className="text-text-tertiary text-sm">
              <span className="animate-pulse-bullseye inline-block">
                <BullseyeIcon className="w-4 h-4" />
              </span>
            </div>
          ) : user ? (
            isShopUser ? (
              /* Shop users: just sign out — shop nav has its own hamburger */
              <button
                onClick={() => signOut()}
                className="text-text-tertiary hover:text-text-primary text-sm transition-colors py-2"
              >
                Sign Out
              </button>
            ) : (
              /* Personal users: hamburger for My Orders / My Items / Account */
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="text-text-secondary hover:text-text-primary p-2 transition-colors"
                aria-label="Toggle menu"
              >
                {menuOpen ? (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                  </svg>
                )}
              </button>
            )
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

      {/* Mobile dropdown menu — personal (non-shop) users only */}
      {menuOpen && user && !isShopUser && (
        <div className="sm:hidden border-t border-border-subtle bg-bg-secondary">
          <div className="max-w-5xl mx-auto px-4 py-3 flex flex-col gap-3">
            {isAdmin && (
              <Link
                href="/admin"
                onClick={() => setMenuOpen(false)}
                className="text-warning hover:text-amber-300 text-sm font-semibold transition-colors py-2"
              >
                ⚡ Admin
              </Link>
            )}
            <Link
              href="/my-orders"
              onClick={() => setMenuOpen(false)}
              className="text-text-secondary hover:text-accent text-sm font-medium transition-colors py-2"
            >
              My Orders
            </Link>
            <Link
              href="/my-items"
              onClick={() => setMenuOpen(false)}
              className="text-text-secondary hover:text-accent text-sm font-medium transition-colors py-2"
            >
              My Items
            </Link>
            <Link
              href="/account"
              onClick={() => setMenuOpen(false)}
              className="text-text-secondary hover:text-accent text-sm font-medium transition-colors py-2"
            >
              My Account
            </Link>
            <button
              onClick={() => { setMenuOpen(false); signOut() }}
              className="text-text-tertiary hover:text-text-primary text-sm transition-colors py-2 text-left"
            >
              Sign Out
            </button>
          </div>
        </div>
      )}
    </nav>
  )
}
