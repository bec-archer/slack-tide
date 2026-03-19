import { createServerClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

// DELETE /api/maintenance/[recordId] — Delete a maintenance record
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ recordId: string }> }
) {
  try {
    const supabase = await createServerClient()
    const { recordId } = await params

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // RLS handles permission check (creator or item owner can delete)
    const { error: deleteError } = await supabase
      .from('maintenance_records')
      .delete()
      .eq('id', recordId)

    if (deleteError) {
      console.error('Maintenance record delete error:', deleteError)
      return NextResponse.json({ error: 'Failed to delete record' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Maintenance DELETE error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/maintenance/[recordId] — Update a maintenance record
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ recordId: string }> }
) {
  try {
    const supabase = await createServerClient()
    const { recordId } = await params

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const updates: Record<string, unknown> = {}

    // Only allow updating specific fields
    if (body.title !== undefined) updates.title = body.title.trim()
    if (body.description !== undefined) updates.description = body.description?.trim() || null
    if (body.record_type !== undefined) updates.record_type = body.record_type
    if (body.service_date !== undefined) updates.service_date = body.service_date
    if (body.cost_cents !== undefined) updates.cost_cents = body.cost_cents
    if (body.mileage !== undefined) updates.mileage = body.mileage
    if (body.provider !== undefined) updates.provider = body.provider?.trim() || null

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    // RLS handles permission check (only creator can update)
    const { data: record, error: updateError } = await supabase
      .from('maintenance_records')
      .update(updates)
      .eq('id', recordId)
      .select()
      .single()

    if (updateError) {
      console.error('Maintenance record update error:', updateError)
      return NextResponse.json({ error: 'Failed to update record' }, { status: 500 })
    }

    return NextResponse.json({ record })
  } catch (err) {
    console.error('Maintenance PATCH error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
