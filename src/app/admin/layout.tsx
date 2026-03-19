'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useEffect, useState, useCallback } from 'react'
import { createBrowserClient } from '@/lib/supabase'

const ADMIN_EMAILS = ['beckeeper78@gmail.com']

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: '◉' },
  { href: '/admin/orders', label: 'Print Queue', icon: '⎙' },
  { href: '/admin/shops', label: 'Shop Verification', icon: '✓', badgeKey: 'pendingShops' as const },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)
  const [pendingShops, setPendingShops] = useState(0)

  const fetchBadgeCounts = useCallback(async () => {
    try {
      const supabase = createBrowserClient()
      const { count } = await supabase
        .from('shops')
        .select('id', { count: 'exact', head: true })
        .eq('verification_requested', true)
        .eq('verified', false)

      setPendingShops(count ?? 0)
    } catch {
      // Silently fail — badge is non-critical
    }
  }, [])

  useEffect(() => {
    if (!isLoading) {
      if (!user || !ADMIN_EMAILS.includes(user.email || '')) {
        router.push('/')
      } else {
        setAuthorized(true)
        fetchBadgeCounts()
      }
    }
  }, [user, isLoading, router, fetchBadgeCounts])

  // Refresh badge counts when navigating between admin pages
  useEffect(() => {
    if (authorized) {
      fetchBadgeCounts()
    }
  }, [pathname, authorized, fetchBadgeCounts])

  const badgeCounts: Record<string, number> = {
    pendingShops,
  }

  if (isLoading || !authorized) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <p className="text-text-tertiary text-sm animate-pulse">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Admin Header Bar */}
      <div className="bg-bg-secondary border-b border-border-subtle">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-text-primary font-bold text-sm tracking-wider uppercase">
              <span className="text-warning">⚡</span> Admin
            </h1>
            <nav className="flex items-center gap-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href ||
                  (item.href !== '/admin' && pathname.startsWith(item.href))
                const badge = item.badgeKey ? badgeCounts[item.badgeKey] : 0
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`relative px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-bg-elevated text-accent'
                        : 'text-text-tertiary hover:text-text-secondary hover:bg-bg-tertiary'
                    }`}
                  >
                    <span className="mr-1.5">{item.icon}</span>
                    {item.label}
                    {badge > 0 && (
                      <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full bg-error text-white">
                        {badge}
                      </span>
                    )}
                  </Link>
                )
              })}
            </nav>
          </div>
          <span className="text-text-tertiary text-xs font-mono">{user?.email}</span>
        </div>
      </div>

      {/* Page Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {children}
      </div>
    </div>
  )
}
