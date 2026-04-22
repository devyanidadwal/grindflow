import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { documents } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { requireUser } from '@/lib/auth'
import { getStorageClient } from '@/lib/supabase-storage'

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
    const userId = await requireUser()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const [doc] = await db
      .select({ id: documents.id, storagePath: documents.storagePath, userId: documents.userId })
      .from(documents)
      .where(eq(documents.id, documentId))
      .limit(1)

    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (doc.userId !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const supabase = getStorageClient()
    const { error: remErr } = await supabase.storage.from(bucketName).remove([doc.storagePath])
    const removedFromStorage = !remErr
    if (remErr) console.warn('[DELETE] storage remove warning:', remErr.message)

    await db.delete(documents).where(eq(documents.id, documentId))
    return NextResponse.json({ success: true, removedFromStorage })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}
