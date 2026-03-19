'use client'

import { useState } from 'react'

interface DeleteButtonProps {
  onDelete: () => Promise<void>
  label?: string
}

export default function DeleteButton({ onDelete, label = 'Delete' }: DeleteButtonProps) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleConfirm() {
    setDeleting(true)
    await onDelete()
    setDeleting(false)
    setConfirming(false)
  }

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-1.5 animate-fade-in">
        <span className="text-xs text-text-tertiary">Sure?</span>
        <button
          onClick={handleConfirm}
          disabled={deleting}
          className="text-xs text-error hover:text-red-300 font-medium transition-colors disabled:opacity-50"
        >
          {deleting ? '...' : 'Yes'}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="text-xs text-text-tertiary hover:text-text-secondary transition-colors"
        >
          No
        </button>
      </span>
    )
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="text-text-tertiary hover:text-error transition-colors p-1"
      title={label}
    >
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
      </svg>
    </button>
  )
}
