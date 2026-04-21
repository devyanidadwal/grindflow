import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { publicLibrary, documents } from '@/lib/db/schema'
import { desc, eq } from 'drizzle-orm'

export async function GET(_req: NextRequest) {
  try {
    const rows = await db
      .select({
        id: publicLibrary.id,
        document_id: publicLibrary.documentId,
        subject: publicLibrary.subject,
        unit: publicLibrary.unit,
        year: publicLibrary.year,
        degree: publicLibrary.degree,
        score: publicLibrary.score,
        analysis_keyword: publicLibrary.analysisKeyword,
        verdict: publicLibrary.verdict,
        rationale: publicLibrary.rationale,
        focus_topics: publicLibrary.focusTopics,
        repetitive_topics: publicLibrary.repetitiveTopics,
        suggested_plan: publicLibrary.suggestedPlan,
        uploaded_at: publicLibrary.uploadedAt,
        uploaded_by: publicLibrary.uploadedBy,
        file_name: documents.fileName,
        storage_path: documents.storagePath,
      })
      .from(publicLibrary)
      .leftJoin(documents, eq(publicLibrary.documentId, documents.id))
      .orderBy(desc(publicLibrary.uploadedAt))

    const parsed = rows.map((r) => ({
      ...r,
      focus_topics: r.focus_topics ? (() => { try { return JSON.parse(r.focus_topics as string) } catch { return r.focus_topics } })() : null,
      repetitive_topics: r.repetitive_topics ? (() => { try { return JSON.parse(r.repetitive_topics as string) } catch { return r.repetitive_topics } })() : null,
      suggested_plan: r.suggested_plan ? (() => { try { return JSON.parse(r.suggested_plan as string) } catch { return r.suggested_plan } })() : null,
      file_name: r.file_name || 'Unknown',
      storage_path: r.storage_path || '',
    }))

    return NextResponse.json({ rows: parsed })
  } catch (e: any) {
    console.error('[PUBLIC-LIBRARY] Error:', e)
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}
