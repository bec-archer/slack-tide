import { createServerClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/profile — Fetch current user's profile
export async function GET() {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (error && error.code === 'PGRST116') {
      // No profile row yet — return empty shell
      return NextResponse.json({ profile: { id: user.id, display_name: null, phone: null, shipping_name: null, shipping_address: null, shipping_city: null, shipping_state: null, shipping_zip: null } })
    }
    if (error) {
      console.error('Profile fetch error:', error)
      return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 })
    }

    return NextResponse.json({ profile })
  } catch (err) {
    console.error('Profile GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/profile — Update current user's profile
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const allowedFields = ['display_name', 'phone', 'shipping_name', 'shipping_address', 'shipping_city', 'shipping_state', 'shipping_zip']

    // Only allow known fields
    const updates: Record<string, string | null> = {}
    for (const field of allowedFields) {
      if (field in body) {
        updates[field] = body[field] || null
      }
    }
    updates.updated_at = new Date().toISOString()

    // Upsert — handles case where trigger hasn't fired yet
    const { data: profile, error } = await supabase
      .from('profiles')
      .upsert({ id: user.id, ...updates }, { onConflict: 'id' })
      .select()
      .single()

    if (error) {
      console.error('Profile update error:', error)
      return NextResponse.json({ error: 'Failed to update profile', detail: error.message }, { status: 500 })
    }

    return NextResponse.json({ profile })
  } catch (err) {
    console.error('Profile PUT error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
