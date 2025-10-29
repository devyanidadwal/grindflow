import { createClient } from '@supabase/supabase-js'

// Server-side Supabase client with service role key
// Use this ONLY in API routes or server components
// NEVER expose the service role key to the client

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

