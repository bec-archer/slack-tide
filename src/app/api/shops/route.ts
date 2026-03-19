import { createServerClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'
import type { CreateShopRequest } from '@/lib/types'

// POST /api/shops — Register a new shop
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if this is a personal account with items — block shop registration
    const { data: profile } = await supabase
      .from('profiles')
      .select('account_type')
      .eq('id', user.id)
      .maybeSingle()

    if (profile?.account_type === 'personal') {
      // Check if they have any items registered
      const { count } = await supabase
        .from('items')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', user.id)

      if (count && count > 0) {
        return NextResponse.json({
          error: 'This account has items registered to it and cannot be used as a business account. Please create a separate account with a different email for your shop.'
        }, { status: 403 })
      }
    }

    const body: CreateShopRequest = await request.json()
    const { name, address, city, state, phone, website, categories_serviced } = body

    // Validate required fields
    if (!name || !address || !city || !state || !phone) {
      return NextResponse.json({ error: 'name, address, city, state, and phone are required' }, { status: 400 })
    }

    if (!categories_serviced || categories_serviced.length === 0) {
      return NextResponse.json({ error: 'At least one service category is required' }, { status: 400 })
    }

    // Create the shop
    const { data: shop, error: shopError } = await supabase
      .from('shops')
      .insert({
        name,
        address,
        city,
        state: state.toUpperCase(),
        phone,
        website: website || null,
        categories_serviced,
        created_by: user.id,
      })
      .select()
      .single()

    if (shopError) {
      console.error('Shop creation error:', shopError)
      return NextResponse.json({ error: 'Failed to create shop', detail: shopError.message }, { status: 500 })
    }

    // Create the admin employee row (bootstrap: the shop creator is the first admin)
    try {
      const { error: employeeError } = await supabase
        .from('shop_employees')
        .insert({
          shop_id: shop.id,
          user_id: user.id,
          email: user.email!,
          role: 'admin',
          invited_by: user.id,
          accepted_at: new Date().toISOString(),
        })

      if (employeeError) {
        console.error('Admin employee creation error:', employeeError)
        // Shop was created but employee link failed — try to clean up
        await supabase.from('shops').delete().eq('id', shop.id)
        return NextResponse.json({ error: 'Failed to set up shop admin', detail: employeeError.message }, { status: 500 })
      }
    } catch (empErr) {
      console.error('shop_employees table error (non-fatal):', empErr)
    }

    // Mark this account as a business account
    await supabase
      .from('profiles')
      .update({ account_type: 'business' })
      .eq('id', user.id)

    return NextResponse.json({ shop }, { status: 201 })
  } catch (err) {
    console.error('Shop registration error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
