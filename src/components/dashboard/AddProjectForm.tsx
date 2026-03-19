'use client'

import { useState } from 'react'
import { createQrstkrClient } from '@/lib/supabase-qrstkr'

interface AddProjectFormProps {
  onAdded: () => void
}

const COLORS = ['#2dd4bf', '#60a5fa', '#a78bfa', '#f472b6', '#fb923c', '#facc15', '#4ade80', '#f87171']

export default function AddProjectForm({ onAdded }: AddProjectFormProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState(COLORS[0])
  const [saving, setSaving] = useState(false)

  function generateSlug(text: string) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    const supabase = createQrstkrClient()
    await supabase.from('projects').insert({
      name: name.trim(),
      slug: generateSlug(name),
      description: description.trim() || null,
      color,
      status: 'active',
    })
    setName('')
    setDescription('')
    setColor(COLORS[0])
    setSaving(false)
    setOpen(false)
    onAdded()
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-primary !py-2 !px-4 !text-sm">
        + New Project
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="card-static !p-4 animate-fade-in">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Project name..."
        className="input !py-2 !px-3 !text-sm mb-2"
        autoFocus
      />
      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description (optional)"
        className="input !py-2 !px-3 !text-sm mb-3"
      />
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs text-text-tertiary">Color:</span>
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setColor(c)}
            className="w-5 h-5 rounded-full transition-transform"
            style={{
              background: c,
              transform: color === c ? 'scale(1.3)' : 'scale(1)',
              boxShadow: color === c ? `0 0 8px ${c}60` : 'none',
            }}
          />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-text-tertiary hover:text-text-secondary transition-colors">
          Cancel
        </button>
        <button type="submit" disabled={saving || !name.trim()} className="btn-primary !py-1.5 !px-4 !text-sm !rounded-lg">
          {saving ? '...' : 'Create'}
        </button>
      </div>
    </form>
  )
}
