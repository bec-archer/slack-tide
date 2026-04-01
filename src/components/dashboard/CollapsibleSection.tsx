'use client'

import { useState, type ReactNode } from 'react'

interface CollapsibleSectionProps {
  title: string
  children: ReactNode
  defaultOpen?: boolean
  /** Optional right-side content shown next to the chevron (e.g. count badge) */
  badge?: ReactNode
  /** Use smaller heading style (for nested/card contexts) */
  compact?: boolean
}

export default function CollapsibleSection({
  title,
  children,
  defaultOpen = true,
  badge,
  compact = false,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 w-full text-left group/collapse cursor-pointer ${
          compact ? 'py-1' : 'mb-3'
        }`}
      >
        <svg
          className={`w-3.5 h-3.5 text-text-tertiary shrink-0 transition-transform duration-200 ${
            open ? 'rotate-90' : 'rotate-0'
          }`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth="2.5"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
        </svg>
        <span
          className={
            compact
              ? 'text-sm font-semibold text-text-secondary'
              : 'text-sm font-semibold text-text-tertiary uppercase tracking-wider'
          }
        >
          {title}
        </span>
        {badge && <span className="ml-auto">{badge}</span>}
      </button>
      {open && children}
    </div>
  )
}
