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
    const { id, keyword } = body || {}
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: auth } = await supabase.auth.getUser(token)
    const user = auth?.user
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: doc, error: selErr } = await supabase
      .from('documents')
      .select('id, user_id, storage_path, file_name')
      .eq('id', id)
      .single()

    if (selErr || !doc) return NextResponse.json({ error: selErr?.message || 'Not found' }, { status: 404 })
    if (doc.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { data: fileData, error: dlErr } = await supabase.storage.from(bucketName).download(doc.storage_path)
    if (dlErr || !fileData) return NextResponse.json({ error: dlErr?.message || 'Download failed' }, { status: 500 })

    const arrayBuffer = await fileData.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const parsed = await pdfParse(buffer)
    let text = parsed.text || ''

    const maxChars = 18000
    if (text.length > maxChars) text = text.slice(0, maxChars) + '\n... [truncated]'

    if (!geminiApiKey) {
      return NextResponse.json({ error: 'Gemini API key missing on server' }, { status: 500 })
    }

    const genAI = new GoogleGenerativeAI(geminiApiKey)
    let model = genAI.getGenerativeModel({ model: defaultModel })

    const system = `You are a quiz generator. Given academic text, create a high-quality multiple-choice quiz. Return strict JSON only with 10 questions, each with 4 options and the correct option index.`

    const prompt = `Document: ${doc.file_name}\nFocus topic/keywords: "${keyword || 'General'}"\n--- Begin Extracted Text (truncated) ---\n${text}\n--- End Extracted Text ---\n\nReturn STRICT JSON only:\n{\n  "questions": [\n    {\n      "question": string,\n      "options": [string, string, string, string],\n      "correctIndex": number // 0..3\n    }\n  ]\n}`

    let output = ''
    try {
      const result = await model.generateContent([system, prompt])
      output = result.response.text()
    } catch (sdkErr: any) {
      try {
        const httpModel = defaultModel || 'gemini-pro'
        const httpRes = await fetch(`https://generativelanguage.googleapis.com/v1/models/${httpModel}:generateContent?key=` + encodeURIComponent(geminiApiKey), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              { role: 'user', parts: [{ text: `${system}\n\n${prompt}` }] }
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

    let json: any
    try {
      json = JSON.parse(output)
    } catch {
      const match = output.match(/\{[\s\S]*\}/)
      json = match ? JSON.parse(match[0]) : { questions: [] }
    }

    const questions = Array.isArray(json?.questions) ? json.questions.slice(0, 10) : []
    return NextResponse.json({ id: doc.id, questions })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}


