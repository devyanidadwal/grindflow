import { NextRequest, NextResponse } from 'next/server'
import { Webhook } from 'svix'
import { db } from '@/lib/db'
import { userProfiles } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'

export async function POST(req: NextRequest) {
  const secret = process.env.CLERK_WEBHOOK_SIGNING_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'Missing CLERK_WEBHOOK_SIGNING_SECRET' }, { status: 500 })
  }

  const svixId = req.headers.get('svix-id')
  const svixTimestamp = req.headers.get('svix-timestamp')
  const svixSignature = req.headers.get('svix-signature')
  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: 'Missing svix headers' }, { status: 400 })
  }

  const payload = await req.text()

  let event: any
  try {
    const wh = new Webhook(secret)
    event = wh.verify(payload, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    })
  } catch (e: any) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const type = event.type as string
  const data = event.data

  try {
    if (type === 'user.created' || type === 'user.updated') {
      const id: string = data.id
      const email: string | undefined = data.email_addresses?.[0]?.email_address
      const clerkUsername: string | undefined = data.username
      const base = clerkUsername || (email ? email.split('@')[0] : `user-${id.substring(0, 8)}`)
      const username = base.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 20) || `user-${id.substring(0, 8)}`

      await db
        .insert(userProfiles)
        .values({ id, username })
        .onConflictDoUpdate({
          target: userProfiles.id,
          set: { updatedAt: sql`now()` },
        })
    } else if (type === 'user.deleted') {
      const id: string | undefined = data.id
      if (id) await db.delete(userProfiles).where(eq(userProfiles.id, id))
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('[CLERK WEBHOOK] error:', e)
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}
