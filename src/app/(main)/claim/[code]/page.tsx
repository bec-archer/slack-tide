'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { CATEGORIES } from '@/lib/constants'
import Link from 'next/link'

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

export default function ClaimPage() {
  const params = useParams()
  const router = useRouter()
  const { user, isLoading } = useAuth()
  const code = params.code as string

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    category: 'car',
    make: '',
    model: '',
    year: String(new Date().getFullYear()),
    nickname: '',
    public_notes: '',
    contact_phone: '',
    contact_email: '',
    show_contact: false,
  })

  if (isLoading) {
    return <LoadingBullseye />
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-primary p-4">
        <div className="card-static p-8 max-w-md w-full text-center animate-fade-in">
          <div className="w-16 h-16 rounded-full bg-accent-muted flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-accent" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-text-primary mb-2">Sign In Required</h1>
          <p className="text-text-secondary mb-6">
            You need to sign in before you can claim a sticker and register your item.
          </p>
          <Link
            href={`/auth?redirect=/claim/${code}`}
            className="btn-primary w-full block text-center"
          >
            Sign In to Claim
          </Link>
        </div>
      </div>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      // Block business accounts from registering items
      const { data: profile } = await supabase
        .from('profiles')
        .select('account_type')
        .eq('id', user!.id)
        .maybeSingle()

      if (profile?.account_type === 'business') {
        throw new Error('Business accounts cannot register personal items. Please sign in with your personal account instead.')
      }

      const { data: sticker, error: stickerError } = await supabase
        .from('stickers')
        .select('*')
        .eq('short_code', code)
        .single()

      if (stickerError || !sticker) {
        throw new Error('Sticker not found')
      }

      if (sticker.status !== 'unregistered') {
        throw new Error('This sticker has already been claimed')
      }

      const yearNum = parseInt(form.year)
      if (!yearNum || yearNum < 1900 || yearNum > new Date().getFullYear() + 1) {
        throw new Error('Please enter a valid year (1900–' + (new Date().getFullYear() + 1) + ')')
      }

      const { data: item, error: itemError } = await supabase
        .from('items')
        .insert({
          owner_id: user!.id,
          category: form.category,
          make: form.make,
          model: form.model,
          year: yearNum,
          nickname: form.nickname || null,
          public_notes: form.public_notes || null,
          contact_phone: form.contact_phone.trim() || null,
          contact_email: form.contact_email.trim() || null,
          show_contact: form.show_contact,
        })
        .select()
        .single()

      if (itemError || !item) {
        throw new Error('Failed to create item')
      }

      const { error: updateError } = await supabase
        .from('stickers')
        .update({
          item_id: item.id,
          status: 'active'
        })
        .eq('id', sticker.id)

      if (updateError) {
        throw new Error('Failed to link sticker')
      }

      router.push(`/i/${code}`)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg-primary p-4">
      <div className="max-w-md mx-auto pt-4 animate-fade-in">
        <div className="card-static p-6">
          <h1 className="text-2xl font-bold text-text-primary mb-2">Claim Your Sticker</h1>
          <p className="text-text-secondary mb-6">
            Register the item this sticker is attached to.
          </p>

          {error && (
            <div className="bg-error/10 border border-error/30 rounded-xl p-4 mb-6">
              <p className="text-error">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
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
                    onClick={() => setForm({ ...form, category: cat.value })}
                    className={`p-3 rounded-xl border transition-all ${
                      form.category === cat.value
                        ? 'border-accent bg-accent-muted shadow-[0_0_0_1px_var(--accent-primary)]'
                        : 'border-border-default bg-bg-tertiary hover:border-border-default hover:bg-bg-elevated'
                    }`}
                  >
                    <div className="text-2xl mb-1">{cat.emoji}</div>
                    <div className={`text-xs ${form.category === cat.value ? 'text-accent' : 'text-text-secondary'}`}>
                      {cat.label}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Boat name */}
            {form.category === 'boat' && (
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Boat Name <span className="text-text-tertiary">(optional)</span>
                </label>
                <input
                  type="text"
                  value={form.nickname}
                  onChange={(e) => setForm({ ...form, nickname: e.target.value })}
                  placeholder="e.g., Knot Today, Sea La Vie"
                  className="input"
                />
              </div>
            )}

            {/* Year */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Year
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={form.year}
                onChange={(e) => setForm({ ...form, year: e.target.value.replace(/[^0-9]/g, '') })}
                placeholder="e.g., 2019"
                className="input"
                required
              />
            </div>

            {/* Make */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Make
              </label>
              <input
                type="text"
                value={form.make}
                onChange={(e) => setForm({ ...form, make: e.target.value })}
                placeholder="e.g., Ford, Yamaha, Honda"
                className="input"
                required
              />
            </div>

            {/* Model */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Model
              </label>
              <input
                type="text"
                value={form.model}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
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
                value={form.public_notes}
                onChange={(e) => setForm({ ...form, public_notes: e.target.value })}
                placeholder="Anything you want people to see when they scan..."
                rows={3}
                className="input"
              />
            </div>

            {/* Contact Info */}
            <div className="border-t border-border-subtle pt-5">
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium text-text-secondary">
                  Contact Info
                </label>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, show_contact: !form.show_contact })}
                  className={`toggle ${form.show_contact ? 'toggle-on' : 'toggle-off'}`}
                >
                  <span className={`toggle-knob ${form.show_contact ? 'toggle-knob-on' : 'toggle-knob-off'}`} />
                </button>
              </div>
              <p className="text-text-tertiary text-xs mb-3">
                {form.show_contact
                  ? 'Your contact info will be visible to anyone who scans this sticker.'
                  : 'Optional — let people reach you if they scan your sticker.'}
              </p>

              {form.show_contact && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">
                      Phone <span className="text-text-tertiary">(optional)</span>
                    </label>
                    <input
                      type="tel"
                      value={form.contact_phone}
                      onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
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
                      value={form.contact_email}
                      onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
                      placeholder="e.g., you@example.com"
                      className="input"
                    />
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full"
            >
              {submitting ? 'Claiming...' : 'Claim Sticker'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
