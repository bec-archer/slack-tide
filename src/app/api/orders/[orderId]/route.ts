import { createServerClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/orders/[orderId] — Get a specific order with its items
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const supabase = await createServerClient()
    const { orderId } = await params

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: order, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (*)
      `)
      .eq('id', orderId)
      .eq('user_id', user.id)
      .single()

    if (error || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    return NextResponse.json({ order })
  } catch (err) {
    console.error('Order fetch error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/orders/[orderId] — Cancel a pending order
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const supabase = await createServerClient()
    const { orderId } = await params

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // Users can only cancel their own pending orders
    if (body.status === 'cancelled') {
      const { data: order, error } = await supabase
        .from('orders')
        .update({ status: 'cancelled' })
        .eq('id', orderId)
        .eq('user_id', user.id)
        .eq('status', 'pending_payment')
        .select()
        .single()

      if (error || !order) {
        return NextResponse.json(
          { error: 'Cannot cancel — order not found or not in pending state' },
          { status: 400 }
        )
      }

      return NextResponse.json({ order })
    }

    return NextResponse.json({ error: 'Invalid update' }, { status: 400 })
  } catch (err) {
    console.error('Order update error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
