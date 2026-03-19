'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface DashboardStats {
  total: number
  byStatus: Record<string, number>
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch('/api/admin/orders?limit=200')
        const data = await res.json()
        if (data.orders) {
          const byStatus: Record<string, number> = {}
          for (const order of data.orders) {
            byStatus[order.status] = (byStatus[order.status] || 0) + 1
          }
          setStats({ total: data.total || data.orders.length, byStatus })
        }
      } catch (err) {
        console.error('Failed to fetch stats:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [])

  const statusCards = [
    { key: 'paid', label: 'Awaiting Print', color: '#f59e0b', emoji: '🔥' },
    { key: 'printing', label: 'Printing', color: '#60a5fa', emoji: '🖨️' },
    { key: 'shipped', label: 'Shipped', color: '#a78bfa', emoji: '📦' },
    { key: 'completed', label: 'Completed', color: '#4ade80', emoji: '✅' },
  ]

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-text-primary text-2xl font-bold mb-1">Dashboard</h2>
        <p className="text-text-tertiary text-sm">QRSTKR order management</p>
      </div>

      {loading ? (
        <p className="text-text-tertiary text-sm animate-pulse">Loading stats...</p>
      ) : (
        <>
          {/* Status Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {statusCards.map((card) => (
              <Link
                key={card.key}
                href={`/admin/orders?status=${card.key}`}
                className="bg-bg-secondary border border-border-subtle rounded-xl p-5 hover:border-border-default transition-colors group"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-2xl">{card.emoji}</span>
                  <span
                    className="text-3xl font-bold font-mono"
                    style={{ color: card.color }}
                  >
                    {stats?.byStatus[card.key] || 0}
                  </span>
                </div>
                <p className="text-text-secondary text-sm font-medium">{card.label}</p>
              </Link>
            ))}
          </div>

          {/* Total */}
          <div className="bg-bg-secondary border border-border-subtle rounded-xl p-5 mb-8">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-text-tertiary text-xs font-medium uppercase tracking-wider mb-1">Total Orders</p>
                <p className="text-text-primary text-3xl font-bold font-mono">{stats?.total || 0}</p>
              </div>
              <Link
                href="/admin/orders"
                className="btn-primary !py-2.5 !px-5 !text-sm"
              >
                View All Orders →
              </Link>
            </div>
          </div>

          {/* Quick Status Breakdown */}
          {stats && Object.keys(stats.byStatus).length > 0 && (
            <div className="bg-bg-secondary border border-border-subtle rounded-xl p-5">
              <h3 className="text-text-secondary text-sm font-semibold mb-4 uppercase tracking-wider">All Statuses</h3>
              <div className="space-y-2">
                {Object.entries(stats.byStatus)
                  .sort(([, a], [, b]) => b - a)
                  .map(([status, count]) => (
                    <Link
                      key={status}
                      href={`/admin/orders?status=${status}`}
                      className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-bg-tertiary transition-colors"
                    >
                      <span className="text-text-secondary text-sm font-mono">{status}</span>
                      <span className="text-text-primary text-sm font-bold font-mono">{count}</span>
                    </Link>
                  ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
