import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { userProfiles } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'
import { requireUser } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUser()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { username } = body || {}
    if (!username || typeof username !== 'string') {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 })
    }
    const trimmedUsername = username.trim()
    if (trimmedUsername.length < 3 || trimmedUsername.length > 20) {
      return NextResponse.json({ error: 'Username must be between 3 and 20 characters' }, { status: 400 })
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(trimmedUsername)) {
      return NextResponse.json({ error: 'Username can only contain letters, numbers, underscores, and hyphens' }, { status: 400 })
    }

    const existing = await db
      .select({ id: userProfiles.id })
      .from(userProfiles)
      .where(eq(userProfiles.username, trimmedUsername))
      .limit(1)

    if (existing[0] && existing[0].id !== userId) {
      return NextResponse.json({ error: 'username_taken' }, { status: 409 })
    }

    await db
      .insert(userProfiles)
      .values({ id: userId, username: trimmedUsername })
      .onConflictDoUpdate({
        target: userProfiles.id,
        set: { username: trimmedUsername, updatedAt: sql`now()` },
      })

    return NextResponse.json({ success: true, username: trimmedUsername })
  } catch (e: any) {
    console.error('[API] Set username error:', e)
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}
