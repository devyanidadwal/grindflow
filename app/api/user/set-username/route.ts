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
    const { username } = body || {}
    
    if (!username || typeof username !== 'string') {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 })
    }

    const trimmedUsername = username.trim()
    
    // Validate username
    if (trimmedUsername.length < 3 || trimmedUsername.length > 20) {
      return NextResponse.json({ error: 'Username must be between 3 and 20 characters' }, { status: 400 })
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(trimmedUsername)) {
      return NextResponse.json({ error: 'Username can only contain letters, numbers, underscores, and hyphens' }, { status: 400 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: auth } = await supabase.auth.getUser(token)
    const user = auth?.user
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Check if username is already taken
    const { data: existing } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('username', trimmedUsername)
      .maybeSingle()

    if (existing && existing.id !== user.id) {
      return NextResponse.json({ error: 'username_taken' }, { status: 409 })
    }

    // Create or update user profile
    const { error: upsertError } = await supabase
      .from('user_profiles')
      .upsert(
        {
          id: user.id,
          username: trimmedUsername,
        },
        { onConflict: 'id' }
      )

    if (upsertError) {
      console.error('[API] Set username error:', upsertError)
      return NextResponse.json({ error: 'Failed to set username' }, { status: 500 })
    }

    return NextResponse.json({ success: true, username: trimmedUsername })
  } catch (e: any) {
    console.error('[API] Set username error:', e)
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}

