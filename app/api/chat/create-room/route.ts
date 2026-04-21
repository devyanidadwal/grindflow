import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { db } from '@/lib/db'
import { chatrooms, chatroomMembers } from '@/lib/db/schema'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '') || ''
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { name, is_private } = body || {}
    if (!name) return NextResponse.json({ error: 'Room name required' }, { status: 400 })

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data: auth } = await supabase.auth.getUser(token)
    const user = auth?.user
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const [room] = await db
      .insert(chatrooms)
      .values({
        name: name.trim(),
        isPrivate: !!is_private,
        createdBy: user.id,
      })
      .returning()

    await db.insert(chatroomMembers).values({
      chatroomId: room.id,
      userId: user.id,
    })

    return NextResponse.json({ room })
  } catch (e: any) {
    console.error('[CHAT] Error:', e)
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}
