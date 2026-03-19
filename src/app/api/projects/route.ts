import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function createQrstkrServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_QRSTKR_SUPABASE_URL!,
    process.env.QRSTKR_SUPABASE_SERVICE_KEY!
  )
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { name, slug, description, color, status, parent_project_id } = body

  if (!name || !slug) {
    return NextResponse.json({ error: 'name and slug are required' }, { status: 400 })
  }

  const supabase = createQrstkrServiceClient()
  const { data, error } = await supabase
    .from('projects')
    .insert({ name, slug, description, color, status, parent_project_id })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
