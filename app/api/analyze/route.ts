import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import pdfParse from 'pdf-parse'
import { GoogleGenerativeAI } from '@google/generative-ai'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'documents'
const geminiApiKey = process.env.GEMINI_API_KEY || ''
const defaultModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash'

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '') || ''
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { id, context } = body || {}
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: auth } = await supabase.auth.getUser(token)
    const user = auth?.user
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Fetch document row
    const { data: doc, error: selErr } = await supabase
      .from('documents')
      .select('id, user_id, storage_path, file_name')
      .eq('id', id)
      .single()

    if (selErr || !doc) return NextResponse.json({ error: selErr?.message || 'Not found' }, { status: 404 })
    if (doc.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // Download file bytes from storage
    const { data: fileData, error: dlErr } = await supabase.storage.from(bucketName).download(doc.storage_path)
    if (dlErr || !fileData) return NextResponse.json({ error: dlErr?.message || 'Download failed' }, { status: 500 })

    const arrayBuffer = await fileData.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const parsed = await pdfParse(buffer)
    let text = parsed.text || ''

    // Keep prompt within token limits
    const maxChars = 18000
    if (text.length > maxChars) text = text.slice(0, maxChars) + '\n... [truncated]'

    if (!geminiApiKey) {
      return NextResponse.json({ error: 'Gemini API key missing on server' }, { status: 500 })
    }

    const genAI = new GoogleGenerativeAI(geminiApiKey)
    // Allow override via env; default to widely available gemini-pro
    let model = genAI.getGenerativeModel({ model: defaultModel })

    const system = `You are an academic document rater. Score a PDF from 0 to 100 based on how well it serves the user's stated purpose. Consider coverage, accuracy, organization, clarity, depth, recency (if relevant), and usefulness.
Return STRICT JSON with keys only:
{
  "score": number,                    // 0-100
  "verdict": string,                 // short one-liner
  "rationale": string,               // <= 120 words
  "focus_topics": string[],          // 5-8 topics to focus more on
  "repetitive_topics": string[],     // 3-6 repetitive or low-value areas
  "suggested_plan": string[]         // 4-7 bullet steps to improve the notes for the purpose
}`

    const prompt = `User purpose/context: "${context || 'General study'}"\nDocument: ${doc.file_name}\n--- Begin Extracted Text (truncated) ---\n${text}\n--- End Extracted Text ---\nRespond with JSON only.`

    let output = ''
    try {
      const result = await model.generateContent([system, prompt])
      output = result.response.text()
    } catch (sdkErr: any) {
      // Fallback: call HTTP v1 endpoint directly; default to gemini-pro
      try {
        const httpModel = defaultModel || 'gemini-pro'
        const httpRes = await fetch(`https://generativelanguage.googleapis.com/v1/models/${httpModel}:generateContent?key=` + encodeURIComponent(geminiApiKey), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [{ text: `${system}\n\n${prompt}` }],
              },
            ],
          }),
        })
        if (!httpRes.ok) {
          const errText = await httpRes.text()
          throw new Error(errText)
        }
        const data = await httpRes.json()
        output = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
      } catch (httpErr: any) {
        throw new Error(httpErr?.message || sdkErr?.message || 'Gemini call failed')
      }
    }
    let json
    try {
      json = JSON.parse(output)
    } catch {
      // try to extract JSON
      const match = output.match(/\{[\s\S]*\}/)
      json = match ? JSON.parse(match[0]) : { score: 0, verdict: 'unable_to_parse', rationale: output.slice(0, 200) }
    }

    // Optionally persist into documents_metadata if table exists
    try {
      await supabase.from('documents_metadata').upsert({
        document_id: doc.id,
        ai_rating: json.score,
        ai_critique: json.rationale,
      }, { onConflict: 'document_id' })
    } catch {}

    return NextResponse.json({ id: doc.id, result: json })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}


