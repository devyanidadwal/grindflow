import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { userProfiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { requireUser } from '@/lib/auth'

export async function GET(_req: NextRequest) {
  try {
    const userId = await requireUser()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const rows = await db
      .select({ username: userProfiles.username })
      .from(userProfiles)
      .where(eq(userProfiles.id, userId))
      .limit(1)

    const profile = rows[0]
    const hasUsername = !!profile?.username
    return NextResponse.json({ hasUsername, username: profile?.username || null })
  } catch (e: any) {
    console.error('[API] Check username error:', e)
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}
