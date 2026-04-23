import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { notifications } from '@/lib/db/schema'
import { and, desc, eq } from 'drizzle-orm'
import { requireUser } from '@/lib/auth'

export async function GET(_req: NextRequest) {
  try {
    const userId = await requireUser()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(50)

    return NextResponse.json({ notifications: rows })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const userId = await requireUser()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const { id, all } = body || {}

    if (all) {
      await db.update(notifications).set({ read: true }).where(eq(notifications.userId, userId))
      return NextResponse.json({ success: true })
    }

    if (!id) return NextResponse.json({ error: 'id or all=true required' }, { status: 400 })

    await db
      .update(notifications)
      .set({ read: true })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}
