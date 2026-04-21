import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { db } from '@/lib/db'
import { userProfiles } from '@/lib/db/schema'
import { ilike } from 'drizzle-orm'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '') || ''
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const query = searchParams.get('q') || ''
    const limit = parseInt(searchParams.get('limit') || '10', 10)

    // Auth still via Supabase — will be replaced by Clerk in Phase 2
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data: auth } = await supabase.auth.getUser(token)
    if (!auth?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // DB query now via Drizzle against Neon
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
