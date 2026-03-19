import { NextResponse } from 'next/server'

// Stubbed — notifications table does not exist in this project's database
export async function GET() {
  return NextResponse.json({ notifications: [], unread_count: 0 })
}
