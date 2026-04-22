import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { userProfiles } from '@/lib/db/schema'
import { inArray } from 'drizzle-orm'
import { requireUser } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUser()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { user_ids } = body || {}
    if (!user_ids || !Array.isArray(user_ids)) {
      return NextResponse.json({ error: 'user_ids array required' }, { status: 400 })
    }

    const usernameMap: Record<string, string> = {}
    if (user_ids.length > 0) {
      const profiles = await db
        .select({ id: userProfiles.id, username: userProfiles.username })
        .from(userProfiles)
        .where(inArray(userProfiles.id, user_ids))
      profiles.forEach((p) => { usernameMap[p.id] = p.username })
    }

    return NextResponse.json({ usernames: usernameMap })
  } catch (e: any) {
    console.error('[CHAT] Users API error:', e)
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}
