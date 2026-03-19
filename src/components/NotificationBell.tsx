'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { createBrowserClient } from '@/lib/supabase'
import Link from 'next/link'

interface NotificationItem {
  id: string
  type: string
  title: string
  body: string | null
  related_item_id: string | null
  read_at: string | null
  created_at: string
}

export default function NotificationBell() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const fetchNotifications = useCallback(async () => {
    if (!user) return

    try {
      const supabase = createBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const res = await fetch('/api/notifications?limit=10', {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      })

      if (res.ok) {
        const body = await res.json()
        setNotifications(body.notifications ?? [])
        setUnreadCount(body.unread_count ?? 0)
      }
    } catch {
      // Silent fail — notification fetch is non-critical
    }
  }, [user])

  // Fetch on mount and every 30 seconds
  useEffect(() => {
    if (!user) return
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [user, fetchNotifications])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

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
      setUnreadCount((prev) => Math.max(0, prev - 1))
    } catch {
      // Silent fail
    }
  }

  function formatTimeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    return `${days}d ago`
  }

  if (!user) return null

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => { setIsOpen(!isOpen); if (!isOpen) fetchNotifications() }}
        className="relative text-text-secondary hover:text-text-primary transition-colors p-1"
        aria-label="Notifications"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-error text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-bg-elevated border border-border-subtle rounded-xl shadow-lg overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-border-subtle flex items-center justify-between">
            <p className="text-sm font-semibold text-text-primary">Notifications</p>
            {unreadCount > 0 && (
              <span className="text-xs text-text-tertiary">{unreadCount} unread</span>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-6 text-center text-text-tertiary text-sm">
                No notifications yet
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`px-4 py-3 border-b border-border-subtle/50 hover:bg-bg-tertiary/50 transition-colors cursor-pointer ${
                    !notif.read_at ? 'bg-accent/5' : ''
                  }`}
                  onClick={() => {
                    if (!notif.read_at) markAsRead(notif.id)
                    if (notif.related_item_id) {
                      setIsOpen(false)
                    }
                  }}
                >
                  <div className="flex items-start gap-2">
                    {!notif.read_at && (
                      <span className="w-2 h-2 bg-accent rounded-full mt-1.5 flex-shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-text-primary font-medium truncate">{notif.title}</p>
                      {notif.body && (
                        <p className="text-xs text-text-secondary line-clamp-2 mt-0.5">{notif.body}</p>
                      )}
                      <p className="text-xs text-text-tertiary mt-1">{formatTimeAgo(notif.created_at)}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {notifications.length > 0 && (
            <div className="px-4 py-2 border-t border-border-subtle">
              <Link
                href="/notifications"
                onClick={() => setIsOpen(false)}
                className="text-xs text-accent hover:text-accent-secondary transition-colors"
              >
                View all notifications
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
