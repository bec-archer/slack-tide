'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { createBrowserClient } from '@/lib/supabase'
import Link from 'next/link'

interface NotificationItem {
  id: string
  type: string
  title: string
  body: string | null
  related_item_id: string | null
  related_record_id: string | null
  read_at: string | null
  created_at: string
}

export default function NotificationsPage() {
  const { user, isLoading: isAuthLoading } = useAuth()
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchNotifications = useCallback(async () => {
    if (!user) return

    try {
      const supabase = createBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const res = await fetch('/api/notifications?limit=50', {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      })

      if (res.ok) {
        const body = await res.json()
        setNotifications(body.notifications ?? [])
      }
    } catch {
      // Silent
    } finally {
      setIsLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (!isAuthLoading) fetchNotifications()
  }, [isAuthLoading, fetchNotifications])

  async function markAsRead(notificationId: string) {
    try {
      const supabase = createBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      await fetch(`/api/notifications/${notificationId}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      })

      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, read_at: new Date().toISOString() } : n
        )
      )
    } catch {
      // Silent
    }
  }

  function formatDate(dateStr: string): string {
    const d = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    const diffHrs = Math.floor(diffMins / 60)
    if (diffHrs < 24) return `${diffHrs}h ago`
    const diffDays = Math.floor(diffHrs / 24)
    if (diffDays < 7) return `${diffDays}d ago`

    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  if (isAuthLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-text-tertiary text-sm animate-pulse">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <div className="card-static p-8 text-center max-w-md">
          <h1 className="text-xl font-bold text-text-primary mb-2">Sign In Required</h1>
          <p className="text-text-secondary mb-6">Sign in to view your notifications.</p>
          <Link href="/auth?redirect=/notifications" className="btn-primary">Sign In</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-text-primary mb-6">Notifications</h1>

      {isLoading ? (
        <div className="text-text-tertiary text-sm animate-pulse py-8">Loading notifications...</div>
      ) : notifications.length === 0 ? (
        <div className="card-static p-8 text-center">
          <p className="text-text-secondary">No notifications yet.</p>
          <p className="text-text-tertiary text-sm mt-1">
            You&apos;ll see notifications here when shops submit service records for your items.
          </p>
        </div>
      ) : (
        <div className="card-static divide-y divide-border-subtle">
          {notifications.map((notif) => (
            <div
              key={notif.id}
              className={`p-4 transition-colors ${!notif.read_at ? 'bg-accent/5' : ''}`}
            >
              <div className="flex items-start gap-3">
                {!notif.read_at && (
                  <span className="w-2 h-2 bg-accent rounded-full mt-2 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm text-text-primary font-medium">{notif.title}</p>
                      {notif.body && (
                        <p className="text-sm text-text-secondary mt-0.5">{notif.body}</p>
                      )}
                      <p className="text-xs text-text-tertiary mt-1">{formatDate(notif.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {!notif.read_at && (
                        <button
                          onClick={() => markAsRead(notif.id)}
                          className="text-xs text-text-tertiary hover:text-text-secondary transition-colors"
                        >
                          Mark read
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
