'use client'

import type { ScopeLogEntry, ScopeLogAction } from '@/lib/dashboard-types'

const ACTION_ICONS: Record<ScopeLogAction, string> = {
  feature_added: '➕',
  feature_cut: '✂️',
  feature_status_changed: '🔄',
  milestone_added: '🏁',
  milestone_completed: '✅',
  project_created: '🚀',
}

const ACTION_COLORS: Record<ScopeLogAction, string> = {
  feature_added: 'var(--accent-primary)',
  feature_cut: 'var(--status-error)',
  feature_status_changed: 'var(--status-info)',
  milestone_added: 'var(--status-info)',
  milestone_completed: 'var(--status-success)',
  project_created: 'var(--accent-primary)',
}

function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const ms = Date.now() - new Date(dateStr).getTime()
  if (isNaN(ms) || ms < 0) return '—'
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

interface ScopeLogTimelineProps {
  entries: ScopeLogEntry[]
}

export default function ScopeLogTimeline({ entries }: ScopeLogTimelineProps) {
  if (entries.length === 0) {
    return (
      <div className="text-text-tertiary text-sm text-center py-8">
        No scope changes yet.
      </div>
    )
  }

  return (
    <div className="space-y-0 relative">
      {/* Vertical line */}
      <div
        className="absolute left-[88px] top-3 bottom-3 w-px"
        style={{ background: 'var(--border-subtle)' }}
      />
      {entries.map((entry, i) => (
        <div
          key={entry.id}
          className="flex items-start gap-3 py-2.5 px-3 rounded-lg hover:bg-bg-tertiary/30 transition-colors relative"
          style={{
            animationDelay: `${i * 30}ms`,
          }}
        >
          <span
            className="text-xs text-text-tertiary w-16 shrink-0 pt-0.5 text-right tabular-nums"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            {timeAgo(entry.created_at)}
          </span>
          <span
            className="text-sm w-6 text-center shrink-0 relative z-10 rounded-full"
            style={{ background: 'var(--bg-primary)' }}
          >
            {ACTION_ICONS[entry.action] || '•'}
          </span>
          <span
            className="text-sm flex-1"
            style={{ color: ACTION_COLORS[entry.action] || 'var(--text-secondary)' }}
          >
            {entry.description || entry.action.replace(/_/g, ' ')}
          </span>
        </div>
      ))}
    </div>
  )
}
