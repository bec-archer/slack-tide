import { createServerClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'
import { requireShopAdmin } from '@/lib/shop-auth'
import twilio from 'twilio'

// POST /api/shops/[shopId]/verify/send-code — Send SMS verification code
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
    const { googlePhone } = body as { googlePhone: string }

    if (!googlePhone) {
      return NextResponse.json({ error: 'googlePhone is required' }, { status: 400 })
    }

    // Get shop
    const { data: shop } = await supabase
      .from('shops')
      .select('id, phone, verified')
      .eq('id', shopId)
      .single()

    if (!shop) {
      return NextResponse.json({ error: 'Shop not found' }, { status: 404 })
    }

    if (shop.verified) {
      return NextResponse.json({ error: 'Shop is already verified' }, { status: 400 })
    }

    // Normalize phone numbers for comparison (strip non-digits)
    const normalizePhone = (p: string): string => p.replace(/\D/g, '').replace(/^1/, '')
    const shopDigits = normalizePhone(shop.phone)
    const googleDigits = normalizePhone(googlePhone)

    if (shopDigits !== googleDigits) {
      return NextResponse.json({
        error: 'Phone number mismatch. The phone number you entered during registration does not match the Google Business listing. Please update your shop phone number or request manual verification.',
      }, { status: 400 })
    }

    // Generate 6-digit code
    const code = String(Math.floor(100000 + Math.random() * 900000))
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutes

    // Store code in verification_docs (JSONB) — temporary storage
    const { error: updateError } = await supabase
      .from('shops')
      .update({
        verification_docs: {
          sms_code: code,
          sms_expires_at: expiresAt,
          sms_phone: googlePhone,
          sms_attempts: 0,
        },
        verification_requested: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', shopId)

    if (updateError) {
      console.error('Failed to store verification code:', updateError)
      return NextResponse.json({ error: 'Failed to initiate verification' }, { status: 500 })
    }

    // Send SMS via Twilio
    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const twilioPhone = process.env.TWILIO_PHONE_NUMBER

    if (!accountSid || !authToken || !twilioPhone) {
      console.error('Twilio credentials not configured')
      return NextResponse.json({ error: 'SMS service not configured' }, { status: 500 })
    }

    // Format the phone number for Twilio (needs +1 prefix for US)
    let toPhone = googlePhone.replace(/\D/g, '')
    if (toPhone.length === 10) toPhone = '1' + toPhone
    if (!toPhone.startsWith('+')) toPhone = '+' + toPhone

    const client = twilio(accountSid, authToken)

    await client.messages.create({
      body: `Your QRSTKR shop verification code is: ${code}. This code expires in 10 minutes.`,
      from: twilioPhone,
      to: toPhone,
    })

    return NextResponse.json({ message: 'Verification code sent', expiresAt })
  } catch (err) {
    console.error('Send code error:', err)
    return NextResponse.json({ error: 'Failed to send verification code' }, { status: 500 })
  }
}
