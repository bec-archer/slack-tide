'use client'

import { createBrowserClient } from '@/lib/supabase'
import type { Milestone, Feature, MilestoneStatus } from '@/lib/dashboard-types'
import InlineEdit from './InlineEdit'
import StatusDropdown from './StatusDropdown'
import ProgressBar from './ProgressBar'
import FeatureRow from './FeatureRow'
import AddFeatureForm from './AddFeatureForm'
import DeleteButton from './DeleteButton'

const MILESTONE_STATUSES: MilestoneStatus[] = ['planned', 'in_progress', 'completed']

function milestoneBadgeClass(status: MilestoneStatus) {
  switch (status) {
    case 'planned': return 'badge-muted'
    case 'in_progress': return 'badge-info'
    case 'completed': return 'badge-success'
  }
}

function milestoneLabel(status: MilestoneStatus) {
  return status.replace('_', ' ')
}

function computeProgress(features: Feature[]) {
  const active = features.filter((f) => f.status !== 'cut')
  const done = active.filter((f) => f.status === 'done' || f.status === 'shipped')
  return active.length > 0 ? Math.round((done.length / active.length) * 100) : 0
}

interface MilestoneCardProps {
  milestone: Milestone
  features: Feature[]
  projectColor: string
  isAdmin: boolean
  onRefresh: () => void
}

export default function MilestoneCard({ milestone, features, projectColor, isAdmin, onRefresh }: MilestoneCardProps) {
  const supabase = createBrowserClient()
  const progress = computeProgress(features)
  const sortedFeatures = [...features].sort((a, b) => a.sort_order - b.sort_order)

  async function updateName(name: string) {
    await supabase.from('milestones').update({ name }).eq('id', milestone.id)
    onRefresh()
  }

  async function updateStatus(status: MilestoneStatus) {
    await supabase.from('milestones').update({ status }).eq('id', milestone.id)
    onRefresh()
  }

  async function handleDelete() {
    await supabase.from('milestones').delete().eq('id', milestone.id)
    onRefresh()
  }

  return (
    <div
      className="card-static !p-0 group/milestone"
      style={
        progress >= 100
          ? { background: `linear-gradient(135deg, ${projectColor}08, transparent 60%), linear-gradient(145deg, var(--bg-secondary) 0%, var(--bg-tertiary) 100%)` }
          : undefined
      }
    >
      <div className="p-5 pb-3">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex-1 min-w-0">
            <InlineEdit
              value={milestone.name}
              onSave={updateName}
              editable={isAdmin}
              className="text-lg font-semibold text-text-primary"
              tag="h3"
            />
            {milestone.description && (
              <p className="text-sm text-text-tertiary mt-0.5">{milestone.description}</p>
            )}
            {milestone.target_date && !isNaN(new Date(milestone.target_date).getTime()) && (
              <p className="text-xs text-text-tertiary mt-1 font-mono" style={{ fontFamily: 'var(--font-mono)' }}>
                Target: {new Date(milestone.target_date).toLocaleDateString()}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <StatusDropdown
              value={milestone.status}
              options={MILESTONE_STATUSES}
              badgeClass={milestoneBadgeClass}
              label={milestoneLabel}
              onChange={updateStatus}
              editable={isAdmin}
            />
            {isAdmin && (
              <span className="opacity-0 group-hover/milestone:opacity-100 touch-visible transition-opacity duration-150">
                <DeleteButton onDelete={handleDelete} label="Delete milestone" />
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-mono text-text-tertiary" style={{ fontFamily: 'var(--font-mono)' }}>
            {progress}%
          </span>
          <div className="flex-1">
            <ProgressBar percentage={progress} color={projectColor} glow />
          </div>
        </div>
      </div>
      <div className="border-t border-border-subtle px-3 py-2">
        {sortedFeatures.length === 0 ? (
          <p className="text-sm text-text-tertiary py-2 px-2">No features yet.</p>
        ) : (
          sortedFeatures.map((feature) => (
            <FeatureRow
              key={feature.id}
              feature={feature}
              isAdmin={isAdmin}
              onRefresh={onRefresh}
            />
          ))
        )}
        {isAdmin && (
          <div className="px-2">
            <AddFeatureForm
              milestoneId={milestone.id}
              projectId={milestone.project_id}
              sortOrder={sortedFeatures.length}
              onAdded={onRefresh}
            />
          </div>
        )}
      </div>
    </div>
  )
}
