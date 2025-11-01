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
      .select('storage_path, file_name')
      .eq('id', docId)
      .single()

    if (docErr || !doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

    // Download from storage
    const { data: fileData, error: downloadErr } = await supabase.storage
      .from(bucketName)
      .download(doc.storage_path)

    if (downloadErr || !fileData) {
      return NextResponse.json({ error: downloadErr?.message || 'Download failed' }, { status: 500 })
    }

    // Convert blob to array buffer
    const arrayBuffer = await fileData.arrayBuffer()

    // Return as PDF
    return new NextResponse(arrayBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${doc.file_name || 'document.pdf'}"`,
      },
    })
  } catch (e: any) {
    console.error('[PUBLIC-LIBRARY-DOWNLOAD] Error:', e)
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}

