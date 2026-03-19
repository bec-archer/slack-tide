'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import type { Project } from '@/lib/dashboard-types'

interface AddProjectFormProps {
  onAdded: () => void
}

const COLORS = ['#2dd4bf', '#60a5fa', '#a78bfa', '#f472b6', '#fb923c', '#facc15', '#4ade80', '#f87171']

export default function AddProjectForm({ onAdded }: AddProjectFormProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState(COLORS[0])
  const [parentProjectId, setParentProjectId] = useState<string>('')
  const [topLevelProjects, setTopLevelProjects] = useState<Project[]>([])
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const supabase = createBrowserClient()
    supabase
      .from('projects')
      .select('id, name')
      .is('parent_project_id', null)
      .order('name')
      .then(({ data }) => setTopLevelProjects((data as Project[]) || []))
  }, [open])

  function generateSlug(text: string) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setFormError(null)
    const payload = {
      name: name.trim(),
      slug: generateSlug(name),
      description: description.trim() || null,
      color,
      status: 'active',
      parent_project_id: parentProjectId || null,
    }
    console.log('[AddProjectForm] Submitting to /api/projects', JSON.stringify(payload))
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const responseBody = await res.text()
      console.log('[AddProjectForm] Response status:', res.status, res.statusText)
      console.log('[AddProjectForm] Response body:', responseBody)
      if (!res.ok) {
        let detail = 'Failed to create project'
        try {
          const err = JSON.parse(responseBody)
          detail = [err.error, err.hint, err.code].filter(Boolean).join(' — ') || detail
        } catch { /* not JSON */ }
        setFormError(detail)
        setSaving(false)
        return
      }
    } catch (err) {
      console.error('[AddProjectForm] Fetch error:', err)
      setFormError('Network error — could not reach server')
      setSaving(false)
      return
    }
    setName('')
    setDescription('')
    setColor(COLORS[0])
    setParentProjectId('')
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
      <select
        value={parentProjectId}
        onChange={(e) => setParentProjectId(e.target.value)}
        className="input !py-2 !px-3 !text-sm mb-3"
      >
        <option value="">Parent project (optional)</option>
        {topLevelProjects.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
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
      {formError && (
        <p className="text-xs text-red-400 mb-2">{formError}</p>
      )}
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
