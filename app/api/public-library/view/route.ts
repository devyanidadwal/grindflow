import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { documents } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const docId = searchParams.get('id')
    if (!docId) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const [doc] = await db
      .select({ fileUrl: documents.fileUrl })
      .from(documents)
      .where(eq(documents.id, docId))
      .limit(1)

    if (!doc || !doc.fileUrl) return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    return NextResponse.json({ url: doc.fileUrl })
  } catch (e: any) {
    console.error('[PUBLIC-LIBRARY-VIEW] Error:', e)
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}
