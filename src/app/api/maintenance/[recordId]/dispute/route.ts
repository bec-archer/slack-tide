import { createServerClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'
import type { DisputeRecordRequest } from '@/lib/types'

// POST /api/maintenance/[recordId]/dispute — Owner disputes a shop-submitted record
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ recordId: string }> }
) {
  try {
    const { recordId } = await params
    const supabase = await createServerClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the record and verify the user owns the item
    const { data: record, error: recordError } = await supabase
      .from('maintenance_records')
      .select('id, item_id, source, disputed, performed_by_shop')
      .eq('id', recordId)
      .single()

    if (recordError || !record) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 })
    }

    // Only shop-submitted records can be disputed
    if (record.source !== 'shop_submitted') {
      return NextResponse.json({ error: 'Only shop-submitted records can be disputed' }, { status: 400 })
    }

    // Already disputed
    if (record.disputed) {
      return NextResponse.json({ error: 'This record has already been disputed' }, { status: 409 })
    }

    // Verify the user owns the item this record belongs to
    const { data: item } = await supabase
      .from('items')
      .select('id, owner_id')
      .eq('id', record.item_id)
      .eq('owner_id', user.id)
      .single()

    if (!item) {
      return NextResponse.json({ error: 'Forbidden — you do not own this item' }, { status: 403 })
    }

    // Parse the reason
    const body: DisputeRecordRequest = await request.json()
    if (!body.reason || body.reason.trim().length === 0) {
      return NextResponse.json({ error: 'A dispute reason is required' }, { status: 400 })
    }

    // Set the dispute flags (soft-delete: record stays in DB but disappears from views)
    const { data: updated, error: updateError } = await supabase
      .from('maintenance_records')
      .update({
        disputed: true,
        disputed_at: new Date().toISOString(),
        dispute_reason: body.reason.trim(),
      })
      .eq('id', recordId)
      .select()
      .single()

    if (updateError) {
      console.error('Dispute update error:', updateError)
      return NextResponse.json({ error: 'Failed to dispute record', detail: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ message: 'Record disputed', record: updated })
  } catch (err) {
    console.error('Dispute error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
