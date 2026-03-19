import { createServerClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'
import { requireShopAdmin } from '@/lib/shop-auth'

// POST /api/shops/[shopId]/verify — Request manual verification (shop admin only)
export async function POST(
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

    // Check current status
    const { data: shop } = await supabase
      .from('shops')
      .select('verified, verification_requested')
      .eq('id', shopId)
      .single()

    if (shop?.verified) {
      return NextResponse.json({ error: 'Shop is already verified' }, { status: 400 })
    }

    if (shop?.verification_requested) {
      return NextResponse.json({ error: 'Verification request already submitted' }, { status: 409 })
    }

    // Parse optional verification docs (photo URLs)
    let verificationDocs = null
    try {
      const body = await request.json()
      if (body?.docs && Array.isArray(body.docs)) {
        verificationDocs = body.docs
      }
    } catch {
      // No body or invalid JSON — that's fine, docs are optional
    }

    // Mark as verification requested, store docs if provided
    const updatePayload: Record<string, unknown> = {
      verification_requested: true,
      updated_at: new Date().toISOString(),
    }

    if (verificationDocs) {
      updatePayload.verification_docs = verificationDocs
    }

    const { data: updated, error } = await supabase
      .from('shops')
      .update(updatePayload)
      .eq('id', shopId)
      .select()
      .single()

    if (error) {
      console.error('Verification request error:', error)
      return NextResponse.json({ error: 'Failed to submit verification request' }, { status: 500 })
    }

    return NextResponse.json({ message: 'Verification request submitted', shop: updated })
  } catch (err) {
    console.error('Verify POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
