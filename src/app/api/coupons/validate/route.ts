import { createServerClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

// POST /api/coupons/validate — Check if a coupon code is valid
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { code } = await request.json()
    if (!code) {
      return NextResponse.json({ error: 'Coupon code is required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .rpc('validate_coupon', { coupon_code: code.trim().toUpperCase() })

    if (error) {
      console.error('Coupon validation error:', error)
      return NextResponse.json({ error: 'Failed to validate coupon' }, { status: 500 })
    }

    const result = data?.[0]
    if (!result) {
      return NextResponse.json({ valid: false, reason: 'Invalid coupon code' })
    }

    return NextResponse.json({
      valid: result.valid,
      discount_type: result.discount_type,
      discount_value: result.discount_value,
      reason: result.reason,
    })
  } catch (err) {
    console.error('Coupon validation API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
