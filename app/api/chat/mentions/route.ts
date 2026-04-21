import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { db } from '@/lib/db'
import { userProfiles, notifications } from '@/lib/db/schema'
import { inArray } from 'drizzle-orm'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '') || ''
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { mentions, messageId, roomName, fromUsername } = body || {}

    if (!mentions || !Array.isArray(mentions) || mentions.length === 0) {
      return NextResponse.json({ success: true, message: 'No mentions to process' })
    }
    if (!messageId) {
      return NextResponse.json({ error: 'Message ID required' }, { status: 400 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data: auth } = await supabase.auth.getUser(token)
    if (!auth?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
