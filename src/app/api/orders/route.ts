import { createServerClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'
import type { CreateOrderRequest } from '@/lib/types'
import { patchDesignSvgWithRealQr } from '@/lib/circular-qr'

// POST /api/orders — Create a new sticker order
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()

    // Require auth — user creates account as part of checkout
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: CreateOrderRequest = await request.json()
    const { sticker_config, design_svg, payment_method, payment_ref, shipping } = body

    // Validate required fields
    if (!sticker_config?.state_template) {
      return NextResponse.json({ error: 'state_template is required' }, { status: 400 })
    }
    if (!design_svg) {
      return NextResponse.json({ error: 'design_svg is required' }, { status: 400 })
    }

    // If paying with coupon, validate it
    let amountCents = 999 // Default price: $9.99 per sticker (placeholder)
    if (payment_method === 'coupon' && payment_ref) {
      const { data: couponResult, error: couponError } = await supabase
        .rpc('validate_coupon', { coupon_code: payment_ref })

      if (couponError || !couponResult?.[0]?.valid) {
        return NextResponse.json(
          { error: couponResult?.[0]?.reason || 'Invalid coupon' },
          { status: 400 }
        )
      }

      const coupon = couponResult[0]
      if (coupon.discount_type === 'full') {
        amountCents = 0
      } else if (coupon.discount_type === 'percent') {
        amountCents = Math.round(amountCents * (1 - coupon.discount_value / 100))
      } else if (coupon.discount_type === 'fixed_cents') {
        amountCents = Math.max(0, amountCents - coupon.discount_value)
      }
    } else if (payment_method === 'free_test') {
      amountCents = 0
    }

    // Create the order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        user_id: user.id,
        status: amountCents === 0 ? 'paid' : 'pending_payment',
        payment_method,
        payment_ref: payment_ref || null,
        amount_cents: amountCents,
        shipping_name: shipping?.name || null,
        shipping_address: shipping?.address || null,
        shipping_city: shipping?.city || null,
        shipping_state: shipping?.state || null,
        shipping_zip: shipping?.zip || null,
        ...(amountCents === 0 ? { paid_at: new Date().toISOString() } : {}),
      })
      .select()
      .single()

    if (orderError) {
      console.error('Order creation error:', orderError)
      return NextResponse.json({ error: 'Failed to create order', detail: orderError.message, code: orderError.code }, { status: 500 })
    }

    // Allocate a short_code for the sticker
    const { data: shortCodeResult, error: shortCodeError } = await supabase
      .rpc('allocate_short_code')

    if (shortCodeError) {
      console.error('Short code allocation error:', shortCodeError)
      return NextResponse.json({ error: 'Failed to allocate sticker code' }, { status: 500 })
    }

    const shortCode = shortCodeResult as string
    const qrUrl = `https://qrstkr.com/i/${shortCode}`

    // Create the sticker record so the scan/lookup page can find it
    const { data: stickerRecord, error: stickerError } = await supabase
      .from('stickers')
      .insert({
        short_code: shortCode,
        status: 'unregistered',
      })
      .select('id')
      .single()

    if (stickerError) {
      console.error('Sticker record creation error:', stickerError)
      // Non-fatal: order can still proceed, sticker just won't be scannable yet
    }

    // Patch the captured SVG: replace demo QR with real QR encoding this order's URL
    const qrColor = sticker_config.color_qr || '#000000'
    const qrBgColor = sticker_config.color_bg || '#ffffff'
    let finalSvg = design_svg
    try {
      finalSvg = patchDesignSvgWithRealQr(design_svg, qrUrl, qrColor, qrBgColor)
    } catch (patchErr) {
      console.error('QR patch failed, using original SVG:', patchErr)
      // Fall through with original SVG — at least the design is saved
    }

    // Create the order item with sticker config
    const { data: orderItem, error: itemError } = await supabase
      .from('order_items')
      .insert({
        order_id: order.id,
        design_svg: finalSvg,
        state_template: sticker_config.state_template,
        qr_position_x: sticker_config.qr_position_x,
        qr_position_y: sticker_config.qr_position_y,
        qr_size: sticker_config.qr_size,
        color_bg: sticker_config.color_bg,
        color_stroke: sticker_config.color_stroke,
        color_fill: sticker_config.color_fill,
        color_qr: sticker_config.color_qr,
        color_halo: sticker_config.color_halo,
        stroke_weight: sticker_config.stroke_weight,
        has_fill: sticker_config.has_fill,
        has_stroke: sticker_config.has_stroke,
        gradient_enabled: sticker_config.gradient_enabled,
        gradient_color1: sticker_config.gradient_color1,
        gradient_color2: sticker_config.gradient_color2,
        gradient_angle: sticker_config.gradient_angle,
        short_code: shortCode,
        qr_url: qrUrl,
        ...(stickerRecord ? { sticker_id: stickerRecord.id } : {}),
      })
      .select()
      .single()

    if (itemError) {
      console.error('Order item creation error:', itemError)
      return NextResponse.json({ error: 'Failed to create order item' }, { status: 500 })
    }

    // If coupon was used, redeem it
    if (payment_method === 'coupon' && payment_ref) {
      await supabase.rpc('redeem_coupon', { coupon_code: payment_ref })
    }

    // If the order is already paid (coupon/free), trigger generation
    if (order.status === 'paid' || amountCents === 0) {
      // TODO: Phase 1b — Call the Python generation service here
      // For now, just mark order as paid and ready for generation
      await supabase
        .from('orders')
        .update({ status: 'paid', paid_at: new Date().toISOString() })
        .eq('id', order.id)
    }

    // Auto-save shipping info to user profile if they don't have one yet
    if (shipping?.name) {
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('shipping_name')
        .eq('id', user.id)
        .single()

      if (!existingProfile?.shipping_name) {
        await supabase
          .from('profiles')
          .upsert({
            id: user.id,
            shipping_name: shipping.name,
            shipping_address: shipping.address,
            shipping_city: shipping.city,
            shipping_state: shipping.state,
            shipping_zip: shipping.zip,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'id' })
      }
    }

    return NextResponse.json({
      order: { ...order, status: amountCents === 0 ? 'paid' : order.status },
      order_item: orderItem,
      short_code: shortCode,
      qr_url: qrUrl,
    }, { status: 201 })

  } catch (err) {
    console.error('Order API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET /api/orders — List current user's orders
export async function GET() {
  try {
    const supabase = await createServerClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (*)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Orders fetch error:', error)
      return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
    }

    return NextResponse.json({ orders })
  } catch (err) {
    console.error('Orders API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
