import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '') || ''
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: auth } = await supabase.auth.getUser(token)
    const user = auth?.user
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Check if user has a profile with username
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('username')
      .eq('id', user.id)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('[API] Check username error:', error)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    const hasUsername = !!profile?.username

    return NextResponse.json({ hasUsername, username: profile?.username || null })
  } catch (e: any) {
    console.error('[API] Check username error:', e)
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}

