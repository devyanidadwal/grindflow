import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { userProfiles } from '@/lib/db/schema'
import { ilike } from 'drizzle-orm'
import { requireUser } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const userId = await requireUser()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const query = searchParams.get('q') || ''
    const limit = parseInt(searchParams.get('limit') || '10', 10)

    const profiles = await db
      .select({ id: userProfiles.id, username: userProfiles.username })
      .from(userProfiles)
      .where(query ? ilike(userProfiles.username, `${query}%`) : undefined)
      .limit(limit)

    return NextResponse.json({ usernames: profiles })
  } catch (e: any) {
    console.error('[SEARCH-USERNAMES] Error:', e)
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}
