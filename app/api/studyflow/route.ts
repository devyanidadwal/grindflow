import { NextRequest, NextResponse } from 'next/server'
import pdfParse from 'pdf-parse'
import { normalizeForPrompt, buildShortText } from '@/lib/text'
import { db } from '@/lib/db'
import { documents, documentsText } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { requireUser } from '@/lib/auth'
import { checkAiRateLimit, rateLimitHeaders } from '@/lib/rate-limit'
import { callGemini, GeminiUnavailableError } from '@/lib/gemini'

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUser()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const rl = checkAiRateLimit(userId, 'studyflow')
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Slow down and try again in a moment.' },
        { status: 429, headers: rateLimitHeaders(rl) }
      )
    }

    const body = await req.json()
    const { id, type = 'both' } = body || {}
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    if (!['diagram', 'analysis', 'both'].includes(type)) {
      return NextResponse.json({ error: 'Invalid type. Must be "diagram", "analysis", or "both"' }, { status: 400 })
    }

    const [doc] = await db
      .select({ id: documents.id, userId: documents.userId, storagePath: documents.storagePath, fileName: documents.fileName, fileUrl: documents.fileUrl })
      .from(documents)
      .where(eq(documents.id, id))
      .limit(1)

    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (doc.userId !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // Load cached text if available; else parse and cache
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
        await db.update(documentsText)
          .set({ normalizedText: normalized, shortText })
          .where(eq(documentsText.documentId, doc.id))
      } catch {}
    }

    const callGeminiWithRetries = (systemPrompt: string, userPrompt: string) =>
      callGemini(systemPrompt, userPrompt, {
        timeoutMs: 15_000,
        maxAttempts: 2,
        models: ['gemini-2.5-flash-lite', 'gemini-2.5-flash'],
      })

    const baseText = shortText || normalizeForPrompt(text)
    const promptText = baseText.length > 10000 ? baseText.slice(0, 10000) + '\n... [truncated]' : baseText

    const system = `You are an expert academic study flow analyzer. Analyze educational documents and return concise, structured responses.`

    const diagramPrompt = `Document: ${doc.fileName}\n--- Content ---\n${promptText}\n--- End ---\n\nCreate a Mermaid flowchart (flowchart TD) showing the main topics and their learning dependencies. Use clear node labels. Keep it concise (max 20 nodes).\n\nRules:\n- Use flowchart TD syntax\n- Node IDs must be simple alphanumeric (A, B, C1, etc.)\n- Labels in square brackets: A[Topic Name]\n- Arrows: A --> B\n- No subgraphs needed, keep flat and readable\n\nReturn ONLY valid JSON:\n{"flowDiagram": "flowchart TD\\n  A[Topic] --> B[Subtopic]\\n  ..."}`

    const analysisPrompt = `Document: ${doc.fileName}\n--- Content ---\n${promptText}\n--- End ---\n\nCreate a FLOW STATE ANALYSIS: main topics, learning progression, prerequisites, optimal study path. 300-500 words, structured sections.\n\nReturn ONLY valid JSON:\n{"flowAnalysis": "analysis here with \\n for newlines"}`

    function parseGeminiOutput(raw: string): any {
      let s = raw.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim()
      try { return JSON.parse(s) } catch {}
      const start = s.indexOf('{')
      const end = s.lastIndexOf('}')
      if (start !== -1 && end !== -1) {
        try { return JSON.parse(s.slice(start, end + 1)) } catch {}
      }
      return {}
    }

    function unescape(s: string): string {
      return (typeof s === 'string' ? s : String(s || '')).replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\r/g, '\r')
    }

    try {
      if (type === 'diagram') {
        const output = await callGeminiWithRetries(system, diagramPrompt)
        const json = parseGeminiOutput(output)
        return NextResponse.json({ id: doc.id, flowDiagram: unescape(json.flowDiagram || '') }, { headers: rateLimitHeaders(rl) })
      }

      if (type === 'analysis') {
        const output = await callGeminiWithRetries(system, analysisPrompt)
        const json = parseGeminiOutput(output)
        return NextResponse.json({ id: doc.id, flowAnalysis: unescape(json.flowAnalysis || '') }, { headers: rateLimitHeaders(rl) })
      }

      // type === 'both': run in parallel
      const [diagramOutput, analysisOutput] = await Promise.all([
        callGeminiWithRetries(system, diagramPrompt),
        callGeminiWithRetries(system, analysisPrompt),
      ])
      const diagramJson = parseGeminiOutput(diagramOutput)
      const analysisJson = parseGeminiOutput(analysisOutput)
      return NextResponse.json({
        id: doc.id,
        flowAnalysis: unescape(analysisJson.flowAnalysis || ''),
        flowDiagram: unescape(diagramJson.flowDiagram || ''),
      }, { headers: rateLimitHeaders(rl) })
    } catch (e: any) {
      if (e instanceof GeminiUnavailableError) {
        return NextResponse.json({ error: e.message }, { status: 503, headers: rateLimitHeaders(rl) })
      }
      throw e
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}

