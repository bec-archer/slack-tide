'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { BarChart, Bar, ResponsiveContainer, Cell } from 'recharts'

interface Commit {
  hash: string
  message: string
  author: string
  email: string
  relativeTime: string
  timestamp: number
}

const MAX_VISIBLE = 25
const POLL_INTERVAL = 30_000

function CommitSparkline({ commits, accentColor }: { commits: Commit[]; accentColor: string }) {
  const data = useMemo(() => {
    const now = new Date()
    const days: { day: string; count: number }[] = []
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      days.push({ day: d.toISOString().slice(0, 10), count: 0 })
    }
    for (const c of commits) {
      if (!c.timestamp) continue
      const d = new Date(c.timestamp * 1000)
      if (isNaN(d.getTime())) continue
      const day = d.toISOString().slice(0, 10)
      const entry = days.find((dd) => dd.day === day)
      if (entry) entry.count++
    }
    return days
  }, [commits])

  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="px-4 py-2 border-b border-border-subtle">
      <ResponsiveContainer width="100%" height={36}>
        <BarChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <Bar dataKey="count" radius={[2, 2, 0, 0]} animationDuration={800}>
            {data.map((entry, index) => (
              <Cell
                key={`${entry.day}-${index}`}
                fill={entry.day === today ? accentColor : `${accentColor}60`}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

interface GitCommitFeedProps {
  accentColor?: string
  pulseKey?: number
}

export default function GitCommitFeed({ accentColor = 'var(--accent-primary)', pulseKey }: GitCommitFeedProps) {
  const [commits, setCommits] = useState<Commit[]>([])
  const [frozen, setFrozen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [newHashes, setNewHashes] = useState<Set<string>>(new Set())
  const topHashRef = useRef<string | null>(null)
  const frozenRef = useRef(false)
  const pendingRef = useRef<Commit[] | null>(null)

  // Pulse the live dot on realtime events
  const [livePulse, setLivePulse] = useState(false)
  const prevPulseKey = useRef(pulseKey)
  useEffect(() => {
    if (pulseKey !== undefined && pulseKey !== prevPulseKey.current) {
      prevPulseKey.current = pulseKey
      setLivePulse(true)
      const t = setTimeout(() => setLivePulse(false), 600)
      return () => clearTimeout(t)
    }
  }, [pulseKey])

  useEffect(() => { frozenRef.current = frozen }, [frozen])

  const fetchCommits = useCallback(async () => {
    try {
      const res = await fetch('/api/git-log')
      const data: Commit[] = await res.json()
      if (!data.length) return

      if (frozenRef.current) {
        pendingRef.current = data
        return
      }

      if (topHashRef.current && data[0].hash !== topHashRef.current) {
        const newOnes = new Set<string>()
        for (const c of data) {
          if (c.hash === topHashRef.current) break
          newOnes.add(c.hash)
        }
        setNewHashes(newOnes)
        setTimeout(() => setNewHashes(new Set()), 400)
      }

      topHashRef.current = data[0].hash
      setCommits(data.slice(0, MAX_VISIBLE))
      setLoading(false)
    } catch {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchCommits() }, [fetchCommits])

  useEffect(() => {
    const interval = setInterval(() => {
      if (!frozenRef.current) fetchCommits()
    }, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [fetchCommits])

  function handleToggleFreeze() {
    if (frozen) {
      setFrozen(false)
      if (pendingRef.current) {
        topHashRef.current = pendingRef.current[0]?.hash ?? null
        setCommits(pendingRef.current.slice(0, MAX_VISIBLE))
        pendingRef.current = null
      }
    } else {
      setFrozen(true)
    }
  }

  if (loading) {
    return (
      <div className="bg-bg-elevated border border-border-subtle rounded-xl overflow-hidden max-h-[60vh]">
        <div className="px-4 py-3 border-b border-border-subtle">
          <div className="h-4 bg-bg-tertiary rounded w-32 animate-pulse" />
        </div>
        <div className="p-4 space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="space-y-1.5 animate-pulse">
              <div className="h-4 bg-bg-tertiary rounded w-full" />
              <div className="h-3 bg-bg-tertiary rounded w-2/3" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-bg-elevated border border-border-subtle rounded-xl overflow-hidden max-h-[60vh] flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border-subtle flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-text-tertiary" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5" />
          </svg>
          <span
            className="text-xs font-semibold text-text-tertiary uppercase tracking-wider"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            Commits
          </span>
          {frozen ? (
            <span className="inline-flex items-center gap-1.5 text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-warning/10 border border-warning/20 text-warning">
              <span className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse" />
              FROZEN
            </span>
          ) : (
            <span
              className="w-2 h-2 rounded-full bg-success"
              title="Live"
              style={{
                animation: livePulse
                  ? 'bullseye-pulse 0.3s ease-out 2'
                  : 'bullseye-pulse 2s ease-in-out infinite',
                boxShadow: livePulse ? '0 0 8px var(--success)' : undefined,
              }}
            />
          )}
        </div>
        <button
          type="button"
          onClick={handleToggleFreeze}
          className="text-xs text-text-tertiary hover:text-text-primary transition-colors px-2 py-1 rounded cursor-pointer"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          {frozen ? '▶ Live' : '❚❚ Freeze'}
        </button>
      </div>

      {/* Sparkline */}
      {commits.length > 0 && <CommitSparkline commits={commits} accentColor={accentColor} />}

      {/* Commit list */}
      <div className={`flex-1 min-h-0 ${frozen ? 'overflow-y-auto' : 'overflow-hidden'}`}>
        {commits.length === 0 ? (
          <p className="text-text-tertiary text-sm text-center py-8">No commits found.</p>
        ) : (
          <div>
            {commits.map((commit) => (
              <div
                key={commit.hash}
                className={`px-4 py-2.5 border-b border-border-subtle hover:bg-bg-tertiary/30 transition-colors duration-150 ${
                  newHashes.has(commit.hash) ? 'commit-entry' : ''
                }`}
              >
                <div className="flex items-baseline gap-2 min-w-0">
                  <span
                    className="text-[11px] text-text-tertiary shrink-0"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    {commit.hash.slice(0, 7)}
                  </span>
                  <span className="text-sm text-text-primary truncate min-w-0">
                    {commit.message}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span
                    className="text-[11px] text-text-tertiary"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    {commit.author}
                  </span>
                  <span className="text-text-tertiary text-[11px]">·</span>
                  <span
                    className="text-[11px] text-text-tertiary tabular-nums"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    {commit.relativeTime}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
