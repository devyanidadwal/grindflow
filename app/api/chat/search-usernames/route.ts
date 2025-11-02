import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: auth } = await supabase.auth.getUser(token)
    if (!auth?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Fetch usernames from user_profiles
    let queryBuilder = supabase
      .from('user_profiles')
      .select('id, username')
      .limit(limit)

    // If query is provided, filter usernames that start with query
    if (query && query.length > 0) {
      queryBuilder = queryBuilder.ilike('username', `${query}%`)
    }

    const { data: profiles, error } = await queryBuilder

    if (error) {
      // If table doesn't exist, return empty array
      if (error.code === 'PGRST116' || 
          error.message?.includes('does not exist') ||
          error.message?.includes('Could not find the table')) {
        return NextResponse.json({ usernames: [] })
      }
      throw error
    }

    const usernames = (profiles || []).map(p => ({
      id: p.id,
      username: p.username,
    }))

    return NextResponse.json({ usernames })
  } catch (e: any) {
    console.error('[SEARCH-USERNAMES] Error:', e)
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}

