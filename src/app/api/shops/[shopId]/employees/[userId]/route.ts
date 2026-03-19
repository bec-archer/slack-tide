import { createServerClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'
import { requireShopAdmin } from '@/lib/shop-auth'

// DELETE /api/shops/[shopId]/employees/[userId] — Remove an employee (soft delete, admin only)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ shopId: string; userId: string }> }
) {
  try {
    const { shopId, userId } = await params
    const supabase = await createServerClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminCtx = await requireShopAdmin(supabase, user.id, shopId)
    if (!adminCtx) {
      return NextResponse.json({ error: 'Forbidden — shop admin access required' }, { status: 403 })
    }

    // Don't let the admin remove themselves
    if (userId === user.id) {
      return NextResponse.json({ error: 'Cannot remove yourself — transfer admin role first' }, { status: 400 })
    }

    // Soft-delete: set removed_at timestamp
    const { data: employee, error } = await supabase
      .from('shop_employees')
      .update({ removed_at: new Date().toISOString() })
      .eq('shop_id', shopId)
      .eq('user_id', userId)
      .is('removed_at', null)
      .select()
      .single()

    if (error || !employee) {
      return NextResponse.json({ error: 'Employee not found or already removed' }, { status: 404 })
    }

    return NextResponse.json({ message: 'Employee removed', employee })
  } catch (err) {
    console.error('Employee DELETE error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
