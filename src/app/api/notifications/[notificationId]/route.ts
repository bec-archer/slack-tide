import { createServerClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

// PUT /api/notifications/[notificationId] — Mark notification as read
export async function PUT(
  _request: NextRequest,
  { params }: { params: Promise<{ notificationId: string }> }
) {
  try {
    const { notificationId } = await params
    const supabase = await createServerClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: notification, error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId)
      .eq('user_id', user.id)
      .is('read_at', null)
      .select()
      .single()

    if (error || !notification) {
      return NextResponse.json({ error: 'Notification not found or already read' }, { status: 404 })
    }

    return NextResponse.json({ notification })
  } catch (err) {
    console.error('Notification PUT error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
