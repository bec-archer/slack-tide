import { createServerClient, createServiceRoleClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

const ADMIN_EMAILS = ['beckeeper78@gmail.com']

// GET /api/admin/shops/verification — List shops pending verification
export async function GET() {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user || !ADMIN_EMAILS.includes(user.email || '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Use service role to bypass RLS for admin reads
    const serviceClient = createServiceRoleClient()

    // Get all shops with pending verification requests
    const { data: pending, error: pendingError } = await serviceClient
      .from('shops')
      .select('id, name, address, city, state, phone, website, categories_serviced, verification_requested, verification_docs, created_by, created_at')
      .eq('verification_requested', true)
      .eq('verified', false)
      .order('updated_at', { ascending: true })

    if (pendingError) {
      console.error('Fetch pending verifications error:', pendingError)
      return NextResponse.json({ error: 'Failed to fetch pending verifications' }, { status: 500 })
    }

    // Also get recently verified shops for reference
    const { data: verified, error: verifiedError } = await serviceClient
      .from('shops')
      .select('id, name, city, state, verified_method, verified_at')
      .eq('verified', true)
      .order('verified_at', { ascending: false })
      .limit(10)

    if (verifiedError) {
      console.error('Fetch verified shops error:', verifiedError)
    }

    // Generate signed URLs for verification docs (private bucket)
    const pendingWithUrls = await Promise.all(
      (pending || []).map(async (shop) => {
        if (!shop.verification_docs || !Array.isArray(shop.verification_docs)) {
          return { ...shop, verification_docs: null }
        }

        const docsWithUrls = await Promise.all(
          shop.verification_docs.map(async (doc: { label: string; storage_path?: string; url?: string }) => {
            // If it has a storage_path, generate a signed URL (1 hour expiry)
            if (doc.storage_path) {
              const { data, error: signedUrlError } = await serviceClient.storage
                .from('shop-verification')
                .createSignedUrl(doc.storage_path, 3600)
              if (signedUrlError) {
                console.error('Signed URL error:', doc.storage_path, signedUrlError)
              }
              return { label: doc.label, url: data?.signedUrl || null, storage_path: doc.storage_path }
            }
            // Legacy: if it already has a url field, pass it through
            return { label: doc.label, url: doc.url || null }
          })
        )

        return { ...shop, verification_docs: docsWithUrls.filter((d) => d.url) }
      })
    )

    return NextResponse.json({
      pending: pendingWithUrls,
      recently_verified: verified || [],
    })
  } catch (err) {
    console.error('Admin verification list error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/admin/shops/verification — Approve or reject a shop
export async function POST(request: NextRequest) {
  try {
    // Verify admin identity with session-based client
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user || !ADMIN_EMAILS.includes(user.email || '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { shopId, action } = body as { shopId: string; action: 'approve' | 'reject' }

    if (!shopId || !action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'shopId and action (approve|reject) are required' }, { status: 400 })
    }

    // Use service role to bypass RLS for admin operations
    const serviceClient = createServiceRoleClient()

    // Verify the shop exists and has a pending request
    const { data: shop } = await serviceClient
      .from('shops')
      .select('id, verified, verification_requested')
      .eq('id', shopId)
      .single()

    if (!shop) {
      return NextResponse.json({ error: 'Shop not found' }, { status: 404 })
    }

    if (shop.verified) {
      return NextResponse.json({ error: 'Shop is already verified' }, { status: 400 })
    }

    if (action === 'approve') {
      const { error: updateError } = await serviceClient
        .from('shops')
        .update({
          verified: true,
          verified_method: 'manual_review',
          verified_at: new Date().toISOString(),
          verification_requested: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', shopId)

      if (updateError) {
        console.error('Approve shop error:', updateError)
        return NextResponse.json({ error: 'Failed to approve shop' }, { status: 500 })
      }

      return NextResponse.json({ message: 'Shop approved and verified' })
    } else {
      // Reject — clear the request flag so they can try again
      const { error: updateError } = await serviceClient
        .from('shops')
        .update({
          verification_requested: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', shopId)

      if (updateError) {
        console.error('Reject shop error:', updateError)
        return NextResponse.json({ error: 'Failed to reject verification' }, { status: 500 })
      }

      return NextResponse.json({ message: 'Verification request rejected' })
    }
  } catch (err) {
    console.error('Admin verification action error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
