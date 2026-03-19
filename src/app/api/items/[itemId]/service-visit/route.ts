import { createServerClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'
import { getShopContext } from '@/lib/shop-auth'
import type { CreateServiceVisitRequest } from '@/lib/types'

// POST /api/items/[itemId]/service-visit — Submit a service visit (shop employees only)
// Creates one maintenance_record per line item, all sharing the same visit_id.
// Also creates a notification for the item owner.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const { itemId } = await params
    const supabase = await createServerClient()

    // 1. Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Verify the user is an active shop employee
    const shopCtx = await getShopContext(supabase, user.id)
    if (!shopCtx) {
      return NextResponse.json({ error: 'Forbidden — shop employee access required' }, { status: 403 })
    }

    // 3. Verify the item exists and get owner info
    const { data: item, error: itemError } = await supabase
      .from('items')
      .select('id, owner_id, make, model, year')
      .eq('id', itemId)
      .single()

    if (itemError || !item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    // 4. Parse and validate request body
    const body: CreateServiceVisitRequest = await request.json()
    const { service_date, mileage_at_service, technicians, line_items } = body

    if (!service_date) {
      return NextResponse.json({ error: 'service_date is required' }, { status: 400 })
    }

    if (!line_items || line_items.length === 0) {
      return NextResponse.json({ error: 'At least one line item is required' }, { status: 400 })
    }

    // Validate each line item
    for (let i = 0; i < line_items.length; i++) {
      const li = line_items[i]
      if (!li.title) {
        return NextResponse.json({ error: `Line item ${i + 1}: title is required` }, { status: 400 })
      }
      if (!li.record_type) {
        return NextResponse.json({ error: `Line item ${i + 1}: record_type is required` }, { status: 400 })
      }
    }

    // 5. Generate a shared visit_id for all records in this visit
    const visitId = crypto.randomUUID()

    // 6. Get the shop name for the provider field
    const { data: shop } = await supabase
      .from('shops')
      .select('name, verified')
      .eq('id', shopCtx.shop_id)
      .single()

    const shopName = shop?.name || 'Unknown Shop'

    // 7. Sanitize technicians array (strings only, trimmed, deduped)
    const cleanTechs: string[] = Array.isArray(technicians)
      ? [...new Set(technicians.map((t: unknown) => String(t).trim()).filter(Boolean))]
      : []

    // 8. Build the maintenance record rows
    const records = line_items.map((li) => ({
      item_id: itemId,
      created_by: user.id,
      record_type: li.record_type,
      title: li.title,
      description: li.description || null,
      service_date,
      cost_cents: li.cost_cents ?? null,
      mileage: mileage_at_service ?? null,
      provider: shopName,
      technicians: cleanTechs,
      // Shop-specific fields
      visit_id: visitId,
      mileage_at_service: mileage_at_service ?? null,
      performed_by_shop: shopCtx.shop_id,
      submitted_by: user.id,
      source: 'shop_submitted' as const,
    }))

    // 9. Insert all records
    const { data: insertedRecords, error: insertError } = await supabase
      .from('maintenance_records')
      .insert(records)
      .select()

    if (insertError) {
      console.error('Service visit insert error:', insertError)
      return NextResponse.json({ error: 'Failed to create service records', detail: insertError.message }, { status: 500 })
    }

    // Notification insert removed — notifications table does not exist

    return NextResponse.json({
      visit_id: visitId,
      records_created: insertedRecords?.length || 0,
      records: insertedRecords,
    }, { status: 201 })

  } catch (err) {
    console.error('Service visit error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
