'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { motion } from 'framer-motion'

export default function OnboardingPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [checking, setChecking] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])

  useEffect(() => {
    let mounted = true
    // Check if user is authenticated
    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return
      if (error || !data?.session) {
        router.replace('/')
        return
      }
      // Check if user already has a username
      checkExistingUsername()
    })

    return () => {
      mounted = false
    }
  }, [router])

  async function checkExistingUsername() {
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session) {
        router.replace('/')
        return
      }

      const token = sessionData.session.access_token
      
      try {
        const res = await fetch('/api/user/check-username', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (res.ok) {
          const data = await res.json()
          const { hasUsername } = data
          if (hasUsername) {
            // User already has username, go to dashboard
            router.replace('/dashboard')
            return
          }
        } else {
          // If API returns error, still allow user to set username
          console.warn('[ONBOARDING] Check username API returned error:', res.status)
        }
      } catch (fetchError) {
        // Network error or fetch failed - allow user to continue anyway
        console.error('[ONBOARDING] Fetch error:', fetchError)
      }
      
      setChecking(false)

      // Generate suggestions based on email
      const email = sessionData.session.user.email || ''
      if (email) {
        const base = email.split('@')[0]
        const suggestions = [
          base,
          `${base}${Math.floor(Math.random() * 1000)}`,
          `${base}_${Math.floor(Math.random() * 100)}`,
        ]
        setSuggestions(suggestions)
      }
    } catch (e) {
      console.error('[ONBOARDING] Check username error:', e)
      setChecking(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const trimmedUsername = username.trim()
    
    // Validate username
    if (!trimmedUsername) {
      setError('Username is required')
      setLoading(false)
      return
    }

    if (trimmedUsername.length < 3) {
      setError('Username must be at least 3 characters')
      setLoading(false)
      return
    }

    if (trimmedUsername.length > 20) {
      setError('Username must be less than 20 characters')
      setLoading(false)
      return
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(trimmedUsername)) {
      setError('Username can only contain letters, numbers, underscores, and hyphens')
      setLoading(false)
      return
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session) {
        router.replace('/')
        return
      }

      const token = sessionData.session.access_token
      const res = await fetch('/api/user/set-username', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ username: trimmedUsername }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.error === 'username_taken') {
          setError('This username is already taken. Please choose another one.')
        } else {
          setError(data.error || 'Failed to set username. Please try again.')
        }
        setLoading(false)
        return
      }

      toast.success('Username set successfully!')
      router.replace('/dashboard')
    } catch (e: any) {
      console.error('[ONBOARDING] Set username error:', e)
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="card max-w-md w-full text-center">
          <div className="mb-4">
            <svg className="animate-spin mx-auto" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold mb-2">Loading...</h3>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-[#071029] via-[#071129] to-[#0f1724]">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="card max-w-md w-full"
      >
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="w-26 h-24 rounded-xl bg-gradient-to-br from-accent to-[#9ad4ff] overflow-hidden relative">
              <img 
                src="/49081F90-0AE7-46AD-BAF4-D21147D31B37_1_201_a.jpeg" 
                alt="Logo" 
                className="w-full h-full object-cover"
                onError={(e) => {
                  // Hide image on error, show placeholder instead
                  e.currentTarget.style.display = 'none'
                }}
              />
            </div>
          </div>
          <h1 className="text-3xl font-bold mb-2">Welcome to GrindFlow!</h1>
          <p className="text-muted">Choose a unique username to get started</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="username" className="block text-sm font-medium mb-2">
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value)
                setError('')
              }}
              placeholder="Enter your username"
              className="input-field w-full"
              maxLength={20}
              autoComplete="off"
              disabled={loading}
              autoFocus
            />
            <p className="text-xs text-muted mt-2">
              3-20 characters, letters, numbers, underscores, and hyphens only
            </p>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-red-400 text-sm mt-2"
              >
                {error}
              </motion.p>
            )}
          </div>

          {suggestions.length > 0 && (
            <div>
              <p className="text-xs text-muted mb-2">Suggestions:</p>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((suggestion, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setUsername(suggestion)
                      setError('')
                    }}
                    className="px-3 py-1.5 text-xs rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !username.trim()}
            className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                Setting up...
              </span>
            ) : (
              'Continue'
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={async () => {
              await supabase.auth.signOut()
              router.replace('/')
            }}
            className="text-sm text-muted hover:text-eaf0ff transition-colors"
          >
            Sign out and use a different account
          </button>
        </div>
      </motion.div>
    </div>
  )
}

