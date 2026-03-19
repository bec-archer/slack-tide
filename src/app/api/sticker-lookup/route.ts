import { createServerClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/sticker-lookup?code=XXXXX — Look up sticker + item info for shop submit
export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get('code')

    if (!code) {
      return NextResponse.json({ error: 'code is required' }, { status: 400 })
    }

    const supabase = await createServerClient()

    // 1. Look up sticker
    const { data: sticker, error: stickerErr } = await supabase
      .from('stickers')
      .select('item_id')
      .eq('short_code', code)
      .maybeSingle()

    if (stickerErr) {
      console.error('Sticker lookup error:', stickerErr)
      return NextResponse.json({ error: 'Sticker lookup failed', detail: stickerErr.message }, { status: 500 })
    }

    if (!sticker || !sticker.item_id) {
      return NextResponse.json({ error: `No item found for sticker code "${code}". Make sure the sticker is registered.` }, { status: 404 })
    }

    // 2. Get item info
    const { data: itemData, error: itemErr } = await supabase
      .from('items')
      .select('id, nickname, make, model, year, owner_id')
      .eq('id', sticker.item_id)
      .maybeSingle()

    if (itemErr) {
      console.error('Item lookup error:', itemErr)
      return NextResponse.json({ error: 'Item lookup failed', detail: itemErr.message }, { status: 500 })
    }

    if (!itemData) {
      console.error('Item not found for item_id:', sticker.item_id, '(sticker code:', code, ')')
      return NextResponse.json({ error: 'Item not found — the sticker may be linked to a deleted item.' }, { status: 404 })
    }

    // 3. Get owner display name
    let ownerName: string | null = null
    if (itemData.owner_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', itemData.owner_id)
        .maybeSingle()
      ownerName = profile?.display_name ?? null
    }

    return NextResponse.json({
      item: {
        id: itemData.id,
        name: itemData.nickname,
        make: itemData.make,
        model: itemData.model,
        year: itemData.year,
        owner_name: ownerName,
      },
    })
  } catch (err) {
    console.error('Sticker lookup unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
