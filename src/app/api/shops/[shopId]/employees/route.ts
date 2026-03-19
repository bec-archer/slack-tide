import { NextRequest, NextResponse } from 'next/server'

// Stubbed — shop_employees table does not exist in this project's database
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ shopId: string }> }
) {
  await params
  return NextResponse.json({ employees: [], owner: null, current_user_id: null })
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ shopId: string }> }
) {
  await params
  return NextResponse.json({ error: 'Not implemented' }, { status: 501 })
}
