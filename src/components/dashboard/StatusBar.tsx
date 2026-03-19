'use client'

import { useEffect, useState } from 'react'
import type { Feature, FeatureStatus } from '@/lib/dashboard-types'

const STATUS_CONFIG: Record<FeatureStatus, { color: string; label: string }> = {
  planned: { color: 'var(--text-tertiary)', label: 'Planned' },
  in_progress: { color: 'var(--info)', label: 'In Progress' },
  done: { color: 'var(--success)', label: 'Done' },
  shipped: { color: 'var(--accent-primary)', label: 'Shipped' },
  cut: { color: 'var(--error)', label: 'Cut' },
}

const STATUS_ORDER: FeatureStatus[] = ['planned', 'in_progress', 'done', 'shipped', 'cut']

interface StatusBarProps {
  features: Feature[]
}

export default function StatusBar({ features }: StatusBarProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => setMounted(true))
    })
    return () => cancelAnimationFrame(raf)
  }, [])

  const total = features.length
  if (total === 0) return null

  const counts = STATUS_ORDER.map((status) => ({
    status,
    count: features.filter((f) => f.status === status).length,
    ...STATUS_CONFIG[status],
  })).filter((s) => s.count > 0)

  return (
    <div className="mb-6">
      {/* Bar */}
      <div className="w-full h-3 rounded-md overflow-hidden flex bg-bg-tertiary">
        {counts.map((seg, i) => (
          <div
            key={seg.status}
            style={{
              width: mounted ? `${(seg.count / total) * 100}%` : '0%',
              backgroundColor: seg.color,
              transition: `width 0.8s ease-out ${i * 80}ms`,
            }}
          />
        ))}
      </div>
      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
        {counts.map((seg) => (
          <div key={seg.status} className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full inline-block"
              style={{ backgroundColor: seg.color }}
            />
            <span className="text-xs text-text-tertiary" style={{ fontFamily: 'var(--font-mono)' }}>
              {seg.label} {seg.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
