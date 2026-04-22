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

    const FAST_MODE = (process.env.FAST_MODE ?? '1') === '1'
    const callGeminiWithRetries = (systemPrompt: string, userPrompt: string) =>
      callGemini(systemPrompt, userPrompt, {
        timeoutMs: FAST_MODE ? 22_000 : 28_000,
        maxAttempts: 3,
        models: ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'],
      })

    const baseText = shortText || normalizeForPrompt(text)
    const maxChars = FAST_MODE ? 12000 : 25000
    const promptText = baseText.length > maxChars ? baseText.slice(0, maxChars) + '\n... [truncated]' : baseText

    const system = `You are an expert academic study flow analyzer. Your task is to analyze educational documents and create comprehensive flow state analyses that help students understand learning progression, concept dependencies, and optimal study paths.`

    let prompt = ''
    if (type === 'diagram') {
      prompt = `Document: ${doc.fileName}\n--- Begin Extracted Text ---\n${promptText}\n--- End Extracted Text ---\n\nAnalyze this entire document and create a FLOW STATE DIAGRAM:
   - Create a visual ASCII/text diagram showing:
     * Main topics as nodes
     * Connections/arrows showing dependencies (use -> or →)
     * Hierarchical structure (use indentation or tree format)
     * Learning flow direction
     * Use boxes, lines, arrows, and clear formatting
     * Example format:
       Topic A
       ├── Subtopic A1
       │   └── Subtopic A1.1
       └── Subtopic A2
           └── Topic B (depends on A2)

IMPORTANT: Return ONLY valid JSON. Escape all quotes, newlines, and special characters in string values. Use \n for newlines, \" for quotes.

Return JSON with this exact key:
{
  "flowDiagram": "ASCII diagram here with escaped quotes and newlines"
}

Make the flowDiagram visually clear with proper formatting. Ensure all quotes inside the string are escaped with \".`
    } else if (type === 'analysis') {
      prompt = `Document: ${doc.fileName}\n--- Begin Extracted Text ---\n${promptText}\n--- End Extracted Text ---\n\nAnalyze this entire document and generate a FLOW STATE ANALYSIS:
   - Identify the main topics and subtopics
   - Map out the learning progression (which concepts build on others)
   - Highlight prerequisites and dependencies
   - Organize concepts in a logical study sequence
   - Note key relationships between topics
   - Suggest optimal learning path
   - Format as structured, readable text with clear sections

IMPORTANT: Return ONLY valid JSON. Escape all quotes, newlines, and special characters in string values. Use \n for newlines, \" for quotes.

Return JSON with this exact key:
{
  "flowAnalysis": "detailed text analysis here with escaped quotes and newlines"
}

Make the flowAnalysis comprehensive (500-1000 words). Ensure all quotes inside the string are escaped with \".`
    } else {
      prompt = `Document: ${doc.fileName}\n--- Begin Extracted Text ---\n${promptText}\n--- End Extracted Text ---\n\nAnalyze this entire document and generate:

1. FLOW STATE ANALYSIS:
   - Identify the main topics and subtopics
   - Map out the learning progression (which concepts build on others)
   - Highlight prerequisites and dependencies
   - Organize concepts in a logical study sequence
   - Note key relationships between topics
   - Suggest optimal learning path
   - Format as structured, readable text with clear sections

2. FLOW STATE DIAGRAM:
   - Create a visual ASCII/text diagram showing:
     * Main topics as nodes
     * Connections/arrows showing dependencies (use -> or →)
     * Hierarchical structure (use indentation or tree format)
     * Learning flow direction
     * Use boxes, lines, arrows, and clear formatting
     * Example format:
       Topic A
       ├── Subtopic A1
       │   └── Subtopic A1.1
       └── Subtopic A2
           └── Topic B (depends on A2)

IMPORTANT: Return ONLY valid JSON. Escape all quotes, newlines, and special characters in string values. Use \n for newlines, \" for quotes.

Return JSON with these exact keys:
{
  "flowAnalysis": "detailed text analysis here with escaped quotes and newlines",
  "flowDiagram": "ASCII diagram here with escaped quotes and newlines"
}

Make the flowAnalysis comprehensive (500-1000 words) and the flowDiagram visually clear with proper formatting. Ensure all quotes inside strings are escaped with \".`
    }

    let output: string
    try {
      output = await callGeminiWithRetries(system, prompt)
    } catch (e: any) {
      if (e instanceof GeminiUnavailableError) {
        return NextResponse.json({ error: e.message }, { status: 503, headers: rateLimitHeaders(rl) })
      }
      throw e
    }

    // Clean up output - remove markdown code blocks if present
    let cleanedOutput = output.trim()
    cleanedOutput = cleanedOutput.replace(/^```json\s*/i, '')
    cleanedOutput = cleanedOutput.replace(/^```\s*/i, '')
    cleanedOutput = cleanedOutput.replace(/\s*```$/i, '')
    cleanedOutput = cleanedOutput.trim()

    let json: any = { flowAnalysis: '', flowDiagram: '' }

    try {
      // First, try direct parsing
      json = JSON.parse(cleanedOutput)
    } catch (parseError: any) {
      // If direct parse fails, try to extract and fix JSON
      try {
        // Find JSON object boundaries
        const openBrace = cleanedOutput.indexOf('{')
        if (openBrace === -1) throw new Error('No JSON object found')
        
        // Use a proper JSON repair approach: find the complete JSON object
        let braceDepth = 0
        let inString = false
        let escapeNext = false
        let jsonEnd = -1
        
        for (let i = openBrace; i < cleanedOutput.length; i++) {
          const char = cleanedOutput[i]
          
          if (escapeNext) {
            escapeNext = false
            continue
          }
          
          if (char === '\\') {
            escapeNext = true
            continue
          }
          
          if (char === '"') {
            inString = !inString
            continue
          }
          
          if (!inString) {
            if (char === '{') braceDepth++
            if (char === '}') {
              braceDepth--
              if (braceDepth === 0) {
                jsonEnd = i + 1
                break
              }
            }
          }
        }
        
        if (jsonEnd === -1) throw new Error('Unmatched braces')
        
        let jsonStr = cleanedOutput.substring(openBrace, jsonEnd)
        
        // Try to fix unescaped newlines in string values
        jsonStr = jsonStr.replace(/("flowAnalysis"\s*:\s*")([\s\S]*?)(")/g, (match, prefix, content, suffix) => {
          const escaped = content
            .replace(/\\/g, '\\\\')
            .replace(/\"/g, '\\"')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r')
            .replace(/\t/g, '\\t')
          return prefix + escaped + suffix
        })
        
        jsonStr = jsonStr.replace(/("flowDiagram"\s*:\s*")([\s\S]*?)(")/g, (match, prefix, content, suffix) => {
          const escaped = content
            .replace(/\\/g, '\\\\')
            .replace(/\"/g, '\\"')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r')
            .replace(/\t/g, '\\t')
          return prefix + escaped + suffix
        })
        
        json = JSON.parse(jsonStr)
      } catch (repairError: any) {
        // If repair fails, try regex extraction as fallback
        try {
          const analysisMatch = cleanedOutput.match(/"flowAnalysis"\s*:\s*"([\s\S]*?)"\s*[,}]/)
          const diagramMatch = cleanedOutput.match(/"flowDiagram"\s*:\s*"([\s\S]*?)"\s*[,}]/)
          
          if (analysisMatch || diagramMatch) {
            json = {
              flowAnalysis: analysisMatch ? analysisMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n') : '',
              flowDiagram: diagramMatch ? diagramMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n') : ''
            }
          } else {
            const mid = Math.floor(cleanedOutput.length / 2)
            json = {
              flowAnalysis: cleanedOutput.slice(0, mid),
              flowDiagram: cleanedOutput.slice(mid) || 'Flow diagram could not be generated'
            }
          }
        } catch (finalError: any) {
          json = {
            flowAnalysis: 'Error parsing flow analysis. Raw response: ' + cleanedOutput.slice(0, 500),
            flowDiagram: 'Error parsing flow diagram'
          }
        }
      }
    }

    if (type === 'diagram') {
      const flowDiagram = typeof json.flowDiagram === 'string' ? json.flowDiagram : String(json.flowDiagram || '')
      const unescapedDiagram = flowDiagram.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\r/g, '\r')
      return NextResponse.json({ id: doc.id, flowDiagram: unescapedDiagram }, { headers: rateLimitHeaders(rl) })
    } else if (type === 'analysis') {
      const flowAnalysis = typeof json.flowAnalysis === 'string' ? json.flowAnalysis : String(json.flowAnalysis || '')
      const unescapedAnalysis = flowAnalysis.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\r/g, '\r')
      return NextResponse.json({ id: doc.id, flowAnalysis: unescapedAnalysis }, { headers: rateLimitHeaders(rl) })
    } else {
      let flowAnalysis = typeof json.flowAnalysis === 'string' ? json.flowAnalysis : String(json.flowAnalysis || '')
      let flowDiagram = typeof json.flowDiagram === 'string' ? json.flowDiagram : String(json.flowDiagram || '')
      flowAnalysis = flowAnalysis.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\r/g, '\r')
      flowDiagram = flowDiagram.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\r/g, '\r')
      return NextResponse.json({ id: doc.id, flowAnalysis, flowDiagram }, { headers: rateLimitHeaders(rl) })
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}

