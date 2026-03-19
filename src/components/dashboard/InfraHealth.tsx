'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { AreaChart, Area, ResponsiveContainer, YAxis } from 'recharts'

interface ServiceStatus {
  name: string
  status: 'ok' | 'degraded' | 'down' | 'unknown'
  latency: number
  lastChecked: string
}

const POLL_INTERVAL = 10_000
const MAX_HISTORY = 20
const MAX_LATENCY_SCALE = 1000

const STATUS_COLORS: Record<string, string> = {
  ok: 'var(--success)',
  degraded: 'var(--warning)',
  down: 'var(--error)',
  unknown: 'var(--text-tertiary)',
}

function LatencyBar({ latency, status }: { latency: number; status: string }) {
  const pct = Math.min((latency / MAX_LATENCY_SCALE) * 100, 100)
  return (
    <div className="w-16 h-1.5 rounded-full bg-bg-tertiary overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{
          width: `${pct}%`,
          backgroundColor: STATUS_COLORS[status] || STATUS_COLORS.unknown,
        }}
      />
    </div>
  )
}

interface InfraHealthProps {
  accentColor?: string
  onLatencyUpdate?: (latency: number | null) => void
}

export default function InfraHealth({ accentColor = 'var(--accent-primary)', onLatencyUpdate }: InfraHealthProps) {
  const [services, setServices] = useState<ServiceStatus[]>([])
  const [history, setHistory] = useState<{ time: number; latency: number }[]>([])
  const [secondsAgo, setSecondsAgo] = useState(0)
  const lastCheckedRef = useRef(Date.now())

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/health-check')
      const data = await res.json()
      const svcs: ServiceStatus[] = data.services || []
      setServices(svcs)
      lastCheckedRef.current = Date.now()
      setSecondsAgo(0)

      // Track Supabase latency for sparkline
      const supabase = svcs.find((s) => s.name === 'Supabase')
      if (supabase) {
        setHistory((prev) => {
          const next = [...prev, { time: Date.now(), latency: supabase.latency }]
          return next.slice(-MAX_HISTORY)
        })
        onLatencyUpdate?.(supabase.latency)
      }
    } catch {
      setServices((prev) =>
        prev.length > 0
          ? prev.map((s) => ({ ...s, status: 'unknown' as const }))
          : [
              { name: 'Supabase', status: 'unknown', latency: 0, lastChecked: '' },
              { name: 'Production', status: 'unknown', latency: 0, lastChecked: '' },
              { name: 'API Server', status: 'unknown', latency: 0, lastChecked: '' },
            ]
      )
      onLatencyUpdate?.(null)
    }
  }, [onLatencyUpdate])

  // Initial fetch + polling
  useEffect(() => {
    fetchHealth()
    const interval = setInterval(fetchHealth, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [fetchHealth])

  // Seconds-ago ticker
  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - lastCheckedRef.current) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // Determine sparkline color based on latest status
  const supabaseStatus = services.find((s) => s.name === 'Supabase')?.status || 'unknown'
  const sparkColor = supabaseStatus === 'ok' ? accentColor : supabaseStatus === 'degraded' ? 'var(--warning)' : 'var(--error)'

  return (
    <div className="bg-bg-elevated border border-border-subtle rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border-subtle flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full"
            style={{
              backgroundColor: services.every((s) => s.status === 'ok')
                ? 'var(--success)'
                : services.some((s) => s.status === 'down')
                  ? 'var(--error)'
                  : 'var(--warning)',
              animation: services.some((s) => s.status === 'down')
                ? 'bullseye-pulse 0.5s ease-in-out infinite'
                : services.some((s) => s.status === 'degraded')
                  ? 'bullseye-pulse 1.5s ease-in-out infinite'
                  : undefined,
            }}
          />
          <span
            className="text-xs font-semibold text-text-tertiary uppercase tracking-wider"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            Infrastructure
          </span>
        </div>
        <span
          className="text-[10px] text-text-tertiary tabular-nums"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          {secondsAgo}s ago
        </span>
      </div>

      {/* Service rows */}
      <div className="px-4 py-2">
        {services.map((svc) => (
          <div
            key={svc.name}
            className="flex items-center gap-3 py-1.5 transition-colors duration-300"
            style={{
              backgroundColor: svc.status === 'down' ? 'rgba(248, 113, 113, 0.05)' : undefined,
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{
                backgroundColor: STATUS_COLORS[svc.status],
                animation: svc.status === 'down'
                  ? 'bullseye-pulse 0.5s ease-in-out infinite'
                  : svc.status === 'degraded'
                    ? 'bullseye-pulse 1.5s ease-in-out infinite'
                    : undefined,
              }}
            />
            <span className="text-xs text-text-secondary w-20 shrink-0">{svc.name}</span>
            <span
              className="text-xs tabular-nums w-12 text-right shrink-0 transition-colors duration-300"
              style={{
                fontFamily: 'var(--font-mono)',
                color: svc.status === 'ok'
                  ? 'var(--text-tertiary)'
                  : STATUS_COLORS[svc.status],
              }}
            >
              {svc.latency}ms
            </span>
            <LatencyBar latency={svc.latency} status={svc.status} />
            <span
              className="text-[10px] uppercase tracking-wider shrink-0"
              style={{
                fontFamily: 'var(--font-mono)',
                color: STATUS_COLORS[svc.status],
              }}
            >
              {svc.status}
            </span>
          </div>
        ))}
      </div>

      {/* Latency sparkline */}
      {history.length > 1 && (
        <div className="px-4 pb-3 pt-1">
          <ResponsiveContainer width="100%" height={40}>
            <AreaChart data={history} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={sparkColor} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={sparkColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <YAxis domain={[0, 'auto']} hide />
              <Area
                type="monotone"
                dataKey="latency"
                stroke={sparkColor}
                strokeWidth={1.5}
                fill="url(#latencyGradient)"
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
