import { createServerClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'
import { getShopContext, requireShopAdmin } from '@/lib/shop-auth'

// GET /api/shops/[shopId] — Get shop profile
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ shopId: string }> }
) {
  try {
    const { shopId } = await params
    const supabase = await createServerClient()

    const { data: shop, error } = await supabase
      .from('shops')
      .select('id, name, address, city, state, phone, website, categories_serviced, verified, verified_at, verified_method, created_at')
      .eq('id', shopId)
      .single()

    if (error || !shop) {
      return NextResponse.json({ error: 'Shop not found' }, { status: 404 })
    }

    return NextResponse.json({ shop })
  } catch (err) {
    console.error('Shop GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/shops/[shopId] — Update shop details (admin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ shopId: string }> }
) {
  try {
    const { shopId } = await params
    const supabase = await createServerClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminCtx = await requireShopAdmin(supabase, user.id, shopId)
    if (!adminCtx) {
      return NextResponse.json({ error: 'Forbidden — shop admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const allowedFields = ['name', 'address', 'city', 'state', 'phone', 'website', 'categories_serviced']

    const updates: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (field in body) {
        updates[field] = body[field]
      }
    }

    if (updates.state && typeof updates.state === 'string') {
      updates.state = (updates.state as string).toUpperCase()
    }

    updates.updated_at = new Date().toISOString()

    const { data: shop, error } = await supabase
      .from('shops')
      .update(updates)
      .eq('id', shopId)
      .select()
      .single()

    if (error) {
      console.error('Shop update error:', error)
      return NextResponse.json({ error: 'Failed to update shop', detail: error.message }, { status: 500 })
    }

    return NextResponse.json({ shop })
  } catch (err) {
    console.error('Shop PUT error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
