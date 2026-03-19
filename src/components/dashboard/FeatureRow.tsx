'use client'

import { createBrowserClient } from '@/lib/supabase'
import type { Feature, FeatureStatus } from '@/lib/dashboard-types'
import InlineEdit from './InlineEdit'
import StatusDropdown from './StatusDropdown'
import PriorityBadge from './PriorityBadge'
import DeleteButton from './DeleteButton'

const FEATURE_STATUSES: FeatureStatus[] = ['planned', 'in_progress', 'done', 'shipped', 'cut']

function featureBadgeClass(status: FeatureStatus) {
  switch (status) {
    case 'planned': return 'badge-muted'
    case 'in_progress': return 'badge-info'
    case 'done': return 'badge-success'
    case 'shipped': return 'badge-accent'
    case 'cut': return 'badge-error'
  }
}

function featureLabel(status: FeatureStatus) {
  return status.replace('_', ' ')
}

interface FeatureRowProps {
  feature: Feature
  isAdmin: boolean
  onRefresh: () => void
}

export default function FeatureRow({ feature, isAdmin, onRefresh }: FeatureRowProps) {
  const supabase = createBrowserClient()

  async function updateName(name: string) {
    await supabase.from('features').update({ name }).eq('id', feature.id)
    onRefresh()
  }

  async function updateStatus(status: FeatureStatus) {
    await supabase.from('features').update({ status }).eq('id', feature.id)
    onRefresh()
  }

  async function handleDelete() {
    await supabase.from('features').delete().eq('id', feature.id)
    onRefresh()
  }

  const isCut = feature.status === 'cut'

  return (
    <div className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-bg-tertiary/50 transition-colors group">
      <div className={`flex-1 min-w-0 ${isCut ? 'line-through opacity-50' : ''}`}>
        <InlineEdit
          value={feature.name}
          onSave={updateName}
          editable={isAdmin}
          className="text-sm text-text-primary"
        />
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {feature.is_scope_creep && (
          <span
            className="text-[10px] font-mono px-1.5 py-0.5 rounded-full border"
            style={{
              color: 'var(--status-warning)',
              borderColor: 'var(--status-warning)',
              background: 'rgba(251, 191, 36, 0.1)',
            }}
            title="Scope creep"
          >
            🔀 creep
          </span>
        )}
        <PriorityBadge priority={feature.priority} />
        <StatusDropdown
          value={feature.status}
          options={FEATURE_STATUSES}
          badgeClass={featureBadgeClass}
          label={featureLabel}
          onChange={updateStatus}
          editable={isAdmin}
        />
        {isAdmin && (
          <span className="opacity-0 group-hover:opacity-100 touch-visible transition-opacity">
            <DeleteButton onDelete={handleDelete} label="Delete feature" />
          </span>
        )}
      </div>
    </div>
  )
}
