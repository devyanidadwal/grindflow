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

    // Prefer cached extracted text when available
    let text = ''
    try {
      const { data: cached } = await supabase
        .from('documents_text')
        .select('text')
        .eq('document_id', doc.id)
        .single()
      if (cached?.text) {
        text = cached.text
      }
    } catch {}

    if (!text) {
      const { data: fileData, error: dlErr } = await supabase.storage.from(bucketName).download(doc.storage_path)
      if (dlErr || !fileData) return NextResponse.json({ error: dlErr?.message || 'Download failed' }, { status: 500 })

      const arrayBuffer = await fileData.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      const parsed = await pdfParse(buffer)
      text = parsed.text || ''

      try {
        await supabase
          .from('documents_text')
          .upsert({ document_id: doc.id, text, extracted_at: new Date().toISOString() }, { onConflict: 'document_id' })
      } catch {}
    }

    const FAST_MODE = (process.env.FAST_MODE ?? '1') === '1'
    const OVERALL_TIMEOUT_MS = parseInt(process.env.QUIZ_TIMEOUT_MS || (FAST_MODE ? '18000' : '22000'), 10)

    function normalizeForPrompt(input: string): string {
      const lines = input.split(/\r?\n/)
      const seen: Record<string, number> = {}
      const kept: string[] = []
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue
        if (trimmed.length <= 50) {
          const key = trimmed.toLowerCase()
          seen[key] = (seen[key] || 0) + 1
          if (seen[key] > 2) continue
        }
        kept.push(trimmed)
      }
      const joined = kept.join('\n')
      return joined.replace(/[\t ]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n')
    }

    const originalNormalized = normalizeForPrompt(text)
    text = originalNormalized

    // If keywords provided, focus to relevant lines
    const focusTerms = String(keyword || '')
      .split(/[,\s]+/)
      .map((s: string) => s.trim().toLowerCase())
      .filter(Boolean)
    if (focusTerms.length > 0) {
      const snippets: string[] = []
      for (const line of text.split(/\r?\n/)) {
        const low = line.toLowerCase()
        if (focusTerms.some((t) => low.includes(t))) {
          snippets.push(line)
          if (snippets.length > 1200) break
        }
      }
      if (snippets.length >= 5) {
        text = snippets.join('\n')
      }
    }

    const maxChars = FAST_MODE ? 5000 : 18000
    if (text.length > maxChars) text = text.slice(0, maxChars) + '\n... [truncated]'

    if (!geminiApiKey) {
      return NextResponse.json({ error: 'Gemini API key missing on server' }, { status: 500 })
    }

    const genAI = new GoogleGenerativeAI(geminiApiKey)
    let model = genAI.getGenerativeModel({ model: FAST_MODE ? 'gemini-2.5-flash' : (defaultModel || 'gemini-2.5-flash') })

    const numQuestions = FAST_MODE ? 6 : 10
    const system = `You are a quiz generator. Given academic text, create a high-quality multiple-choice quiz. Return strict JSON only with ${numQuestions} concise questions, each with 4 options and the correct option index.`

    const prompt = `Document: ${doc.file_name}\nFocus topic/keywords: "${keyword || 'General'}"\n--- Begin Extracted Text (truncated) ---\n${text}\n--- End Extracted Text ---\n\nReturn STRICT JSON only:\n{\n  "questions": [\n    {\n      "question": string,\n      "options": [string, string, string, string],\n      "correctIndex": number // 0..3\n    }\n  ]\n}`

    let output = ''
    // Short timeout and HTTP fallback with smaller prompt
    const timeoutMs = OVERALL_TIMEOUT_MS
    try {
      const timed = new Promise<string>((resolve, reject) => {
        let done = false
        const timer = setTimeout(() => { if (!done) reject(new Error('timeout')) }, timeoutMs)
        model.generateContent([system, prompt])
          .then((res) => { done = true; clearTimeout(timer); resolve(res.response.text()) })
          .catch((err) => { done = true; clearTimeout(timer); reject(err) })
      })
      output = await timed
    } catch (sdkErr: any) {
      try {
        const httpModel = FAST_MODE ? 'gemini-2.5-flash' : (defaultModel || 'gemini-pro')
        const smaller = text.slice(0, FAST_MODE ? 3000 : 8000)
        const controller = new AbortController()
        const abortId = setTimeout(() => controller.abort(), timeoutMs)
        const httpRes = await fetch(`https://generativelanguage.googleapis.com/v1/models/${httpModel}:generateContent?key=` + encodeURIComponent(geminiApiKey), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              { role: 'user', parts: [{ text: `${system}\n\nDocument: ${doc.file_name}\nKeywords: ${keyword || 'General'}\n---\n${smaller}` }] }
            ],
          }),
          signal: controller.signal,
        })
        clearTimeout(abortId)
        if (!httpRes.ok) {
          const errText = await httpRes.text()
          throw new Error(errText)
        }
        const data = await httpRes.json()
        output = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
      } catch (httpErr: any) {
        // Gracefully handle aborts/timeouts by returning empty output
        const msg = String(httpErr?.message || '')
        if (httpErr?.name === 'AbortError' || /aborted|abort/i.test(msg)) {
          output = ''
        } else {
          // Non-timeout errors propagate to be handled by outer logic
          output = ''
        }
      }
    }

    // Robust JSON cleanup and parsing
    let json: any = { questions: [] }
    try {
      let cleaned = (output || '').trim()
      cleaned = cleaned.replace(/^```json\s*/i, '')
      cleaned = cleaned.replace(/^```\s*/i, '')
      cleaned = cleaned.replace(/\s*```$/i, '')
      cleaned = cleaned.trim()

      try {
        json = JSON.parse(cleaned)
      } catch {
        // Attempt to find complete JSON object by matching braces
        const open = cleaned.indexOf('{')
        if (open !== -1) {
          let depth = 0, inStr = false, esc = false, end = -1
          for (let i = open; i < cleaned.length; i++) {
            const ch = cleaned[i]
            if (esc) { esc = false; continue }
            if (ch === '\\') { esc = true; continue }
            if (ch === '"') { inStr = !inStr; continue }
            if (!inStr) {
              if (ch === '{') depth++
              if (ch === '}') { depth--; if (depth === 0) { end = i + 1; break } }
            }
          }
          if (end !== -1) {
            const slice = cleaned.slice(open, end)
            try { json = JSON.parse(slice) } catch {}
          }
        }
        if (!Array.isArray(json?.questions)) {
          // Last resort: regex extraction of questions array
          const qMatch = cleaned.match(/"questions"\s*:\s*\[([\s\S]*?)\]/)
          if (qMatch && qMatch[0]) {
            try {
              json = JSON.parse(`{${qMatch[0]}}`)
            } catch {}
          }
        }
      }
    } catch {}

    let questions = Array.isArray(json?.questions) ? json.questions.slice(0, numQuestions) : []
    // If no questions returned, retry once with broader context and longer prompt
    if (questions.length === 0) {
      try {
        const broader = originalNormalized.slice(0, FAST_MODE ? 9000 : 14000)
        const retryPrompt = `Document: ${doc.file_name}\nFocus topic/keywords: "${keyword || 'General'}"\n--- Begin Extracted Text (truncated) ---\n${broader}\n--- End Extracted Text ---\n\nReturn STRICT JSON only:\n{\n  "questions": [\n    {\n      "question": string,\n      "options": [string, string, string, string],\n      "correctIndex": number // 0..3\n    }\n  ]\n}`
        let retryOutput = ''
        try {
          const timed = new Promise<string>((resolve, reject) => {
            let done = false
            const timer = setTimeout(() => { if (!done) reject(new Error('timeout')) }, timeoutMs)
            model.generateContent([system, retryPrompt])
              .then((res) => { done = true; clearTimeout(timer); resolve(res.response.text()) })
              .catch((err) => { done = true; clearTimeout(timer); reject(err) })
          })
          retryOutput = await timed
        } catch (e:any) {
          const httpModel = FAST_MODE ? 'gemini-2.5-flash' : (defaultModel || 'gemini-pro')
          const controller = new AbortController()
          const abortId = setTimeout(() => controller.abort(), timeoutMs)
          const httpRes = await fetch(`https://generativelanguage.googleapis.com/v1/models/${httpModel}:generateContent?key=` + encodeURIComponent(geminiApiKey), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                { role: 'user', parts: [{ text: `${system}\n\n${retryPrompt}` }] }
              ],
            }),
            signal: controller.signal,
          })
          clearTimeout(abortId)
          if (httpRes.ok) {
            const data = await httpRes.json()
            retryOutput = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
          } else {
            // On HTTP error, continue to return empty list gracefully
            retryOutput = ''
          }
        }
        try {
          json = JSON.parse(retryOutput)
        } catch {
          const match = retryOutput.match(/\{[\s\S]*\}/)
          json = match ? JSON.parse(match[0]) : { questions: [] }
        }
        questions = Array.isArray(json?.questions) ? json.questions.slice(0, numQuestions) : []
      } catch {}
    }

    // Final safety: never exceed overall timeout; ensure response even if empty
    return NextResponse.json({ id: doc.id, questions })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}


