import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { userProfiles, notifications } from '@/lib/db/schema'
import { inArray } from 'drizzle-orm'
import { requireUser } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUser()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { mentions, messageId, roomName, fromUsername } = body || {}

    if (!mentions || !Array.isArray(mentions) || mentions.length === 0) {
      return NextResponse.json({ success: true, message: 'No mentions to process' })
    }
    if (!messageId) {
      return NextResponse.json({ error: 'Message ID required' }, { status: 400 })
    }

    const profiles = await db
      .select({ id: userProfiles.id, username: userProfiles.username })
      .from(userProfiles)
      .where(inArray(userProfiles.username, mentions))

    if (profiles.length === 0) {
      return NextResponse.json({ success: true, message: 'No users found for mentions' })
    }

    const rows = profiles.map((p) => ({
      userId: p.id,
      type: 'mention',
      title: fromUsername || 'Someone',
      message: `mentioned you in ${roomName || 'chat'}`,
      relatedMessageId: messageId,
    }))

    await db.insert(notifications).values(rows)
    return NextResponse.json({ success: true, notified: profiles.length })
  } catch (e: any) {
    console.error('[MENTIONS] Error:', e)
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}
