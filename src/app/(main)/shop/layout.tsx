'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useShop } from '@/contexts/ShopContext'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import QRSTKRLogo from '@/components/QRSTKRLogo'

/** Routes under /shop that should NOT be gated by auth or shop membership */
const UNGATED_ROUTES = ['/shop/auth', '/shop/register', '/shop/invite']

function ShopNav() {
  const { isShopAdmin, shopName, shopVerified } = useShop()
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const navItems = [
    { href: '/shop', label: 'Dashboard' },
    { href: '/shop/submit', label: 'Submit Service' },
    { href: '/shop/history', label: 'History' },
    { href: '/shop/disputes', label: 'Disputes' },
    ...(isShopAdmin
      ? [{ href: '/shop/employees', label: 'Employees' }]
      : []),
    { href: '/shop/profile', label: 'Shop Profile' },
  ]

  function isActive(href: string): boolean {
    if (href === '/shop') return pathname === '/shop'
    return pathname.startsWith(href)
  }

  // Find current page label for mobile header
  const currentPage = navItems.find((item) => isActive(item.href))

  return (
    <div className="bg-bg-tertiary border-b border-border-subtle">
      <div className="max-w-5xl mx-auto px-4">
        {/* Shop name header + mobile hamburger */}
        <div className="py-2 border-b border-border-subtle/50 sm:border-b flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium text-text-tertiary uppercase tracking-wider">
              Shop Dashboard
            </p>
            <p className="text-sm font-semibold text-text-primary truncate">
              {shopName}
            </p>
          </div>
          {/* Mobile hamburger */}
          <button
            className="sm:hidden p-2 text-text-secondary hover:text-text-primary transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle shop menu"
          >
            {mobileMenuOpen ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            )}
          </button>
        </div>

        {/* Desktop: horizontal nav tabs */}
        <div className="hidden sm:flex items-center gap-1 overflow-x-auto py-2 -mx-1 px-1 scrollbar-hide">
          {navItems.map((item) => {
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`whitespace-nowrap px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  active
                    ? 'bg-accent/15 text-accent'
                    : 'text-text-tertiary hover:text-text-secondary hover:bg-bg-elevated/50'
                }`}
              >
                {item.label}
                {item.href === '/shop/profile' && !shopVerified && (
                  <span className="ml-1 text-warning text-xs" title="Verification needed">⚠️</span>
                )}
              </Link>
            )
          })}
        </div>

        {/* Mobile: dropdown menu */}
        {mobileMenuOpen && (
          <div className="sm:hidden py-2 flex flex-col gap-0.5">
            {navItems.map((item) => {
              const active = isActive(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                    active
                      ? 'bg-accent/15 text-accent'
                      : 'text-text-tertiary hover:text-text-secondary hover:bg-bg-elevated/50'
                  }`}
                >
                  {item.label}
                  {item.href === '/shop/profile' && !shopVerified && (
                    <span className="ml-1 text-warning text-xs">⚠️</span>
                  )}
                </Link>
              )
            })}
          </div>
        )}

        {/* Mobile: show current page indicator when menu is closed */}
        {!mobileMenuOpen && currentPage && (
          <div className="sm:hidden py-1.5">
            <p className="text-xs font-medium text-accent">{currentPage.label}</p>
          </div>
        )}
      </div>
    </div>
  )
}

/** Landing page shown to unauthenticated visitors at /shop */
function ShopLanding() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center animate-fade-in">
        <div className="mb-8">
          <QRSTKRLogo id="shop-landing" height={40} />
          <p className="text-xs font-semibold text-accent uppercase tracking-wider mt-3 mb-2">
            Shop Portal
          </p>
          <p className="text-text-secondary text-sm leading-relaxed">
            Log service records for customers, build your shop&apos;s verified history,
            and get found by vehicle owners who care about maintenance.
          </p>
        </div>

        <div className="space-y-3">
          <Link
            href="/shop/auth"
            className="btn-primary w-full block text-center"
          >
            Log In to Your Shop
          </Link>
          <Link
            href="/shop/auth?mode=signup&redirect=/shop/register"
            className="btn-secondary w-full block text-center"
          >
            Register a New Shop
          </Link>
        </div>

        <div className="mt-8 pt-6 border-t border-border-subtle">
          <p className="text-text-tertiary text-xs mb-3">
            Shop accounts are separate from personal QRSTKR accounts.
          </p>
          <p className="text-text-tertiary text-xs">
            Looking for your personal account?{' '}
            <Link href="/auth" className="text-accent hover:text-accent-secondary transition-colors">
              Sign in here
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading: isAuthLoading } = useAuth()
  const { isShopUser, isShopLoading } = useShop()
  const pathname = usePathname()

  // Check if this is an ungated route (auth, register, invite)
  const isUngatedRoute = UNGATED_ROUTES.some((route) => pathname.startsWith(route))

  // Ungated routes handle their own auth — just render them
  if (isUngatedRoute) {
    return (
      <main className="max-w-5xl mx-auto">
        {children}
      </main>
    )
  }

  // Still loading auth or shop context
  if (isAuthLoading || isShopLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-text-tertiary text-sm animate-pulse">
          Loading...
        </div>
      </div>
    )
  }

  // Not logged in — show the shop landing page
  if (!user) {
    return <ShopLanding />
  }

  // Logged in but not a shop user — prompt to register
  if (!isShopUser) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <div className="card-static p-8 text-center max-w-md">
          <h1 className="text-xl font-bold text-text-primary mb-2">No Shop Found</h1>
          <p className="text-text-secondary mb-6">
            This account isn&apos;t linked to a shop yet. Register your
            business to start logging service records for customers.
          </p>
          <Link href="/shop/register" className="btn-primary">
            Register Your Shop
          </Link>
        </div>
      </div>
    )
  }

  // Shop user — show shop nav + content
  return (
    <>
      <ShopNav />
      <main className="max-w-5xl mx-auto px-4 py-6">
        {children}
      </main>
    </>
  )
}
