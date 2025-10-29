'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('abc@gmail.com')
  const [password, setPassword] = useState('123456')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    async function checkAuth() {
      const { data } = await supabase.auth.getSession()
      if (data?.session) {
        router.replace('/dashboard')
      } else {
        setChecking(false)
      }
    }
    checkAuth()
  }, [router])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      toast.success('Logged in successfully!')
      router.push('/dashboard')
    } catch (error: any) {
      toast.error(error.message || 'Login failed')
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
          <form onSubmit={handleLogin} className="flex flex-col gap-2.5">
            <h3 className="mt-0 mb-2 text-xl font-semibold">Welcome back</h3>
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
            <div className="flex gap-2">
              <button 
                type="submit" 
                className="btn-primary flex-1" 
                disabled={loading}
              >
                {loading ? 'Logging in...' : 'Login'}
              </button>
              <Link href="/signin" className="btn-secondary flex-1 text-center">
                Sign Up
              </Link>
            </div>
            <p className="text-xs text-muted mt-2">
              Guest credentials pre-filled. Or use your own account.
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}

