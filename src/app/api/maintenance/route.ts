import { createServerClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'
import type { CreateMaintenanceRequest } from '@/lib/types'

// GET /api/maintenance?item_id=xxx — List maintenance records for an item
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const itemId = request.nextUrl.searchParams.get('item_id')

    if (!itemId) {
      return NextResponse.json({ error: 'item_id is required' }, { status: 400 })
    }

    const { data: records, error } = await supabase
      .from('maintenance_records')
      .select('*')
      .eq('item_id', itemId)
      .or('disputed.is.null,disputed.eq.false')
      .order('service_date', { ascending: false })

    if (error) {
      console.error('Maintenance records fetch error:', error)
      return NextResponse.json({ error: 'Failed to fetch records' }, { status: 500 })
    }

    return NextResponse.json({ records })
  } catch (err) {
    console.error('Maintenance GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/maintenance — Create a maintenance record
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: CreateMaintenanceRequest = await request.json()
    const { item_id, record_type, title, description, service_date, cost_cents, mileage, provider } = body

    // Validate required fields
    if (!item_id) {
      return NextResponse.json({ error: 'item_id is required' }, { status: 400 })
    }
    if (!title?.trim()) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 })
    }
    if (!service_date) {
      return NextResponse.json({ error: 'service_date is required' }, { status: 400 })
    }

    // Verify user owns this item
    const { data: item, error: itemError } = await supabase
      .from('items')
      .select('id, owner_id')
      .eq('id', item_id)
      .single()

    if (itemError || !item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    if (item.owner_id !== user.id) {
      return NextResponse.json({ error: 'You can only add records to your own items' }, { status: 403 })
    }

    // Create the record
    const { data: record, error: insertError } = await supabase
      .from('maintenance_records')
      .insert({
        item_id,
        created_by: user.id,
        record_type: record_type || 'service',
        title: title.trim(),
        description: description?.trim() || null,
        service_date,
        cost_cents: cost_cents ?? null,
        mileage: mileage ?? null,
        provider: provider?.trim() || null,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Maintenance record insert error:', insertError)
      return NextResponse.json({ error: 'Failed to create record', detail: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ record }, { status: 201 })
  } catch (err) {
    console.error('Maintenance POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
