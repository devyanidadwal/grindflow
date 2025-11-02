import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { normalizeForPrompt, buildShortText } from '@/lib/text'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data, error } = await supabase
      .from('documents_text')
      .select('text, normalized_text, short_text')
      .eq('document_id', id)
      .single()

    if (error) return NextResponse.json({ status: 'missing', short_text: '', error: error.message })

    let normalized = data?.normalized_text || ''
    let shortText = data?.short_text || ''
    const text = data?.text || ''

    if (!normalized && text) normalized = normalizeForPrompt(text)
    if (!shortText && normalized) shortText = buildShortText(normalized, 12000)

    return NextResponse.json({ status: shortText ? 'ready' : (text ? 'partial' : 'missing'), length: (shortText || text).length || 0, short_text: shortText })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}


