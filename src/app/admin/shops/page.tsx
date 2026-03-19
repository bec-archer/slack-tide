'use client'

import { useEffect, useState, useCallback } from 'react'

interface VerificationDoc {
  label: string
  url: string
  storage_path?: string
}

interface PendingShop {
  id: string
  name: string
  address: string
  city: string
  state: string
  phone: string
  website: string | null
  categories_serviced: string[]
  verification_docs: VerificationDoc[] | null
  created_at: string
}

interface VerifiedShop {
  id: string
  name: string
  city: string
  state: string
  verified_method: string
  verified_at: string
}

export default function AdminShopsPage() {
  const [pending, setPending] = useState<PendingShop[]>([])
  const [recentlyVerified, setRecentlyVerified] = useState<VerifiedShop[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/shops/verification')
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to load')
        return
      }
      setPending(data.pending || [])
      setRecentlyVerified(data.recently_verified || [])
    } catch {
      setError('Failed to load verification data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  async function handleAction(shopId: string, action: 'approve' | 'reject') {
    const confirmMsg = action === 'approve'
      ? 'Approve this shop? They\'ll show as verified to all users.'
      : 'Reject this verification request? The shop can request again later.'

    if (!window.confirm(confirmMsg)) return

    setActionLoading(shopId)
    setError(null)

    try {
      const res = await fetch('/api/admin/shops/verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopId, action }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || `Failed to ${action}`)
        return
      }

      // Refresh the list
      await fetchData()
    } catch {
      setError(`Failed to ${action} shop`)
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return <p className="text-text-tertiary text-sm animate-pulse">Loading verification requests...</p>
  }

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-text-primary text-2xl font-bold mb-1">Shop Verification</h2>
        <p className="text-text-tertiary text-sm">Review and approve shop verification requests</p>
      </div>

      {error && (
        <div className="bg-error/10 border border-error/30 rounded-xl p-4 mb-6">
          <p className="text-error text-sm">{error}</p>
        </div>
      )}

      {/* Pending Requests */}
      <div className="mb-10">
        <h3 className="text-text-secondary text-sm font-semibold uppercase tracking-wider mb-4">
          Pending Requests ({pending.length})
        </h3>

        {pending.length === 0 ? (
          <div className="bg-bg-secondary border border-border-subtle rounded-xl p-6 text-center">
            <p className="text-text-tertiary text-sm">No pending verification requests</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pending.map((shop) => (
              <div
                key={shop.id}
                className="bg-bg-secondary border border-border-subtle rounded-xl p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-text-primary font-semibold text-lg">{shop.name}</h4>
                    <p className="text-text-secondary text-sm mt-1">
                      {shop.address}, {shop.city}, {shop.state}
                    </p>
                    <p className="text-text-secondary text-sm mt-1">
                      Phone: {shop.phone}
                      {shop.website && (
                        <span className="ml-3">
                          Web: <a href={shop.website} target="_blank" rel="noopener noreferrer" className="text-accent hover:text-accent-secondary">{shop.website}</a>
                        </span>
                      )}
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {shop.categories_serviced.map((cat) => (
                        <span
                          key={cat}
                          className="text-xs bg-bg-tertiary text-text-tertiary px-2 py-0.5 rounded-full"
                        >
                          {cat}
                        </span>
                      ))}
                    </div>
                    <p className="text-text-tertiary text-xs mt-2">
                      Registered: {new Date(shop.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex gap-2 shrink-0 items-start">
                    <button
                      onClick={() => handleAction(shop.id, 'approve')}
                      disabled={actionLoading === shop.id}
                      className="bg-success/20 hover:bg-success/30 text-success font-medium text-sm px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {actionLoading === shop.id ? '...' : 'Approve'}
                    </button>
                    <button
                      onClick={() => handleAction(shop.id, 'reject')}
                      disabled={actionLoading === shop.id}
                      className="bg-error/20 hover:bg-error/30 text-error font-medium text-sm px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {actionLoading === shop.id ? '...' : 'Reject'}
                    </button>
                  </div>
                </div>

                {/* Verification photos */}
                {shop.verification_docs && shop.verification_docs.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-border-subtle">
                    <p className="text-text-tertiary text-xs font-medium uppercase tracking-wider mb-3">
                      Submitted Documents
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {shop.verification_docs.map((doc, idx) => {
                        const isPdf = doc.storage_path?.endsWith('.pdf') || doc.url?.includes('.pdf')
                        return (
                          <div key={idx}>
                            <a href={doc.url} target="_blank" rel="noopener noreferrer" className="block">
                              {isPdf ? (
                                <div className="w-full h-40 bg-bg-tertiary rounded-lg border border-border-subtle hover:border-accent/50 transition-colors cursor-pointer flex flex-col items-center justify-center gap-2">
                                  <span className="text-4xl">📄</span>
                                  <span className="text-xs text-accent font-medium">View PDF</span>
                                </div>
                              ) : (
                                <img
                                  src={doc.url}
                                  alt={doc.label}
                                  className="w-full h-40 object-cover rounded-lg border border-border-subtle hover:border-accent/50 transition-colors cursor-pointer"
                                />
                              )}
                            </a>
                            <p className="text-text-tertiary text-xs mt-1">{doc.label}</p>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recently Verified */}
      {recentlyVerified.length > 0 && (
        <div>
          <h3 className="text-text-secondary text-sm font-semibold uppercase tracking-wider mb-4">
            Recently Verified
          </h3>
          <div className="bg-bg-secondary border border-border-subtle rounded-xl divide-y divide-border-subtle">
            {recentlyVerified.map((shop) => (
              <div key={shop.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <span className="text-text-primary text-sm font-medium">{shop.name}</span>
                  <span className="text-text-tertiary text-sm ml-2">{shop.city}, {shop.state}</span>
                </div>
                <div className="text-right">
                  <span className="text-success text-xs font-medium">
                    {shop.verified_method === 'google_business' ? 'Google' : 'Manual'}
                  </span>
                  <span className="text-text-tertiary text-xs ml-2">
                    {new Date(shop.verified_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
