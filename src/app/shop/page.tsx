'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useShop } from '@/contexts/ShopContext'
import { createBrowserClient } from '@/lib/supabase'

interface DashboardStats {
  totalRecords: number
  thisMonthRecords: number
  uniqueItems: number
  recentRecords: RecentRecord[]
}

interface RecentRecord {
  id: string
  title: string
  record_type: string
  service_date: string
  created_at: string
  item_nickname: string | null
  item_make: string | null
  item_model: string | null
  item_year: number | null
}

export default function ShopDashboardPage() {
  const { shopId, shopName, shopVerified } = useShop()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!shopId) return

    async function loadDashboard() {
      setIsLoading(true)
      try {
        const supabase = createBrowserClient()

        // Get total record count
        const { count: totalCount } = await supabase
          .from('maintenance_records')
          .select('id', { count: 'exact', head: true })
          .eq('shop_id', shopId)

        // Get this month's records
        const now = new Date()
        const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
        const { count: monthCount } = await supabase
          .from('maintenance_records')
          .select('id', { count: 'exact', head: true })
          .eq('shop_id', shopId)
          .gte('service_date', monthStart)

        // Get unique items served
        const { data: itemRows } = await supabase
          .from('maintenance_records')
          .select('item_id')
          .eq('shop_id', shopId)

        const uniqueItemIds = new Set((itemRows ?? []).map((r) => r.item_id))

        // Get 5 most recent records with item info
        const { data: recentRows } = await supabase
          .from('maintenance_records')
          .select('id, title, record_type, service_date, created_at, items(nickname, make, model, year)')
          .eq('shop_id', shopId)
          .order('created_at', { ascending: false })
          .limit(5)

        const recentRecords: RecentRecord[] = (recentRows ?? []).map((r) => {
          const item = r.items as unknown as { nickname: string | null; make: string | null; model: string | null; year: number | null } | null
          return {
            id: r.id,
            title: r.title,
            record_type: r.record_type,
            service_date: r.service_date,
            created_at: r.created_at,
            item_nickname: item?.nickname ?? null,
            item_make: item?.make ?? null,
            item_model: item?.model ?? null,
            item_year: item?.year ?? null,
          }
        })

        setStats({
          totalRecords: totalCount ?? 0,
          thisMonthRecords: monthCount ?? 0,
          uniqueItems: uniqueItemIds.size,
          recentRecords,
        })
      } catch {
        // Silently fail — dashboard is non-critical
      } finally {
        setIsLoading(false)
      }
    }

    loadDashboard()
  }, [shopId])

  function itemLabel(r: RecentRecord): string {
    const parts: string[] = []
    if (r.item_year) parts.push(String(r.item_year))
    if (r.item_make) parts.push(r.item_make)
    if (r.item_model) parts.push(r.item_model)
    if (parts.length > 0) return parts.join(' ')
    return r.item_nickname || 'Item'
  }

  function formatDate(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  function recordTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      service: 'Service',
      repair: 'Repair',
      upgrade: 'Upgrade',
      inspection: 'Inspection',
      diagnostic: 'Diagnostic',
      other: 'Other',
    }
    return labels[type] || type
  }

  return (
    <div>
      {/* Verification banner */}
      {!shopVerified && (
        <div className="bg-warning/10 border border-warning/30 rounded-lg p-4 mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-warning font-semibold text-sm">Shop Not Verified</p>
            <p className="text-text-secondary text-xs mt-0.5">
              Verify your shop to build trust with customers and appear in search results.
            </p>
          </div>
          <Link href="/shop/profile" className="btn-primary text-sm shrink-0">
            Verify Now
          </Link>
        </div>
      )}

      <h1 className="text-2xl font-bold text-text-primary mb-6">Dashboard</h1>

      {isLoading ? (
        <div className="text-text-tertiary text-sm animate-pulse py-8 text-center">
          Loading dashboard...
        </div>
      ) : stats ? (
        <>
          {/* Stats cards */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="card-static p-4 text-center">
              <p className="text-2xl font-bold text-text-primary">{stats.totalRecords}</p>
              <p className="text-xs text-text-tertiary mt-1">Total Records</p>
            </div>
            <div className="card-static p-4 text-center">
              <p className="text-2xl font-bold text-text-primary">{stats.thisMonthRecords}</p>
              <p className="text-xs text-text-tertiary mt-1">This Month</p>
            </div>
            <div className="card-static p-4 text-center">
              <p className="text-2xl font-bold text-text-primary">{stats.uniqueItems}</p>
              <p className="text-xs text-text-tertiary mt-1">Items Served</p>
            </div>
          </div>

          {/* Quick actions */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <Link
              href="/shop/submit"
              className="card-static p-5 text-center hover:border-accent/50 transition-colors group"
            >
              <div className="text-3xl mb-2">📱</div>
              <p className="text-sm font-semibold text-text-primary group-hover:text-accent transition-colors">
                Submit Service
              </p>
              <p className="text-xs text-text-tertiary mt-1">Scan a sticker to log work</p>
            </Link>
            <Link
              href="/shop/history"
              className="card-static p-5 text-center hover:border-accent/50 transition-colors group"
            >
              <div className="text-3xl mb-2">📋</div>
              <p className="text-sm font-semibold text-text-primary group-hover:text-accent transition-colors">
                View History
              </p>
              <p className="text-xs text-text-tertiary mt-1">Browse all submissions</p>
            </Link>
          </div>

          {/* Recent activity */}
          <div>
            <h2 className="text-sm font-semibold text-text-primary mb-3">Recent Activity</h2>
            {stats.recentRecords.length === 0 ? (
              <div className="card-static p-8 text-center">
                <p className="text-text-tertiary text-sm mb-3">No service records yet.</p>
                <Link href="/shop/submit" className="btn-primary text-sm">
                  Submit Your First Service
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {stats.recentRecords.map((record) => (
                  <div key={record.id} className="card-static p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-text-primary truncate">{record.title}</p>
                      <p className="text-xs text-text-tertiary mt-0.5">
                        {itemLabel(record)} · {recordTypeLabel(record.record_type)}
                      </p>
                    </div>
                    <p className="text-xs text-text-tertiary shrink-0">{formatDate(record.service_date)}</p>
                  </div>
                ))}
                {stats.totalRecords > 5 && (
                  <Link
                    href="/shop/history"
                    className="block text-center text-xs text-accent hover:text-accent-secondary transition-colors py-2"
                  >
                    View all {stats.totalRecords} records →
                  </Link>
                )}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="card-static p-8 text-center">
          <p className="text-text-tertiary text-sm">Failed to load dashboard data.</p>
        </div>
      )}
    </div>
  )
}
