import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

/**
 * POST /api/shops/invite — Accept a shop employee invitation
 *
 * The authenticated user's email is matched against pending shop_employees rows.
 * If a match is found (no user_id yet, not removed), the row is linked to this user.
 */
export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const userEmail = user.email

  // Check if the user is already associated with a shop
  try {
    const { data: existingEmployee } = await supabase
      .from('shop_employees')
      .select('id, shop_id')
      .eq('user_id', user.id)
      .is('removed_at', null)
      .limit(1)
      .maybeSingle()

    if (existingEmployee) {
      return NextResponse.json(
        { error: 'You are already associated with a shop' },
        { status: 409 }
      )
    }
  } catch {
    // shop_employees table may not exist — continue
  }

  // Try to find a pending invite by email first
  let invite: { id: string; shop_id: string; role: string } | null = null

  try {
    if (userEmail) {
      const { data: emailInvite } = await supabase
        .from('shop_employees')
        .select('id, shop_id, role')
        .eq('email', userEmail.toLowerCase())
        .is('user_id', null)
        .is('removed_at', null)
        .limit(1)
        .maybeSingle()

      invite = emailInvite
    }

    // If no email match, try matching by phone from the user's profile
    if (!invite) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('phone')
        .eq('id', user.id)
        .maybeSingle()

      if (profile?.phone) {
        const normalizedPhone = profile.phone.replace(/\D/g, '').replace(/^1/, '')
        if (normalizedPhone.length >= 10) {
          // Try both with and without leading 1
          const { data: phoneInvite } = await supabase
            .from('shop_employees')
            .select('id, shop_id, role')
            .or(`phone.eq.${normalizedPhone},phone.eq.1${normalizedPhone}`)
            .is('user_id', null)
            .is('removed_at', null)
            .limit(1)
            .maybeSingle()

          invite = phoneInvite
        }
      }
    }
  } catch {
    // shop_employees table may not exist
  }

  if (!invite) {
    return NextResponse.json(
      { error: 'No pending invitation found for your email or phone number' },
      { status: 404 }
    )
  }

  // Accept the invite: link user_id and set accepted_at
  const { error: updateError } = await supabase
    .from('shop_employees')
    .update({
      user_id: user.id,
      email: userEmail?.toLowerCase() || undefined, // Backfill email if invite was phone-only
      accepted_at: new Date().toISOString(),
    })
    .eq('id', invite.id)

  if (updateError) {
    return NextResponse.json(
      { error: 'Failed to accept invitation' },
      { status: 500 }
    )
  }

  // Set account type to 'business' (same as shop registration)
  await supabase
    .from('profiles')
    .update({ account_type: 'business' })
    .eq('id', user.id)

  // Fetch the shop name for the response
  const { data: shop } = await supabase
    .from('shops')
    .select('name')
    .eq('id', invite.shop_id)
    .single()

  return NextResponse.json({
    success: true,
    shop_id: invite.shop_id,
    shop_name: shop?.name ?? 'Unknown Shop',
    role: invite.role,
  })
}
