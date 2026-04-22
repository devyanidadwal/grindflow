import { NextRequest, NextResponse } from 'next/server'
import pdfParse from 'pdf-parse'
import { normalizeForPrompt, buildShortText } from '@/lib/text'
import { db } from '@/lib/db'
import { documents, documentsText, documentsMetadata } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { requireUser } from '@/lib/auth'
import { checkAiRateLimit, rateLimitHeaders } from '@/lib/rate-limit'
import { callGemini, GeminiUnavailableError } from '@/lib/gemini'

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUser()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const rl = checkAiRateLimit(userId, 'analyze')
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Slow down and try again in a moment.' },
        { status: 429, headers: rateLimitHeaders(rl) }
      )
    }

    const body = await req.json()
    const { id, context } = body || {}
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const [doc] = await db
      .select({ id: documents.id, userId: documents.userId, storagePath: documents.storagePath, fileName: documents.fileName, fileUrl: documents.fileUrl })
      .from(documents)
      .where(eq(documents.id, id))
      .limit(1)

    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (doc.userId !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

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
      if (!doc.fileUrl) return NextResponse.json({ error: 'File URL missing' }, { status: 500 })
      const fileRes = await fetch(doc.fileUrl)
      if (!fileRes.ok) return NextResponse.json({ error: 'Download failed' }, { status: 500 })
      const arrayBuffer = await fileRes.arrayBuffer()
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

    let output: string
    try {
      output = await callGemini(system, prompt, { timeoutMs: 22_000, maxAttempts: 3 })
    } catch (e: any) {
      if (e instanceof GeminiUnavailableError) {
        return NextResponse.json({ error: e.message }, { status: 503 })
      }
      throw e
    }

    let json: any
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

    return NextResponse.json({ id: doc.id, result: json }, { headers: rateLimitHeaders(rl) })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}
