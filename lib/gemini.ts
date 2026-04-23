import { GoogleGenerativeAI } from '@google/generative-ai'

const geminiApiKey = process.env.GEMINI_API_KEY || ''
const defaultModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash'

export interface CallOpts {
  timeoutMs?: number
  models?: string[]
  maxAttempts?: number
}

export class GeminiUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GeminiUnavailableError'
  }
}

const RETRYABLE = /overloaded|resource.*exhausted|rate|429|unavailable|503|502|timeout/i

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms)
    p.then((v) => {
      clearTimeout(t)
      resolve(v)
    }).catch((e) => {
      clearTimeout(t)
      reject(e)
    })
  })
}

export async function callGemini(
  systemPrompt: string,
  userPrompt: string,
  opts: CallOpts = {}
): Promise<string> {
  if (!geminiApiKey) throw new GeminiUnavailableError('Gemini API key missing on server')

  const models = Array.from(
    new Set(
      (opts.models && opts.models.length ? opts.models : [defaultModel, 'gemini-2.5-flash', 'gemini-2.5-flash-lite']).filter(
        Boolean
      )
    )
  )
  const timeoutMs = opts.timeoutMs ?? 22_000
  const maxAttempts = opts.maxAttempts ?? 3
  const backoffs = [500, 1200, 3000, 6000]

  const genAI = new GoogleGenerativeAI(geminiApiKey)

  let lastErr: any = null
  for (const modelName of models) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // SDK path
      try {
        const m = genAI.getGenerativeModel({ model: modelName })
        const res = await withTimeout(m.generateContent([systemPrompt, userPrompt]), timeoutMs)
        const text = res.response.text()
        if (text) return text
      } catch (err: any) {
        lastErr = err
        const msg = String(err?.message || '')
        if (/API.?key.*(invalid|expired)/i.test(msg)) {
          throw new GeminiUnavailableError('Gemini API key invalid or expired')
        }
        if (!RETRYABLE.test(msg)) {
          // Try HTTP fallback once before giving up on this model
        }
      }

      // HTTP fallback
      try {
        const httpRes = await withTimeout(
          fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=` +
              encodeURIComponent(geminiApiKey),
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
              }),
            }
          ),
          timeoutMs
        )
        if (httpRes.ok) {
          const data = await httpRes.json()
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
          if (text) return text
        } else {
          const errText = await httpRes.text()
          lastErr = new Error(errText || `HTTP ${httpRes.status}`)
          if (/API.?key.*(invalid|expired)/i.test(errText)) {
            throw new GeminiUnavailableError('Gemini API key invalid or expired')
          }
          if (!RETRYABLE.test(errText)) break // non-retryable; try next model
        }
      } catch (err: any) {
        lastErr = err
        const msg = String(err?.message || '')
        if (err instanceof GeminiUnavailableError) throw err
        if (!RETRYABLE.test(msg) && msg !== 'timeout') break
      }

      await sleep(backoffs[Math.min(attempt, backoffs.length - 1)])
    }
  }

  throw new GeminiUnavailableError(lastErr?.message || 'Gemini temporarily unavailable')
}
