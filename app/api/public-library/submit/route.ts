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
    const { document_id, subject, unit, year, degree, score, analysis_keyword, verdict, rationale, focus_topics, repetitive_topics, suggested_plan } = body || {}
    if (!document_id || !subject) {
      return NextResponse.json({ error: 'Missing document_id or subject' }, { status: 400 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: auth } = await supabase.auth.getUser(token)
    const user = auth?.user
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Verify document belongs to user
    const { data: doc, error: docErr } = await supabase
      .from('documents')
      .select('id, user_id, file_name, storage_path')
      .eq('id', document_id)
      .single()

    if (docErr || !doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    if (doc.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // Upsert into public_library (table will be created via migration)
    const { data: publicDoc, error: insertErr } = await supabase
      .from('public_library')
      .upsert({
        document_id,
        subject: subject.trim(),
        unit: unit?.trim() || null,
        year: year?.trim() || null,
        degree: degree?.trim() || null,
        score: score != null ? Number(score) : null,
        analysis_keyword: analysis_keyword?.trim() || null,
        verdict: verdict?.trim() || null,
        rationale: rationale?.trim() || null,
        focus_topics: focus_topics ? JSON.stringify(focus_topics) : null,
        repetitive_topics: repetitive_topics ? JSON.stringify(repetitive_topics) : null,
        suggested_plan: suggested_plan ? JSON.stringify(suggested_plan) : null,
        uploaded_by: user.id,
        uploaded_at: new Date().toISOString(),
      }, {
        onConflict: 'document_id',
      })
      .select('id')
      .single()

    if (insertErr) {
      console.error('[PUBLIC-LIBRARY] Insert error:', insertErr)
      return NextResponse.json({ error: insertErr.message || 'Failed to add to public library' }, { status: 500 })
    }

    return NextResponse.json({ success: true, id: publicDoc?.id })
  } catch (e: any) {
    console.error('[PUBLIC-LIBRARY] Error:', e)
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}

