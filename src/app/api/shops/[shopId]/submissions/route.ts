import { createServerClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'
import { getShopContext } from '@/lib/shop-auth'

// GET /api/shops/[shopId]/submissions — List records submitted by this shop
// Searchable by customer name/phone, filterable by date range/service type/employee
export async function GET(
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

    // Verify user is an employee of this shop
    const shopCtx = await getShopContext(supabase, user.id, shopId)
    if (!shopCtx) {
      return NextResponse.json({ error: 'Forbidden — shop employee access required' }, { status: 403 })
    }

    // Parse query params (frontend sends 'from', 'to', 'type')
    const searchParams = request.nextUrl.searchParams
    const dateFrom = searchParams.get('from') || searchParams.get('date_from')
    const dateTo = searchParams.get('to') || searchParams.get('date_to')
    const recordType = searchParams.get('type') || searchParams.get('record_type')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build query — join with items (no nested profiles join — profiles
    // RLS blocks shop employees from reading other users' profiles)
    let query = supabase
      .from('maintenance_records')
      .select(`
        id, item_id, record_type, title, description, service_date,
        cost_cents, mileage_at_service, visit_id, submitted_by,
        technicians, disputed, disputed_at, created_at,
        items!inner (id, make, model, year, nickname)
      `, { count: 'exact' })
      .eq('performed_by_shop', shopId)
      .eq('source', 'shop_submitted')
      .or('disputed.is.null,disputed.eq.false')
      .order('service_date', { ascending: false })

    if (dateFrom) query = query.gte('service_date', dateFrom)
    if (dateTo) query = query.lte('service_date', dateTo)
    if (recordType) query = query.eq('record_type', recordType)

    query = query.range(offset, offset + limit - 1)

    const { data: records, error, count } = await query

    if (error) {
      console.error('Submissions list error:', error)
      return NextResponse.json({ error: 'Failed to fetch submissions', detail: error.message }, { status: 500 })
    }

    return NextResponse.json({ records, total: count, limit, offset })
  } catch (err) {
    console.error('Submissions GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
