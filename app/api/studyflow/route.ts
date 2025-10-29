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
    const { id, type = 'both' } = body || {}
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    if (!['diagram', 'analysis', 'both'].includes(type)) {
      return NextResponse.json({ error: 'Invalid type. Must be "diagram", "analysis", or "both"' }, { status: 400 })
    }

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

    // Keep more text for flow analysis
    const maxChars = 25000
    if (text.length > maxChars) text = text.slice(0, maxChars) + '\n... [truncated]'

    if (!geminiApiKey) {
      return NextResponse.json({ error: 'Gemini API key missing on server' }, { status: 500 })
    }

    const genAI = new GoogleGenerativeAI(geminiApiKey)
    const candidateModels = Array.from(new Set([
      defaultModel,
      'gemini-2.5-flash',
      'gemini-1.5-pro',
      'gemini-pro',
    ].filter(Boolean)))

    async function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)) }

    async function callGeminiWithRetries(systemPrompt: string, userPrompt: string): Promise<string> {
      const backoffs = [500, 1000, 2000, 4000]
      for (const modelName of candidateModels) {
        // Try SDK with retries
        for (let attempt = 0; attempt < backoffs.length; attempt++) {
          try {
            const sdkModel = genAI.getGenerativeModel({ model: modelName })
            const res = await sdkModel.generateContent([systemPrompt, userPrompt])
            const text = res.response.text()
            if (text) return text
          } catch (err: any) {
            const msg = String(err?.message || '')
            if (attempt < backoffs.length - 1 && (/overloaded|resource.*exhausted|rate|429|unavailable|503/i.test(msg))) {
              await sleep(backoffs[attempt])
              continue
            }
            // fallthrough to HTTP
          }
          // HTTP fallback with same attempt index
          try {
            const httpRes = await fetch(`https://generativelanguage.googleapis.com/v1/models/${modelName}:generateContent?key=` + encodeURIComponent(geminiApiKey), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [ { role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] } ],
              }),
            })
            if (httpRes.ok) {
              const data = await httpRes.json()
              const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
              if (text) return text
            } else {
              const txt = await httpRes.text()
              if (attempt < backoffs.length - 1 && (/overloaded|resource.*exhausted|rate|429|unavailable|503/i.test(txt))) {
                await sleep(backoffs[attempt])
                continue
              }
            }
          } catch (httpErr: any) {
            const msg = String(httpErr?.message || '')
            if (attempt < backoffs.length - 1 && (/overloaded|resource.*exhausted|rate|429|unavailable|503/i.test(msg))) {
              await sleep(backoffs[attempt])
              continue
            }
          }
        }
      }
      throw new Error('Gemini temporarily overloaded. Please retry in a moment.')
    }

    const system = `You are an expert academic study flow analyzer. Your task is to analyze educational documents and create comprehensive flow state analyses that help students understand learning progression, concept dependencies, and optimal study paths.`

    let prompt = ''
    if (type === 'diagram') {
      prompt = `Document: ${doc.file_name}\n--- Begin Extracted Text ---\n${text}\n--- End Extracted Text ---\n\nAnalyze this entire document and create a FLOW STATE DIAGRAM:\n   - Create a visual ASCII/text diagram showing:\n     * Main topics as nodes\n     * Connections/arrows showing dependencies (use -> or →)\n     * Hierarchical structure (use indentation or tree format)\n     * Learning flow direction\n     * Use boxes, lines, arrows, and clear formatting\n     * Example format:\n       Topic A\n       ├── Subtopic A1\n       │   └── Subtopic A1.1\n       └── Subtopic A2\n           └── Topic B (depends on A2)\n\nIMPORTANT: Return ONLY valid JSON. Escape all quotes, newlines, and special characters in string values. Use \\n for newlines, \\" for quotes.\n\nReturn JSON with this exact key:\n{\n  "flowDiagram": "ASCII diagram here with escaped quotes and newlines"\n}\n\nMake the flowDiagram visually clear with proper formatting. Ensure all quotes inside the string are escaped with \\".`
    } else if (type === 'analysis') {
      prompt = `Document: ${doc.file_name}\n--- Begin Extracted Text ---\n${text}\n--- End Extracted Text ---\n\nAnalyze this entire document and generate a FLOW STATE ANALYSIS:\n   - Identify the main topics and subtopics\n   - Map out the learning progression (which concepts build on others)\n   - Highlight prerequisites and dependencies\n   - Organize concepts in a logical study sequence\n   - Note key relationships between topics\n   - Suggest optimal learning path\n   - Format as structured, readable text with clear sections\n\nIMPORTANT: Return ONLY valid JSON. Escape all quotes, newlines, and special characters in string values. Use \\n for newlines, \\" for quotes.\n\nReturn JSON with this exact key:\n{\n  "flowAnalysis": "detailed text analysis here with escaped quotes and newlines"\n}\n\nMake the flowAnalysis comprehensive (500-1000 words). Ensure all quotes inside the string are escaped with \\".`
    } else {
      prompt = `Document: ${doc.file_name}\n--- Begin Extracted Text ---\n${text}\n--- End Extracted Text ---\n\nAnalyze this entire document and generate:\n\n1. FLOW STATE ANALYSIS:\n   - Identify the main topics and subtopics\n   - Map out the learning progression (which concepts build on others)\n   - Highlight prerequisites and dependencies\n   - Organize concepts in a logical study sequence\n   - Note key relationships between topics\n   - Suggest optimal learning path\n   - Format as structured, readable text with clear sections\n\n2. FLOW STATE DIAGRAM:\n   - Create a visual ASCII/text diagram showing:\n     * Main topics as nodes\n     * Connections/arrows showing dependencies (use -> or →)\n     * Hierarchical structure (use indentation or tree format)\n     * Learning flow direction\n     * Use boxes, lines, arrows, and clear formatting\n     * Example format:\n       Topic A\n       ├── Subtopic A1\n       │   └── Subtopic A1.1\n       └── Subtopic A2\n           └── Topic B (depends on A2)\n\nIMPORTANT: Return ONLY valid JSON. Escape all quotes, newlines, and special characters in string values. Use \\n for newlines, \\" for quotes.\n\nReturn JSON with these exact keys:\n{\n  "flowAnalysis": "detailed text analysis here with escaped quotes and newlines",\n  "flowDiagram": "ASCII diagram here with escaped quotes and newlines"\n}\n\nMake the flowAnalysis comprehensive (500-1000 words) and the flowDiagram visually clear with proper formatting. Ensure all quotes inside strings are escaped with \\".`
    }

    const output = await callGeminiWithRetries(system, prompt)

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
        // This is a simpler approach: look for patterns like "key": "value with
        // newline" and fix them
        jsonStr = jsonStr.replace(/("flowAnalysis"\s*:\s*")([\s\S]*?)(")/g, (match, prefix, content, suffix) => {
          // Escape newlines, quotes, and backslashes in content
          const escaped = content
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r')
            .replace(/\t/g, '\\t')
          return prefix + escaped + suffix
        })
        
        jsonStr = jsonStr.replace(/("flowDiagram"\s*:\s*")([\s\S]*?)(")/g, (match, prefix, content, suffix) => {
          const escaped = content
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r')
            .replace(/\t/g, '\\t')
          return prefix + escaped + suffix
        })
        
        json = JSON.parse(jsonStr)
      } catch (repairError: any) {
        // If repair fails, try regex extraction as fallback
        try {
          // Extract using regex with dotall flag
          const analysisMatch = cleanedOutput.match(/"flowAnalysis"\s*:\s*"([\s\S]*?)"\s*[,}]/)
          const diagramMatch = cleanedOutput.match(/"flowDiagram"\s*:\s*"([\s\S]*?)"\s*[,}]/)
          
          if (analysisMatch || diagramMatch) {
            json = {
              flowAnalysis: analysisMatch ? analysisMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n') : '',
              flowDiagram: diagramMatch ? diagramMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n') : ''
            }
          } else {
            // Ultimate fallback: split output
            const mid = Math.floor(cleanedOutput.length / 2)
            json = {
              flowAnalysis: cleanedOutput.slice(0, mid),
              flowDiagram: cleanedOutput.slice(mid) || 'Flow diagram could not be generated'
            }
          }
        } catch (finalError: any) {
          // Last resort
          json = {
            flowAnalysis: 'Error parsing flow analysis. Raw response: ' + cleanedOutput.slice(0, 500),
            flowDiagram: 'Error parsing flow diagram'
          }
        }
      }
    }

    // Ensure we have valid strings and return only requested type
    if (type === 'diagram') {
      const flowDiagram = typeof json.flowDiagram === 'string' ? json.flowDiagram : String(json.flowDiagram || '')
      const unescapedDiagram = flowDiagram.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\r/g, '\r')
      return NextResponse.json({ id: doc.id, flowDiagram: unescapedDiagram })
    } else if (type === 'analysis') {
      const flowAnalysis = typeof json.flowAnalysis === 'string' ? json.flowAnalysis : String(json.flowAnalysis || '')
      const unescapedAnalysis = flowAnalysis.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\r/g, '\r')
      return NextResponse.json({ id: doc.id, flowAnalysis: unescapedAnalysis })
    } else {
      // type === 'both'
      let flowAnalysis = typeof json.flowAnalysis === 'string' ? json.flowAnalysis : String(json.flowAnalysis || '')
      let flowDiagram = typeof json.flowDiagram === 'string' ? json.flowDiagram : String(json.flowDiagram || '')
      flowAnalysis = flowAnalysis.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\r/g, '\r')
      flowDiagram = flowDiagram.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\r/g, '\r')
      return NextResponse.json({ id: doc.id, flowAnalysis, flowDiagram })
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}

