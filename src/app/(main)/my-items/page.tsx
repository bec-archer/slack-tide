'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { CATEGORY_EMOJI } from '@/lib/constants'

interface ItemWithSticker {
  id: string
  category: string
  make: string
  model: string
  year: number
  public_notes: string | null
  created_at: string
  short_code: string | null
}

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

export default function MyItemsPage() {
  const router = useRouter()
  const { user, isLoading: authLoading } = useAuth()
  const [items, setItems] = useState<ItemWithSticker[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return

    if (!user) {
      router.push('/auth?redirect=/my-items')
      return
    }

    async function fetchItems() {
      const { data, error } = await supabase
        .from('items')
        .select(`
          id,
          category,
          make,
          model,
          year,
          public_notes,
          created_at,
          stickers!item_id ( short_code )
        `)
        .eq('owner_id', user!.id)
        .order('created_at', { ascending: false })

      if (!error && data) {
        const mapped = data.map((item: Record<string, unknown>) => ({
          ...item,
          short_code: Array.isArray(item.stickers) && item.stickers.length > 0
            ? (item.stickers[0] as Record<string, string>).short_code
            : null,
        })) as ItemWithSticker[]
        setItems(mapped)
      }

      setLoading(false)
    }

    fetchItems()
  }, [user, authLoading, router])

  if (authLoading || loading) {
    return <LoadingBullseye />
  }

  return (
    <div className="min-h-screen bg-bg-primary p-4">
      <div className="max-w-2xl mx-auto pt-4 animate-fade-in">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-text-primary">My Items</h1>
          <span className="badge badge-accent">
            {items.length} {items.length === 1 ? 'item' : 'items'}
          </span>
        </div>

        {items.length === 0 ? (
          <div className="card-static p-10 text-center">
            <div className="w-20 h-20 rounded-full bg-accent-muted flex items-center justify-center mx-auto mb-5">
              <svg className="w-10 h-10 text-accent" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-text-primary mb-2">No items yet</h2>
            <p className="text-text-secondary">
              Scan a QR sticker to claim your first item and start tracking it.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const emoji = CATEGORY_EMOJI[item.category] || '🔧'

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    if (item.short_code) {
                      router.push(`/i/${item.short_code}`)
                    }
                  }}
                  className="w-full bg-bg-secondary hover:bg-bg-tertiary border border-border-subtle hover:border-border-default rounded-2xl p-4 text-left transition-all flex items-center gap-4 group"
                >
                  <div className="w-12 h-12 rounded-xl bg-accent-muted flex items-center justify-center text-2xl flex-shrink-0 group-hover:scale-105 transition-transform">
                    {emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-text-primary font-semibold truncate">
                      {item.year} {item.make} {item.model}
                    </h2>
                    <p className="text-text-tertiary text-sm capitalize">{item.category}</p>
                  </div>
                  <svg className="w-5 h-5 text-text-tertiary group-hover:text-accent group-hover:translate-x-1 transition-all" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
