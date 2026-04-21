import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import pdfParse from 'pdf-parse'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { normalizeForPrompt, buildShortText } from '@/lib/text'
import { db } from '@/lib/db'
import { documents, documentsText, documentsMetadata } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'

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

    const [doc] = await db
      .select({ id: documents.id, userId: documents.userId, storagePath: documents.storagePath, fileName: documents.fileName })
      .from(documents)
      .where(eq(documents.id, id))
      .limit(1)

    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (doc.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    let text = ''
    let shortText = ''
    try {
      const [cached] = await db
        .select({ text: documentsText.text, normalized_text: documentsText.normalizedText, short_text: documentsText.shortText })
        .from(documentsText)
        .where(eq(documentsText.documentId, doc.id))
        .limit(1)
      if (cached?.short_text) shortText = cached.short_text
      if (cached?.text) text = cached.text
      if (!shortText && cached?.normalized_text) shortText = buildShortText(cached.normalized_text, 12000)
    } catch {}

    if (!text) {
      const { data: fileData, error: dlErr } = await supabase.storage.from(bucketName).download(doc.storagePath)
      if (dlErr || !fileData) return NextResponse.json({ error: dlErr?.message || 'Download failed' }, { status: 500 })

      const arrayBuffer = await fileData.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      const parsed = await pdfParse(buffer)
      text = parsed.text || ''
      try {
        const normalized = normalizeForPrompt(text)
        shortText = buildShortText(normalized, 12000)
        await db
          .insert(documentsText)
          .values({ documentId: doc.id, text, normalizedText: normalized, shortText, extractedAt: new Date().toISOString() })
          .onConflictDoUpdate({
            target: documentsText.documentId,
            set: { text, normalizedText: normalized, shortText, extractedAt: new Date().toISOString() },
          })
      } catch {}
    }

    if (!shortText && text) {
      const normalized = normalizeForPrompt(text)
      shortText = buildShortText(normalized, 12000)
      try {
        await db
          .update(documentsText)
          .set({ normalizedText: normalized, shortText })
          .where(eq(documentsText.documentId, doc.id))
      } catch {}
    }

    let promptText = shortText || text
    const maxChars = 18000
    if (promptText.length > maxChars) promptText = promptText.slice(0, maxChars) + '\n... [truncated]'

    if (!geminiApiKey) {
      return NextResponse.json({ error: 'Gemini API key missing on server' }, { status: 500 })
    }

    const genAI = new GoogleGenerativeAI(geminiApiKey)
    let model = genAI.getGenerativeModel({ model: defaultModel })

    const system = `You are an academic document rater. Score a PDF from 0 to 100 based on how well it serves the user's stated purpose. Consider coverage, accuracy, organization, clarity, depth, recency (if relevant), and usefulness.
Return STRICT JSON with keys only:
{
  "score": number,
  "verdict": string,
  "rationale": string,
  "focus_topics": string[],
  "repetitive_topics": string[],
  "suggested_plan": string[]
}`

    const prompt = `User purpose/context: "${context || 'General study'}"\nDocument: ${doc.fileName}\n--- Begin Extracted Text (truncated) ---\n${promptText}\n--- End Extracted Text ---\nRespond with JSON only.`

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
            contents: [{ role: 'user', parts: [{ text: `${system}\n\n${prompt}` }] }],
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
      const match = output.match(/\{[\s\S]*\}/)
      json = match ? JSON.parse(match[0]) : { score: 0, verdict: 'unable_to_parse', rationale: output.slice(0, 200) }
    }

    try {
      await db
        .insert(documentsMetadata)
        .values({ documentId: doc.id, aiRating: json.score, aiCritique: json.rationale })
        .onConflictDoUpdate({
          target: documentsMetadata.documentId,
          set: { aiRating: json.score, aiCritique: json.rationale },
        })
    } catch {}

    return NextResponse.json({ id: doc.id, result: json })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}
