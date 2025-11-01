import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '') || ''
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { name, is_private } = body || {}
    if (!name) {
      return NextResponse.json({ error: 'Room name required' }, { status: 400 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: auth } = await supabase.auth.getUser(token)
    const user = auth?.user
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: room, error } = await supabase
      .from('chatrooms')
      .insert({
        name: name.trim(),
        is_private: is_private || false,
        created_by: user.id,
      })
      .select()
      .single()

    if (error) {
      console.error('[CHAT] Create room error:', error)
      return NextResponse.json({ error: error.message || 'Failed to create room' }, { status: 500 })
    }

    // Add creator as member
    await supabase
      .from('chatroom_members')
      .insert({
        chatroom_id: room.id,
        user_id: user.id,
      })

    return NextResponse.json({ room })
  } catch (e: any) {
    console.error('[CHAT] Error:', e)
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}

