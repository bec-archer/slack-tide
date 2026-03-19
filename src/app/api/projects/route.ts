import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { name, slug, description, color, status, parent_project_id } = body

  if (!name || !slug) {
    return NextResponse.json({ error: 'name and slug are required' }, { status: 400 })
  }

  // Ensure empty/invalid parent_project_id becomes null, not "" which breaks the uuid FK
  const parentId = parent_project_id && parent_project_id !== 'null' ? parent_project_id : null

  let supabase
  try {
    supabase = createServiceRoleClient()
  } catch (err) {
    console.error('[POST /api/projects] Failed to create service role client:', err)
    return NextResponse.json(
      { error: 'Server configuration error: missing Supabase service role key' },
      { status: 500 }
    )
  }

  const insertPayload = { name, slug, description, color, status, parent_project_id: parentId }
  console.log('[POST /api/projects] Inserting:', JSON.stringify(insertPayload))

  const { data, error } = await supabase
    .from('projects')
    .insert(insertPayload)
    .select()
    .single()

  if (error) {
    console.error('[POST /api/projects] Supabase error:', JSON.stringify(error, null, 2))
    return NextResponse.json(
      { error: error.message, code: error.code, details: error.details, hint: error.hint },
      { status: 500 }
    )
  }

  console.log('[POST /api/projects] Created project:', data.id)
  return NextResponse.json(data)
}
