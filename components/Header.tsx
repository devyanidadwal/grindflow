'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { UserButton, useUser } from '@clerk/nextjs'
import NotificationBell from './NotificationBell'

interface HeaderProps {
  title: string
  onSearchChange?: (value: string) => void
  onAuthToggle?: () => void
  isAuthenticated?: boolean
  userEmail?: string
  userId?: string
}

export default function Header({ title, isAuthenticated, userId }: HeaderProps) {
  const router = useRouter()
  const { isSignedIn, user } = useUser()
  const signedIn = isAuthenticated ?? isSignedIn
  const currentUserId = userId || user?.id || ''
  const email = user?.primaryEmailAddress?.emailAddress || ''

  return (
    <header className="flex justify-between items-center px-7 py-[18px] border-b border-white/2">
      <div>
        <h2 className="m-0 text-xl font-semibold">{title}</h2>
      </div>
      <div className="flex items-center gap-3">
        {signedIn && <NotificationBell userId={currentUserId} />}
        {signedIn && (
          <button
            onClick={() => router.push('/dashboard?view=settings')}
            className="btn-ghost text-xl"
            title="Settings"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c0 .66.39 1.26 1 1.51.32.13.66.2 1.01.2H21a2 2 0 1 1 0 4h-.09c-.35 0-.69.07-1.01.2-.61.25-1 .85-1 1.51z" />
            </svg>
          </button>
        )}
        {signedIn ? (
          <>
            <span className="btn-secondary cursor-default opacity-75">
              ✓ Signed In{email && ` as ${email}`}
            </span>
            <UserButton />
          </>
        ) : (
          <Link href="/signin" className="btn-secondary">Sign In</Link>
        )}
      </div>
    </header>
  )
}
