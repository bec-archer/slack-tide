import { NextRequest, NextResponse } from 'next/server'

// Stubbed — shop_employees table does not exist in this project's database
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ shopId: string; userId: string }> }
) {
  await params
  return NextResponse.json({ error: 'Not implemented' }, { status: 501 })
}
