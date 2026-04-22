import { auth, currentUser } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { userProfiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

async function ensureProfile(userId: string, email: string | null) {
  try {
    const existing = await db
      .select({ id: userProfiles.id })
      .from(userProfiles)
      .where(eq(userProfiles.id, userId))
      .limit(1)
    if (existing.length > 0) return
    const base = email ? email.split('@')[0] : `user-${userId.substring(0, 8)}`
    const username = (base.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 20) || `user-${userId.substring(0, 8)}`)
    await db.insert(userProfiles).values({ id: userId, username }).onConflictDoNothing({ target: userProfiles.id })
  } catch (e) {
    console.warn('[auth] ensureProfile failed:', (e as any)?.message || e)
  }
}

export async function requireUser(): Promise<string | null> {
  const { userId } = await auth()
  if (!userId) return null
  const user = await currentUser().catch(() => null)
  const email = user?.emailAddresses?.[0]?.emailAddress ?? null
  await ensureProfile(userId, email)
  return userId
}

export async function requireUserWithEmail(): Promise<{ id: string; email: string | null } | null> {
  const { userId } = await auth()
  if (!userId) return null
  const user = await currentUser().catch(() => null)
  const email = user?.emailAddresses?.[0]?.emailAddress ?? null
  await ensureProfile(userId, email)
  return { id: userId, email }
}
