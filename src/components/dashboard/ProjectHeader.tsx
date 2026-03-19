'use client'

import { useEffect, useState } from 'react'
import type { Project, Feature, ProjectStatus } from '@/lib/dashboard-types'
import StatusDropdown from './StatusDropdown'
import { createBrowserClient } from '@/lib/supabase'

const PROJECT_STATUSES: ProjectStatus[] = ['active', 'paused', 'completed', 'archived']

function projectBadgeClass(status: ProjectStatus) {
  switch (status) {
    case 'active': return 'badge-accent'
    case 'paused': return 'badge-warning'
    case 'completed': return 'badge-success'
    case 'archived': return 'badge-muted'
  }
}

interface ProjectHeaderProps {
  project: Project
  features: Feature[]
  isAdmin: boolean
  onRefresh: () => void
}

export default function ProjectHeader({ project, features, isAdmin, onRefresh }: ProjectHeaderProps) {
  const active = features.filter((f) => f.status !== 'cut')
  const completed = active.filter((f) => f.status === 'done' || f.status === 'shipped').length
  const percentage = active.length > 0 ? Math.round((completed / active.length) * 100) : 0

  async function updateStatus(status: ProjectStatus) {
    const supabase = createBrowserClient()
    await supabase.from('projects').update({ status }).eq('id', project.id)
    onRefresh()
  }

  // Animated stroke offset
  const radius = 68
  const circumference = 2 * Math.PI * radius
  const [offset, setOffset] = useState(circumference)

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setOffset(circumference - (percentage / 100) * circumference)
      })
    })
    return () => cancelAnimationFrame(raf)
  }, [percentage, circumference])

  return (
    <div className="flex items-center justify-between gap-6">
      {/* Left: name, description, status */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-3 mb-2">
          <h1
            className="text-3xl sm:text-4xl font-extrabold text-text-primary tracking-tight"
            style={{ fontFamily: 'var(--font-plus-jakarta)' }}
          >
            {project.name}
          </h1>
          <StatusDropdown
            value={project.status}
            options={PROJECT_STATUSES}
            badgeClass={projectBadgeClass}
            label={(s) => s}
            onChange={updateStatus}
            editable={isAdmin}
          />
        </div>
        {project.description && (
          <p className="text-text-secondary text-base">{project.description}</p>
        )}
      </div>

      {/* Right: completion ring */}
      <div className="shrink-0">
        <svg viewBox="0 0 160 160" width="140" height="140">
          {/* Background track */}
          <circle
            cx="80" cy="80" r={radius}
            fill="none"
            stroke="var(--bg-elevated)"
            strokeWidth="12"
          />
          {/* Animated fill arc */}
          <circle
            cx="80" cy="80" r={radius}
            fill="none"
            stroke={project.color}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            transform="rotate(-90 80 80)"
            style={{
              filter: `drop-shadow(0 0 8px ${project.color}60)`,
              transition: 'stroke-dashoffset 1.2s ease-out',
            }}
          />
          {/* Percentage */}
          <text
            x="80" y="74"
            textAnchor="middle"
            dominantBaseline="central"
            fill={project.color}
            style={{ fontFamily: 'var(--font-mono)', fontSize: '28px', fontWeight: 700 }}
          >
            {percentage}%
          </text>
          {/* Label */}
          <text
            x="80" y="98"
            textAnchor="middle"
            dominantBaseline="central"
            fill="var(--text-tertiary)"
            style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}
          >
            complete
          </text>
        </svg>
      </div>
    </div>
  )
}
