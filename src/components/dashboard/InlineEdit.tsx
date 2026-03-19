'use client'

import { useState, useRef, useEffect } from 'react'

interface InlineEditProps {
  value: string
  onSave: (val: string) => Promise<void>
  editable: boolean
  className?: string
  tag?: 'h1' | 'h2' | 'h3' | 'p' | 'span'
}

export default function InlineEdit({ value, onSave, editable, className = '', tag = 'span' }: InlineEditProps) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(value)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setText(value) }, [value])
  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])

  async function handleSave() {
    const trimmed = text.trim()
    if (!trimmed || trimmed === value) {
      setText(value)
      setEditing(false)
      return
    }
    setSaving(true)
    await onSave(trimmed)
    setSaving(false)
    setEditing(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSave()
    if (e.key === 'Escape') { setText(value); setEditing(false) }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className={`input !py-1 !px-2 ${className} ${saving ? 'opacity-50' : ''}`}
        style={{ boxShadow: '0 0 0 3px var(--accent-glow)', borderColor: 'var(--accent-primary)' }}
        disabled={saving}
      />
    )
  }

  const Tag = tag
  return (
    <Tag
      className={`${className} ${editable ? 'cursor-text hover:underline decoration-dashed decoration-text-tertiary underline-offset-4 rounded px-1 -mx-1 transition-all duration-150 inline-flex items-center gap-1.5 group/edit' : ''}`}
      onClick={() => editable && setEditing(true)}
      title={editable ? 'Click to edit' : undefined}
    >
      {value}
      {editable && (
        <svg className="w-3 h-3 text-text-tertiary opacity-0 group-hover/edit:opacity-100 transition-opacity duration-150 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
        </svg>
      )}
    </Tag>
  )
}
