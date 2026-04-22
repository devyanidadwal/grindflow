import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { chatrooms, chatroomMembers } from '@/lib/db/schema'
import { requireUser } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUser()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { name, is_private } = body || {}
    if (!name) return NextResponse.json({ error: 'Room name required' }, { status: 400 })

    const [room] = await db
      .insert(chatrooms)
      .values({
        name: name.trim(),
        isPrivate: !!is_private,
        createdBy: userId,
      })
      .returning()

    await db.insert(chatroomMembers).values({
      chatroomId: room.id,
      userId,
    })

    return NextResponse.json({ room })
  } catch (e: any) {
    console.error('[CHAT] Error:', e)
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}
