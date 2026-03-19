'use client'

import { useEffect, useState } from 'react'

interface ProgressBarProps {
  percentage: number
  color?: string
  height?: string
  glow?: boolean
}

export default function ProgressBar({ percentage, color, height = '6px', glow = false }: ProgressBarProps) {
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => setWidth(percentage))
    })
    return () => cancelAnimationFrame(raf)
  }, [percentage])

  const barColor = color || 'var(--accent-primary)'
  const isComplete = percentage >= 100

  return (
    <div
      className="w-full rounded-full overflow-hidden"
      style={{ height, background: 'var(--bg-tertiary)' }}
    >
      <div
        className={`h-full rounded-full relative ${isComplete ? 'shimmer' : ''}`}
        style={{
          width: `${width}%`,
          background: `linear-gradient(90deg, ${barColor}, ${barColor}cc)`,
          boxShadow: glow
            ? `0 0 8px ${barColor}60, 0 0 4px ${barColor}40`
            : undefined,
          transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      />
    </div>
  )
}
