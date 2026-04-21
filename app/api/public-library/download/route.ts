import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { db } from '@/lib/db'
import { documents } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'documents'

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const docId = searchParams.get('id')
    if (!docId) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const [doc] = await db
      .select({ storagePath: documents.storagePath, fileName: documents.fileName })
      .from(documents)
      .where(eq(documents.id, docId))
      .limit(1)

    if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data: fileData, error: downloadErr } = await supabase.storage
      .from(bucketName)
      .download(doc.storagePath)

    if (downloadErr || !fileData) {
      return NextResponse.json({ error: downloadErr?.message || 'Download failed' }, { status: 500 })
    }

    const arrayBuffer = await fileData.arrayBuffer()
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
