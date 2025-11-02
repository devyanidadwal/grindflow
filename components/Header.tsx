'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import NotificationBell from './NotificationBell'

interface HeaderProps {
  title: string
  onSearchChange?: (value: string) => void
  onAuthToggle?: () => void
  isAuthenticated?: boolean
  userEmail?: string
  userId?: string
}

export default function Header({ title, onSearchChange, onAuthToggle, isAuthenticated = false, userEmail, userId }: HeaderProps) {
  const router = useRouter()
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [email, setEmail] = useState<string>('')
  const [currentUserId, setCurrentUserId] = useState<string>('')

  useEffect(() => {
    if (!isAuthenticated) {
      setEmail('')
      setAvatarUrl(null)
      return
    }

    async function fetchUserData() {
      try {
        // Use getUser() to get fresh user data with metadata
        const { data: { user }, error } = await supabase.auth.getUser()
        
        if (error || !user) {
          console.error('[HEADER] Error fetching user:', error)
          return
        }

        // Get email and user ID
        const userEmail = user.email || ''
        setEmail(userEmail)
        setCurrentUserId(user.id)
        
        // Get avatar from user_metadata - check multiple possible locations
        // Google OAuth can store it in different places
        const avatar = 
          user.user_metadata?.avatar_url || 
          user.user_metadata?.picture || 
          user.user_metadata?.picture_url ||
          (user.user_metadata?.provider === 'google' && user.user_metadata?.avatar_url) ||
          null
        
        if (avatar) {
          setAvatarUrl(avatar)
        } else {
          // If no avatar in metadata, try to construct from email (Gravatar fallback)
          // Or generate initials as fallback
          setAvatarUrl(null)
        }
      } catch (e) {
        console.error('[HEADER] Error in fetchUserData:', e)
      }
    }

    fetchUserData()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_e, session) => {
      if (session?.user) {
        const user = session.user
        const userEmail = user.email || ''
        setEmail(userEmail)
        
        // Get avatar from user_metadata
        const avatar = 
          user.user_metadata?.avatar_url || 
          user.user_metadata?.picture || 
          user.user_metadata?.picture_url ||
          null
        
        setAvatarUrl(avatar)
        setCurrentUserId(user.id)
      } else {
        setEmail('')
        setAvatarUrl(null)
        setCurrentUserId('')
      }
    })

    return () => subscription.unsubscribe()
  }, [isAuthenticated])

  return (
    <header className="flex justify-between items-center px-7 py-[18px] border-b border-white/2">
      <div>
        <h2 className="m-0 text-xl font-semibold">{title}</h2>
      </div>
      <div className="flex items-center gap-3">
        {isAuthenticated && <NotificationBell userId={userId || currentUserId} />}
        {isAuthenticated && (
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
        {isAuthenticated ? (
          <span className="btn-secondary cursor-default opacity-75">
            ✓ Signed In{email && ` as ${email}`}
          </span>
        ) : (
          <button onClick={onAuthToggle} className="btn-secondary">
            Sign In
          </button>
        )}
        {isAuthenticated ? (
          avatarUrl ? (
            <button 
              className="btn-ghost p-0 w-10 h-10 rounded-full overflow-hidden border-2 border-white/10 hover:border-white/20 transition-colors"
              title="Profile"
            >
              <img 
                src={avatarUrl} 
                alt="Profile" 
                className="w-full h-full object-cover"
                onError={() => {
                  // If image fails to load, hide it and show default icon
                  setAvatarUrl(null)
                }}
              />
            </button>
          ) : (
            <button 
              className="btn-ghost w-10 h-10 rounded-full bg-gradient-to-br from-accent/20 to-[#9ad4ff]/20 flex items-center justify-center font-bold text-sm border border-white/10"
              title="Profile"
            >
              {email ? email.charAt(0).toUpperCase() : '👤'}
            </button>
          )
        ) : null}
      </div>
    </header>
  )
}

