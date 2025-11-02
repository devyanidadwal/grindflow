'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

interface UpdateUsernameSectionProps {
  userEmail?: string
}

export default function UpdateUsernameSection({ userEmail }: UpdateUsernameSectionProps) {
  const [currentUsername, setCurrentUsername] = useState<string>('')
  const [newUsername, setNewUsername] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function fetchCurrentUsername() {
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        if (!sessionData.session) return

        const token = sessionData.session.access_token
        const res = await fetch('/api/user/check-username', {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (res.ok) {
          const { username } = await res.json()
          setCurrentUsername(username || 'Not set')
        }
      } catch (e) {
        console.error('[SETTINGS] Fetch username error:', e)
      } finally {
        setChecking(false)
      }
    }

    fetchCurrentUsername()
  }, [])

  async function handleUpdate() {
    setError('')
    const trimmedUsername = newUsername.trim()

    if (!trimmedUsername) {
      setError('Username is required')
      return
    }

    if (trimmedUsername.length < 3) {
      setError('Username must be at least 3 characters')
      return
    }

    if (trimmedUsername.length > 20) {
      setError('Username must be less than 20 characters')
      return
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(trimmedUsername)) {
      setError('Username can only contain letters, numbers, underscores, and hyphens')
      return
    }

    setLoading(true)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session) {
        toast.error('Not authenticated')
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
          setError(data.error || 'Failed to update username')
        }
        setLoading(false)
        return
      }

      toast.success('Username updated successfully!')
      setCurrentUsername(trimmedUsername)
      setNewUsername('')
      setError('')
    } catch (e: any) {
      console.error('[SETTINGS] Update username error:', e)
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-muted">
          <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
          Loading...
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">
          Current Username
        </label>
        <div className="input-field bg-white/5 cursor-not-allowed opacity-75">
          {currentUsername || 'Not set'}
        </div>
      </div>

      <div>
        <label htmlFor="new-username" className="block text-sm font-medium mb-2">
          New Username
        </label>
        <input
          id="new-username"
          type="text"
          value={newUsername}
          onChange={(e) => {
            setNewUsername(e.target.value)
            setError('')
          }}
          placeholder="Enter new username"
          className="input-field w-full"
          maxLength={20}
          autoComplete="off"
          disabled={loading}
        />
        <p className="text-xs text-muted mt-2">
          3-20 characters, letters, numbers, underscores, and hyphens only
        </p>
        {error && (
          <p className="text-red-400 text-sm mt-2">{error}</p>
        )}
      </div>

      <button
        onClick={handleUpdate}
        disabled={loading || !newUsername.trim()}
        className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            Updating...
          </span>
        ) : (
          'Update Username'
        )}
      </button>
    </div>
  )
}

