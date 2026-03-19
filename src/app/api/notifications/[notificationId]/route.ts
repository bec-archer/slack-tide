import { NextResponse } from 'next/server'

// Stubbed — notifications table does not exist in this project's database
export async function PUT() {
  return NextResponse.json({ error: 'Not implemented' }, { status: 404 })
}
