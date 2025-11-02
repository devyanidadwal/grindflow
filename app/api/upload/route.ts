import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Simple in-memory cache to avoid bucket metadata calls on every upload
let BUCKET_READY = false

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  console.log('[API] Upload request received at', new Date().toISOString())
  
  try {
    console.log('[API] Step 1: Parsing auth header...')
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '') || ''
    console.log('[API] Auth token:', token ? `Present (${token.substring(0, 20)}...)` : 'Missing')

    console.log('[API] Step 2: Initializing Supabase client...')
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
    console.log('[API] Supabase client initialized')

    // Verify user authentication; require token to associate uploads
    if (token) {
      console.log('[API] Step 3: Verifying user token...')
      const authStartTime = Date.now()
      const { data: { user }, error: authError } = await supabase.auth.getUser(token)
      console.log('[API] Auth verification completed in', Date.now() - authStartTime, 'ms')
      
      if (authError || !user) {
        console.error('[API] Auth verification failed:', authError)
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        )
      }
      console.log('[API] User authenticated:', user.email)
    } else {
      console.warn('[API] No auth token provided - proceeding without auth')
    }

    console.log('[API] Step 4: Parsing form data...')
    const formDataStartTime = Date.now()
    const formData = await request.formData()
    console.log('[API] FormData parsed in', Date.now() - formDataStartTime, 'ms')

    console.log('[API] Step 5: Extracting file from FormData...')
    const file = formData.get('file') as File

    if (!file) {
      console.error('[API] No file found in FormData')
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    console.log('[API] File extracted:', {
      name: file.name,
      size: file.size,
      type: file.type,
    })

    // Check if file is PDF
    if (file.type !== 'application/pdf') {
      console.error('[API] Invalid file type:', file.type)
      return NextResponse.json(
        { error: 'Only PDF files are allowed' },
        { status: 400 }
      )
    }

    console.log('[API] Step 6: Converting file to buffer...')
    const bufferStartTime = Date.now()
    const fileBuffer = await file.arrayBuffer()
    const fileBytes = new Uint8Array(fileBuffer)
    console.log('[API] File converted to buffer in', Date.now() - bufferStartTime, 'ms')
    console.log('[API] Buffer size:', fileBytes.length, 'bytes')

    // Upload to Supabase Storage
    const bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'documents'
    // Ensure bucket exists (creates a public bucket if missing)
    if (!BUCKET_READY) {
      try {
        const { data: buckets } = await supabase.storage.listBuckets()
        const bucket = (buckets || []).find((b) => b.name === bucketName)
        if (!bucket) {
          await supabase.storage.createBucket(bucketName, {
            public: true,
            fileSizeLimit: 52428800,
          })
        } else if (!bucket.public) {
          await supabase.storage.updateBucket(bucketName, { public: true })
        }
        BUCKET_READY = true
      } catch (e) {
        console.warn('[API] bucket ensure failed (continuing):', (e as any)?.message || e)
      }
    }
    const fileName = `${Date.now()}-${file.name}`
    console.log('[API] Step 7: Uploading to Supabase Storage...')
    console.log('[API] Bucket:', bucketName)
    console.log('[API] File name:', fileName)

    const uploadStartTime = Date.now()
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(fileName, fileBytes, {
        contentType: 'application/pdf',
        upsert: false,
      })
    
    const uploadDuration = Date.now() - uploadStartTime
    console.log('[API] Storage upload completed in', uploadDuration, 'ms')

    if (uploadError) {
      console.error('[API] Storage upload error:', uploadError)
      console.error('[API] Error details:', JSON.stringify(uploadError, null, 2))
      return NextResponse.json(
        { error: 'Failed to upload file', details: uploadError.message },
        { status: 500 }
      )
    }

    console.log('[API] Upload successful! Path:', uploadData.path)

    // Get public URL (optional - depends on bucket settings)
    console.log('[API] Step 8: Getting public URL...')
    const { data: urlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(fileName)
    console.log('[API] Public URL:', urlData?.publicUrl || 'N/A')

    const totalDuration = Date.now() - startTime
    console.log('[API] Total request processing time:', totalDuration, 'ms')

    // Persist metadata to database if we have an authenticated user
    let dbInsertError: any = null
    let inserted: any = null
    try {
      if (token) {
        const { data: { user } } = await supabase.auth.getUser(token)
        if (user) {
          // Ensure a user_profiles row exists to satisfy FK (username required)
          try {
            const email = user.email || ''
            const username = email ? email.split('@')[0] : `user-${user.id.substring(0, 8)}`
            await supabase
              .from('user_profiles')
              .upsert({ id: user.id, username }, { onConflict: 'id' })
          } catch (e) {
            console.warn('[API] upsert user_profiles failed (continuing):', (e as any)?.message || e)
          }
          const { data: rows, error: insErr } = await supabase
            .from('documents')
            .insert({
              user_id: user.id,
              file_name: file.name,
              storage_path: uploadData.path,
            })
            .select('id')
          if (insErr) {
            dbInsertError = insErr
          } else {
            inserted = rows?.[0] || null
          }
        }
      }
    } catch (e: any) {
      dbInsertError = e
      console.error('[API] Failed to insert metadata into documents table:', e?.message || e)
    }

    const response = {
      success: true,
      message: 'File uploaded successfully',
      file: {
        name: file.name,
        size: file.size,
        type: file.type,
        storagePath: uploadData.path,
        publicUrl: urlData?.publicUrl || null,
      },
      timing: {
        totalMs: totalDuration,
        uploadMs: uploadDuration,
      },
      db: dbInsertError ? { warning: 'metadata_not_saved', message: dbInsertError?.message || String(dbInsertError) } : { inserted: true, row: inserted },
    }

    console.log('[API] Sending success response:', JSON.stringify(response, null, 2))
    return NextResponse.json(response)
  } catch (error: any) {
    const errorDuration = Date.now() - startTime
    console.error('[API] Upload API error after', errorDuration, 'ms')
    console.error('[API] Error type:', error?.constructor?.name)
    console.error('[API] Error message:', error?.message)
    console.error('[API] Error stack:', error?.stack)
    console.error('[API] Full error:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2))
    
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

