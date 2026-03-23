'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

interface OrderItem {
  id: string
  state_template: string
  short_code: string | null
  qr_url: string | null
  status: string
  qr_size: number
  color_bg: string
  color_fill: string | null
  color_stroke: string | null
}

interface Order {
  id: string
  status: string
  amount_cents: number
  payment_method: string | null
  shipping_name: string | null
  shipping_city: string | null
  shipping_state: string | null
  created_at: string
  paid_at: string | null
  shipped_at: string | null
  completed_at: string | null
  order_items: OrderItem[]
}

const STATUS_COLORS: Record<string, string> = {
  pending_payment: '#64748b',
  paid: '#f59e0b',
  generating: '#60a5fa',
  generated: '#818cf8',
  printing: '#a78bfa',
  shipped: '#c084fc',
  completed: '#4ade80',
  failed: '#f87171',
  cancelled: '#6b7280',
  refunded: '#fb923c',
}

const STATUS_LABELS: Record<string, string> = {
  pending_payment: 'Awaiting Payment',
  paid: 'Order Received',
  generating: 'Generating',
  generated: 'Ready to Print',
  printing: 'Printing',
  shipped: 'Shipped',
  completed: 'Delivered',
  failed: 'Failed',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
}

function LoadingBullseye() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-primary">
      <div className="text-accent animate-pulse-bullseye">
        <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
          <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="1.5" opacity="0.6"/>
          <circle cx="12" cy="12" r="2" fill="currentColor"/>
        </svg>
      </div>
    </div>
  )
}

function formatDate(d: string | null | undefined) {
  if (!d) return '—'
  const date = new Date(d)
  if (isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

export default function MyOrdersPage() {
  const router = useRouter()
  const { user, isLoading: authLoading } = useAuth()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return

    if (!user) {
      router.push('/auth?redirect=/my-orders')
      return
    }

    async function fetchOrders() {
      try {
        const res = await fetch('/api/orders')
        const data = await res.json()
        if (data.orders) {
          setOrders(data.orders)
        }
      } catch (err) {
        console.error('Failed to fetch orders:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchOrders()
  }, [user, authLoading, router])

  if (authLoading || loading) {
    return <LoadingBullseye />
  }

  return (
    <div className="min-h-screen bg-bg-primary p-4">
      <div className="max-w-2xl mx-auto pt-4 animate-fade-in">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-text-primary">My Orders</h1>
          <span className="badge badge-accent">
            {orders.length} {orders.length === 1 ? 'order' : 'orders'}
          </span>
        </div>

        {orders.length === 0 ? (
          <div className="card-static p-10 text-center">
            <div className="w-20 h-20 rounded-full bg-accent-muted flex items-center justify-center mx-auto mb-5">
              <svg className="w-10 h-10 text-accent" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-text-primary mb-2">No orders yet</h2>
            <p className="text-text-secondary mb-6">
              Design your first custom sticker and place an order.
            </p>
            <button
              onClick={() => router.push('/customize')}
              className="btn-primary !py-3 !px-6 !text-sm"
            >
              Design a Sticker
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => {
              const statusColor = STATUS_COLORS[order.status] || '#64748b'
              const statusLabel = STATUS_LABELS[order.status] || order.status

              return (
                <div
                  key={order.id}
                  className="bg-bg-secondary border border-border-subtle rounded-2xl p-4 transition-all"
                >
                  {/* Order Header */}
                  <div className="flex items-center justify-between mb-3">
                    <span
                      className="inline-block px-2.5 py-1 rounded-full text-xs font-bold"
                      style={{
                        backgroundColor: `${statusColor}20`,
                        color: statusColor,
                        border: `1px solid ${statusColor}40`,
                      }}
                    >
                      {statusLabel}
                    </span>
                    <span className="text-text-tertiary text-xs">
                      {formatDate(order.created_at)}
                    </span>
                  </div>

                  {/* Order Items */}
                  {order.order_items?.map((item) => (
                    <div key={item.id} className="flex items-center gap-4">
                      {/* Mini color preview */}
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center text-lg flex-shrink-0 border border-border-subtle"
                        style={{ backgroundColor: item.color_bg || '#ffffff' }}
                      >
                        <span
                          style={{ color: item.color_fill || item.color_stroke || '#000' }}
                          className="text-xl"
                        >
                          ◆
                        </span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <h2 className="text-text-primary font-semibold capitalize">
                          {item.state_template} Sticker
                        </h2>
                        <div className="flex items-center gap-3 mt-0.5">
                          {item.short_code && (
                            <span className="text-xs font-mono font-bold" style={{ color: '#f59e0b' }}>
                              {item.short_code}
                            </span>
                          )}
                          {item.qr_url && (
                            <span className="text-text-tertiary text-xs font-mono truncate">
                              {item.qr_url}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Shipping / Timeline */}
                  <div className="mt-3 pt-3 border-t border-border-subtle flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-tertiary">
                    {order.shipping_city && order.shipping_state && (
                      <span>Ship to: {order.shipping_city}, {order.shipping_state}</span>
                    )}
                    {order.shipped_at && (
                      <span>Shipped: {formatDate(order.shipped_at)}</span>
                    )}
                    {order.completed_at && (
                      <span className="text-success">Delivered: {formatDate(order.completed_at)}</span>
                    )}
                    <span className="font-mono">
                      {order.amount_cents === 0 ? 'Free' : `$${(order.amount_cents / 100).toFixed(2)}`}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
