'use client'

import { useEffect, useState, useCallback } from 'react'
import { useShop } from '@/contexts/ShopContext'
import { createBrowserClient } from '@/lib/supabase'

interface SubmissionRecord {
  id: string
  record_type: string
  title: string
  description: string | null
  service_date: string
  cost_cents: number | null
  visit_id: string | null
  mileage_at_service: number | null
  technicians: string[] | null
  created_at: string
  items: {
    id: string
    nickname: string | null
    make: string | null
    model: string | null
    year: number | null
  } | null
}

export default function ShopHistoryPage() {
  const { shopId } = useShop()
  const [records, setRecords] = useState<SubmissionRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Filters
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [recordType, setRecordType] = useState('')
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)

  const PAGE_SIZE = 25

  const fetchSubmissions = useCallback(async (pageNum: number) => {
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
      if (dateFrom) params.set('from', dateFrom)
      if (dateTo) params.set('to', dateTo)
      if (recordType) params.set('type', recordType)

      const res = await fetch(`/api/shops/${shopId}/submissions?${params}`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      })

      if (!res.ok) {
        setError('Failed to load submissions')
        setIsLoading(false)
        return
      }

      const body = await res.json()
      setRecords(body.records ?? [])
      setHasMore((body.records ?? []).length === PAGE_SIZE)
    } catch {
      setError('Something went wrong')
    } finally {
      setIsLoading(false)
    }
  }, [shopId, dateFrom, dateTo, recordType])

  useEffect(() => {
    fetchSubmissions(page)
  }, [page, fetchSubmissions])

  function handleFilter(e: React.FormEvent) {
    e.preventDefault()
    setPage(0)
    fetchSubmissions(0)
  }

  function formatDate(d: string | null | undefined): string {
    if (!d) return '—'
    const date = new Date(d + 'T00:00:00')
    if (isNaN(date.getTime())) return '—'
    return date.toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    })
  }

  function formatCents(cents: number): string {
    return '$' + (cents / 100).toFixed(2)
  }

  function itemLabel(rec: SubmissionRecord): string {
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
      <h1 className="text-2xl font-bold text-text-primary mb-6">Service History</h1>

      {/* Filters */}
      <form onSubmit={handleFilter} className="card-static p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label className="block text-xs text-text-tertiary mb-1">From</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="input text-sm" />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-text-tertiary mb-1">To</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="input text-sm" />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-text-tertiary mb-1">Type</label>
            <select value={recordType} onChange={(e) => setRecordType(e.target.value)} className="input text-sm">
              <option value="">All Types</option>
              <option value="service">Service / Routine</option>
              <option value="repair">Repair</option>
              <option value="upgrade">Upgrade</option>
              <option value="inspection">Inspection</option>
              <option value="diagnostic">Diagnostic</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="flex items-end">
            <button type="submit" className="btn-secondary text-sm">Filter</button>
          </div>
        </div>
      </form>

      {error && (
        <div className="bg-error/10 border border-error/30 rounded-xl p-4 mb-4">
          <p className="text-error text-sm">{error}</p>
        </div>
      )}

      {isLoading ? (
        <div className="text-text-tertiary text-sm animate-pulse py-8">Loading submissions...</div>
      ) : records.length === 0 ? (
        <div className="card-static p-8 text-center">
          <p className="text-text-tertiary">No submissions found.</p>
        </div>
      ) : (
        <>
          <div className="card-static divide-y divide-border-subtle">
            {records.map((rec) => {
              const isExpanded = expandedId === rec.id
              return (
                <div key={rec.id}>
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : rec.id)}
                    className="w-full p-4 text-left hover:bg-bg-elevated/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="text-text-primary text-sm font-medium truncate">{rec.title}</p>
                        <p className="text-text-tertiary text-xs mt-0.5">
                          {itemLabel(rec)}
                          {rec.items?.nickname && (
                            <span className="text-text-tertiary"> &middot; {rec.items.nickname}</span>
                          )}
                        </p>
                        {!isExpanded && rec.description && (
                          <p className="text-text-secondary text-xs mt-1 line-clamp-1">{rec.description}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-text-secondary text-sm">{formatDate(rec.service_date)}</p>
                        {rec.cost_cents != null && (
                          <p className="text-text-tertiary text-xs">{formatCents(rec.cost_cents)}</p>
                        )}
                        <span className="inline-block text-xs font-medium bg-bg-elevated text-text-secondary px-2 py-0.5 rounded-full mt-1 capitalize">
                          {rec.record_type}
                        </span>
                      </div>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-3">
                      <div className="border-t border-border-subtle pt-3">
                        {rec.description && (
                          <div className="mb-3">
                            <p className="text-xs font-medium text-text-tertiary mb-1">Description</p>
                            <p className="text-sm text-text-secondary whitespace-pre-wrap">{rec.description}</p>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-xs font-medium text-text-tertiary">Service Date</p>
                            <p className="text-text-primary">{formatDate(rec.service_date)}</p>
                          </div>
                          {rec.cost_cents != null && (
                            <div>
                              <p className="text-xs font-medium text-text-tertiary">Cost</p>
                              <p className="text-text-primary">{formatCents(rec.cost_cents)}</p>
                            </div>
                          )}
                          {rec.mileage_at_service != null && (
                            <div>
                              <p className="text-xs font-medium text-text-tertiary">Mileage / Hours</p>
                              <p className="text-text-primary">{rec.mileage_at_service.toLocaleString()}</p>
                            </div>
                          )}
                          <div>
                            <p className="text-xs font-medium text-text-tertiary">Type</p>
                            <p className="text-text-primary capitalize">{rec.record_type}</p>
                          </div>
                          {rec.technicians && rec.technicians.length > 0 && (
                            <div className="col-span-2">
                              <p className="text-xs font-medium text-text-tertiary">Performed By</p>
                              <p className="text-text-primary">{rec.technicians.join(', ')}</p>
                            </div>
                          )}
                          {rec.visit_id && (
                            <div>
                              <p className="text-xs font-medium text-text-tertiary">Visit ID</p>
                              <p className="text-text-primary font-mono text-xs">{rec.visit_id.slice(0, 8)}</p>
                            </div>
                          )}
                          <div>
                            <p className="text-xs font-medium text-text-tertiary">Submitted</p>
                            <p className="text-text-primary">
                              {rec.created_at ? new Date(rec.created_at).toLocaleDateString('en-US', {
                                month: 'short', day: 'numeric', year: 'numeric',
                              }) : '—'}
                            </p>
                          </div>
                        </div>

                        {rec.items && (
                          <div className="mt-3 pt-3 border-t border-border-subtle">
                            <p className="text-xs font-medium text-text-tertiary mb-1">Item</p>
                            <p className="text-sm text-text-primary">{itemLabel(rec)}</p>
                            {rec.items.nickname && (
                              <p className="text-xs text-text-tertiary">&ldquo;{rec.items.nickname}&rdquo;</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="btn-secondary text-sm disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-text-tertiary text-sm">Page {page + 1}</span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={!hasMore}
              className="btn-secondary text-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  )
}
