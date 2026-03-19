import { createServerClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'
import { requireShopAdmin } from '@/lib/shop-auth'

interface VerificationDocs {
  sms_code: string
  sms_expires_at: string
  sms_phone: string
  sms_attempts: number
}

// POST /api/shops/[shopId]/verify/confirm-code — Confirm SMS verification code
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

    const body = await request.json()
    const { code } = body as { code: string }

    if (!code || code.length !== 6) {
      return NextResponse.json({ error: 'A 6-digit verification code is required' }, { status: 400 })
    }

    // Get shop with verification data
    const { data: shop } = await supabase
      .from('shops')
      .select('id, verified, verification_docs')
      .eq('id', shopId)
      .single()

    if (!shop) {
      return NextResponse.json({ error: 'Shop not found' }, { status: 404 })
    }

    if (shop.verified) {
      return NextResponse.json({ error: 'Shop is already verified' }, { status: 400 })
    }

    const docs = shop.verification_docs as VerificationDocs | null
    if (!docs?.sms_code || !docs?.sms_expires_at) {
      return NextResponse.json({ error: 'No verification code has been sent. Please start the verification process again.' }, { status: 400 })
    }

    // Check expiry
    if (new Date(docs.sms_expires_at) < new Date()) {
      return NextResponse.json({ error: 'Verification code has expired. Please request a new one.' }, { status: 400 })
    }

    // Check max attempts (prevent brute force)
    if (docs.sms_attempts >= 5) {
      return NextResponse.json({ error: 'Too many attempts. Please request a new verification code.' }, { status: 429 })
    }

    // Increment attempts
    await supabase
      .from('shops')
      .update({
        verification_docs: { ...docs, sms_attempts: docs.sms_attempts + 1 },
      })
      .eq('id', shopId)

    // Check code
    if (code !== docs.sms_code) {
      const remaining = 4 - docs.sms_attempts
      return NextResponse.json({
        error: `Incorrect code. ${remaining > 0 ? `${remaining} attempts remaining.` : 'Please request a new code.'}`,
      }, { status: 400 })
    }

    // Code is correct — mark shop as verified
    const { data: updated, error: updateError } = await supabase
      .from('shops')
      .update({
        verified: true,
        verified_at: new Date().toISOString(),
        verified_method: 'google_business',
        verification_requested: false,
        verification_docs: null, // Clear the code
        updated_at: new Date().toISOString(),
      })
      .eq('id', shopId)
      .select()
      .single()

    if (updateError) {
      console.error('Failed to mark shop as verified:', updateError)
      return NextResponse.json({ error: 'Failed to complete verification' }, { status: 500 })
    }

    return NextResponse.json({ message: 'Shop verified successfully', shop: updated })
  } catch (err) {
    console.error('Confirm code error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
