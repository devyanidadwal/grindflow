import { NextRequest, NextResponse } from 'next/server'
import { normalizeForPrompt, buildShortText } from '@/lib/text'
import { db } from '@/lib/db'
import { documentsText } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const [row] = await db
      .select({
        text: documentsText.text,
        normalized_text: documentsText.normalizedText,
        short_text: documentsText.shortText,
      })
      .from(documentsText)
      .where(eq(documentsText.documentId, id))
      .limit(1)

    if (!row) return NextResponse.json({ status: 'missing', short_text: '' })

    let normalized = row.normalized_text || ''
    let shortText = row.short_text || ''
    const text = row.text || ''

    if (!normalized && text) normalized = normalizeForPrompt(text)
    if (!shortText && normalized) shortText = buildShortText(normalized, 12000)

    return NextResponse.json({
      status: shortText ? 'ready' : (text ? 'partial' : 'missing'),
      length: (shortText || text).length || 0,
      short_text: shortText,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}
