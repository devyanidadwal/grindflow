import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { documents } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { requireUser } from '@/lib/auth'
import { getStorageClient } from '@/lib/supabase-storage'

let BUCKET_PUBLIC_CACHE: { known: boolean; isPublic: boolean; checkedAt: number } = {
  known: false,
  isPublic: false,
  checkedAt: 0,
}

export async function GET(_request: NextRequest) {
  try {
    const userId = await requireUser()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const rows = await db
      .select({
        id: documents.id,
        file_name: documents.fileName,
        storage_path: documents.storagePath,
        created_at: documents.createdAt,
      })
      .from(documents)
      .where(eq(documents.userId, userId))
      .orderBy(desc(documents.createdAt))

    const supabase = getStorageClient()
    const bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'documents'
    let isPublic = BUCKET_PUBLIC_CACHE.isPublic
    const now = Date.now()
    if (!BUCKET_PUBLIC_CACHE.known || now - BUCKET_PUBLIC_CACHE.checkedAt > 5 * 60 * 1000) {
      const { data: buckets } = await supabase.storage.listBuckets()
      const bucket = (buckets || []).find((b) => b.name === bucketName)
      isPublic = !!bucket?.public
      BUCKET_PUBLIC_CACHE = { known: true, isPublic, checkedAt: now }
    }

    const rowsWithUrls = await Promise.all(
      rows.map(async (row: any) => {
        if (isPublic) {
          const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(row.storage_path)
          return { ...row, publicUrl: urlData?.publicUrl || null, bucket: bucketName }
        }
        const { data: signed } = await supabase.storage
          .from(bucketName)
          .createSignedUrl(row.storage_path, 60 * 60)
        return { ...row, publicUrl: signed?.signedUrl || null, bucket: bucketName }
      })
    )

    const res = NextResponse.json({ rows: rowsWithUrls })
    res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    res.headers.set('Pragma', 'no-cache')
    res.headers.set('Expires', '0')
    return res
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}
