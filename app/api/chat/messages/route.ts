import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { chatMessages } from '@/lib/db/schema'
import { asc, eq, gt, and } from 'drizzle-orm'
import { requireUserWithEmail } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const authed = await requireUserWithEmail()
    if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const roomId = searchParams.get('roomId')
    const since = searchParams.get('since')
    if (!roomId) return NextResponse.json({ error: 'roomId required' }, { status: 400 })

    const whereClause = since
      ? and(eq(chatMessages.chatroomId, roomId), gt(chatMessages.createdAt, since))
      : eq(chatMessages.chatroomId, roomId)

    const messages = await db
      .select()
      .from(chatMessages)
      .where(whereClause)
      .orderBy(asc(chatMessages.createdAt))
      .limit(500)

    return NextResponse.json({ messages })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const authed = await requireUserWithEmail()
    if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { roomId, content } = await req.json()
    if (!roomId || !content) {
      return NextResponse.json({ error: 'roomId and content required' }, { status: 400 })
    }

    const [row] = await db
      .insert(chatMessages)
      .values({
        chatroomId: roomId,
        userId: authed.id,
        userEmail: authed.email || '',
        content: String(content).trim(),
      })
      .returning()

    return NextResponse.json({ message: row })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}
