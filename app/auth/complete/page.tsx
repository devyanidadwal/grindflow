'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

export default function AuthCompletePage() {
  const router = useRouter()
  const [status, setStatus] = useState<'checking' | 'success' | 'failed' | 'idle'>('checking')
  const [secondsLeft, setSecondsLeft] = useState(15)

  useEffect(() => {
    let mounted = true
    const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams()
    const hasCode = !!params.get('code')
    console.log('[auth/complete] mounted, hasCode=', hasCode, 'search=', window.location.search)

    // If there's no code in the query, just check for an existing session and redirect
    const quickCheck = async () => {
      try {
        const { data } = await supabase.auth.getSession()
        if (data?.session) {
          // Check if user has username
          const token = data.session.access_token
          try {
            const res = await fetch('/api/user/check-username', {
              headers: { Authorization: `Bearer ${token}` },
            })
            if (res.ok) {
              const { hasUsername } = await res.json()
              if (hasUsername) {
                toast.success('Logged in successfully!')
                window.location.href = '/dashboard'
              } else {
                window.location.href = '/onboarding'
              }
            } else {
              // If check fails, assume onboarding needed
              window.location.href = '/onboarding'
            }
          } catch (e) {
            // If check fails, assume onboarding needed
            window.location.href = '/onboarding'
          }
        } else {
          // proceed to poll for a session if there was an OAuth code
          if (!hasCode) {
            setStatus('failed')
          }
        }
      } catch (err) {
        // continue to polling path below
      }
    }

    quickCheck()

    // If the SDK exposes getSessionFromUrl (older/newer variants), prefer that first
    const tryGetSessionFromUrl = async (): Promise<boolean> => {
      // Some SDK versions may have this method; call defensively
      const anyAuth = (supabase.auth as any)
      if (anyAuth && typeof anyAuth.getSessionFromUrl === 'function') {
        try {
          console.log('[auth/complete] calling getSessionFromUrl()')
          await anyAuth.getSessionFromUrl()
          console.log('[auth/complete] getSessionFromUrl() finished')
          return true
        } catch (e) {
          console.error('[auth/complete] getSessionFromUrl() error', e)
          // ignore and fall back to polling
        }
      }
      return false
    }

    let pollTimer: number | undefined
    let countdownTimer: number | undefined

    const startPolling = async () => {
      // If the SDK helper worked, the session may already be set; check once
      const helperWorked = await tryGetSessionFromUrl()
      console.log('[auth/complete] helperWorked=', helperWorked)
      if (helperWorked) {
          const { data } = await supabase.auth.getSession()
          console.log('[auth/complete] after helper getSession ->', data)
          if (data?.session) {
            if (!mounted) return
            // Check if user has username
            const token = data.session.access_token
            try {
              const res = await fetch('/api/user/check-username', {
                headers: { Authorization: `Bearer ${token}` },
              })
              if (res.ok) {
                const { hasUsername } = await res.json()
                setStatus('success')
                toast.success('Logged in successfully!')
                window.location.href = hasUsername ? '/dashboard' : '/onboarding'
              } else {
                window.location.href = '/onboarding'
              }
            } catch (e) {
              window.location.href = '/onboarding'
            }
            return
          }
      }

      const POLL_INTERVAL = 500
      const MAX_MS = 15000
      const deadline = Date.now() + MAX_MS

      const doPoll = async () => {
        try {
          const { data } = await supabase.auth.getSession()
          console.log('[auth/complete] poll getSession ->', !!data?.session)
          if (data?.session) {
            if (!mounted) return
            // Check if user has username
            const token = data.session.access_token
            try {
              const res = await fetch('/api/user/check-username', {
                headers: { Authorization: `Bearer ${token}` },
              })
              if (res.ok) {
                const { hasUsername } = await res.json()
                setStatus('success')
                toast.success('Logged in successfully!')
                router.push(hasUsername ? '/dashboard' : '/onboarding')
              } else {
                router.push('/onboarding')
              }
            } catch (e) {
              router.push('/onboarding')
            }
            return
          }
        } catch (e) {
          console.error('[auth/complete] poll error', e)
          // ignore and retry
        }

        if (Date.now() < deadline) {
          pollTimer = window.setTimeout(doPoll, POLL_INTERVAL)
        } else {
          if (!mounted) return
          setStatus('failed')
          toast.error('Sign-in did not complete. Try signing in again.')
        }
      }

      // Start countdown UI
      countdownTimer = window.setInterval(() => {
        setSecondsLeft((s) => Math.max(0, s - 1))
      }, 1000)

      doPoll()
    }

    // Only start polling if we have an OAuth code in the query (otherwise quickCheck above handled it)
    if (hasCode) startPolling()

    return () => {
      mounted = false
      if (pollTimer) clearTimeout(pollTimer)
      if (countdownTimer) clearInterval(countdownTimer)
    }
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="card max-w-md w-full text-center">
        {status === 'checking' && (
          <div>
            <div className="mb-4">
              <svg className="animate-spin mx-auto" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2">Completing sign-in…</h3>
            <p className="text-sm text-muted mb-3">We are finalizing your sign-in. This typically takes a few seconds.</p>
            <p className="text-xs text-muted">If nothing happens, try signing in again. Waiting <span className="font-medium">{secondsLeft}s</span></p>
          </div>
        )}

        {status === 'success' && (
          <div>
            <h3 className="text-xl font-semibold">Signed in</h3>
            <p className="text-sm text-muted">Redirecting to your dashboard…</p>
          </div>
        )}

        {status === 'failed' && (
          <div>
            <h3 className="text-xl font-semibold mb-2">Could not complete sign-in</h3>
            <p className="text-sm text-muted mb-4">We couldn't detect a session. This can happen if the sign-in was started in a different browser tab or localStorage was cleared. Try signing in again.</p>
            <div className="flex gap-2 justify-center">
              <button className="btn-primary" onClick={() => { window.location.href = '/'; }}>Back to Home</button>
              <button className="btn-ghost" onClick={() => { window.location.reload(); }}>Retry</button>
            </div>
          </div>
        )}

        {status === 'idle' && (
          <div>
            <p>Ready.</p>
          </div>
        )}
      </div>
    </div>
  )
}
