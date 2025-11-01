import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'documents'

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const docId = searchParams.get('id')
    if (!docId) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Fetch document to get storage path
    const { data: doc, error: docErr } = await supabase
      .from('documents')
      .select('storage_path')
      .eq('id', docId)
      .single()

    if (docErr || !doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

    // Create signed URL for viewing (valid for 1 hour)
    const { data: signed, error: urlErr } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(doc.storage_path, 60 * 60)

    if (urlErr || !signed) {
      return NextResponse.json({ error: urlErr?.message || 'Failed to generate view URL' }, { status: 500 })
    }

    return NextResponse.json({ url: signed.signedUrl })
  } catch (e: any) {
    console.error('[PUBLIC-LIBRARY-VIEW] Error:', e)
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}

