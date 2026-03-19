import { createServerClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'
import { requireShopAdmin } from '@/lib/shop-auth'

interface GooglePlace {
  id: string
  displayName: { text: string; languageCode: string }
  formattedAddress: string
  internationalPhoneNumber?: string
  nationalPhoneNumber?: string
  websiteUri?: string
}

interface GooglePlacesResponse {
  places?: GooglePlace[]
}

// POST /api/shops/[shopId]/verify/google-lookup — Search Google Places for matching business
export async function POST(
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

    const adminCtx = await requireShopAdmin(supabase, user.id, shopId)
    if (!adminCtx) {
      return NextResponse.json({ error: 'Forbidden — shop admin access required' }, { status: 403 })
    }

    // Get shop details for the search
    const { data: shop } = await supabase
      .from('shops')
      .select('name, address, city, state, phone, verified')
      .eq('id', shopId)
      .single()

    if (!shop) {
      return NextResponse.json({ error: 'Shop not found' }, { status: 404 })
    }

    if (shop.verified) {
      return NextResponse.json({ error: 'Shop is already verified' }, { status: 400 })
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY
    if (!apiKey) {
      console.error('GOOGLE_PLACES_API_KEY not configured')
      return NextResponse.json({ error: 'Google Places API not configured' }, { status: 500 })
    }

    // Search Google Places with the shop's name and location
    const searchQuery = `${shop.name}, ${shop.city}, ${shop.state}`

    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.internationalPhoneNumber,places.nationalPhoneNumber,places.websiteUri',
      },
      body: JSON.stringify({
        textQuery: searchQuery,
        maxResultCount: 5,
      }),
    })

    if (!res.ok) {
      const errBody = await res.text()
      console.error('Google Places API error:', res.status, errBody)
      return NextResponse.json({ error: 'Google Places search failed' }, { status: 502 })
    }

    const data: GooglePlacesResponse = await res.json()
    const places = data.places || []

    // Return matching places (strip Google's internal IDs for security, use index)
    const results = places.map((place: GooglePlace, index: number) => ({
      index,
      name: place.displayName.text,
      address: place.formattedAddress,
      phone: place.nationalPhoneNumber || place.internationalPhoneNumber || null,
      website: place.websiteUri || null,
    }))

    return NextResponse.json({ results, shopPhone: shop.phone })
  } catch (err) {
    console.error('Google lookup error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
