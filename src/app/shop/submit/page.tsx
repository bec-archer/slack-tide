'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import jsQR from 'jsqr'
import { useShop } from '@/contexts/ShopContext'
import { createBrowserClient } from '@/lib/supabase'
import type { MaintenanceRecordType, ServiceVisitLineItem } from '@/lib/types'

interface ItemInfo {
  id: string
  name: string | null
  make: string | null
  model: string | null
  year: number | null
  owner_name: string | null
}

type SubmitStep = 'scan' | 'confirm' | 'form' | 'success'

const RECORD_TYPES: Array<{ value: MaintenanceRecordType; label: string }> = [
  { value: 'service', label: 'Service / Routine' },
  { value: 'repair', label: 'Repair' },
  { value: 'upgrade', label: 'Upgrade' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'diagnostic', label: 'Diagnostic' },
  { value: 'other', label: 'Other' },
]

interface LineItemForm {
  record_type: MaintenanceRecordType
  title: string
  description: string
  cost_display: string  // raw dollar string — converted to cents on submit
}

function emptyLineItem(): LineItemForm {
  return { record_type: 'service', title: '', description: '', cost_display: '' }
}

export default function ShopSubmitPage() {
  const { shopId } = useShop()
  const [step, setStep] = useState<SubmitStep>('scan')
  const [error, setError] = useState<string | null>(null)

  // Scan state
  const [isLookingUp, setIsLookingUp] = useState(false)

  // Item state
  const [item, setItem] = useState<ItemInfo | null>(null)

  // Form state
  const [serviceDate, setServiceDate] = useState(() => {
    const d = new Date()
    return d.toISOString().split('T')[0]
  })
  const [mileage, setMileage] = useState('')
  const [lineItems, setLineItems] = useState<LineItemForm[]>([emptyLineItem()])
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Technician picker state
  const [shopEmployees, setShopEmployees] = useState<Array<{ name: string; isCurrentUser: boolean }>>([])
  const [selectedTechs, setSelectedTechs] = useState<string[]>([])
  const [manualTechName, setManualTechName] = useState('')
  const [showTechDropdown, setShowTechDropdown] = useState(false)

  // QR Scanner
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [isCameraActive, setIsCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Fetch shop employees for the tech picker when we reach the form step
  useEffect(() => {
    if (step === 'form' && shopId && shopEmployees.length === 0) {
      fetchShopEmployees()
    }
  }, [step, shopId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchShopEmployees() {
    try {
      const supabase = createBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const res = await fetch(`/api/shops/${shopId}/employees`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      })
      if (!res.ok) return

      const body = await res.json()
      const currentUserId: string | null = body.current_user_id ?? null
      const seen = new Set<string>()
      const people: Array<{ name: string; isCurrentUser: boolean }> = []

      // Add shop owner first (they might not be in the employees table)
      if (body.owner?.display_name) {
        const ownerName: string = body.owner.display_name
        seen.add(ownerName.toLowerCase())
        people.push({ name: ownerName, isCurrentUser: body.owner.user_id === currentUserId })
      }

      // Add accepted employees
      const emps = body.employees ?? []
      for (const emp of emps) {
        if (emp.accepted_at && !emp.removed_at) {
          // Prefer display_name, fall back to email/phone
          const name: string | null = emp.display_name
            || emp.email
            || (emp.phone ? formatPhoneForDisplay(emp.phone) : null)
          if (name && !seen.has(name.toLowerCase())) {
            seen.add(name.toLowerCase())
            people.push({ name, isCurrentUser: emp.user_id === currentUserId })
          }
        }
      }

      // Sort current user to the top
      people.sort((a, b) => {
        if (a.isCurrentUser && !b.isCurrentUser) return -1
        if (!a.isCurrentUser && b.isCurrentUser) return 1
        return 0
      })
      setShopEmployees(people)
    } catch {
      // Non-critical — manual entry still works
    }
  }

  function formatPhoneForDisplay(digits: string): string {
    const clean = digits.replace(/^1/, '')
    if (clean.length === 10) {
      return `(${clean.slice(0, 3)}) ${clean.slice(3, 6)}-${clean.slice(6)}`
    }
    return digits
  }

  function toggleTech(name: string) {
    setSelectedTechs((prev) =>
      prev.includes(name) ? prev.filter((t) => t !== name) : [...prev, name]
    )
  }

  function addManualTech() {
    const trimmed = manualTechName.trim()
    if (trimmed && !selectedTechs.includes(trimmed)) {
      setSelectedTechs((prev) => [...prev, trimmed])
    }
    setManualTechName('')
  }

  function removeTech(name: string) {
    setSelectedTechs((prev) => prev.filter((t) => t !== name))
  }

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function stopCamera() {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current)
      scanIntervalRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    setIsCameraActive(false)
  }

  function scanWithJsQR() {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.readyState < 2) return

    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'dontInvert',
    })

    if (code) {
      const match = code.data.match(/\/i\/([A-Za-z0-9]+)/)
      if (match) {
        stopCamera()
        lookupItem(match[1])
      }
    }
  }

  async function startCamera() {
    setCameraError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setIsCameraActive(true)

      // Scan using jsQR (works on all browsers including iOS Safari)
      scanIntervalRef.current = setInterval(scanWithJsQR, 300)
    } catch {
      setCameraError('Camera access denied. Please allow camera access to scan stickers.')
    }
  }

  const lookupItem = useCallback(async (code: string) => {
    setError(null)
    setIsLookingUp(true)

    try {
      const res = await fetch(`/api/sticker-lookup?code=${encodeURIComponent(code)}`)
      const body = await res.json()

      if (!res.ok) {
        setError(body.error || 'Lookup failed.')
        setIsLookingUp(false)
        return
      }

      setItem(body.item)
      setStep('confirm')
    } catch {
      setError('Something went wrong looking up the sticker.')
    } finally {
      setIsLookingUp(false)
    }
  }, [])

  function updateLineItem(index: number, updates: Partial<LineItemForm>) {
    setLineItems((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], ...updates }
      return next
    })
  }

  function removeLineItem(index: number) {
    setLineItems((prev) => prev.filter((_, i) => i !== index))
  }

  function addLineItem() {
    setLineItems((prev) => [...prev, emptyLineItem()])
  }

  async function handleSubmitVisit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    // Validate line items
    const validItems = lineItems.filter((li) => li.title.trim() !== '')
    if (validItems.length === 0) {
      setError('Add at least one service line item with a title.')
      return
    }

    setIsSubmitting(true)

    try {
      const supabase = createBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setError('Session expired'); setIsSubmitting(false); return }

      const payload = {
        item_id: item!.id,
        service_date: serviceDate,
        mileage_at_service: mileage ? parseInt(mileage, 10) : undefined,
        technicians: selectedTechs.length > 0 ? selectedTechs : undefined,
        line_items: validItems.map((li) => {
          const costVal = li.cost_display.trim()
          const cents = costVal ? Math.round(parseFloat(costVal) * 100) : undefined
          return {
            record_type: li.record_type,
            title: li.title.trim(),
            description: li.description?.trim() || undefined,
            cost_cents: cents && !isNaN(cents) ? cents : undefined,
          }
        }),
      }

      const res = await fetch(`/api/items/${item!.id}/service-visit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => null)
        setError(body?.error || `Submission failed (${res.status})`)
        setIsSubmitting(false)
        return
      }

      setStep('success')
    } catch {
      setError('Something went wrong.')
    } finally {
      setIsSubmitting(false)
    }
  }

  function resetForm() {
    setStep('scan')
    setItem(null)
    setServiceDate(new Date().toISOString().split('T')[0])
    setMileage('')
    setLineItems([emptyLineItem()])
    setSelectedTechs([])
    setManualTechName('')
    setError(null)
  }

  function itemLabel(): string {
    if (!item) return ''
    const parts: string[] = []
    if (item.year) parts.push(String(item.year))
    if (item.make) parts.push(item.make)
    if (item.model) parts.push(item.model)
    if (parts.length > 0) return parts.join(' ')
    return item.name || 'Unnamed Item'
  }

  // --- STEP: SUCCESS ---
  if (step === 'success') {
    return (
      <div className="py-12 text-center">
        <div className="text-5xl mb-4">✅</div>
        <h1 className="text-2xl font-bold text-text-primary mb-2">Service Submitted!</h1>
        <p className="text-text-secondary mb-6">
          {lineItems.filter((li) => li.title.trim()).length} record(s) logged for {itemLabel()}.
          The owner has been notified.
        </p>
        <div className="flex gap-3 justify-center">
          <button onClick={resetForm} className="btn-primary">
            Submit Another
          </button>
          <a href="/shop/history" className="btn-secondary">
            View History
          </a>
        </div>
      </div>
    )
  }

  // --- STEP: CONFIRM ITEM ---
  if (step === 'confirm' && item) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-text-primary mb-6">Confirm Item</h1>

        <div className="card-static p-6 text-center">
          <p className="text-text-tertiary text-sm mb-2">Service Visit</p>
          <p className="text-xl font-bold text-text-primary mb-1">{itemLabel()}</p>
          {item.owner_name && (
            <p className="text-text-secondary">Owner: {item.owner_name}</p>
          )}

          <p className="text-text-tertiary text-sm mt-4 mb-6">Is this the right item?</p>

          <div className="flex gap-3 justify-center">
            <button onClick={() => setStep('form')} className="btn-primary">
              Yes, Log Service
            </button>
            <button onClick={resetForm} className="btn-secondary">
              Cancel
            </button>
          </div>
        </div>
      </div>
    )
  }

  // --- STEP: SERVICE FORM ---
  if (step === 'form' && item) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-text-primary">Log Service</h1>
          <p className="text-text-secondary text-sm mt-1">
            {itemLabel()}
            {item.owner_name && ` — ${item.owner_name}`}
          </p>
        </div>

        {error && (
          <div className="bg-error/10 border border-error/30 rounded-xl p-4 mb-4">
            <p className="text-error text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmitVisit} className="space-y-6">
          {/* Visit-level fields */}
          <div className="card-static p-5">
            <h2 className="text-sm font-semibold text-text-primary mb-3">Visit Details</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-text-tertiary mb-1">Date of Service</label>
                <input
                  type="date"
                  value={serviceDate}
                  onChange={(e) => setServiceDate(e.target.value)}
                  className="input text-sm text-[16px] !w-auto"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-text-tertiary mb-1">Mileage / Hours</label>
                <input
                  type="number"
                  value={mileage}
                  onChange={(e) => setMileage(e.target.value)}
                  placeholder="Optional"
                  className="input text-sm"
                  min={0}
                />
              </div>

              {/* Technician picker */}
              <div>
                <label className="block text-xs text-text-tertiary mb-1">Who Worked On This?</label>

                {/* Selected tech chips */}
                {selectedTechs.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {selectedTechs.map((tech) => (
                      <span
                        key={tech}
                        className="inline-flex items-center gap-1 bg-accent/15 text-accent text-xs font-medium px-2 py-1 rounded-full"
                      >
                        {tech}
                        <button
                          type="button"
                          onClick={() => removeTech(tech)}
                          className="hover:text-error transition-colors text-[10px] leading-none"
                          aria-label={`Remove ${tech}`}
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Employee dropdown */}
                {shopEmployees.length > 0 && (
                  <div className="relative mb-2">
                    <button
                      type="button"
                      onClick={() => setShowTechDropdown(!showTechDropdown)}
                      className="input text-sm text-left w-full flex items-center justify-between"
                    >
                      <span className="text-text-tertiary">Select from employees...</span>
                      <span className="text-text-tertiary text-xs">{showTechDropdown ? '▲' : '▼'}</span>
                    </button>
                    {showTechDropdown && (
                      <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-bg-primary border border-border-subtle rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {shopEmployees.map((emp) => {
                          const isSelected = selectedTechs.includes(emp.name)
                          return (
                            <button
                              key={emp.name}
                              type="button"
                              onClick={() => { toggleTech(emp.name); setShowTechDropdown(false) }}
                              className={`w-full px-3 py-2 text-left text-sm hover:bg-bg-elevated transition-colors ${
                                isSelected ? 'text-accent font-medium' : 'text-text-primary'
                              }`}
                            >
                              {isSelected && '✓ '}{emp.name}{emp.isCurrentUser && ' (You)'}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Manual entry */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualTechName}
                    onChange={(e) => setManualTechName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); addManualTech() }
                    }}
                    placeholder="Or type a name and press Enter"
                    className="input text-sm flex-1"
                    maxLength={100}
                  />
                  {manualTechName.trim() && (
                    <button
                      type="button"
                      onClick={addManualTech}
                      className="text-xs text-accent font-medium hover:text-accent-secondary transition-colors whitespace-nowrap"
                    >
                      + Add
                    </button>
                  )}
                </div>
                <p className="text-text-tertiary text-xs mt-1">Optional — choose employees or add names manually.</p>
              </div>
            </div>
          </div>

          {/* Line items */}
          <div>
            <h2 className="text-sm font-semibold text-text-primary mb-3">Services Performed</h2>
            <div className="space-y-3">
              {lineItems.map((li, idx) => (
                <div key={idx} className="card-static p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium text-text-tertiary">
                      Line Item {idx + 1}
                    </span>
                    {lineItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeLineItem(idx)}
                        className="text-xs text-text-tertiary hover:text-error transition-colors"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-text-tertiary mb-1">Type</label>
                        <select
                          value={li.record_type}
                          onChange={(e) => updateLineItem(idx, { record_type: e.target.value as MaintenanceRecordType })}
                          className="input text-sm"
                        >
                          {RECORD_TYPES.map((rt) => (
                            <option key={rt.value} value={rt.value}>{rt.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-text-tertiary mb-1">Cost ($)</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={li.cost_display}
                          onChange={(e) => {
                            const val = e.target.value
                            if (val === '' || /^\d*\.?\d{0,2}$/.test(val)) {
                              updateLineItem(idx, { cost_display: val })
                            }
                          }}
                          placeholder="0.00"
                          className="input text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-text-tertiary mb-1">Title</label>
                      <input
                        type="text"
                        value={li.title}
                        onChange={(e) => updateLineItem(idx, { title: e.target.value })}
                        placeholder="e.g., Oil Change"
                        className="input text-sm"
                        required
                        maxLength={200}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-text-tertiary mb-1">Description (optional)</label>
                      <textarea
                        value={li.description || ''}
                        onChange={(e) => updateLineItem(idx, { description: e.target.value })}
                        placeholder="e.g., Full synthetic, Mobil 1 5W-30, new filter"
                        className="input text-sm resize-none"
                        rows={2}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addLineItem}
              className="mt-3 text-sm text-accent hover:text-accent-secondary transition-colors font-medium"
            >
              + Add another service
            </button>
          </div>

          {/* Submit */}
          <div className="flex gap-3">
            <button type="submit" disabled={isSubmitting} className="btn-primary">
              {isSubmitting ? 'Submitting...' : `Submit ${lineItems.filter((li) => li.title.trim()).length} Record(s)`}
            </button>
            <button type="button" onClick={resetForm} className="btn-secondary">
              Cancel
            </button>
          </div>
        </form>
      </div>
    )
  }

  // --- STEP: SCAN ---
  return (
    <div>
      <h1 className="text-2xl font-bold text-text-primary mb-6">Submit Service</h1>

      {error && (
        <div className="bg-error/10 border border-error/30 rounded-xl p-4 mb-4">
          <p className="text-error text-sm">{error}</p>
        </div>
      )}

      {/* Camera scanner */}
      <div className="card-static p-5 mb-6">
        <h2 className="text-sm font-semibold text-text-primary mb-3">Scan QR Sticker</h2>

        <div className="relative aspect-[4/3] bg-black rounded-lg overflow-hidden mb-3">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
          />
          <canvas ref={canvasRef} className="hidden" />
          {!isCameraActive && (
            <div className="absolute inset-0 flex items-center justify-center">
              <button onClick={startCamera} className="btn-primary">
                Open Camera
              </button>
            </div>
          )}
          {isCameraActive && (
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-[15%] border-2 border-white/50 rounded-xl" />
            </div>
          )}
        </div>

        {cameraError && (
          <p className="text-warning text-xs mb-3">{cameraError}</p>
        )}

        {isCameraActive && (
          <button onClick={stopCamera} className="text-xs text-text-tertiary hover:text-text-secondary transition-colors">
            Stop Camera
          </button>
        )}
      </div>

    </div>
  )
}
