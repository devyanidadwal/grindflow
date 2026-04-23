import { NextRequest, NextResponse } from 'next/server'
import pdfParse from 'pdf-parse'
import { db } from '@/lib/db'
import { documents, documentsText } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { requireUser } from '@/lib/auth'
import { checkAiRateLimit, rateLimitHeaders } from '@/lib/rate-limit'
import { callGemini, GeminiUnavailableError } from '@/lib/gemini'

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
  return kept.join('\n').replace(/[\t ]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n')
}

function parseQuestions(output: string, max: number): any[] {
  let cleaned = (output || '').trim()
  cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim()
  let json: any = { questions: [] }
  try {
    json = JSON.parse(cleaned)
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (match) {
      try { json = JSON.parse(match[0]) } catch {}
    }
  }
  return Array.isArray(json?.questions) ? json.questions.slice(0, max) : []
}

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUser()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const rl = checkAiRateLimit(userId, 'quiz')
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Slow down and try again in a moment.' },
        { status: 429, headers: rateLimitHeaders(rl) }
      )
    }

    const body = await req.json()
    const { id, keyword } = body || {}
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const [doc] = await db
      .select({ id: documents.id, userId: documents.userId, fileName: documents.fileName, fileUrl: documents.fileUrl })
      .from(documents)
      .where(eq(documents.id, id))
      .limit(1)

    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (doc.userId !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    let text = ''
    try {
      const [cached] = await db
        .select({ text: documentsText.text })
        .from(documentsText)
        .where(eq(documentsText.documentId, doc.id))
        .limit(1)
      if (cached?.text) text = cached.text
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
        await db
          .insert(documentsText)
          .values({ documentId: doc.id, text, extractedAt: new Date().toISOString() })
          .onConflictDoUpdate({
            target: documentsText.documentId,
            set: { text, extractedAt: new Date().toISOString() },
          })
      } catch {}
    }

    const FAST_MODE = (process.env.FAST_MODE ?? '1') === '1'
    const OVERALL_TIMEOUT_MS = parseInt(process.env.QUIZ_TIMEOUT_MS || (FAST_MODE ? '18000' : '22000'), 10)

    const originalNormalized = normalizeForPrompt(text)
    text = originalNormalized

    const focusTerms = String(keyword || '').split(/[,\s]+/).map((s: string) => s.trim().toLowerCase()).filter(Boolean)
    if (focusTerms.length > 0) {
      const snippets: string[] = []
      for (const line of text.split(/\r?\n/)) {
        const low = line.toLowerCase()
        if (focusTerms.some((t) => low.includes(t))) {
          snippets.push(line)
          if (snippets.length > 1200) break
        }
      }
      if (snippets.length >= 5) text = snippets.join('\n')
    }

    const maxChars = FAST_MODE ? 5000 : 18000
    if (text.length > maxChars) text = text.slice(0, maxChars) + '\n... [truncated]'

    const numQuestions = FAST_MODE ? 6 : 10
    const system = `You are a quiz generator. Given academic text, create a high-quality multiple-choice quiz. Return strict JSON only with ${numQuestions} concise questions, each with 4 options and the correct option index.`
    const prompt = `Document: ${doc.fileName}\nFocus topic/keywords: "${keyword || 'General'}"\n--- Begin Extracted Text (truncated) ---\n${text}\n--- End Extracted Text ---\n\nReturn STRICT JSON only:\n{\n  "questions": [\n    {\n      "question": string,\n      "options": [string, string, string, string],\n      "correctIndex": number // 0..3\n    }\n  ]\n}`

    let output: string
    try {
      output = await callGemini(system, prompt, { timeoutMs: OVERALL_TIMEOUT_MS, maxAttempts: 2 })
    } catch (e: any) {
      if (e instanceof GeminiUnavailableError) {
        return NextResponse.json({ error: e.message }, { status: 503, headers: rateLimitHeaders(rl) })
      }
      throw e
    }

    let questions = parseQuestions(output, numQuestions)

    if (questions.length === 0) {
      const broader = originalNormalized.slice(0, FAST_MODE ? 9000 : 14000)
      const retryPrompt = `Document: ${doc.fileName}\nFocus topic/keywords: "${keyword || 'General'}"\n--- Begin Extracted Text (truncated) ---\n${broader}\n--- End Extracted Text ---\n\nReturn STRICT JSON only:\n{\n  "questions": [\n    {\n      "question": string,\n      "options": [string, string, string, string],\n      "correctIndex": number // 0..3\n    }\n  ]\n}`
      try {
        const retryOutput = await callGemini(system, retryPrompt, { timeoutMs: OVERALL_TIMEOUT_MS, maxAttempts: 2 })
        questions = parseQuestions(retryOutput, numQuestions)
      } catch {
        // leave empty
      }
    }

    return NextResponse.json({ id: doc.id, questions }, { headers: rateLimitHeaders(rl) })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}
