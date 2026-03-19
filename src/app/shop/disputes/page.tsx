'use client'

import { useEffect, useState, useCallback } from 'react'
import { useShop } from '@/contexts/ShopContext'
import { createBrowserClient } from '@/lib/supabase'

interface DisputedRecord {
  id: string
  record_type: string
  title: string
  description: string | null
  service_date: string
  cost_cents: number | null
  disputed_at: string | null
  dispute_reason: string | null
  items: {
    id: string
    nickname: string | null
    make: string | null
    model: string | null
    year: number | null
  } | null
}

export default function ShopDisputesPage() {
  const { shopId } = useShop()
  const [records, setRecords] = useState<DisputedRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)

  const PAGE_SIZE = 25

  const fetchDisputes = useCallback(async (pageNum: number) => {
    if (!shopId) return
    setIsLoading(true)
    setError(null)

    try {
      const supabase = createBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const params = new URLSearchParams()
      params.set('limit', String(PAGE_SIZE))
      params.set('offset', String(pageNum * PAGE_SIZE))

      const res = await fetch(`/api/shops/${shopId}/disputes?${params}`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      })

      if (!res.ok) {
        setError('Failed to load disputes')
        setIsLoading(false)
        return
      }

      const body = await res.json()
      setRecords(body.disputes ?? [])
      setHasMore((body.disputes ?? []).length === PAGE_SIZE)
    } catch {
      setError('Something went wrong')
    } finally {
      setIsLoading(false)
    }
  }, [shopId])

  useEffect(() => {
    fetchDisputes(page)
  }, [page, fetchDisputes])

  function formatDate(d: string): string {
    return new Date(d).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    })
  }

  function itemLabel(rec: DisputedRecord): string {
    const item = rec.items
    if (!item) return 'Unknown Item'
    const parts: string[] = []
    if (item.year) parts.push(String(item.year))
    if (item.make) parts.push(item.make)
    if (item.model) parts.push(item.model)
    if (parts.length > 0) return parts.join(' ')
    return item.nickname || 'Unnamed Item'
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-text-primary mb-6">Disputes</h1>

      {error && (
        <div className="bg-error/10 border border-error/30 rounded-xl p-4 mb-4">
          <p className="text-error text-sm">{error}</p>
        </div>
      )}

      {isLoading ? (
        <div className="text-text-tertiary text-sm animate-pulse py-8">Loading disputes...</div>
      ) : records.length === 0 ? (
        <div className="card-static p-8 text-center">
          <p className="text-text-secondary text-lg mb-1">No disputes</p>
          <p className="text-text-tertiary text-sm">None of your shop&apos;s submissions have been disputed.</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {records.map((rec) => (
              <div key={rec.id} className="card-static p-5">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <p className="text-text-primary text-sm font-medium">{rec.title}</p>
                    <p className="text-text-tertiary text-xs mt-0.5">
                      {itemLabel(rec)} — Service date: {formatDate(rec.service_date)}
                    </p>
                  </div>
                  <span className="text-xs font-medium bg-error/15 text-error px-2.5 py-0.5 rounded-full shrink-0 capitalize">
                    {rec.record_type}
                  </span>
                </div>

                {rec.dispute_reason && (
                  <div className="bg-error/5 border border-error/20 rounded-lg p-3">
                    <p className="text-xs font-medium text-error mb-1">Owner&apos;s Reason</p>
                    <p className="text-text-secondary text-sm">{rec.dispute_reason}</p>
                  </div>
                )}

                {rec.disputed_at && (
                  <p className="text-text-tertiary text-xs mt-2">
                    Disputed on {formatDate(rec.disputed_at)}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4">
            <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="btn-secondary text-sm disabled:opacity-50">
              Previous
            </button>
            <span className="text-text-tertiary text-sm">Page {page + 1}</span>
            <button onClick={() => setPage((p) => p + 1)} disabled={!hasMore} className="btn-secondary text-sm disabled:opacity-50">
              Next
            </button>
          </div>
        </>
      )}
    </div>
  )
}
