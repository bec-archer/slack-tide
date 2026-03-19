'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

interface Profile {
  id: string
  display_name: string | null
  phone: string | null
  shipping_name: string | null
  shipping_address: string | null
  shipping_city: string | null
  shipping_state: string | null
  shipping_zip: string | null
}

export default function AccountPage() {
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [form, setForm] = useState({
    display_name: '',
    phone: '',
    shipping_name: '',
    shipping_address: '',
    shipping_city: '',
    shipping_state: '',
    shipping_zip: '',
  })

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth')
    }
  }, [user, authLoading, router])

  // Fetch profile on load
  useEffect(() => {
    if (!user) return
    const fetchProfile = async () => {
      try {
        const res = await fetch('/api/profile')
        if (!res.ok) throw new Error('Failed to fetch profile')
        const data = await res.json()
        setProfile(data.profile)
        setForm({
          display_name: data.profile.display_name || '',
          phone: data.profile.phone || '',
          shipping_name: data.profile.shipping_name || '',
          shipping_address: data.profile.shipping_address || '',
          shipping_city: data.profile.shipping_city || '',
          shipping_state: data.profile.shipping_state || '',
          shipping_zip: data.profile.shipping_zip || '',
        })
      } catch (err) {
        console.error('Profile fetch error:', err)
        setError('Failed to load profile')
      } finally {
        setLoading(false)
      }
    }
    fetchProfile()
  }, [user])

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.detail || 'Failed to save')
      }
      const data = await res.json()
      setProfile(data.profile)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save profile'
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    setSaved(false)
  }

  if (authLoading || loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0f1a' }}>
        <p style={{ color: '#94a3b8', fontSize: '16px' }}>Loading...</p>
      </div>
    )
  }

  const inputStyle = {
    width: '100%',
    padding: '10px 14px',
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '8px',
    color: '#f1f5f9',
    fontSize: '14px',
    outline: 'none',
  }

  const labelStyle = {
    display: 'block',
    color: '#94a3b8',
    fontSize: '13px',
    fontWeight: 600 as const,
    marginBottom: '6px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0f1a', padding: '40px 20px' }}>
      <div style={{ maxWidth: '560px', margin: '0 auto' }}>
        <h1 style={{ color: '#f1f5f9', fontSize: '28px', fontWeight: 700, marginBottom: '8px' }}>
          {profile?.display_name ? `Hi, ${profile.display_name}!` : 'My Account'}
        </h1>
        <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '32px' }}>
          {user?.email}
        </p>

        {error && (
          <div style={{ background: '#450a0a', border: '1px solid #991b1b', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', color: '#fca5a5', fontSize: '14px' }}>
            {error}
          </div>
        )}

        {/* Personal Info */}
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ color: '#e2e8f0', fontSize: '18px', fontWeight: 600, marginBottom: '16px', paddingBottom: '8px', borderBottom: '1px solid #1e293b' }}>
            Personal Info
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Display Name</label>
              <input
                type="text"
                placeholder="Bec"
                value={form.display_name}
                onChange={(e) => updateField('display_name', e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Phone</label>
              <input
                type="tel"
                placeholder="(555) 123-4567"
                value={form.phone}
                onChange={(e) => updateField('phone', e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>
        </div>

        {/* Shipping Address */}
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ color: '#e2e8f0', fontSize: '18px', fontWeight: 600, marginBottom: '16px', paddingBottom: '8px', borderBottom: '1px solid #1e293b' }}>
            Shipping Address
          </h2>
          <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '16px' }}>
            Save your address here and it&apos;ll be prefilled at checkout.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Full Name</label>
              <input
                type="text"
                placeholder="Jane Doe"
                value={form.shipping_name}
                onChange={(e) => updateField('shipping_name', e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Address</label>
              <input
                type="text"
                placeholder="123 Main St"
                value={form.shipping_address}
                onChange={(e) => updateField('shipping_address', e.target.value)}
                style={inputStyle}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px' }}>
              <div>
                <label style={labelStyle}>City</label>
                <input
                  type="text"
                  placeholder="Miami"
                  value={form.shipping_city}
                  onChange={(e) => updateField('shipping_city', e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>State</label>
                <input
                  type="text"
                  placeholder="FL"
                  value={form.shipping_state}
                  onChange={(e) => updateField('shipping_state', e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>ZIP</label>
                <input
                  type="text"
                  placeholder="33101"
                  value={form.shipping_zip}
                  onChange={(e) => updateField('shipping_zip', e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            width: '100%',
            padding: '14px',
            background: saving ? '#1e293b' : 'linear-gradient(135deg, #2dd4bf, #14b8a6)',
            color: saving ? '#64748b' : '#021a19',
            border: 'none',
            borderRadius: '10px',
            fontSize: '16px',
            fontWeight: 700,
            cursor: saving ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
          }}
        >
          {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
        </button>

        {saved && (
          <p style={{ color: '#4ade80', fontSize: '13px', textAlign: 'center', marginTop: '12px' }}>
            Profile updated successfully
          </p>
        )}
      </div>
    </div>
  )
}
