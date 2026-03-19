'use client'

import { useState } from 'react'
import { createQrstkrClient } from '@/lib/supabase-qrstkr'
import type { FeaturePriority } from '@/lib/dashboard-types'

interface AddFeatureFormProps {
  milestoneId: string
  projectId: string
  sortOrder: number
  onAdded: () => void
}

export default function AddFeatureForm({ milestoneId, projectId, sortOrder, onAdded }: AddFeatureFormProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [priority, setPriority] = useState<FeaturePriority>('medium')
  const [isScopeCreep, setIsScopeCreep] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    const supabase = createQrstkrClient()
    await supabase.from('features').insert({
      milestone_id: milestoneId,
      project_id: projectId,
      name: name.trim(),
      priority,
      is_scope_creep: isScopeCreep,
      sort_order: sortOrder,
      status: 'planned',
    })
    setName('')
    setPriority('medium')
    setIsScopeCreep(false)
    setSaving(false)
    setOpen(false)
    onAdded()
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-text-tertiary hover:text-accent transition-colors flex items-center gap-1 mt-2"
      >
        <span>+</span> Add Feature
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 p-3 rounded-lg bg-bg-tertiary border border-border-subtle animate-fade-in">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Feature name..."
        className="input !py-1.5 !px-2 !text-sm mb-2"
        autoFocus
      />
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as FeaturePriority)}
          className="input !py-1 !px-2 !text-xs !w-auto"
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
        <label className="flex items-center gap-1.5 text-xs text-text-secondary cursor-pointer">
          <input
            type="checkbox"
            checked={isScopeCreep}
            onChange={(e) => setIsScopeCreep(e.target.checked)}
            className="accent-accent"
          />
          Scope creep
        </label>
        <div className="flex-1" />
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-text-tertiary hover:text-text-secondary transition-colors">
          Cancel
        </button>
        <button type="submit" disabled={saving || !name.trim()} className="btn-primary !py-1 !px-3 !text-xs !rounded-lg">
          {saving ? '...' : 'Add'}
        </button>
      </div>
    </form>
  )
}
