import { createServerClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'
import { getShopContext } from '@/lib/shop-auth'

// GET /api/shops/[shopId]/disputes — List disputed records for this shop
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

    const limit = Math.min(parseInt(request.nextUrl.searchParams.get('limit') || '50'), 100)
    const offset = parseInt(request.nextUrl.searchParams.get('offset') || '0')

    const { data: disputes, error, count } = await supabase
      .from('maintenance_records')
      .select(`
        id, item_id, record_type, title, description, service_date,
        cost_cents, disputed_at, dispute_reason, visit_id, created_at,
        items!inner (id, nickname, make, model, year)
      `, { count: 'exact' })
      .eq('performed_by_shop', shopId)
      .eq('disputed', true)
      .order('disputed_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Disputes list error:', error)
      return NextResponse.json({ error: 'Failed to fetch disputes', detail: error.message }, { status: 500 })
    }

    return NextResponse.json({ disputes, total: count, limit, offset })
  } catch (err) {
    console.error('Disputes GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
