'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import type { Feature } from '@/lib/dashboard-types'

function useCountUp(target: number, duration = 800) {
  const [value, setValue] = useState(0)
  const startTime = useRef<number | null>(null)

  useEffect(() => {
    if (target === 0) { setValue(0); return }
    startTime.current = null
    const scaledDuration = duration + Math.min(target * 10, 400)

    function tick(ts: number) {
      if (!startTime.current) startTime.current = ts
      const elapsed = ts - startTime.current
      const progress = Math.min(elapsed / scaledDuration, 1)
      // easeOutCubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(eased * target))
      if (progress < 1) requestAnimationFrame(tick)
    }

    const raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])

  return value
}

function useLiveUptime(createdAt: string | null | undefined) {
  const compute = useCallback(() => {
    if (!createdAt) return '—'
    const ms = Date.now() - new Date(createdAt).getTime()
    if (isNaN(ms) || ms < 0) return '—'
    const totalHours = Math.floor(ms / 3600000)
    const days = Math.floor(totalHours / 24)
    const hours = totalHours % 24
    return `${days}d ${hours}h`
  }, [createdAt])

  const [display, setDisplay] = useState(compute)

  useEffect(() => {
    const interval = setInterval(() => setDisplay(compute()), 60_000)
    return () => clearInterval(interval)
  }, [compute])

  return display
}

interface StatsRowProps {
  features: Feature[]
  createdAt: string | null | undefined
  accentColor?: string
  pulseKey?: number
  apiLatency?: number | null
}

export default function StatsRow({ features, createdAt, accentColor, pulseKey, apiLatency }: StatsRowProps) {
  const active = features.filter((f) => f.status !== 'cut')
  const completed = active.filter((f) => f.status === 'done' || f.status === 'shipped').length
  const inProgress = features.filter((f) => f.status === 'in_progress').length
  const scopeCreep = features.filter((f) => f.is_scope_creep).length
  const uptime = useLiveUptime(createdAt)

  const color = accentColor || 'var(--accent-primary)'

  const totalAnimated = useCountUp(active.length)
  const completedAnimated = useCountUp(completed)
  const inProgressAnimated = useCountUp(inProgress)
  const scopeCreepAnimated = useCountUp(scopeCreep)

  // Pulse effect on realtime changes
  const [pulsing, setPulsing] = useState(false)
  const prevPulseKey = useRef(pulseKey)
  useEffect(() => {
    if (pulseKey !== undefined && pulseKey !== prevPulseKey.current) {
      prevPulseKey.current = pulseKey
      setPulsing(true)
      const t = setTimeout(() => setPulsing(false), 600)
      return () => clearTimeout(t)
    }
  }, [pulseKey])

  const latencyColor = apiLatency == null
    ? 'var(--text-tertiary)'
    : apiLatency < 100
      ? 'var(--success)'
      : apiLatency < 500
        ? 'var(--warning)'
        : 'var(--error)'

  const stats: { label: string; value: string | number; icon: string; isString?: boolean; valueColor?: string }[] = [
    { label: 'Total Features', value: totalAnimated, icon: '📦' },
    { label: 'Completed', value: completedAnimated, icon: '✅' },
    { label: 'In Progress', value: inProgressAnimated, icon: '🔧' },
    { label: 'Scope Creep', value: scopeCreepAnimated, icon: '🔀' },
    { label: 'Days Active', value: uptime, icon: '📅', isString: true },
    { label: 'Supabase', value: apiLatency != null ? `${apiLatency}ms` : '—', icon: '🗄️', isString: true, valueColor: latencyColor },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="bg-bg-secondary border border-border-subtle rounded-xl p-4 text-center relative overflow-hidden group hover:border-border-default transition-all duration-150"
          style={{
            background: pulsing
              ? `radial-gradient(ellipse at center, var(--accent-muted) 0%, var(--bg-secondary) 70%)`
              : undefined,
          }}
        >
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: `radial-gradient(ellipse at center, ${color}08 0%, transparent 70%)` }} />
          <div className="relative">
            <div
              className="text-3xl font-bold transition-colors duration-300"
              style={{
                fontFamily: 'var(--font-mono)',
                color: stat.valueColor || 'var(--text-primary)',
              }}
            >
              {stat.value}
            </div>
            <div className="text-xs text-text-tertiary mt-1.5 flex items-center justify-center gap-1">
              <span>{stat.icon}</span>
              <span>{stat.label}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
