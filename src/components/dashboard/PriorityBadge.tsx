'use client'

import type { FeaturePriority } from '@/lib/dashboard-types'

const PRIORITY_CONFIG: Record<FeaturePriority, { color: string; label: string }> = {
  low: { color: 'var(--text-tertiary)', label: 'Low' },
  medium: { color: 'var(--warning)', label: 'Med' },
  high: { color: '#f97316', label: 'High' },
  critical: { color: 'var(--error)', label: 'Crit' },
}

export default function PriorityBadge({ priority }: { priority: FeaturePriority }) {
  const config = PRIORITY_CONFIG[priority]
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-mono">
      <span
        className="w-2 h-2 rounded-full inline-block"
        style={{ background: config.color }}
      />
      <span style={{ color: config.color }}>{config.label}</span>
    </span>
  )
}
