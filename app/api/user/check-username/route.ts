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

    // Handle case where table doesn't exist or row doesn't exist
    if (error) {
      if (error.code === 'PGRST116' || 
          error.message?.includes('does not exist') || 
          error.message?.includes('Could not find the table') ||
          error.message?.includes('schema cache')) {
        // Table doesn't exist yet - return false (user needs to set username)
        return NextResponse.json({ hasUsername: false, username: null })
      }
      console.error('[API] Check username error:', error)
      // For other errors, still return false to allow user to set username
      return NextResponse.json({ hasUsername: false, username: null })
    }

    const hasUsername = !!profile?.username

    return NextResponse.json({ hasUsername, username: profile?.username || null })
  } catch (e: any) {
    console.error('[API] Check username error:', e)
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}

