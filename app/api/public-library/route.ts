import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export async function GET(req: NextRequest) {
  try {
    // Public library browsing is allowed without auth
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Fetch public library entries with document details
    const { data: publicDocs, error } = await supabase
      .from('public_library')
      .select(`
        id,
        document_id,
        subject,
        unit,
        year,
        degree,
        score,
        analysis_keyword,
        verdict,
        rationale,
        focus_topics,
        repetitive_topics,
        suggested_plan,
        uploaded_at,
        uploaded_by,
        documents (
          file_name,
          storage_path
        )
      `)
      .order('uploaded_at', { ascending: false })

    if (error) {
      console.error('[PUBLIC-LIBRARY] Query error:', error)
      return NextResponse.json({ error: error.message || 'Failed to fetch public library' }, { status: 500 })
    }

    // Transform to flatten documents relation
    const rows = (publicDocs || []).map((entry: any) => ({
      id: entry.id,
      document_id: entry.document_id,
      subject: entry.subject,
      unit: entry.unit,
      year: entry.year,
      degree: entry.degree,
      score: entry.score,
      analysis_keyword: entry.analysis_keyword,
      verdict: entry.verdict,
      rationale: entry.rationale,
      focus_topics: entry.focus_topics ? (typeof entry.focus_topics === 'string' ? JSON.parse(entry.focus_topics) : entry.focus_topics) : null,
      repetitive_topics: entry.repetitive_topics ? (typeof entry.repetitive_topics === 'string' ? JSON.parse(entry.repetitive_topics) : entry.repetitive_topics) : null,
      suggested_plan: entry.suggested_plan ? (typeof entry.suggested_plan === 'string' ? JSON.parse(entry.suggested_plan) : entry.suggested_plan) : null,
      uploaded_at: entry.uploaded_at,
      uploaded_by: entry.uploaded_by,
      file_name: entry.documents?.file_name || 'Unknown',
      storage_path: entry.documents?.storage_path || '',
    }))

    return NextResponse.json({ rows })
  } catch (e: any) {
    console.error('[PUBLIC-LIBRARY] Error:', e)
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}

