import { createServerClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

// Hardcoded admin user IDs for now — move to a proper admin role system later
// TODO: Replace with role-based auth from profiles table
const ADMIN_EMAILS = ['beckeeper78@gmail.com']

async function isAdmin(supabase: Awaited<ReturnType<typeof createServerClient>>) {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return { isAdmin: false, user: null }
  return { isAdmin: ADMIN_EMAILS.includes(user.email || ''), user }
}

// GET /api/admin/orders — Admin print queue (all orders, filterable by status)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { isAdmin: admin, user } = await isAdmin(supabase)

    if (!admin || !user) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    // Admin needs to bypass RLS — use service role or a special admin policy
    // For now, since the admin IS a user, we'll query with a broader select
    // NOTE: This will need a service-role client for production
    let query = supabase
      .from('orders')
      .select(`
        *,
        order_items (*)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status) {
      query = query.eq('status', status)
    }

    const { data: orders, error, count } = await query

    if (error) {
      console.error('Admin orders fetch error:', error)
      return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
    }

    return NextResponse.json({ orders, total: count })
  } catch (err) {
    console.error('Admin orders API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/admin/orders — Update order status (admin only)
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { isAdmin: admin } = await isAdmin(supabase)

    if (!admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { order_id, status, admin_notes } = body

    if (!order_id || !status) {
      return NextResponse.json({ error: 'order_id and status are required' }, { status: 400 })
    }

    // Build update object with appropriate timestamp
    const update: Record<string, unknown> = { status }
    if (admin_notes !== undefined) update.admin_notes = admin_notes

    const timestampMap: Record<string, string> = {
      paid: 'paid_at',
      generated: 'generated_at',
      printing: 'printed_at',
      shipped: 'shipped_at',
      completed: 'completed_at',
    }
    if (timestampMap[status]) {
      update[timestampMap[status]] = new Date().toISOString()
    }

    const { data: order, error } = await supabase
      .from('orders')
      .update(update)
      .eq('id', order_id)
      .select(`
        *,
        order_items (*)
      `)
      .single()

    if (error) {
      console.error('Admin order update error:', error)
      return NextResponse.json({ error: 'Failed to update order' }, { status: 500 })
    }

    return NextResponse.json({ order })
  } catch (err) {
    console.error('Admin orders API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
