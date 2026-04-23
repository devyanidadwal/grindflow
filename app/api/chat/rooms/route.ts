import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { chatrooms, chatroomMembers } from '@/lib/db/schema'
import { eq, or, desc, inArray } from 'drizzle-orm'
import { requireUser } from '@/lib/auth'

export async function GET(_req: NextRequest) {
  try {
    const userId = await requireUser()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const publicOrOwn = await db
      .select()
      .from(chatrooms)
      .where(or(eq(chatrooms.isPrivate, false), eq(chatrooms.createdBy, userId)))
      .orderBy(desc(chatrooms.createdAt))

    const memberships = await db
      .select({ chatroomId: chatroomMembers.chatroomId })
      .from(chatroomMembers)
      .where(eq(chatroomMembers.userId, userId))

    const memberIds = memberships.map((m) => m.chatroomId)
    const memberRooms = memberIds.length
      ? await db.select().from(chatrooms).where(inArray(chatrooms.id, memberIds))
      : []

    const map = new Map<string, any>()
    for (const r of [...publicOrOwn, ...memberRooms]) map.set(r.id, r)
    const rooms = Array.from(map.values()).sort(
      (a, b) => new Date(b.createdAt as any).getTime() - new Date(a.createdAt as any).getTime()
    )

    return NextResponse.json({ rooms })
  } catch (e: any) {
    console.error('[CHAT-ROOMS] Error:', e)
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}
