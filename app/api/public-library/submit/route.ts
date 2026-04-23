import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { documents, publicLibrary } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { requireUser } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUser()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { document_id, subject, unit, year, degree, score, analysis_keyword, verdict, rationale, focus_topics, repetitive_topics, suggested_plan } = body || {}
    if (!document_id || !subject) {
      return NextResponse.json({ error: 'Missing document_id or subject' }, { status: 400 })
    }

    const [doc] = await db
      .select({ id: documents.id, userId: documents.userId })
      .from(documents)
      .where(eq(documents.id, document_id))
      .limit(1)

    if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    if (doc.userId !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const values = {
      documentId: document_id,
      subject: subject.trim(),
      unit: unit?.trim() || null,
      year: year?.trim() || null,
      degree: degree?.trim() || null,
      score: score != null ? Number(score) : null,
      analysisKeyword: analysis_keyword?.trim() || null,
      verdict: verdict?.trim() || null,
      rationale: rationale?.trim() || null,
      focusTopics: focus_topics ? JSON.stringify(focus_topics) : null,
      repetitiveTopics: repetitive_topics ? JSON.stringify(repetitive_topics) : null,
      suggestedPlan: suggested_plan ? JSON.stringify(suggested_plan) : null,
      uploadedBy: userId,
      uploadedAt: new Date().toISOString(),
    }

    const [row] = await db
      .insert(publicLibrary)
      .values(values)
      .onConflictDoUpdate({
        target: publicLibrary.documentId,
        set: values,
      })
      .returning({ id: publicLibrary.id })

    return NextResponse.json({ success: true, id: row?.id })
  } catch (e: any) {
    console.error('[PUBLIC-LIBRARY] Error:', e)
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}
