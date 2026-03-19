'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import type { Order, OrderItem, OrderStatus } from '@/lib/types'

interface OrderWithItems extends Order {
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

const STATUS_FLOW: OrderStatus[] = [
  'paid',
  'printing',
  'shipped',
  'completed',
]

const ALL_STATUSES: OrderStatus[] = [
  'pending_payment',
  'paid',
  'generating',
  'generated',
  'printing',
  'shipped',
  'completed',
  'failed',
  'cancelled',
  'refunded',
]

export default function AdminOrdersPage() {
  const searchParams = useSearchParams()
  const initialStatus = searchParams.get('status') || ''

  const [orders, setOrders] = useState<OrderWithItems[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState(initialStatus)
  const [total, setTotal] = useState(0)
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null)
  const [updatingOrder, setUpdatingOrder] = useState<string | null>(null)

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      params.set('limit', '50')
      const res = await fetch(`/api/admin/orders?${params}`)
      const data = await res.json()
      if (data.orders) {
        setOrders(data.orders)
        setTotal(data.total || data.orders.length)
      }
    } catch (err) {
      console.error('Failed to fetch orders:', err)
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  const updateOrderStatus = async (orderId: string, newStatus: OrderStatus) => {
    setUpdatingOrder(orderId)
    try {
      const res = await fetch('/api/admin/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId, status: newStatus }),
      })
      if (res.ok) {
        await fetchOrders() // Refresh
      } else {
        const data = await res.json()
        alert(`Failed to update: ${data.error}`)
      }
    } catch (err) {
      console.error('Update failed:', err)
      alert('Network error updating order')
    } finally {
      setUpdatingOrder(null)
    }
  }

  const downloadSvg = (item: OrderItem) => {
    if (!item.design_svg) return
    const blob = new Blob([item.design_svg], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sticker_${item.short_code || item.id.slice(0, 8)}_${item.state_template}.svg`
    a.click()
    URL.revokeObjectURL(url)
  }

  const getNextStatus = (current: OrderStatus): OrderStatus | null => {
    const idx = STATUS_FLOW.indexOf(current)
    if (idx === -1 || idx >= STATUS_FLOW.length - 1) return null
    return STATUS_FLOW[idx + 1]
  }

  const formatDate = (d: string | null) => {
    if (!d) return '—'
    return new Date(d).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    })
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-text-primary text-2xl font-bold mb-1">Print Queue</h2>
          <p className="text-text-tertiary text-sm">
            {total} order{total !== 1 ? 's' : ''} {statusFilter && `· filtered: ${statusFilter}`}
          </p>
        </div>
        <button
          onClick={() => fetchOrders()}
          className="text-text-tertiary hover:text-accent text-sm font-medium transition-colors px-3 py-1.5 rounded-lg hover:bg-bg-tertiary"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setStatusFilter('')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            !statusFilter ? 'bg-accent text-bg-primary' : 'bg-bg-elevated text-text-tertiary hover:text-text-secondary'
          }`}
        >
          All
        </button>
        {ALL_STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s === statusFilter ? '' : s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold font-mono transition-colors ${
              statusFilter === s ? 'text-bg-primary' : 'bg-bg-elevated text-text-tertiary hover:text-text-secondary'
            }`}
            style={statusFilter === s ? { backgroundColor: STATUS_COLORS[s] } : {}}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Orders List */}
      {loading ? (
        <p className="text-text-tertiary text-sm animate-pulse py-12 text-center">Loading orders...</p>
      ) : orders.length === 0 ? (
        <div className="bg-bg-secondary border border-border-subtle rounded-xl p-12 text-center">
          <p className="text-text-tertiary text-sm">No orders found{statusFilter ? ` with status "${statusFilter}"` : ''}.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const isExpanded = expandedOrder === order.id
            const nextStatus = getNextStatus(order.status)
            const isUpdating = updatingOrder === order.id

            return (
              <div
                key={order.id}
                className="bg-bg-secondary border border-border-subtle rounded-xl overflow-hidden transition-colors hover:border-border-default"
              >
                {/* Order Row (Collapsed) */}
                <button
                  onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                  className="w-full text-left px-5 py-4 flex items-center gap-4"
                >
                  {/* Status Badge */}
                  <span
                    className="inline-block px-2.5 py-1 rounded-full text-xs font-bold font-mono whitespace-nowrap"
                    style={{
                      backgroundColor: `${STATUS_COLORS[order.status]}20`,
                      color: STATUS_COLORS[order.status],
                      border: `1px solid ${STATUS_COLORS[order.status]}40`,
                    }}
                  >
                    {order.status}
                  </span>

                  {/* Order Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <span className="text-text-primary text-sm font-semibold font-mono truncate">
                        {order.id.slice(0, 8)}
                      </span>
                      {order.shipping_name && (
                        <span className="text-text-secondary text-sm truncate">
                          {order.shipping_name}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-text-tertiary text-xs">
                        {formatDate(order.created_at)}
                      </span>
                      <span className="text-text-tertiary text-xs font-mono">
                        {order.payment_method}
                      </span>
                      {order.order_items?.length > 0 && (
                        <span className="text-text-tertiary text-xs">
                          {order.order_items.length} item{order.order_items.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Expand Indicator */}
                  <span className="text-text-tertiary text-lg transition-transform" style={{
                    transform: isExpanded ? 'rotate(90deg)' : 'none',
                  }}>
                    ›
                  </span>
                </button>

                {/* Expanded Detail */}
                {isExpanded && (
                  <div className="border-t border-border-subtle px-5 py-5">
                    {/* Order Metadata */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
                      <div>
                        <p className="text-text-tertiary text-xs mb-1">Order ID</p>
                        <p className="text-text-primary text-xs font-mono break-all">{order.id}</p>
                      </div>
                      <div>
                        <p className="text-text-tertiary text-xs mb-1">Payment</p>
                        <p className="text-text-primary text-xs font-mono">
                          {order.payment_method}{order.payment_ref ? ` · ${order.payment_ref}` : ''}
                        </p>
                      </div>
                      <div>
                        <p className="text-text-tertiary text-xs mb-1">Amount</p>
                        <p className="text-text-primary text-xs font-mono">
                          ${(order.amount_cents / 100).toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-text-tertiary text-xs mb-1">Created</p>
                        <p className="text-text-primary text-xs">{formatDate(order.created_at)}</p>
                      </div>
                    </div>

                    {/* Shipping */}
                    {order.shipping_name && (
                      <div className="bg-bg-tertiary rounded-lg p-3 mb-5">
                        <p className="text-text-tertiary text-xs mb-1 font-semibold uppercase tracking-wider">Ship To</p>
                        <p className="text-text-primary text-sm">{order.shipping_name}</p>
                        <p className="text-text-secondary text-sm">
                          {order.shipping_address}
                          {order.shipping_city && `, ${order.shipping_city}`}
                          {order.shipping_state && `, ${order.shipping_state}`}
                          {order.shipping_zip && ` ${order.shipping_zip}`}
                        </p>
                      </div>
                    )}

                    {/* Timestamps */}
                    <div className="flex flex-wrap gap-4 mb-5 text-xs">
                      {[
                        { label: 'Paid', value: order.paid_at },
                        { label: 'Generated', value: order.generated_at },
                        { label: 'Printed', value: order.printed_at },
                        { label: 'Shipped', value: order.shipped_at },
                        { label: 'Completed', value: order.completed_at },
                      ].map(({ label, value }) => (
                        <span key={label} className={value ? 'text-text-secondary' : 'text-text-tertiary opacity-40'}>
                          {label}: {value ? formatDate(value) : '—'}
                        </span>
                      ))}
                    </div>

                    {/* Order Items */}
                    <div className="space-y-4">
                      {order.order_items?.map((item) => (
                        <div
                          key={item.id}
                          className="bg-bg-tertiary rounded-xl p-4"
                        >
                          <div className="flex items-start gap-4">
                            {/* SVG Preview */}
                            {item.design_svg ? (
                              <div
                                className="w-24 h-24 rounded-lg overflow-hidden bg-white flex-shrink-0 border border-border-subtle"
                                dangerouslySetInnerHTML={{ __html: item.design_svg }}
                                style={{
                                  // Force the SVG to fit the preview box
                                }}
                              />
                            ) : (
                              <div className="w-24 h-24 rounded-lg bg-bg-elevated flex items-center justify-center flex-shrink-0">
                                <span className="text-text-tertiary text-xs">No SVG</span>
                              </div>
                            )}

                            {/* Item Details */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-text-primary text-sm font-semibold capitalize">
                                  {item.state_template}
                                </span>
                                {item.short_code && (
                                  <span className="text-warning text-xs font-bold font-mono bg-bg-elevated px-2 py-0.5 rounded">
                                    {item.short_code}
                                  </span>
                                )}
                              </div>

                              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mb-3">
                                <span className="text-text-tertiary">QR URL: <span className="text-accent font-mono">{item.qr_url || '—'}</span></span>
                                <span className="text-text-tertiary">QR Size: <span className="text-text-secondary font-mono">{item.qr_size}</span></span>
                                <span className="text-text-tertiary">Colors:
                                  <span className="inline-flex gap-1 ml-1 align-middle">
                                    {[item.color_bg, item.color_fill, item.color_stroke, item.color_qr, item.color_halo].filter(Boolean).map((c, i) => (
                                      <span
                                        key={i}
                                        className="inline-block w-3 h-3 rounded-sm border border-border-subtle"
                                        style={{ backgroundColor: c || undefined }}
                                        title={c || ''}
                                      />
                                    ))}
                                  </span>
                                </span>
                                <span className="text-text-tertiary">Fill/Stroke: <span className="text-text-secondary">{item.has_fill ? 'Fill' : '—'}{item.has_stroke ? ' + Stroke' : ''}</span></span>
                              </div>

                              {/* Download Button */}
                              <div className="flex gap-2">
                                {item.design_svg && (
                                  <button
                                    onClick={() => downloadSvg(item)}
                                    className="px-3 py-1.5 bg-accent text-bg-primary rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity"
                                  >
                                    ↓ Download SVG
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Status Actions */}
                    <div className="mt-5 pt-4 border-t border-border-subtle flex items-center gap-3">
                      {nextStatus && (
                        <button
                          onClick={() => updateOrderStatus(order.id, nextStatus)}
                          disabled={isUpdating}
                          className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                          style={{
                            backgroundColor: isUpdating ? '#374151' : STATUS_COLORS[nextStatus],
                            color: isUpdating ? '#9ca3af' : '#0a0f14',
                            cursor: isUpdating ? 'not-allowed' : 'pointer',
                          }}
                        >
                          {isUpdating ? 'Updating...' : `Mark as ${nextStatus}`}
                        </button>
                      )}

                      {/* Manual status select for edge cases */}
                      <select
                        value=""
                        onChange={(e) => {
                          if (e.target.value) {
                            updateOrderStatus(order.id, e.target.value as OrderStatus)
                          }
                        }}
                        disabled={isUpdating}
                        className="bg-bg-elevated text-text-secondary text-xs rounded-lg px-3 py-2 border border-border-subtle font-mono"
                      >
                        <option value="">Set status...</option>
                        {ALL_STATUSES.filter(s => s !== order.status).map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>

                      {order.status === 'completed' && (
                        <span className="text-success text-xs font-semibold ml-auto">✓ Order Complete</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
