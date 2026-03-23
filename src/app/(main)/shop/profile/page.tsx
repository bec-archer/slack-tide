'use client'

import { useEffect, useState, useRef } from 'react'
import { useShop } from '@/contexts/ShopContext'
import { createBrowserClient } from '@/lib/supabase'
import { compressImage } from '@/lib/image-utils'
import type { Shop, ShopCategory } from '@/lib/types'

const SHOP_CATEGORIES: Array<{ value: ShopCategory; label: string }> = [
  { value: 'cars', label: 'Cars' },
  { value: 'trucks', label: 'Trucks' },
  { value: 'boats', label: 'Boats' },
  { value: 'motorcycles', label: 'Motorcycles' },
  { value: 'lawnmowers', label: 'Lawnmowers' },
  { value: 'trailers', label: 'Trailers' },
  { value: 'RVs', label: 'RVs' },
  { value: 'ATVs', label: 'ATVs' },
  { value: 'jet_skis', label: 'Jet Skis' },
  { value: 'generators', label: 'Generators' },
  { value: 'heavy_equipment', label: 'Heavy Equipment' },
  { value: 'other', label: 'Other' },
]

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',
  'HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
]

interface GoogleResult {
  index: number
  name: string
  address: string
  phone: string | null
  website: string | null
}

type VerifyStep = 'idle' | 'searching' | 'results' | 'sending' | 'code' | 'confirming' | 'upload' | 'submitting'

interface VerificationPhoto {
  label: string
  file: File | null
  preview: string | null
  required: boolean
}

export default function ShopProfilePage() {
  const { shopId, isShopAdmin, refreshShopContext } = useShop()
  const [shop, setShop] = useState<Shop | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // "Your Name" state (user's display_name from profiles table)
  const [displayName, setDisplayName] = useState('')
  const [displayNameSaved, setDisplayNameSaved] = useState('')
  const [isNameSaving, setIsNameSaving] = useState(false)
  const [nameMsg, setNameMsg] = useState<string | null>(null)

  // Verification flow state
  const [verifyStep, setVerifyStep] = useState<VerifyStep>('idle')
  const [googleResults, setGoogleResults] = useState<GoogleResult[]>([])
  const [selectedPlace, setSelectedPlace] = useState<GoogleResult | null>(null)
  const [verifyCode, setVerifyCode] = useState('')
  const [verifyError, setVerifyError] = useState<string | null>(null)

  // Manual verification photo upload state
  const [verifyPhotos, setVerifyPhotos] = useState<VerificationPhoto[]>([
    { label: 'Storefront / signage', file: null, preview: null, required: true },
    { label: 'Business license or registration', file: null, preview: null, required: true },
    { label: 'Shop interior (optional)', file: null, preview: null, required: false },
  ])
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([])

  // Edit form state
  const [editName, setEditName] = useState('')
  const [editAddress, setEditAddress] = useState('')
  const [editCity, setEditCity] = useState('')
  const [editState, setEditState] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editWebsite, setEditWebsite] = useState('')
  const [editCategories, setEditCategories] = useState<ShopCategory[]>([])

  useEffect(() => {
    if (!shopId) return
    fetchShop()
    fetchUserName()
  }, [shopId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchShop() {
    const supabase = createBrowserClient()
    const { data, error: fetchErr } = await supabase
      .from('shops')
      .select('*')
      .eq('id', shopId!)
      .single()

    if (fetchErr || !data) {
      setError('Failed to load shop profile')
      setIsLoading(false)
      return
    }

    const shopData = data as Shop
    setShop(shopData)
    populateEditForm(shopData)
    setIsLoading(false)
  }

  function populateEditForm(s: Shop) {
    setEditName(s.name)
    setEditAddress(s.address)
    setEditCity(s.city)
    setEditState(s.state)
    setEditPhone(s.phone)
    setEditWebsite(s.website || '')
    setEditCategories(s.categories_serviced)
  }

  async function fetchUserName() {
    try {
      const supabase = createBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const res = await fetch('/api/profile', {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      })
      if (!res.ok) return
      const body = await res.json()
      const name = body.profile?.display_name || ''
      setDisplayName(name)
      setDisplayNameSaved(name)
    } catch {
      // Non-critical
    }
  }

  async function saveUserName() {
    const trimmed = displayName.trim()
    if (trimmed === displayNameSaved) return
    setIsNameSaving(true)
    setNameMsg(null)

    try {
      const supabase = createBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setIsNameSaving(false); return }

      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ display_name: trimmed }),
      })

      if (!res.ok) {
        setNameMsg('Failed to save name')
        setIsNameSaving(false)
        return
      }

      setDisplayNameSaved(trimmed)
      setNameMsg('Saved!')
      setTimeout(() => setNameMsg(null), 2000)
    } catch {
      setNameMsg('Something went wrong')
    } finally {
      setIsNameSaving(false)
    }
  }

  function toggleCategory(cat: ShopCategory) {
    setEditCategories((prev) =>
      prev.includes(cat)
        ? prev.filter((c) => c !== cat)
        : [...prev, cat]
    )
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccessMsg(null)

    if (editCategories.length === 0) {
      setError('Select at least one category.')
      return
    }

    setIsSaving(true)

    try {
      const supabase = createBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setError('Session expired'); setIsSaving(false); return }

      const res = await fetch(`/api/shops/${shopId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          name: editName.trim(),
          address: editAddress.trim(),
          city: editCity.trim(),
          state: editState,
          phone: editPhone.trim(),
          website: editWebsite.trim() || undefined,
          categories_serviced: editCategories,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => null)
        setError(body?.error || 'Failed to save changes')
        setIsSaving(false)
        return
      }

      const updated = await res.json()
      setShop(updated.shop)
      populateEditForm(updated.shop)
      setIsEditing(false)
      setSuccessMsg('Shop profile updated!')
      await refreshShopContext()
    } catch {
      setError('Something went wrong')
    } finally {
      setIsSaving(false)
    }
  }

  async function getSession(): Promise<string | null> {
    const supabase = createBrowserClient()
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ?? null
  }

  async function handleGoogleLookup() {
    setVerifyError(null)
    setVerifyStep('searching')

    try {
      const token = await getSession()
      if (!token) { setVerifyError('Session expired'); setVerifyStep('idle'); return }

      const res = await fetch(`/api/shops/${shopId}/verify/google-lookup`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      })

      const body = await res.json()
      if (!res.ok) {
        setVerifyError(body.error || 'Google lookup failed')
        setVerifyStep('idle')
        return
      }

      setGoogleResults(body.results || [])
      setVerifyStep('results')
    } catch {
      setVerifyError('Something went wrong searching Google')
      setVerifyStep('idle')
    }
  }

  async function handleSendCode(place: GoogleResult) {
    setVerifyError(null)
    setSelectedPlace(place)
    setVerifyStep('sending')

    try {
      const token = await getSession()
      if (!token) { setVerifyError('Session expired'); setVerifyStep('results'); return }

      const res = await fetch(`/api/shops/${shopId}/verify/send-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ googlePhone: place.phone }),
      })

      const body = await res.json()
      if (!res.ok) {
        setVerifyError(body.error || 'Failed to send verification code')
        setVerifyStep('results')
        return
      }

      setVerifyStep('code')
    } catch {
      setVerifyError('Something went wrong sending the code')
      setVerifyStep('results')
    }
  }

  async function handleConfirmCode() {
    setVerifyError(null)
    setVerifyStep('confirming')

    try {
      const token = await getSession()
      if (!token) { setVerifyError('Session expired'); setVerifyStep('code'); return }

      const res = await fetch(`/api/shops/${shopId}/verify/confirm-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ code: verifyCode.trim() }),
      })

      const body = await res.json()
      if (!res.ok) {
        setVerifyError(body.error || 'Verification failed')
        setVerifyStep('code')
        return
      }

      setSuccessMsg('Shop verified successfully!')
      setVerifyStep('idle')
      setVerifyCode('')
      await fetchShop()
      await refreshShopContext()
    } catch {
      setVerifyError('Something went wrong')
      setVerifyStep('code')
    }
  }

  function handleManualVerification() {
    setVerifyError(null)
    // Reset photos
    setVerifyPhotos([
      { label: 'Storefront / signage', file: null, preview: null, required: true },
      { label: 'Business license or registration', file: null, preview: null, required: true },
      { label: 'Shop interior (optional)', file: null, preview: null, required: false },
    ])
    setVerifyStep('upload')
  }

  const MAX_FILE_SIZE_MB = 5
  const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

  function handlePhotoSelect(index: number, file: File | null) {
    if (!file) return

    const isPdf = file.type === 'application/pdf'

    // Only enforce size limit on PDFs — images get compressed before upload
    if (isPdf && file.size > MAX_FILE_SIZE_BYTES) {
      setVerifyError(`PDF too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max size is ${MAX_FILE_SIZE_MB}MB.`)
      return
    }

    setVerifyError(null)

    // For images, create object URL preview; for PDFs, use a placeholder
    const preview = isPdf ? 'pdf' : URL.createObjectURL(file)
    setVerifyPhotos((prev) => {
      const updated = [...prev]
      // Clean up old preview URL (only for non-PDF previews)
      if (updated[index].preview && updated[index].preview !== 'pdf') {
        URL.revokeObjectURL(updated[index].preview!)
      }
      updated[index] = { ...updated[index], file, preview }
      return updated
    })
  }

  async function handleSubmitManualReview() {
    setVerifyError(null)

    // Check required photos
    const missingRequired = verifyPhotos.filter((p) => p.required && !p.file)
    if (missingRequired.length > 0) {
      setVerifyError(`Please upload: ${missingRequired.map((p) => p.label).join(', ')}`)
      return
    }

    setVerifyStep('submitting')

    try {
      const token = await getSession()
      if (!token) { setVerifyError('Session expired'); setVerifyStep('upload'); return }

      const supabase = createBrowserClient()
      const uploadedDocs: Array<{ label: string; storage_path: string }> = []

      // Upload each file to private bucket
      for (const photo of verifyPhotos) {
        if (!photo.file) continue

        const isPdf = photo.file.type === 'application/pdf'
        const fileId = crypto.randomUUID()
        let uploadBlob: Blob
        let contentType: string
        let storagePath: string

        if (isPdf) {
          // PDFs go up as-is (no compression)
          uploadBlob = photo.file
          contentType = 'application/pdf'
          storagePath = `${shopId}/${fileId}.pdf`
        } else {
          // Images get compressed
          const compressed = await compressImage(photo.file, 1600, 0.85)
          uploadBlob = compressed.blob
          contentType = 'image/jpeg'
          storagePath = `${shopId}/${fileId}.jpg`
        }

        const { error: uploadErr } = await supabase.storage
          .from('shop-verification')
          .upload(storagePath, uploadBlob, {
            cacheControl: '3600',
            contentType,
            upsert: false,
          })

        if (uploadErr) {
          console.error('Upload error:', uploadErr)
          setVerifyError(`Failed to upload ${photo.label}. Please try again.`)
          setVerifyStep('upload')
          return
        }

        uploadedDocs.push({ label: photo.label, storage_path: storagePath })
      }

      // Submit verification request with photo URLs
      const res = await fetch(`/api/shops/${shopId}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ docs: uploadedDocs }),
      })

      const body = await res.json()
      if (!res.ok) {
        setVerifyError(body.error || 'Verification request failed')
        setVerifyStep('upload')
        return
      }

      setSuccessMsg('Verification request submitted with photos! We\'ll review your shop shortly.')
      setVerifyStep('idle')
      // Clean up preview URLs
      verifyPhotos.forEach((p) => { if (p.preview) URL.revokeObjectURL(p.preview) })
      await fetchShop()
    } catch {
      setVerifyError('Something went wrong uploading photos')
      setVerifyStep('upload')
    }
  }

  if (isLoading) {
    return <div className="text-text-tertiary text-sm animate-pulse py-8">Loading shop profile...</div>
  }

  if (!shop) {
    return <div className="text-error py-8">Failed to load shop profile.</div>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Shop Profile</h1>
        {isShopAdmin && !isEditing && (
          <button
            onClick={() => { setIsEditing(true); setSuccessMsg(null) }}
            className="btn-secondary text-sm"
          >
            Edit Profile
          </button>
        )}
      </div>

      {error && (
        <div className="bg-error/10 border border-error/30 rounded-xl p-4 mb-4">
          <p className="text-error text-sm">{error}</p>
        </div>
      )}

      {successMsg && (
        <div className="bg-success/10 border border-success/30 rounded-xl p-4 mb-4">
          <p className="text-success text-sm">{successMsg}</p>
        </div>
      )}

      {/* Verification status card */}
      <div className="card-static p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-medium text-text-secondary mb-1">Verification Status</p>
            {shop.verified ? (
              <p className="text-success font-semibold">
                ✓ Verified {shop.verified_method === 'google_business' ? '(Google Business)' : '(Manual Review)'}
              </p>
            ) : shop.verification_requested ? (
              <p className="text-warning font-medium">Manual Review Pending</p>
            ) : (
              <p className="text-text-tertiary">Not verified</p>
            )}
          </div>
          {isShopAdmin && !shop.verified && !shop.verification_requested && verifyStep === 'idle' && (
            <div className="flex flex-col items-end gap-3">
              <button
                onClick={handleGoogleLookup}
                className="btn-primary text-sm"
              >
                Verify via Google
              </button>
              <button
                onClick={handleManualVerification}
                className="text-xs text-text-tertiary hover:text-accent transition-colors"
              >
                Not on Google Business? Request manual verification
              </button>
            </div>
          )}
        </div>

        {verifyError && (
          <div className="bg-error/10 border border-error/30 rounded-lg p-3 mb-3">
            <p className="text-error text-sm">{verifyError}</p>
          </div>
        )}

        {/* Step: Searching Google */}
        {verifyStep === 'searching' && (
          <div className="text-text-tertiary text-sm animate-pulse py-4 text-center">
            Searching Google for your business...
          </div>
        )}

        {/* Step: Google Results */}
        {verifyStep === 'results' && (
          <div className="space-y-3">
            <p className="text-sm text-text-secondary">
              {googleResults.length > 0
                ? 'Select your business from the results below:'
                : 'No matching businesses found on Google.'}
            </p>
            {googleResults.map((place) => (
              <div
                key={place.index}
                className="border border-border-subtle rounded-lg p-3 hover:border-accent/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text-primary">{place.name}</p>
                    <p className="text-xs text-text-tertiary mt-0.5">{place.address}</p>
                    {place.phone && (
                      <p className="text-xs text-text-secondary mt-1">Phone: {place.phone}</p>
                    )}
                    {place.website && (
                      <p className="text-xs text-text-tertiary mt-0.5 truncate">{place.website}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleSendCode(place)}
                    disabled={!place.phone}
                    className="btn-primary text-xs shrink-0 disabled:opacity-50"
                    title={!place.phone ? 'No phone number listed — cannot verify via SMS' : ''}
                  >
                    {place.phone ? 'Verify This' : 'No Phone'}
                  </button>
                </div>
              </div>
            ))}
            <div className="mt-4 pt-4 border-t border-border-subtle">
              <div className="bg-bg-tertiary rounded-lg p-4 text-center mb-3">
                <p className="text-sm text-text-secondary mb-2">Don&apos;t see your shop?</p>
                <button
                  onClick={handleManualVerification}
                  className="btn-primary text-sm"
                >
                  Request Manual Review
                </button>
                <p className="text-xs text-text-tertiary mt-2">
                  Upload photos of your storefront and business license for verification.
                </p>
              </div>
              <button
                onClick={() => setVerifyStep('idle')}
                className="text-xs text-text-tertiary hover:text-text-secondary transition-colors"
              >
                ← Cancel
              </button>
            </div>
          </div>
        )}

        {/* Step: Sending SMS */}
        {verifyStep === 'sending' && (
          <div className="text-text-tertiary text-sm animate-pulse py-4 text-center">
            Sending verification code to {selectedPlace?.phone}...
          </div>
        )}

        {/* Step: Enter Code */}
        {verifyStep === 'code' && (
          <div className="space-y-3">
            <p className="text-sm text-text-secondary">
              We sent a 6-digit code to the phone number listed on your Google Business profile.
              Enter it below to verify your shop.
            </p>
            <div className="flex gap-3">
              <input
                type="text"
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                className="input text-center text-lg tracking-widest font-mono w-40"
              />
              <button
                onClick={handleConfirmCode}
                disabled={verifyCode.length !== 6}
                className="btn-primary text-sm disabled:opacity-50"
              >
                Confirm
              </button>
            </div>
            <div className="flex items-center justify-between">
              <button
                onClick={() => { setVerifyStep('results'); setVerifyCode('') }}
                className="text-xs text-text-tertiary hover:text-text-secondary transition-colors"
              >
                ← Back to results
              </button>
              <button
                onClick={() => selectedPlace && handleSendCode(selectedPlace)}
                className="text-xs text-accent hover:text-accent-secondary transition-colors"
              >
                Resend code
              </button>
            </div>
          </div>
        )}

        {/* Step: Confirming */}
        {verifyStep === 'confirming' && (
          <div className="text-text-tertiary text-sm animate-pulse py-4 text-center">
            Verifying code...
          </div>
        )}

        {/* Step: Upload photos for manual review */}
        {verifyStep === 'upload' && (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-text-primary mb-1">Manual Verification</p>
              <p className="text-xs text-text-secondary">
                Upload photos of your storefront and business license (images or PDF) so we can verify your shop.
              </p>
            </div>

            {verifyPhotos.map((photo, idx) => (
              <div key={idx} className="border border-border-subtle rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-text-secondary">
                    {photo.label} {photo.required && <span className="text-error">*</span>}
                  </p>
                  <button
                    type="button"
                    onClick={() => fileInputRefs.current[idx]?.click()}
                    className="btn-secondary text-xs"
                  >
                    {photo.file ? 'Change' : 'Choose File'}
                  </button>
                  <input
                    ref={(el) => { fileInputRefs.current[idx] = el }}
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={(e) => handlePhotoSelect(idx, e.target.files?.[0] ?? null)}
                  />
                </div>
                {photo.preview && (
                  photo.preview === 'pdf' ? (
                    <div className="w-full py-6 bg-bg-tertiary rounded-lg flex flex-col items-center gap-1">
                      <span className="text-3xl">📄</span>
                      <p className="text-xs text-text-tertiary">{photo.file?.name}</p>
                    </div>
                  ) : (
                    <img
                      src={photo.preview}
                      alt={photo.label}
                      className="w-full max-h-48 object-cover rounded-lg"
                    />
                  )
                )}
              </div>
            ))}

            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => {
                  verifyPhotos.forEach((p) => { if (p.preview && p.preview !== 'pdf') URL.revokeObjectURL(p.preview) })
                  setVerifyStep('results')
                }}
                className="btn-secondary text-xs"
              >
                ← Back
              </button>
              <button
                onClick={handleSubmitManualReview}
                className="btn-primary text-sm"
              >
                Submit for Review
              </button>
            </div>
          </div>
        )}

        {/* Step: Submitting manual review */}
        {verifyStep === 'submitting' && (
          <div className="text-text-tertiary text-sm animate-pulse py-4 text-center">
            Uploading photos and submitting...
          </div>
        )}
      </div>

      {isEditing ? (
        <form onSubmit={handleSave} className="card-static p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">Business Name</label>
            <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="input" required maxLength={200} />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">Street Address</label>
            <input type="text" value={editAddress} onChange={(e) => setEditAddress(e.target.value)} className="input" required maxLength={300} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-text-secondary mb-2">City</label>
              <input type="text" value={editCity} onChange={(e) => setEditCity(e.target.value)} className="input" required maxLength={100} />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">State</label>
              <select value={editState} onChange={(e) => setEditState(e.target.value)} className="input" required>
                <option value="">—</option>
                {US_STATES.map((s) => (<option key={s} value={s}>{s}</option>))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">Phone</label>
            <input type="tel" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="input" required maxLength={20} />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">Website</label>
            <input type="url" value={editWebsite} onChange={(e) => setEditWebsite(e.target.value)} className="input" maxLength={300} placeholder="https://" />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-3">Categories Serviced</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {SHOP_CATEGORIES.map((cat) => {
                const selected = editCategories.includes(cat.value)
                return (
                  <button key={cat.value} type="button" onClick={() => toggleCategory(cat.value)}
                    className={`text-sm font-medium px-3 py-2 rounded-lg border transition-colors text-left ${
                      selected ? 'border-accent bg-accent/10 text-accent' : 'border-border-default bg-bg-elevated text-text-secondary hover:border-border-subtle'
                    }`}>
                    {selected ? '✓ ' : ''}{cat.label}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={isSaving} className="btn-primary">
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
            <button type="button" onClick={() => { setIsEditing(false); if (shop) populateEditForm(shop) }} className="btn-secondary">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="card-static p-6 space-y-4">
          <div>
            <p className="text-xs text-text-tertiary uppercase tracking-wider mb-1">Business Name</p>
            <p className="text-text-primary font-medium">{shop.name}</p>
          </div>
          <div>
            <p className="text-xs text-text-tertiary uppercase tracking-wider mb-1">Address</p>
            <p className="text-text-primary">{shop.address}, {shop.city}, {shop.state}</p>
          </div>
          <div>
            <p className="text-xs text-text-tertiary uppercase tracking-wider mb-1">Phone</p>
            <p className="text-text-primary">{shop.phone}</p>
          </div>
          {shop.website && (
            <div>
              <p className="text-xs text-text-tertiary uppercase tracking-wider mb-1">Website</p>
              <a href={shop.website} target="_blank" rel="noopener noreferrer" className="text-accent hover:text-accent-secondary transition-colors">
                {shop.website}
              </a>
            </div>
          )}
          <div>
            <p className="text-xs text-text-tertiary uppercase tracking-wider mb-1">Categories Serviced</p>
            <div className="flex flex-wrap gap-2 mt-1">
              {shop.categories_serviced.map((cat) => (
                <span key={cat} className="text-xs font-medium bg-bg-elevated text-text-secondary px-2.5 py-1 rounded-full border border-border-subtle">
                  {SHOP_CATEGORIES.find((c) => c.value === cat)?.label ?? cat}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Your Name card — sets display_name on user's profile */}
      <div className="card-static p-5 mt-6">
        <h2 className="text-sm font-semibold text-text-primary mb-1">Your Name</h2>
        <p className="text-xs text-text-tertiary mb-3">
          This is how your name appears when tagged on service records.
        </p>
        <div className="flex gap-2 items-center">
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveUserName() } }}
            placeholder="e.g., Bec"
            className="input text-sm flex-1"
            maxLength={100}
          />
          <button
            onClick={saveUserName}
            disabled={isNameSaving || displayName.trim() === displayNameSaved}
            className="btn-primary text-sm disabled:opacity-50"
          >
            {isNameSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
        {nameMsg && (
          <p className={`text-xs mt-1.5 ${nameMsg === 'Saved!' ? 'text-success' : 'text-error'}`}>
            {nameMsg}
          </p>
        )}
      </div>
    </div>
  )
}
