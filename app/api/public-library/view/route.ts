import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { documents } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getStorageClient } from '@/lib/supabase-storage'

const bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'documents'

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const docId = searchParams.get('id')
    if (!docId) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const [doc] = await db
      .select({ storagePath: documents.storagePath })
      .from(documents)
      .where(eq(documents.id, docId))
      .limit(1)

    if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

    const supabase = getStorageClient()
    const { data: signed, error: urlErr } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(doc.storagePath, 60 * 60)

    if (urlErr || !signed) {
      return NextResponse.json({ error: urlErr?.message || 'Failed to generate view URL' }, { status: 500 })
    }

    return NextResponse.json({ url: signed.signedUrl })
  } catch (e: any) {
    console.error('[PUBLIC-LIBRARY-VIEW] Error:', e)
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}
