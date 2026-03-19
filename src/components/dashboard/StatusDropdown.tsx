'use client'

import { useState, useRef, useEffect } from 'react'

interface StatusDropdownProps<T extends string> {
  value: T
  options: T[]
  badgeClass: (val: T) => string
  label: (val: T) => string
  onChange: (val: T) => Promise<void>
  editable: boolean
}

export default function StatusDropdown<T extends string>({
  value,
  options,
  badgeClass,
  label,
  onChange,
  editable,
}: StatusDropdownProps<T>) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  async function handleSelect(val: T) {
    if (val === value) { setOpen(false); return }
    setSaving(true)
    setOpen(false)
    await onChange(val)
    setSaving(false)
  }

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        className={`badge ${badgeClass(value)} ${editable ? 'cursor-pointer hover:brightness-125 transition-all duration-150' : 'cursor-default'} ${saving ? 'opacity-50' : ''}`}
        onClick={() => editable && setOpen(!open)}
        disabled={saving}
        style={{ fontFamily: 'var(--font-mono)' }}
        title={editable ? 'Click to change status' : undefined}
      >
        {label(value)}
        {editable && <span className="text-[10px] ml-0.5 opacity-60">▾</span>}
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 min-w-[140px] rounded-lg overflow-hidden border border-border-default bg-bg-elevated shadow-lg animate-fade-in">
          {options.map((opt) => (
            <button
              key={opt}
              className={`w-full text-left px-3 py-2 text-xs font-mono transition-colors hover:bg-bg-tertiary ${opt === value ? 'opacity-50' : ''}`}
              onClick={() => handleSelect(opt)}
            >
              <span className={`badge ${badgeClass(opt)}`}>{label(opt)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
