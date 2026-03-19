'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useShop } from '@/contexts/ShopContext'
import { createBrowserClient } from '@/lib/supabase'
import Link from 'next/link'
import QRSTKRLogo from '@/components/QRSTKRLogo'
import type { ShopCategory } from '@/lib/types'

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

export default function ShopRegisterPage() {
  const router = useRouter()
  const { user, isLoading: isAuthLoading } = useAuth()
  const { isShopUser, isShopLoading, refreshShopContext } = useShop()

  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [phone, setPhone] = useState('')
  const [website, setWebsite] = useState('')
  const [categories, setCategories] = useState<ShopCategory[]>([])
  const [tosAccepted, setTosAccepted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Loading states
  if (isAuthLoading || isShopLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-text-tertiary text-sm animate-pulse">Loading...</div>
      </div>
    )
  }

  // Not logged in — send to shop auth
  if (!user) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <div className="card-static p-8 text-center max-w-md">
          <h1 className="text-xl font-bold text-text-primary mb-2">Create a Business Account First</h1>
          <p className="text-text-secondary mb-6">
            You need a business account before you can register a shop.
            This is separate from your personal QRSTKR account.
          </p>
          <Link href="/shop/auth?mode=signup&redirect=/shop/register" className="btn-primary">
            Create Business Account
          </Link>
          <p className="text-text-tertiary text-sm mt-4">
            Already have a business account?{' '}
            <Link href="/shop/auth?redirect=/shop/register" className="text-accent hover:text-accent-secondary transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    )
  }

  // Already a shop user
  if (isShopUser) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <div className="card-static p-8 text-center max-w-md">
          <h1 className="text-xl font-bold text-text-primary mb-2">Already Registered</h1>
          <p className="text-text-secondary mb-6">
            Your account is already associated with a shop.
          </p>
          <Link href="/shop" className="btn-primary">
            Go to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  function toggleCategory(cat: ShopCategory) {
    setCategories((prev) =>
      prev.includes(cat)
        ? prev.filter((c) => c !== cat)
        : [...prev, cat]
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (categories.length === 0) {
      setError('Select at least one category your shop services.')
      return
    }

    if (!tosAccepted) {
      setError('You must accept the Terms of Service to register.')
      return
    }

    setIsSubmitting(true)

    try {
      const supabase = createBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        setError('Your session expired. Please sign in again.')
        setIsSubmitting(false)
        return
      }

      const res = await fetch('/api/shops', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          address: address.trim(),
          city: city.trim(),
          state,
          phone: phone.trim(),
          website: website.trim() || undefined,
          categories_serviced: categories,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => null)
        const msg: string = body?.error || `Registration failed (${res.status})`
        setError(msg)
        setIsSubmitting(false)
        return
      }

      // Refresh shop context so the layout picks up the new shop
      await refreshShopContext()
      router.push('/shop/profile')
    } catch {
      setError('Something went wrong. Please try again.')
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg-primary py-8 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-block mb-3">
            <QRSTKRLogo id="shop-register" height={36} />
          </Link>
          <h1 className="text-2xl font-bold text-text-primary mb-1">Register Your Shop</h1>
          <p className="text-text-secondary text-sm">
            Create a shop account to log service records for customers with QRSTKR stickers.
          </p>
        </div>

        <div className="card-static p-6">
          {error && (
            <div className="bg-error/10 border border-error/30 rounded-xl p-4 mb-6">
              <p className="text-error text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Business Name */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Business Name <span className="text-error">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Savannah Auto Service"
                className="input"
                required
                maxLength={200}
              />
            </div>

            {/* Address */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Street Address <span className="text-error">*</span>
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="123 Main Street"
                className="input"
                required
                maxLength={300}
              />
            </div>

            {/* City + State row */}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  City <span className="text-error">*</span>
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Savannah"
                  className="input"
                  required
                  maxLength={100}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  State <span className="text-error">*</span>
                </label>
                <select
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="input"
                  required
                >
                  <option value="">—</option>
                  {US_STATES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Phone Number <span className="text-error">*</span>
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(912) 555-0123"
                className="input"
                required
                maxLength={20}
              />
            </div>

            {/* Website */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Website <span className="text-text-tertiary font-normal">(optional)</span>
              </label>
              <input
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://www.yourshop.com"
                className="input"
                maxLength={300}
              />
            </div>

            {/* Categories */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-3">
                What does your shop service? <span className="text-error">*</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {SHOP_CATEGORIES.map((cat) => {
                  const selected = categories.includes(cat.value)
                  return (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => toggleCategory(cat.value)}
                      className={`text-sm font-medium px-3 py-2 rounded-lg border transition-colors text-left ${
                        selected
                          ? 'border-accent bg-accent/10 text-accent'
                          : 'border-border-default bg-bg-elevated text-text-secondary hover:border-border-subtle'
                      }`}
                    >
                      {selected ? '✓ ' : ''}{cat.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* TOS */}
            <div className="border-t border-border-subtle pt-5">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={tosAccepted}
                  onChange={(e) => setTosAccepted(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded border-border-default accent-accent"
                />
                <span className="text-sm text-text-secondary leading-relaxed">
                  I agree to the QRSTKR Shop{' '}
                  <span className="text-accent">Terms of Service</span>. I understand that
                  my shop is responsible for submitting accurate service records and that
                  item owners may dispute any record. Fraudulent submissions may result in
                  account termination.
                </span>
              </label>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary w-full"
            >
              {isSubmitting ? 'Registering...' : 'Register Shop'}
            </button>
          </form>
        </div>

        {/* Footer link */}
        <p className="text-center text-text-tertiary text-sm mt-6">
          Already have a shop account?{' '}
          <Link href="/shop/auth" className="text-accent hover:text-accent-secondary transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
