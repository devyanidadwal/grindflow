import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

let BUCKET_PUBLIC_CACHE: { known: boolean; isPublic: boolean; checkedAt: number } = {
  known: false,
  isPublic: false,
  checkedAt: 0,
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '') || ''

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: auth } = await supabase.auth.getUser(token)
    const user = auth?.user
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('documents')
      .select('id, file_name, storage_path, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

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
      (data || []).map(async (row: any) => {
        if (isPublic) {
          const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(row.storage_path)
          return { ...row, publicUrl: urlData?.publicUrl || null, bucket: bucketName }
        }
        const { data: signed } = await supabase.storage
          .from(bucketName)
          .createSignedUrl(row.storage_path, 60 * 60) // 1 hour
        return { ...row, publicUrl: signed?.signedUrl || null, bucket: bucketName }
      })
    )

    return NextResponse.json({ rows: rowsWithUrls })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}


