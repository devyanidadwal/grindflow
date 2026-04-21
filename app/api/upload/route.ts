import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { db } from '@/lib/db'
import { userProfiles, documents } from '@/lib/db/schema'
import { sql } from 'drizzle-orm'

let BUCKET_READY = false

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '') || ''

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    let authenticatedUser: { id: string; email?: string } | null = null
    if (token) {
      const { data: { user }, error: authError } = await supabase.auth.getUser(token)
      if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      authenticatedUser = { id: user.id, email: user.email || undefined }
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Only PDF files are allowed' }, { status: 400 })
    }

    const fileBuffer = await file.arrayBuffer()
    const fileBytes = new Uint8Array(fileBuffer)

    const bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'documents'
    if (!BUCKET_READY) {
      try {
        const { data: buckets } = await supabase.storage.listBuckets()
        const bucket = (buckets || []).find((b) => b.name === bucketName)
        if (!bucket) {
          await supabase.storage.createBucket(bucketName, { public: true, fileSizeLimit: 52428800 })
        } else if (!bucket.public) {
          await supabase.storage.updateBucket(bucketName, { public: true })
        }
        BUCKET_READY = true
      } catch (e) {
        console.warn('[API] bucket ensure failed (continuing):', (e as any)?.message || e)
      }
    }

    const fileName = `${Date.now()}-${file.name}`
    const uploadStartTime = Date.now()
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(fileName, fileBytes, { contentType: 'application/pdf', upsert: false })
    const uploadDuration = Date.now() - uploadStartTime

    if (uploadError || !uploadData) {
      return NextResponse.json({ error: 'Failed to upload file', details: uploadError?.message }, { status: 500 })
    }

    const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(fileName)

    let dbInsertError: any = null
    let inserted: any = null
    try {
      if (authenticatedUser) {
        const username = authenticatedUser.email
          ? authenticatedUser.email.split('@')[0]
          : `user-${authenticatedUser.id.substring(0, 8)}`
        try {
          await db
            .insert(userProfiles)
            .values({ id: authenticatedUser.id, username })
            .onConflictDoNothing({ target: userProfiles.id })
        } catch (e) {
          console.warn('[API] upsert user_profiles failed (continuing):', (e as any)?.message || e)
        }

        const [row] = await db
          .insert(documents)
          .values({
            userId: authenticatedUser.id,
            fileName: file.name,
            storagePath: uploadData.path,
          })
          .returning({ id: documents.id })
        inserted = row || null
      }
    } catch (e: any) {
      dbInsertError = e
    }

    const totalDuration = Date.now() - startTime
    return NextResponse.json({
      success: true,
      message: 'File uploaded successfully',
      file: {
        name: file.name,
        size: file.size,
        type: file.type,
        storagePath: uploadData.path,
        publicUrl: urlData?.publicUrl || null,
      },
      timing: { totalMs: totalDuration, uploadMs: uploadDuration },
      db: dbInsertError
        ? { warning: 'metadata_not_saved', message: dbInsertError?.message || String(dbInsertError) }
        : { inserted: true, row: inserted },
    })
  } catch (error: any) {
    console.error('[API] Upload error:', error)
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 })
  }
}
