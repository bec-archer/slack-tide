'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Project, Feature, ProjectStatus } from '@/lib/dashboard-types'
import ProgressBar from './ProgressBar'

function projectBadgeClass(status: ProjectStatus) {
  switch (status) {
    case 'active': return 'badge-accent'
    case 'paused': return 'badge-warning'
    case 'completed': return 'badge-success'
    case 'archived': return 'badge-muted'
  }
}

interface ProjectCardProps {
  project: Project
  features: Feature[]
  milestoneCount: number
  isSubProject?: boolean
}

export default function ProjectCard({ project, features, milestoneCount, isSubProject }: ProjectCardProps) {
  const active = features.filter((f) => f.status !== 'cut')
  const completed = active.filter((f) => f.status === 'done' || f.status === 'shipped').length
  const percentage = active.length > 0 ? Math.round((completed / active.length) * 100) : 0
  const [collapsed, setCollapsed] = useState(percentage === 100)

  if (isSubProject) {
    return (
      <Link href={`/dashboard/${project.slug}`} className="block">
        <div
          className="card-static !py-2.5 !px-3"
          style={{ borderLeftWidth: '2px', borderLeftColor: project.color }}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <h3 className="text-sm font-medium text-text-secondary truncate">{project.name}</h3>
              <span className={`badge ${projectBadgeClass(project.status)} !text-[10px] !px-1.5 !py-0 shrink-0`} style={{ fontFamily: 'var(--font-mono)' }}>
                {project.status}
              </span>
            </div>
            <div className="flex items-center gap-3 shrink-0 text-xs text-text-tertiary" style={{ fontFamily: 'var(--font-mono)' }}>
              <span>{active.length} features</span>
              <span className="font-semibold" style={{ color: project.color }}>{percentage}%</span>
            </div>
          </div>
        </div>
      </Link>
    )
  }

  return (
    <div
      className="card h-full"
      style={{ borderLeftWidth: '3px', borderLeftColor: project.color }}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Link href={`/dashboard/${project.slug}`} className="hover:underline underline-offset-2">
            <h2 className="text-lg font-semibold text-text-primary">{project.name}</h2>
          </Link>
          <span className={`badge ${projectBadgeClass(project.status)} shrink-0`} style={{ fontFamily: 'var(--font-mono)' }}>
            {project.status}
          </span>
        </div>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-text-tertiary hover:text-text-secondary transition-colors shrink-0 p-0.5"
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          <span className="text-xs" style={{ fontFamily: 'var(--font-mono)' }}>
            {collapsed ? '▸' : '▾'}
          </span>
        </button>
      </div>
      {!collapsed && (
        <>
          {project.description && (
            <p className="text-sm text-text-secondary mb-4 line-clamp-2">{project.description}</p>
          )}
          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl font-bold" style={{ fontFamily: 'var(--font-mono)', color: project.color }}>
              {percentage}%
            </span>
            <div className="flex-1">
              <ProgressBar percentage={percentage} color={project.color} />
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-text-tertiary" style={{ fontFamily: 'var(--font-mono)' }}>
            <span>{milestoneCount} milestones</span>
            <span>{active.length} features</span>
          </div>
        </>
      )}
      {collapsed && (
        <div className="flex items-center gap-3 text-xs text-text-tertiary" style={{ fontFamily: 'var(--font-mono)' }}>
          <span className="font-semibold" style={{ color: project.color }}>{percentage}%</span>
          <span>{milestoneCount} milestones</span>
          <span>{active.length} features</span>
        </div>
      )}
    </div>
  )
}
