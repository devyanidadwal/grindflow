'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

export default function SignInPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    async function checkAuth() {
      const { data } = await supabase.auth.getSession()
      if (data?.session) {
        // Already authenticated, redirect to dashboard
        router.push('/')
      }
      setChecking(false)
    }
    checkAuth()
  }, [router])

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      })

      if (error) throw error

      toast.success('Account created! Please check your email to confirm (if required).')
      router.push('/')
    } catch (error: any) {
      toast.error(error.message || 'Sign up failed')
    } finally {
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-xl font-semibold mb-2">Loading...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="card max-w-[920px] flex gap-[18px]">
        <div className="flex-1 p-2">
          <h1 className="m-0 mb-4 text-3xl font-bold">GrindFlow</h1>
          <p className="text-muted mb-6">Upload notes • Get AI ratings • Earn coins</p>
          <ul className="list-none p-0 m-0 space-y-3">
            <li className="flex items-center gap-2">
              ✨ AI-assisted note scoring & suggestions
            </li>
            <li className="flex items-center gap-2">
              🧭 Flow maps & adaptive study steps
            </li>
            <li className="flex items-center gap-2">
              🧠 Auto-generated quizzes
            </li>
            <li className="flex items-center gap-2">
              💸 Earn coins for sharing high-quality notes
            </li>
          </ul>
        </div>
        <div className="w-80 p-2">
          <form onSubmit={handleSignUp} className="flex flex-col gap-2.5">
            <h3 className="mt-0 mb-2 text-xl font-semibold">Create your account</h3>
            <input
              type="email"
              id="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="input-field"
            />
            <input
              type="password"
              id="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="input-field"
            />
            <button 
              type="submit" 
              className="btn-primary"
              disabled={loading}
            >
              {loading ? 'Creating account...' : 'Sign Up'}
            </button>
            <p className="text-xs text-muted mt-2">
              Already have an account? <Link href="/login" className="text-accent hover:underline">Login</Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}

