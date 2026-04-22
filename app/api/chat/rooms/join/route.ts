import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { chatroomMembers } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { requireUser } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUser()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { roomId } = await req.json()
    if (!roomId) return NextResponse.json({ error: 'roomId required' }, { status: 400 })

    const existing = await db
      .select({ id: chatroomMembers.id })
      .from(chatroomMembers)
      .where(and(eq(chatroomMembers.chatroomId, roomId), eq(chatroomMembers.userId, userId)))
      .limit(1)

    if (existing.length > 0) return NextResponse.json({ success: true, alreadyMember: true })

    await db.insert(chatroomMembers).values({ chatroomId: roomId, userId })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}
