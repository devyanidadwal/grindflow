import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '') || ''
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { user_ids } = body || {}
    if (!user_ids || !Array.isArray(user_ids)) {
      return NextResponse.json({ error: 'user_ids array required' }, { status: 400 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: auth } = await supabase.auth.getUser(token)
    if (!auth?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Fetch usernames from user_profiles table
    const usernameMap: Record<string, string> = {}
    
    if (user_ids.length > 0) {
      const { data: profiles, error: profileError } = await supabase
        .from('user_profiles')
        .select('id, username')
        .in('id', user_ids)

      if (!profileError && profiles) {
        profiles.forEach((profile) => {
          usernameMap[profile.id] = profile.username
        })
      }
    }

    return NextResponse.json({ usernames: usernameMap })
  } catch (e: any) {
    console.error('[CHAT] Users API error:', e)
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}

