import { NextResponse } from 'next/server'

// Stubbed — shop_employees table does not exist in this project's database
export async function POST() {
  return NextResponse.json(
    { error: 'No pending invitation found for your email or phone number' },
    { status: 404 }
  )
}
