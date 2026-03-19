import { createServerClient, createServiceRoleClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'
import { requireShopAdmin, getShopContext } from '@/lib/shop-auth'

// GET /api/shops/[shopId]/employees — List employees (any shop employee can view)
// Returns display_name from profiles, current_user_id, and shop owner
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ shopId: string }> }
) {
  try {
    const { shopId } = await params
    const supabase = await createServerClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Any active shop employee can view the employee list (needed for tech picker)
    const shopCtx = await getShopContext(supabase, user.id, shopId)
    if (!shopCtx) {
      return NextResponse.json({ error: 'Forbidden — shop employee access required' }, { status: 403 })
    }

    // Use service role to bypass RLS on profiles (employees can't read other users' profiles)
    const serviceClient = createServiceRoleClient()

    // Fetch employees + shop owner in parallel
    const [empResult, shopResult] = await Promise.all([
      serviceClient
        .from('shop_employees')
        .select('id, shop_id, user_id, email, phone, role, invited_at, accepted_at, removed_at')
        .eq('shop_id', shopId)
        .is('removed_at', null)
        .order('invited_at', { ascending: true }),
      serviceClient
        .from('shops')
        .select('created_by')
        .eq('id', shopId)
        .single(),
    ])

    if (empResult.error) {
      console.error('Employee list error:', empResult.error)
      return NextResponse.json({ error: 'Failed to fetch employees' }, { status: 500 })
    }

    const employees = empResult.data ?? []
    const ownerId: string | null = shopResult.data?.created_by ?? null

    // Collect all user_ids (employees + owner) to batch-fetch display names
    const userIds = new Set<string>()
    for (const emp of employees) {
      if (emp.user_id) userIds.add(emp.user_id)
    }
    if (ownerId) userIds.add(ownerId)

    // Batch-fetch profiles for display_name
    const profileMap = new Map<string, string>()
    if (userIds.size > 0) {
      const { data: profiles } = await serviceClient
        .from('profiles')
        .select('id, display_name')
        .in('id', [...userIds])

      if (profiles) {
        for (const p of profiles) {
          if (p.display_name) profileMap.set(p.id, p.display_name)
        }
      }
    }

    // Enrich employees with display_name
    const enriched = employees.map((emp) => ({
      ...emp,
      display_name: (emp.user_id && profileMap.get(emp.user_id)) || null,
    }))

    // Build owner info
    const owner = ownerId ? {
      user_id: ownerId,
      display_name: profileMap.get(ownerId) || null,
    } : null

    return NextResponse.json({ employees: enriched, owner, current_user_id: user.id })
  } catch (err) {
    console.error('Employees GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/shops/[shopId]/employees — Invite an employee by email OR phone (admin only)
// Sends SMS invite via Twilio when phone number is provided.
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
    const { email, phone, role } = body as { email?: string; phone?: string; role?: string }

    if (!email && !phone) {
      return NextResponse.json({ error: 'Email or phone number is required' }, { status: 400 })
    }

    const employeeRole = role === 'admin' ? 'admin' : 'technician'
    const normalizedEmail = email?.trim().toLowerCase() || null
    const normalizedPhone = phone ? phone.replace(/\D/g, '') : null

    // Validate phone format if provided (10 digits US, or 11 with leading 1)
    if (normalizedPhone && (normalizedPhone.length < 10 || normalizedPhone.length > 11)) {
      return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 })
    }

    // Check for existing active employee by email or phone
    if (normalizedEmail) {
      const { data: existingByEmail } = await supabase
        .from('shop_employees')
        .select('id')
        .eq('shop_id', shopId)
        .eq('email', normalizedEmail)
        .is('removed_at', null)
        .maybeSingle()

      if (existingByEmail) {
        return NextResponse.json({ error: 'This email is already an active employee of this shop' }, { status: 409 })
      }
    }

    if (normalizedPhone) {
      const { data: existingByPhone } = await supabase
        .from('shop_employees')
        .select('id')
        .eq('shop_id', shopId)
        .eq('phone', normalizedPhone)
        .is('removed_at', null)
        .maybeSingle()

      if (existingByPhone) {
        return NextResponse.json({ error: 'This phone number is already an active employee of this shop' }, { status: 409 })
      }
    }

    // Build the insert — at least one of email/phone will be set (validated above)
    const insertData: Record<string, unknown> = {
      shop_id: shopId,
      role: employeeRole,
      invited_by: user.id,
    }
    if (normalizedEmail) insertData.email = normalizedEmail
    if (normalizedPhone) insertData.phone = normalizedPhone

    const { data: employee, error: insertError } = await supabase
      .from('shop_employees')
      .insert(insertData)
      .select()
      .single()

    if (insertError) {
      console.error('Employee invite error:', insertError)
      return NextResponse.json({ error: 'Failed to invite employee', detail: insertError.message }, { status: 500 })
    }

    // Send SMS invite if phone number was provided
    let smsSent = false
    if (normalizedPhone) {
      try {
        const accountSid = process.env.TWILIO_ACCOUNT_SID
        const authToken = process.env.TWILIO_AUTH_TOKEN
        const twilioPhone = process.env.TWILIO_PHONE_NUMBER

        if (accountSid && authToken && twilioPhone) {
          // Get shop name for the SMS
          const { data: shop } = await supabase
            .from('shops')
            .select('name')
            .eq('id', shopId)
            .single()

          const shopName = shop?.name || 'a shop'

          // Format phone for Twilio (+1 prefix for US)
          let toPhone = normalizedPhone
          if (toPhone.length === 10) toPhone = '1' + toPhone
          if (!toPhone.startsWith('+')) toPhone = '+' + toPhone

          const twilio = (await import('twilio')).default
          const client = twilio(accountSid, authToken)

          await client.messages.create({
            body: `You've been invited to join ${shopName} on QRSTKR! Create your account and accept your invite at: https://qrstkr.com/shop/invite`,
            from: twilioPhone,
            to: toPhone,
          })

          smsSent = true
        }
      } catch (smsErr) {
        // Don't fail the invite if SMS fails — the invite row is still created
        console.error('SMS invite error (non-fatal):', smsErr)
      }
    }

    return NextResponse.json({ employee, smsSent }, { status: 201 })
  } catch (err) {
    console.error('Employee POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
