import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export async function DELETE(request: NextRequest, context: { params: { id: string } }) {
  // Prefer path param; fall back to query (?id=) or JSON body
  let documentId = context?.params?.id
  if (!documentId) {
    try {
      const url = new URL(request.url)
      documentId = url.searchParams.get('id') || ''
      if (!documentId) {
        const body = await request.json().catch(() => null)
        documentId = (body && (body.id as string)) || ''
      }
    } catch {}
  }
  if (!documentId) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  const bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'documents'
  try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '') || ''
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: auth } = await supabase.auth.getUser(token)
    const user = auth?.user
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Get the document row to know storage_path; ensure ownership
    const { data: rows, error: selErr } = await supabase
      .from('documents')
      .select('id, storage_path, user_id')
      .eq('id', documentId)
      .single()

    if (selErr || !rows) return NextResponse.json({ error: selErr?.message || 'Not found' }, { status: 404 })
    if (rows.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const storagePath = rows.storage_path as string

    // Delete from storage first (ignore if missing)
    const { error: remErr } = await supabase.storage.from(bucketName).remove([storagePath])
    const removedFromStorage = !remErr
    if (remErr) {
      // continue; maybe file already gone
      console.warn('[DELETE] storage remove warning:', remErr.message)
    }

    // Delete DB row
    const { error: delErr } = await supabase
      .from('documents')
      .delete()
      .eq('id', documentId)

    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })

    return NextResponse.json({ success: true, removedFromStorage })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}


