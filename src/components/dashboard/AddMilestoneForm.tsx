'use client'

import { useState } from 'react'
import { createQrstkrClient } from '@/lib/supabase-qrstkr'

interface AddMilestoneFormProps {
  projectId: string
  sortOrder: number
  onAdded: () => void
}

export default function AddMilestoneForm({ projectId, sortOrder, onAdded }: AddMilestoneFormProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    const supabase = createQrstkrClient()
    await supabase.from('milestones').insert({
      project_id: projectId,
      name: name.trim(),
      sort_order: sortOrder,
      status: 'planned',
    })
    setName('')
    setSaving(false)
    setOpen(false)
    onAdded()
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-secondary !py-2 !px-4 !text-sm mt-4"
      >
        + Add Milestone
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 p-4 rounded-lg bg-bg-tertiary border border-border-subtle animate-fade-in">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Milestone name..."
        className="input !py-2 !px-3 !text-sm mb-3"
        autoFocus
      />
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-text-tertiary hover:text-text-secondary transition-colors">
          Cancel
        </button>
        <button type="submit" disabled={saving || !name.trim()} className="btn-primary !py-1.5 !px-4 !text-sm !rounded-lg">
          {saving ? '...' : 'Add Milestone'}
        </button>
      </div>
    </form>
  )
}
