import { createUploadthing, type FileRouter } from 'uploadthing/next'
import { UploadThingError } from 'uploadthing/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { userProfiles, documents } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

const f = createUploadthing()

async function ensureProfile(userId: string, email: string | null) {
  const existing = await db
    .select({ id: userProfiles.id })
    .from(userProfiles)
    .where(eq(userProfiles.id, userId))
    .limit(1)
  if (existing.length > 0) return
  const base = email ? email.split('@')[0] : `user-${userId.substring(0, 8)}`
  const username = (base.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 20) || `user-${userId.substring(0, 8)}`)
  await db.insert(userProfiles).values({ id: userId, username }).onConflictDoNothing({ target: userProfiles.id })
}

export const ourFileRouter = {
  pdfUploader: f({
    pdf: { maxFileSize: '32MB', maxFileCount: 1 },
  })
    .middleware(async () => {
      const { userId } = await auth()
      if (!userId) throw new UploadThingError('Unauthorized')
      const user = await currentUser().catch(() => null)
      const email = user?.emailAddresses?.[0]?.emailAddress ?? null
      await ensureProfile(userId, email)
      return { userId }
    })
    .onUploadComplete(async ({ metadata, file }) => {
      const [row] = await db
        .insert(documents)
        .values({
          userId: metadata.userId,
          fileName: file.name,
          storagePath: file.key,
          fileUrl: file.ufsUrl,
        })
        .returning({ id: documents.id })

      return { documentId: row?.id, url: file.ufsUrl, key: file.key, name: file.name }
    }),
} satisfies FileRouter

export type OurFileRouter = typeof ourFileRouter
