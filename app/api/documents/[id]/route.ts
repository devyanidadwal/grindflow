import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { db } from '@/lib/db'
import { documents } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  let documentId = ''
  try {
    const p = await context.params
    documentId = p?.id || ''
  } catch {}
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

    const [doc] = await db
      .select({ id: documents.id, storagePath: documents.storagePath, userId: documents.userId })
      .from(documents)
      .where(eq(documents.id, documentId))
      .limit(1)

    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (doc.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const storagePath = doc.storagePath

    const { error: remErr } = await supabase.storage.from(bucketName).remove([storagePath])
    const removedFromStorage = !remErr
    if (remErr) console.warn('[DELETE] storage remove warning:', remErr.message)

    await db.delete(documents).where(eq(documents.id, documentId))

    return NextResponse.json({ success: true, removedFromStorage })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}
