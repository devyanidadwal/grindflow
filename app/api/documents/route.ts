import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { documents } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { requireUser } from '@/lib/auth'

export async function GET(_request: NextRequest) {
  try {
    const userId = await requireUser()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const rows = await db
      .select({
        id: documents.id,
        file_name: documents.fileName,
        storage_path: documents.storagePath,
        file_url: documents.fileUrl,
        created_at: documents.createdAt,
      })
      .from(documents)
      .where(eq(documents.userId, userId))
      .orderBy(desc(documents.createdAt))

    const rowsWithUrls = rows.map((row) => ({
      ...row,
      publicUrl: row.file_url || null,
      bucket: 'uploadthing',
    }))

    const res = NextResponse.json({ rows: rowsWithUrls })
    res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    res.headers.set('Pragma', 'no-cache')
    res.headers.set('Expires', '0')
    return res
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}
