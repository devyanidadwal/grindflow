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
      .select({ fileUrl: documents.fileUrl, fileName: documents.fileName })
      .from(documents)
      .where(eq(documents.id, docId))
      .limit(1)

    if (!doc || !doc.fileUrl) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

    const fileRes = await fetch(doc.fileUrl)
    if (!fileRes.ok) return NextResponse.json({ error: 'Download failed' }, { status: 500 })
    const arrayBuffer = await fileRes.arrayBuffer()

    return new NextResponse(arrayBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${doc.fileName || 'document.pdf'}"`,
      },
    })
  } catch (e: any) {
    console.error('[PUBLIC-LIBRARY-DOWNLOAD] Error:', e)
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}
