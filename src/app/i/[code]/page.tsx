'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { CATEGORIES, CATEGORY_EMOJI } from '@/lib/constants'
import { compressImage, formatFileSize } from '@/lib/image-utils'
import Link from 'next/link'
import type { MaintenanceRecord, MaintenanceRecordType } from '@/lib/types'

interface Sticker {
  id: string
  short_code: string
  status: string
  item_id: string | null
}

interface PhotoMetadata {
  id: string
  storage_path: string
  uploaded_at: string
}

interface Item {
  id: string
  owner_id: string | null
  category: string
  make: string
  model: string
  year: number
  nickname: string | null
  public_notes: string | null
  contact_phone: string | null
  contact_email: string | null
  show_contact: boolean
  photos: PhotoMetadata[]
}

const RECORD_TYPES: { value: MaintenanceRecordType; label: string; emoji: string }[] = [
  { value: 'service', label: 'Service', emoji: '🔧' },
  { value: 'repair', label: 'Repair', emoji: '🛠️' },
  { value: 'upgrade', label: 'Upgrade', emoji: '⬆️' },
  { value: 'inspection', label: 'Inspection', emoji: '🔍' },
  { value: 'diagnostic', label: 'Diagnostic', emoji: '🩺' },
  { value: 'other', label: 'Other', emoji: '📝' },
]

const RECORD_TYPE_EMOJI: Record<string, string> = Object.fromEntries(
  RECORD_TYPES.map((t) => [t.value, t.emoji])
)

function formatCost(cents: number): string {
  return '$' + (cents / 100).toFixed(2)
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL

function LoadingBullseye() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-primary">
      <div className="text-accent animate-pulse-bullseye">
        <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
          <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="1.5" opacity="0.6"/>
          <circle cx="12" cy="12" r="2" fill="currentColor"/>
        </svg>
      </div>
    </div>
  )
}

export default function ScanPage() {
  const params = useParams()
  const router = useRouter()
  const { user, isLoading: authLoading } = useAuth()
  const code = params.code as string
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [loading, setLoading] = useState(true)
  const [sticker, setSticker] = useState<Sticker | null>(null)
  const [item, setItem] = useState<Item | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    category: '',
    make: '',
    model: '',
    year: '',
    nickname: '',
    public_notes: '',
    contact_phone: '',
    contact_email: '',
    show_contact: false,
  })
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Maintenance state
  const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceRecord[]>([])
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false)
  const [maintenanceLoading, setMaintenanceLoading] = useState(false)
  const [maintenanceSaving, setMaintenanceSaving] = useState(false)
  const [maintenanceError, setMaintenanceError] = useState<string | null>(null)
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null)
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null)
  const [editRecordForm, setEditRecordForm] = useState({
    record_type: 'service' as MaintenanceRecordType,
    title: '',
    description: '',
    service_date: '',
    cost: '',
    mileage: '',
    provider: '',
  })
  const [editRecordSaving, setEditRecordSaving] = useState(false)
  const [editRecordError, setEditRecordError] = useState<string | null>(null)
  const [shopNames, setShopNames] = useState<Record<string, { name: string; verified: boolean }>>({})
  const [disputeRecordId, setDisputeRecordId] = useState<string | null>(null)
  const [disputeReason, setDisputeReason] = useState('')
  const [disputeSubmitting, setDisputeSubmitting] = useState(false)
  const [maintenanceForm, setMaintenanceForm] = useState({
    record_type: 'service' as MaintenanceRecordType,
    title: '',
    description: '',
    service_date: new Date().toISOString().split('T')[0],
    cost: '',
    mileage: '',
    provider: '',
  })

  // Photo upload state
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [compressionInfo, setCompressionInfo] = useState<string | null>(null)

  useEffect(() => {
    async function lookupSticker() {
      const { data: stickerData, error: stickerError } = await supabase
        .from('stickers')
        .select('*')
        .eq('short_code', code)
        .single()

      if (stickerError || !stickerData) {
        setError('Sticker not found. Check the code and try again.')
        setLoading(false)
        return
      }

      setSticker(stickerData)

      if (stickerData.status === 'active' && stickerData.item_id) {
        const { data: itemData } = await supabase
          .from('items')
          .select('*')
          .eq('id', stickerData.item_id)
          .single()

        if (itemData) {
          setItem({
            ...itemData,
            photos: itemData.photos || [],
          })

          // Fetch maintenance records
          try {
            const res = await fetch(`/api/maintenance?item_id=${stickerData.item_id}`)
            if (res.ok) {
              const data = await res.json()
              const records: MaintenanceRecord[] = data.records || []
              setMaintenanceRecords(records)

              // Fetch shop names for any shop-submitted records
              const shopIds = [...new Set(records.filter((r) => r.performed_by_shop).map((r) => r.performed_by_shop!))]
              if (shopIds.length > 0) {
                const { data: shops } = await supabase
                  .from('shops')
                  .select('id, name, verified')
                  .in('id', shopIds)
                if (shops) {
                  const nameMap: Record<string, { name: string; verified: boolean }> = {}
                  for (const s of shops) {
                    nameMap[s.id] = { name: s.name, verified: s.verified }
                  }
                  setShopNames(nameMap)
                }
              }
            }
          } catch {
            // Non-fatal — page still works without records
          }
        }
      }

      setLoading(false)
    }

    lookupSticker()
  }, [code])

  // ---- Edit handlers ----

  function startEditing() {
    if (!item) return
    setEditForm({
      category: item.category,
      make: item.make,
      model: item.model,
      year: String(item.year),
      nickname: item.nickname || '',
      public_notes: item.public_notes || '',
      contact_phone: item.contact_phone || '',
      contact_email: item.contact_email || '',
      show_contact: item.show_contact || false,
    })
    setEditError(null)
    setSaveSuccess(false)
    setIsEditing(true)
  }

  function cancelEditing() {
    setIsEditing(false)
    setEditError(null)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!item) return

    setSaving(true)
    setEditError(null)

    const yearNum = parseInt(editForm.year)
    if (!yearNum || yearNum < 1900 || yearNum > new Date().getFullYear() + 1) {
      setEditError('Please enter a valid year (1900–' + (new Date().getFullYear() + 1) + ')')
      setSaving(false)
      return
    }

    if (!editForm.make.trim()) {
      setEditError('Make is required')
      setSaving(false)
      return
    }

    if (!editForm.model.trim()) {
      setEditError('Model is required')
      setSaving(false)
      return
    }

    try {
      const { error: updateError } = await supabase
        .from('items')
        .update({
          category: editForm.category,
          make: editForm.make.trim(),
          model: editForm.model.trim(),
          year: yearNum,
          nickname: editForm.nickname.trim() || null,
          public_notes: editForm.public_notes.trim() || null,
          contact_phone: editForm.contact_phone.trim() || null,
          contact_email: editForm.contact_email.trim() || null,
          show_contact: editForm.show_contact,
        })
        .eq('id', item.id)

      if (updateError) throw new Error(updateError.message)

      setItem({
        ...item,
        category: editForm.category,
        make: editForm.make.trim(),
        model: editForm.model.trim(),
        year: yearNum,
        nickname: editForm.nickname.trim() || null,
        public_notes: editForm.public_notes.trim() || null,
        contact_phone: editForm.contact_phone.trim() || null,
        contact_email: editForm.contact_email.trim() || null,
        show_contact: editForm.show_contact,
      })

      setIsEditing(false)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  // ---- Photo handlers ----

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    e.target.value = ''

    if (!file.type.startsWith('image/')) {
      setUploadError('Please select an image file (JPEG, PNG, etc.)')
      return
    }

    if (file.size > 15 * 1024 * 1024) {
      setUploadError('Image is too large (max 15MB)')
      return
    }

    setUploadError(null)
    setSelectedFile(file)
    setCompressionInfo(null)

    const reader = new FileReader()
    reader.onload = () => setPreviewUrl(reader.result as string)
    reader.readAsDataURL(file)
  }

  function cancelUpload() {
    setSelectedFile(null)
    setPreviewUrl(null)
    setCompressionInfo(null)
    setUploadError(null)
  }

  async function handlePhotoUpload() {
    if (!selectedFile || !item) return

    setIsUploading(true)
    setUploadError(null)

    try {
      const result = await compressImage(selectedFile)
      setCompressionInfo(
        `${formatFileSize(selectedFile.size)} → ${formatFileSize(result.blob.size)} (${result.width}×${result.height})`
      )

      const photoId = crypto.randomUUID()
      const storagePath = `${item.id}/${photoId}.jpg`

      const { error: storageError } = await supabase.storage
        .from('item-photos')
        .upload(storagePath, result.blob, {
          cacheControl: '3600',
          contentType: 'image/jpeg',
          upsert: false,
        })

      if (storageError) throw new Error(storageError.message)

      const newPhoto: PhotoMetadata = {
        id: photoId,
        storage_path: storagePath,
        uploaded_at: new Date().toISOString(),
      }

      const updatedPhotos = [...(item.photos || []), newPhoto]

      const { error: updateError } = await supabase
        .from('items')
        .update({ photos: updatedPhotos })
        .eq('id', item.id)

      if (updateError) throw new Error(updateError.message)

      setItem({ ...item, photos: updatedPhotos })
      setSelectedFile(null)
      setPreviewUrl(null)
      setCompressionInfo(null)
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setIsUploading(false)
    }
  }

  async function handleDeletePhoto(photoId: string) {
    if (!item) return
    if (!window.confirm('Delete this photo?')) return

    try {
      const photo = item.photos.find((p) => p.id === photoId)
      if (!photo) return

      const { error: storageError } = await supabase.storage
        .from('item-photos')
        .remove([photo.storage_path])

      if (storageError) throw new Error(storageError.message)

      const updatedPhotos = item.photos.filter((p) => p.id !== photoId)

      const { error: updateError } = await supabase
        .from('items')
        .update({ photos: updatedPhotos })
        .eq('id', item.id)

      if (updateError) throw new Error(updateError.message)

      setItem({ ...item, photos: updatedPhotos })
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to delete photo')
    }
  }

  function getPhotoUrl(storagePath: string) {
    return `${SUPABASE_URL}/storage/v1/object/public/item-photos/${storagePath}`
  }

  // ---- Maintenance handlers ----

  const scrollYRef = useRef(0)

  function openMaintenanceModal() {
    setMaintenanceForm({
      record_type: 'service',
      title: '',
      description: '',
      service_date: new Date().toISOString().split('T')[0],
      cost: '',
      mileage: '',
      provider: '',
    })
    setMaintenanceError(null)
    // iOS WebKit scroll lock — position:fixed is the only thing that works
    scrollYRef.current = window.scrollY
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollYRef.current}px`
    document.body.style.left = '0'
    document.body.style.right = '0'
    document.body.style.width = '100%'
    setShowMaintenanceModal(true)
  }

  function closeMaintenanceModal() {
    setShowMaintenanceModal(false)
    document.body.style.position = ''
    document.body.style.top = ''
    document.body.style.left = ''
    document.body.style.right = ''
    document.body.style.width = ''
    window.scrollTo(0, scrollYRef.current)
  }

  async function handleMaintenanceSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!item) return

    setMaintenanceSaving(true)
    setMaintenanceError(null)

    try {
      const costCents = maintenanceForm.cost
        ? Math.round(parseFloat(maintenanceForm.cost) * 100)
        : undefined
      const mileage = maintenanceForm.mileage
        ? parseInt(maintenanceForm.mileage)
        : undefined

      const res = await fetch('/api/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_id: item.id,
          record_type: maintenanceForm.record_type,
          title: maintenanceForm.title,
          description: maintenanceForm.description || undefined,
          service_date: maintenanceForm.service_date,
          cost_cents: costCents,
          mileage,
          provider: maintenanceForm.provider || undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create record')
      }

      const data = await res.json()
      setMaintenanceRecords([data.record, ...maintenanceRecords])
      closeMaintenanceModal()
    } catch (err) {
      setMaintenanceError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setMaintenanceSaving(false)
    }
  }

  async function handleDeleteRecord(recordId: string) {
    if (!window.confirm('Delete this maintenance record?')) return

    try {
      const res = await fetch(`/api/maintenance/${recordId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      setMaintenanceRecords(maintenanceRecords.filter((r) => r.id !== recordId))
      if (expandedRecordId === recordId) setExpandedRecordId(null)
    } catch (err) {
      console.error('Delete record error:', err)
    }
  }

  async function handleDisputeRecord(recordId: string) {
    if (!disputeReason.trim()) return
    setDisputeSubmitting(true)

    try {
      const res = await fetch(`/api/maintenance/${recordId}/dispute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: disputeReason.trim() }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        alert(data?.error || 'Failed to file dispute')
        setDisputeSubmitting(false)
        return
      }

      // Remove the disputed record from view
      setMaintenanceRecords(maintenanceRecords.filter((r) => r.id !== recordId))
      setDisputeRecordId(null)
      setDisputeReason('')
      if (expandedRecordId === recordId) setExpandedRecordId(null)
    } catch {
      alert('Something went wrong filing the dispute.')
    } finally {
      setDisputeSubmitting(false)
    }
  }

  function toggleExpandRecord(recordId: string) {
    if (editingRecordId) return // don't collapse while editing
    setExpandedRecordId(expandedRecordId === recordId ? null : recordId)
  }

  function startEditingRecord(record: MaintenanceRecord) {
    setEditRecordForm({
      record_type: record.record_type,
      title: record.title,
      description: record.description || '',
      service_date: record.service_date,
      cost: record.cost_cents != null ? (record.cost_cents / 100).toFixed(2) : '',
      mileage: record.mileage_at_service != null ? String(record.mileage_at_service) : (record.mileage != null ? String(record.mileage) : ''),
      provider: record.provider || '',
    })
    setEditRecordError(null)
    setEditingRecordId(record.id)
  }

  function cancelEditingRecord() {
    setEditingRecordId(null)
    setEditRecordError(null)
  }

  async function handleEditRecordSubmit(e: React.FormEvent, recordId: string) {
    e.preventDefault()
    setEditRecordSaving(true)
    setEditRecordError(null)

    try {
      const costCents = editRecordForm.cost
        ? Math.round(parseFloat(editRecordForm.cost) * 100)
        : undefined
      const mileage = editRecordForm.mileage
        ? parseInt(editRecordForm.mileage)
        : undefined

      const res = await fetch(`/api/maintenance/${recordId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          record_type: editRecordForm.record_type,
          title: editRecordForm.title,
          description: editRecordForm.description || undefined,
          service_date: editRecordForm.service_date,
          cost_cents: costCents ?? null,
          mileage: mileage ?? null,
          provider: editRecordForm.provider || undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update record')
      }

      const data = await res.json()
      setMaintenanceRecords(maintenanceRecords.map((r) => r.id === recordId ? data.record : r))
      setEditingRecordId(null)
    } catch (err) {
      setEditRecordError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setEditRecordSaving(false)
    }
  }

  // ---- Render ----

  if (loading || authLoading) {
    return <LoadingBullseye />
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-primary p-4">
        <div className="bg-error/10 border border-error/30 rounded-2xl p-8 max-w-md text-center animate-fade-in">
          <div className="w-14 h-14 rounded-full bg-error/10 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-error" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <h1 className="text-error text-xl font-bold mb-2">Error</h1>
          <p className="text-text-secondary">{error}</p>
        </div>
      </div>
    )
  }

  // Unclaimed sticker
  if (sticker?.status === 'unregistered') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-primary p-4">
        <div className="card-static p-8 max-w-md w-full text-center animate-fade-in">
          <div className="w-20 h-20 rounded-full bg-accent-muted flex items-center justify-center mx-auto mb-5">
            <svg className="w-10 h-10 text-accent" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-text-primary mb-2">Unclaimed Sticker</h1>
          <p className="text-text-secondary mb-4">
            This sticker hasn&apos;t been registered yet. Claim it to start tracking your item.
          </p>
          <p className="text-text-tertiary text-sm mb-6 font-mono">{code}</p>
          {user ? (
            <button
              onClick={() => router.push(`/claim/${code}`)}
              className="btn-primary w-full"
            >
              Claim This Sticker
            </button>
          ) : (
            <Link
              href={`/auth?redirect=/claim/${code}`}
              className="btn-primary w-full block text-center"
            >
              Sign In to Claim
            </Link>
          )}
        </div>
      </div>
    )
  }

  // Claimed sticker - show item details (or edit form)
  if (item) {
    const isOwner = user?.id === item.owner_id
    const emoji = CATEGORY_EMOJI[item.category] || '🔧'
    const hasContactInfo = item.show_contact && (item.contact_phone || item.contact_email)
    const hasPhotos = item.photos && item.photos.length > 0

    return (
      <div className="min-h-screen bg-bg-primary p-4">
        <div className="max-w-2xl mx-auto pt-4 animate-fade-in">
          <div className="card-static p-6">
            {/* Owner badge */}
            {isOwner && !isEditing && (
              <div className="badge badge-accent mb-4">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                <span>Your Item</span>
              </div>
            )}

            {/* Save success toast */}
            {saveSuccess && (
              <div className="badge badge-success mb-4">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                <span>Changes saved</span>
              </div>
            )}

            {isEditing ? (
              /* ============ EDIT MODE ============ */
              <form onSubmit={handleSave} className="space-y-5">
                <div className="flex items-center justify-between mb-2">
                  <h1 className="text-xl font-bold text-text-primary">Edit Item</h1>
                  <button
                    type="button"
                    onClick={cancelEditing}
                    className="text-text-tertiary hover:text-text-primary text-sm transition-colors"
                  >
                    Cancel
                  </button>
                </div>

                {editError && (
                  <div className="bg-error/10 border border-error/30 rounded-xl p-4">
                    <p className="text-error text-sm">{editError}</p>
                  </div>
                )}

                {/* Category */}
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-3">
                    What is it?
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat.value}
                        type="button"
                        onClick={() => setEditForm({ ...editForm, category: cat.value })}
                        className={`p-3 rounded-xl border transition-all ${
                          editForm.category === cat.value
                            ? 'border-accent bg-accent-muted shadow-[0_0_0_1px_var(--accent-primary)]'
                            : 'border-border-default bg-bg-tertiary hover:bg-bg-elevated'
                        }`}
                      >
                        <div className="text-2xl mb-1">{cat.emoji}</div>
                        <div className={`text-xs ${editForm.category === cat.value ? 'text-accent' : 'text-text-secondary'}`}>
                          {cat.label}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Boat name */}
                {editForm.category === 'boat' && (
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">
                      Boat Name <span className="text-text-tertiary">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={editForm.nickname}
                      onChange={(e) => setEditForm({ ...editForm, nickname: e.target.value })}
                      placeholder='e.g., Knot Today, Sea La Vie'
                      className="input"
                    />
                  </div>
                )}

                {/* Year */}
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">Year</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    value={editForm.year}
                    onChange={(e) => setEditForm({ ...editForm, year: e.target.value.replace(/[^0-9]/g, '') })}
                    placeholder="e.g., 2019"
                    className="input"
                    required
                  />
                </div>

                {/* Make */}
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">Make</label>
                  <input
                    type="text"
                    value={editForm.make}
                    onChange={(e) => setEditForm({ ...editForm, make: e.target.value })}
                    placeholder="e.g., Ford, Yamaha, Honda"
                    className="input"
                    required
                  />
                </div>

                {/* Model */}
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">Model</label>
                  <input
                    type="text"
                    value={editForm.model}
                    onChange={(e) => setEditForm({ ...editForm, model: e.target.value })}
                    placeholder="e.g., F-150, 242X, Civic"
                    className="input"
                    required
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    Public Notes <span className="text-text-tertiary">(optional)</span>
                  </label>
                  <textarea
                    value={editForm.public_notes}
                    onChange={(e) => setEditForm({ ...editForm, public_notes: e.target.value })}
                    placeholder="Anything you want people to see when they scan..."
                    rows={3}
                    className="input"
                  />
                </div>

                {/* Contact Info Section */}
                <div className="border-t border-border-subtle pt-5">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-text-secondary">
                      Contact Info
                    </label>
                    <button
                      type="button"
                      onClick={() => setEditForm({ ...editForm, show_contact: !editForm.show_contact })}
                      className={`toggle ${editForm.show_contact ? 'toggle-on' : 'toggle-off'}`}
                    >
                      <span className={`toggle-knob ${editForm.show_contact ? 'toggle-knob-on' : 'toggle-knob-off'}`} />
                    </button>
                  </div>
                  <p className="text-text-tertiary text-xs mb-3">
                    {editForm.show_contact
                      ? 'Your contact info will be visible to anyone who scans this sticker.'
                      : 'Contact info is hidden. Toggle on to let people reach you.'}
                  </p>

                  {editForm.show_contact && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">
                          Phone <span className="text-text-tertiary">(optional)</span>
                        </label>
                        <input
                          type="tel"
                          value={editForm.contact_phone}
                          onChange={(e) => setEditForm({ ...editForm, contact_phone: e.target.value })}
                          placeholder="e.g., (555) 123-4567"
                          className="input"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">
                          Email <span className="text-text-tertiary">(optional)</span>
                        </label>
                        <input
                          type="email"
                          value={editForm.contact_email}
                          onChange={(e) => setEditForm({ ...editForm, contact_email: e.target.value })}
                          placeholder="e.g., you@example.com"
                          className="input"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Save / Cancel buttons */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="btn-primary flex-1"
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    type="button"
                    onClick={cancelEditing}
                    disabled={saving}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              /* ============ VIEW MODE ============ */
              <>
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 rounded-xl bg-accent-muted flex items-center justify-center text-3xl flex-shrink-0">
                    {emoji}
                  </div>
                  <div>
                    {item.nickname && (
                      <p className="text-accent font-medium text-sm italic mb-0.5">&ldquo;{item.nickname}&rdquo;</p>
                    )}
                    <h1 className="text-2xl font-bold text-text-primary">
                      {item.year} {item.make} {item.model}
                    </h1>
                    <p className="text-text-tertiary capitalize text-sm">{item.category}</p>
                  </div>
                </div>

                {/* Photo gallery */}
                {hasPhotos && (
                  <div className="mb-5">
                    <h2 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-3">Photos</h2>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {item.photos.map((photo) => (
                        <div key={photo.id} className="relative group aspect-square rounded-xl overflow-hidden bg-bg-tertiary border border-border-subtle">
                          <img
                            src={getPhotoUrl(photo.storage_path)}
                            alt="Item photo"
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                          {isOwner && (
                            <button
                              onClick={() => handleDeletePhoto(photo.id)}
                              className="absolute top-2 right-2 bg-black/60 hover:bg-error text-white rounded-full w-8 h-8 flex items-center justify-center text-sm opacity-0 group-hover:opacity-100 touch-visible transition-all"
                              title="Delete photo"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {item.public_notes && (
                  <div className="bg-bg-tertiary rounded-xl p-4 mb-4 border border-border-subtle">
                    <h2 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2">Notes</h2>
                    <p className="text-text-secondary leading-relaxed">{item.public_notes}</p>
                  </div>
                )}

                {/* Public contact info */}
                {hasContactInfo && (
                  <div className="bg-bg-tertiary rounded-xl p-4 mb-4 border border-border-subtle">
                    <h2 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-3">Contact Owner</h2>
                    <div className="flex flex-col gap-2">
                      {item.contact_phone && (
                        <a
                          href={`tel:${item.contact_phone}`}
                          className="inline-flex items-center gap-2 text-accent hover:text-accent-secondary transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                          </svg>
                          <span>{item.contact_phone}</span>
                        </a>
                      )}
                      {item.contact_email && (
                        <a
                          href={`mailto:${item.contact_email}`}
                          className="inline-flex items-center gap-2 text-accent hover:text-accent-secondary transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                          </svg>
                          <span>{item.contact_email}</span>
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {/* Maintenance History — visible to everyone */}
                {maintenanceRecords.length > 0 && (
                  <div className="mb-5">
                    <h2 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-3">
                      Service History ({maintenanceRecords.length})
                    </h2>
                    <div className="space-y-2">
                      {maintenanceRecords.map((record) => {
                        const isExpanded = expandedRecordId === record.id
                        const isEditingThis = editingRecordId === record.id

                        return (
                          <div
                            key={record.id}
                            className={`bg-bg-tertiary rounded-xl border transition-all ${
                              isExpanded ? 'border-accent/30 shadow-sm' : 'border-border-subtle'
                            }`}
                          >
                            {/* Collapsed row — always visible, clickable */}
                            <div
                              onClick={() => toggleExpandRecord(record.id)}
                              className="flex items-start justify-between gap-2 p-4 cursor-pointer"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-lg flex-shrink-0">{RECORD_TYPE_EMOJI[record.record_type] || '📝'}</span>
                                <div className="min-w-0">
                                  <p className="text-text-primary font-medium truncate">{record.title}</p>
                                  <p className="text-text-tertiary text-xs">
                                    {formatDate(record.service_date)}
                                    {record.provider && <> &middot; {record.provider}</>}
                                    {record.source === 'shop_submitted' && record.performed_by_shop && shopNames[record.performed_by_shop] && (
                                      <> &middot; <span className="text-accent">{shopNames[record.performed_by_shop].name}</span>
                                        {shopNames[record.performed_by_shop].verified && (
                                          <span className="text-success ml-0.5" title="Verified shop">✓</span>
                                        )}
                                      </>
                                    )}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                {record.cost_cents != null && (
                                  <span className="text-text-secondary text-sm font-medium">
                                    {formatCost(record.cost_cents)}
                                  </span>
                                )}
                                <svg
                                  className={`w-4 h-4 text-text-tertiary transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                  fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                                </svg>
                              </div>
                            </div>

                            {/* Expanded detail */}
                            {isExpanded && !isEditingThis && (
                              <div className="px-4 pb-4 border-t border-border-subtle pt-3 space-y-3">
                                {/* Type badge + shop source */}
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="badge badge-accent !text-xs capitalize">
                                    {record.record_type}
                                  </span>
                                  {record.source === 'shop_submitted' && record.performed_by_shop && shopNames[record.performed_by_shop] && (
                                    <span className="text-xs text-text-secondary">
                                      Submitted by: <span className="text-text-primary font-medium">{shopNames[record.performed_by_shop].name}</span>
                                      {shopNames[record.performed_by_shop].verified && (
                                        <span className="ml-1 text-success" title="Verified shop">✓</span>
                                      )}
                                    </span>
                                  )}
                                </div>

                                {/* Details grid */}
                                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                                  <div>
                                    <p className="text-text-tertiary text-xs">Date</p>
                                    <p className="text-text-primary">{formatDate(record.service_date)}</p>
                                  </div>
                                  {record.cost_cents != null && (
                                    <div>
                                      <p className="text-text-tertiary text-xs">Cost</p>
                                      <p className="text-text-primary">{formatCost(record.cost_cents)}</p>
                                    </div>
                                  )}
                                  {(record.mileage_at_service ?? record.mileage) != null && (
                                    <div>
                                      <p className="text-text-tertiary text-xs">Odometer / Hours</p>
                                      <p className="text-text-primary">{(record.mileage_at_service ?? record.mileage)!.toLocaleString()}</p>
                                    </div>
                                  )}
                                  {record.provider && (
                                    <div>
                                      <p className="text-text-tertiary text-xs">Done by</p>
                                      <p className="text-text-primary">{record.provider}</p>
                                    </div>
                                  )}
                                </div>

                                {/* Description */}
                                {record.description && (
                                  <div>
                                    <p className="text-text-tertiary text-xs mb-1">Notes</p>
                                    <p className="text-text-secondary text-sm leading-relaxed">{record.description}</p>
                                  </div>
                                )}

                                {/* Dispute flow (for shop-submitted records, owner only) */}
                                {isOwner && record.source === 'shop_submitted' && disputeRecordId === record.id && (
                                  <div className="bg-error/5 border border-error/20 rounded-lg p-3 space-y-2">
                                    <p className="text-sm font-medium text-error">Dispute this record?</p>
                                    <p className="text-xs text-text-secondary">This will remove the record from your maintenance history.</p>
                                    <textarea
                                      value={disputeReason}
                                      onChange={(e) => setDisputeReason(e.target.value)}
                                      placeholder="Reason for dispute (required)"
                                      className="input !text-sm resize-none"
                                      rows={2}
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                    <div className="flex gap-2">
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleDisputeRecord(record.id) }}
                                        disabled={disputeSubmitting || !disputeReason.trim()}
                                        className="text-xs font-medium text-error hover:text-red-400 transition-colors disabled:opacity-50"
                                      >
                                        {disputeSubmitting ? 'Submitting...' : 'Confirm Dispute'}
                                      </button>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); setDisputeRecordId(null); setDisputeReason('') }}
                                        className="text-xs text-text-tertiary hover:text-text-secondary transition-colors"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                )}

                                {/* Owner actions */}
                                {isOwner && (
                                  <div className="flex gap-2 pt-1">
                                    {/* Edit/Delete only for owner-submitted records; shop records use Dispute */}
                                    {record.source !== 'shop_submitted' && (
                                      <>
                                        <button
                                          onClick={(e) => { e.stopPropagation(); startEditingRecord(record) }}
                                          className="btn-secondary !py-1.5 !px-3 !text-xs"
                                        >
                                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                                          </svg>
                                          Edit
                                        </button>
                                        <button
                                          onClick={(e) => { e.stopPropagation(); handleDeleteRecord(record.id) }}
                                          className="btn-secondary !py-1.5 !px-3 !text-xs text-error hover:!bg-error/10"
                                        >
                                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                          </svg>
                                          Delete
                                        </button>
                                      </>
                                    )}
                                    {record.source === 'shop_submitted' && disputeRecordId !== record.id && (
                                      <button
                                        onClick={(e) => { e.stopPropagation(); setDisputeRecordId(record.id); setDisputeReason('') }}
                                        className="btn-secondary !py-1.5 !px-3 !text-xs text-warning hover:!bg-warning/10"
                                      >
                                        Dispute
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Inline edit form */}
                            {isExpanded && isEditingThis && (
                              <div className="px-4 pb-4 border-t border-border-subtle pt-3">
                                {editRecordError && (
                                  <div className="bg-error/10 border border-error/30 rounded-xl p-3 mb-3">
                                    <p className="text-error text-sm">{editRecordError}</p>
                                  </div>
                                )}
                                <form onSubmit={(e) => handleEditRecordSubmit(e, record.id)} className="space-y-3">
                                  {/* Type */}
                                  <div className="grid grid-cols-3 gap-1.5">
                                    {RECORD_TYPES.map((type) => (
                                      <button
                                        key={type.value}
                                        type="button"
                                        onClick={() => setEditRecordForm({ ...editRecordForm, record_type: type.value })}
                                        className={`p-1.5 rounded-lg border transition-all text-center ${
                                          editRecordForm.record_type === type.value
                                            ? 'border-accent bg-accent-muted'
                                            : 'border-border-default bg-bg-tertiary'
                                        }`}
                                      >
                                        <div className="text-sm">{type.emoji}</div>
                                        <div className={`text-[10px] ${editRecordForm.record_type === type.value ? 'text-accent' : 'text-text-tertiary'}`}>
                                          {type.label}
                                        </div>
                                      </button>
                                    ))}
                                  </div>

                                  {/* Title */}
                                  <input
                                    type="text"
                                    value={editRecordForm.title}
                                    onChange={(e) => setEditRecordForm({ ...editRecordForm, title: e.target.value })}
                                    placeholder="What was done?"
                                    className="input !text-sm"
                                    required
                                  />

                                  {/* Date + Cost */}
                                  <div className="grid grid-cols-2 gap-2">
                                    <input
                                      type="date"
                                      value={editRecordForm.service_date}
                                      onChange={(e) => setEditRecordForm({ ...editRecordForm, service_date: e.target.value })}
                                      className="input !text-sm"
                                      required
                                    />
                                    <div className="relative">
                                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary text-xs">$</span>
                                      <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={editRecordForm.cost}
                                        onChange={(e) => setEditRecordForm({ ...editRecordForm, cost: e.target.value })}
                                        placeholder="Cost"
                                        className="input !text-sm !pl-6"
                                      />
                                    </div>
                                  </div>

                                  {/* Mileage + Provider */}
                                  <div className="grid grid-cols-2 gap-2">
                                    <input
                                      type="number"
                                      min="0"
                                      value={editRecordForm.mileage}
                                      onChange={(e) => setEditRecordForm({ ...editRecordForm, mileage: e.target.value })}
                                      placeholder="Odometer / Hours"
                                      className="input !text-sm"
                                    />
                                    <input
                                      type="text"
                                      value={editRecordForm.provider}
                                      onChange={(e) => setEditRecordForm({ ...editRecordForm, provider: e.target.value })}
                                      placeholder="Done by"
                                      className="input !text-sm"
                                    />
                                  </div>

                                  {/* Notes */}
                                  <textarea
                                    value={editRecordForm.description}
                                    onChange={(e) => setEditRecordForm({ ...editRecordForm, description: e.target.value })}
                                    placeholder="Notes..."
                                    rows={2}
                                    className="input !text-sm"
                                  />

                                  {/* Save / Cancel */}
                                  <div className="flex gap-2">
                                    <button type="submit" disabled={editRecordSaving} className="btn-primary !py-1.5 !px-3 !text-xs flex-1">
                                      {editRecordSaving ? 'Saving...' : 'Save'}
                                    </button>
                                    <button type="button" onClick={cancelEditingRecord} disabled={editRecordSaving} className="btn-secondary !py-1.5 !px-3 !text-xs">
                                      Cancel
                                    </button>
                                  </div>
                                </form>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Owner actions */}
                {isOwner && (
                  <div className="border-t border-border-subtle pt-5 mt-5">
                    <h2 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-3">Owner Actions</h2>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={startEditing}
                        className="btn-primary !py-2 !px-4 !text-sm"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                        </svg>
                        Edit Item
                      </button>
                      <button
                        onClick={openMaintenanceModal}
                        className="btn-secondary !py-2 !px-4 !text-sm"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                        Add Maintenance Record
                      </button>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="btn-secondary !py-2 !px-4 !text-sm"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                        </svg>
                        {isUploading ? 'Uploading...' : 'Upload Photo'}
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoSelect}
                        className="hidden"
                      />
                    </div>

                    {/* Upload error */}
                    {uploadError && (
                      <div className="bg-error/10 border border-error/30 rounded-xl p-3 mt-3">
                        <p className="text-error text-sm">{uploadError}</p>
                      </div>
                    )}

                    {/* Photo preview + confirm upload */}
                    {previewUrl && selectedFile && (
                      <div className="mt-3 bg-bg-tertiary border border-border-subtle rounded-xl p-4">
                        <div className="flex gap-3 items-start">
                          <img
                            src={previewUrl}
                            alt="Preview"
                            className="w-24 h-24 object-cover rounded-lg"
                          />
                          <div className="flex-1">
                            <p className="text-text-secondary text-sm truncate">{selectedFile.name}</p>
                            <p className="text-text-tertiary text-xs">
                              Original: {formatFileSize(selectedFile.size)}
                            </p>
                            {compressionInfo && (
                              <p className="text-success text-xs mt-1">
                                Compressed: {compressionInfo}
                              </p>
                            )}
                            <div className="flex gap-2 mt-2">
                              <button
                                onClick={handlePhotoUpload}
                                disabled={isUploading}
                                className="btn-primary !py-1.5 !px-3 !text-xs"
                              >
                                {isUploading ? 'Compressing & uploading...' : 'Upload'}
                              </button>
                              <button
                                onClick={cancelUpload}
                                disabled={isUploading}
                                className="btn-secondary !py-1.5 !px-3 !text-xs"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    <p className="text-text-tertiary text-xs mt-3">Ownership transfers &amp; AI assistant coming soon</p>
                  </div>
                )}

                <div className="text-center pt-5 border-t border-border-subtle mt-5">
                  <p className="text-text-tertiary text-sm">
                    Tracked with <span className="text-accent font-semibold">QRSTKR</span>
                  </p>
                </div>

                {/* Maintenance Record — Bottom Sheet */}
                {showMaintenanceModal && (
                  <>
                    <div
                      className="fixed inset-0 z-40 bg-black/50"
                      onClick={closeMaintenanceModal}
                      onTouchMove={(e) => e.preventDefault()}
                    />
                    <div
                      className="fixed inset-x-0 bottom-0 z-50 bg-bg-secondary border-t border-border-default rounded-t-2xl flex flex-col"
                      style={{ maxHeight: 'min(85dvh, 85vh)', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
                    >
                      {/* Drag handle + header */}
                      <div className="flex-shrink-0 pt-3 pb-2 px-5">
                        <div className="w-10 h-1 rounded-full bg-border-default mx-auto mb-3" />
                        <div className="flex items-center justify-between">
                          <h2 className="text-lg font-bold text-text-primary">Add Maintenance Record</h2>
                          <button
                            onClick={closeMaintenanceModal}
                            className="text-text-tertiary hover:text-text-primary transition-colors p-1"
                          >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      {/* Scrollable form content */}
                      <div
                        className="flex-1 overflow-y-auto overflow-x-hidden px-5"
                        style={{ overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch', paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' } as React.CSSProperties}
                      >
                        {maintenanceError && (
                          <div className="bg-error/10 border border-error/30 rounded-xl p-3 mb-4">
                            <p className="text-error text-sm">{maintenanceError}</p>
                          </div>
                        )}

                        <form onSubmit={handleMaintenanceSubmit} className="space-y-4 pb-6">
                          {/* Record Type */}
                          <div>
                            <label className="block text-sm font-medium text-text-secondary mb-2">Type</label>
                            <div className="grid grid-cols-3 gap-2">
                              {RECORD_TYPES.map((type) => (
                                <button
                                  key={type.value}
                                  type="button"
                                  onClick={() => setMaintenanceForm({ ...maintenanceForm, record_type: type.value })}
                                  className={`p-2 rounded-xl border transition-all text-center ${
                                    maintenanceForm.record_type === type.value
                                      ? 'border-accent bg-accent-muted shadow-[0_0_0_1px_var(--accent-primary)]'
                                      : 'border-border-default bg-bg-tertiary hover:bg-bg-elevated'
                                  }`}
                                >
                                  <div className="text-lg">{type.emoji}</div>
                                  <div className={`text-xs ${maintenanceForm.record_type === type.value ? 'text-accent' : 'text-text-secondary'}`}>
                                    {type.label}
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Title */}
                          <div>
                            <label className="block text-sm font-medium text-text-secondary mb-2">
                              What was done? <span className="text-error">*</span>
                            </label>
                            <input
                              type="text"
                              value={maintenanceForm.title}
                              onChange={(e) => setMaintenanceForm({ ...maintenanceForm, title: e.target.value })}
                              placeholder="e.g., Oil change, New impeller, Brake pads"
                              className="input"
                              required
                            />
                          </div>

                          {/* Service Date */}
                          <div>
                            <label className="block text-sm font-medium text-text-secondary mb-2">
                              Date <span className="text-error">*</span>
                            </label>
                            <input
                              type="date"
                              value={maintenanceForm.service_date}
                              onChange={(e) => setMaintenanceForm({ ...maintenanceForm, service_date: e.target.value })}
                              className="input"
                              required
                            />
                          </div>

                          {/* Cost + Mileage row */}
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-sm font-medium text-text-secondary mb-2">
                                Cost <span className="text-text-tertiary">(optional)</span>
                              </label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary text-sm">$</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={maintenanceForm.cost}
                                  onChange={(e) => setMaintenanceForm({ ...maintenanceForm, cost: e.target.value })}
                                  placeholder="0.00"
                                  className="input !pl-7"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-text-secondary mb-2">
                                Odometer/Hrs <span className="text-text-tertiary">(opt)</span>
                              </label>
                              <input
                                type="number"
                                min="0"
                                value={maintenanceForm.mileage}
                                onChange={(e) => setMaintenanceForm({ ...maintenanceForm, mileage: e.target.value })}
                                placeholder="e.g., 45200"
                                className="input"
                              />
                            </div>
                          </div>

                          {/* Provider */}
                          <div>
                            <label className="block text-sm font-medium text-text-secondary mb-2">
                              Done by <span className="text-text-tertiary">(optional)</span>
                            </label>
                            <input
                              type="text"
                              value={maintenanceForm.provider}
                              onChange={(e) => setMaintenanceForm({ ...maintenanceForm, provider: e.target.value })}
                              placeholder="e.g., Self, Joe's Marine, Dealer"
                              className="input"
                            />
                          </div>

                          {/* Description */}
                          <div>
                            <label className="block text-sm font-medium text-text-secondary mb-2">
                              Notes <span className="text-text-tertiary">(optional)</span>
                            </label>
                            <textarea
                              value={maintenanceForm.description}
                              onChange={(e) => setMaintenanceForm({ ...maintenanceForm, description: e.target.value })}
                              placeholder="Any extra details..."
                              rows={3}
                              className="input"
                            />
                          </div>

                          {/* Actions */}
                          <div className="flex gap-3 pt-2">
                            <button
                              type="submit"
                              disabled={maintenanceSaving}
                              className="btn-primary flex-1"
                            >
                              {maintenanceSaving ? 'Saving...' : 'Save Record'}
                            </button>
                            <button
                              type="button"
                              onClick={closeMaintenanceModal}
                              disabled={maintenanceSaving}
                              className="btn-secondary"
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  return null
}
