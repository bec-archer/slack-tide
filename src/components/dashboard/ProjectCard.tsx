'use client'

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
}

export default function ProjectCard({ project, features, milestoneCount }: ProjectCardProps) {
  const active = features.filter((f) => f.status !== 'cut')
  const completed = active.filter((f) => f.status === 'done' || f.status === 'shipped').length
  const percentage = active.length > 0 ? Math.round((completed / active.length) * 100) : 0

  return (
    <Link href={`/dashboard/${project.slug}`} className="block">
      <div
        className="card h-full"
        style={{ borderLeftWidth: '3px', borderLeftColor: project.color }}
      >
        <div className="flex items-start justify-between gap-2 mb-3">
          <h2 className="text-lg font-semibold text-text-primary">{project.name}</h2>
          <span className={`badge ${projectBadgeClass(project.status)} shrink-0`} style={{ fontFamily: 'var(--font-mono)' }}>
            {project.status}
          </span>
        </div>
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
      </div>
    </Link>
  )
}
