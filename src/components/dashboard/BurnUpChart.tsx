'use client'

import { useMemo } from 'react'
import { LineChart, Line, XAxis, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts'
import type { ScopeLogEntry } from '@/lib/dashboard-types'

interface BurnUpChartProps {
  scopeLog: ScopeLogEntry[]
  accentColor: string
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return '—'
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export default function BurnUpChart({ scopeLog, accentColor }: BurnUpChartProps) {
  const data = useMemo(() => {
    if (!scopeLog.length) return []

    // Filter out entries with invalid dates, then sort oldest first
    const valid = scopeLog.filter((e) => e.created_at && !isNaN(new Date(e.created_at).getTime()))
    const sorted = [...valid].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )

    // Group by day
    const dayMap = new Map<string, { scope: number; progress: number }>()

    let cumulativeScope = 0
    let cumulativeProgress = 0

    for (const entry of sorted) {
      const day = new Date(entry.created_at).toISOString().slice(0, 10)

      if (entry.action === 'feature_added') {
        cumulativeScope++
      }
      if (
        entry.action === 'feature_status_changed' &&
        (entry.new_value === 'done' || entry.new_value === 'shipped')
      ) {
        cumulativeProgress++
      }

      dayMap.set(day, { scope: cumulativeScope, progress: cumulativeProgress })
    }

    return Array.from(dayMap.entries()).map(([day, vals]) => ({
      date: formatDate(day),
      scope: vals.scope,
      progress: vals.progress,
    }))
  }, [scopeLog])

  // Check if there's enough data for a meaningful chart
  const uniqueDays = new Set(data.map((d) => d.date)).size

  return (
    <section className="mb-6">
      <h2 className="text-sm font-semibold text-text-tertiary uppercase tracking-wider mb-3">
        Burn-Up
      </h2>
      <div className="bg-bg-secondary border border-border-subtle rounded-xl p-4">
        {uniqueDays < 2 ? (
          <div className="h-[140px] flex items-center justify-center">
            <p className="text-text-tertiary text-sm" style={{ fontFamily: 'var(--font-mono)' }}>
              Not enough data yet — come back after a few days of activity
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
              <defs>
                <linearGradient id="progressGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={accentColor} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={accentColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tick={{ fill: 'var(--text-tertiary)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-default)',
                  borderRadius: '8px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  color: 'var(--text-primary)',
                }}
                itemStyle={{ color: 'var(--text-secondary)' }}
                labelStyle={{ color: 'var(--text-tertiary)', marginBottom: '4px' }}
              />
              <Line
                type="monotone"
                dataKey="scope"
                stroke="var(--text-tertiary)"
                strokeWidth={1.5}
                strokeDasharray="4 3"
                dot={false}
                name="Scope"
                animationDuration={1200}
              />
              <Area
                type="monotone"
                dataKey="progress"
                stroke={accentColor}
                strokeWidth={2}
                fill="url(#progressGradient)"
                dot={false}
                name="Completed"
                animationDuration={1200}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  )
}
