'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

export default function Dashboard() {
  const [activeView, setActiveView] = useState('home')
  const [showAuth, setShowAuth] = useState(false)
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [authStatus, setAuthStatus] = useState('Not signed in')
  const [userEmail, setUserEmail] = useState<string>('')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    async function checkAuth() {
      const { data } = await supabase.auth.getSession()
      const session = data?.session
      
      if (session) {
        const email = session.user.email || 'User'
        setIsAuthenticated(true)
        setUserEmail(email)
        setAuthStatus(`Signed in as ${email}`)
        setIsLoading(false)
      } else {
        // Not authenticated, redirect to login
        setIsLoading(false)
        router.replace('/login')
      }
    }

    checkAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        setIsAuthenticated(false)
        setUserEmail('')
        setAuthStatus('Not signed in')
        router.replace('/login')
      } else if (session) {
        const email = session.user.email || 'User'
        setIsAuthenticated(true)
        setUserEmail(email)
        setAuthStatus(`Signed in as ${email}`)
      }
    })

    return () => subscription.unsubscribe()
  }, [router])

  const handleSignIn = async () => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: authPassword,
      })
      if (error) throw error
      toast.success('Signed in')
      setShowAuth(false)
    } catch (e: any) {
      toast.error(`Sign-in failed: ${e.message || e}`)
    }
  }

  const handleSignUp = async () => {
    try {
      const { error } = await supabase.auth.signUp({
        email: authEmail,
        password: authPassword,
      })
      if (error) throw error
      toast.success('Sign-up successful. Check your email to confirm (if required).')
      setShowAuth(false)
    } catch (e: any) {
      toast.error(`Sign-up failed: ${e.message || e}`)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setUserEmail('')
    setAuthStatus('Not signed in')
    toast.success('Signed out')
    router.replace('/login')
  }

  const handleUpload = async () => {
    console.log('[UPLOAD] Starting upload process...')
    
    if (!file) {
      console.warn('[UPLOAD] No file selected')
      toast.error('Choose a PDF first.')
      return
    }

    console.log('[UPLOAD] File details:', {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: new Date(file.lastModified).toISOString(),
    })

    try {
      console.log('[UPLOAD] Step 1: Creating FormData...')
      const form = new FormData()
      form.append('file', file)
      console.log('[UPLOAD] FormData created successfully')

      console.log('[UPLOAD] Step 2: Getting auth session...')
      const sessionStartTime = Date.now()
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      console.log('[UPLOAD] Session fetch completed in', Date.now() - sessionStartTime, 'ms')
      
      if (sessionError) {
        console.error('[UPLOAD] Session error:', sessionError)
      }
      
      const token = session?.access_token
      console.log('[UPLOAD] Auth token:', token ? `Present (${token.substring(0, 20)}...)` : 'Missing')

      const headers: HeadersInit = {}
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      console.log('[UPLOAD] Step 3: Preparing fetch request...')
      console.log('[UPLOAD] Request headers:', Object.keys(headers))
      console.log('[UPLOAD] FormData size estimate:', file.size, 'bytes')

      console.log('[UPLOAD] Step 4: Sending request to /api/upload...')
      const fetchStartTime = Date.now()
      
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers,
        body: form,
        credentials: 'include',
      })

      const fetchDuration = Date.now() - fetchStartTime
      console.log('[UPLOAD] Fetch completed in', fetchDuration, 'ms')
      console.log('[UPLOAD] Response status:', res.status, res.statusText)
      console.log('[UPLOAD] Response headers:', Object.fromEntries(res.headers.entries()))

      if (!res.ok) {
        const errorText = await res.text()
        console.error('[UPLOAD] Error response:', errorText)
        let errorData
        try {
          errorData = JSON.parse(errorText)
          console.error('[UPLOAD] Parsed error data:', errorData)
          throw new Error(errorData.error || errorData.message || 'Upload failed')
        } catch {
          throw new Error(errorText || 'Upload failed')
        }
      }

      console.log('[UPLOAD] Step 5: Parsing response...')
      const result = await res.json()
      console.log('[UPLOAD] Upload successful! Result:', result)

      toast.success('Document uploaded!')
      setFile(null)
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      
      console.log('[UPLOAD] Upload process completed successfully')
    } catch (e: any) {
      console.error('[UPLOAD] Upload failed with error:', e)
      console.error('[UPLOAD] Error stack:', e.stack)
      console.error('[UPLOAD] Error name:', e.name)
      console.error('[UPLOAD] Error message:', e.message)
      toast.error('Upload failed. Check console for details.')
    }
  }

  const pageTitles: Record<string, string> = {
    'home': 'Dashboard',
    'my-docs': 'My Documents',
    'upload': 'Upload Page',
    'document-pure': 'Document Viewer',
    'qsui': 'Quiz / Study Flow',
    'wallet': 'Wallet',
    'wallet-transactions': 'Wallet Transactions',
    'settings': 'Settings',
  }

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="text-xl font-semibold mb-2">Loading...</div>
          <div className="text-sm text-muted">Checking authentication...</div>
        </div>
      </div>
    )
  }

  // Don't render dashboard if not authenticated
  if (!isAuthenticated) {
    return null
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar activeView={activeView} onViewChange={setActiveView} />
      <div className="flex-1 flex flex-col">
        <Header
          title={activeView === 'auth' ? 'AUTH' : pageTitles[activeView] || 'Dashboard'}
          onAuthToggle={() => {
            setActiveView('auth')
            setShowAuth(true)
          }}
          isAuthenticated={isAuthenticated}
          userEmail={userEmail}
        />
        <main className="p-7 flex-1 max-w-[1100px] mx-auto w-full">
          {/* Auth Panel */}
          {(activeView === 'auth' || showAuth) && (
            <section className="fade visible flex flex-col items-center justify-center gap-[18px] min-h-[80vh]">
              <div className="card">
                <h3 className="mt-0 mb-4 text-xl font-semibold">Sign in to GrindFlow</h3>
                <p className="mb-2 text-sm">{authStatus}</p>
                <div className="flex gap-2 items-center">
                  <input
                    type="email"
                    placeholder="Email"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    className="input-field flex-1"
                  />
                  <input
                    type="password"
                    placeholder="Password"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    className="input-field flex-1"
                  />
                </div>
                <div className="flex gap-2 mt-2">
                  <button onClick={handleSignIn} className="btn-primary">
                    Sign In
                  </button>
                  <button onClick={handleSignUp} className="btn-secondary">
                    Sign Up
                  </button>
                  <button onClick={handleSignOut} className="btn-ghost">
                    Sign Out
                  </button>
                </div>
                <small className="text-xs text-muted">
                  Use email/password accounts enabled in your Supabase project.
                </small>
              </div>
            </section>
          )}

          {/* Home Section */}
          {activeView === 'home' && (
            <section className="fade visible flex flex-col items-center justify-center gap-[18px] min-h-[80vh]">
              <div className="card">
                <h3 className="mt-0 mb-4 text-xl font-semibold">Upload Document</h3>
                <div className="mb-3">
                  <span className="block text-sm text-muted mb-2">Select PDF file:</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="hidden"
                    id="file-upload-input"
                  />
                  <label
                    htmlFor="file-upload-input"
                    className="block w-full cursor-pointer border border-white/4 rounded-lg bg-transparent p-4 hover:bg-white/5 transition-colors text-center"
                  >
                    <span className="text-accent font-semibold">Click to choose PDF file</span>
                    <span className="block text-xs text-muted mt-1">or drag and drop</span>
                  </label>
                </div>
                {file && (
                  <div className="mb-3 p-2 bg-white/5 rounded-lg border border-white/10">
                    <p className="text-sm text-muted mb-1">Selected file:</p>
                    <p className="text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-muted mt-1">
                      Size: {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                )}
                <div className="flex gap-2.5">
                  <button onClick={handleUpload} className="btn-primary" disabled={!file}>
                    Upload
                  </button>
                  <button
                    onClick={() => toast.info('Mock analyze feature coming soon')}
                    className="btn-secondary"
                  >
                    Mock Analyze
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* My Documents */}
          {activeView === 'my-docs' && (
            <section className="fade visible flex flex-col items-center justify-start gap-[18px] min-h-[80vh]">
              <div className="card">
                <h3 className="mt-0 mb-4 text-xl font-semibold">My Documents</h3>
                <p className="text-muted">Your uploaded notes will appear here.</p>
              </div>
            </section>
          )}

          {/* Upload */}
          {activeView === 'upload' && (
            <section className="fade visible flex flex-col items-center justify-start gap-[18px] min-h-[80vh]">
              <div className="card">
                <h3 className="mt-0 mb-4 text-xl font-semibold">Upload Page</h3>
                <p className="text-muted">Advanced upload and categorization.</p>
              </div>
            </section>
          )}

          {/* Document Viewer */}
          {activeView === 'document-pure' && (
            <section className="fade visible flex flex-col items-center justify-start gap-[18px] min-h-[80vh]">
              <div className="card">
                <h3 className="mt-0 mb-4 text-xl font-semibold">Document Viewer</h3>
                <p className="text-muted">Detailed AI feedback and document insights.</p>
              </div>
            </section>
          )}

          {/* Quiz / Study Flow */}
          {activeView === 'qsui' && (
            <section className="fade visible flex flex-col items-center justify-start gap-[18px] min-h-[80vh]">
              <div className="card">
                <h3 className="mt-0 mb-4 text-xl font-semibold">Quiz / Study Flow</h3>
                <p className="text-muted">Interactive study mode with generated questions.</p>
              </div>
            </section>
          )}

          {/* Wallet */}
          {activeView === 'wallet' && (
            <section className="fade visible flex flex-col items-center justify-start gap-[18px] min-h-[80vh]">
              <div className="card">
                <h3 className="mt-0 mb-4 text-xl font-semibold">Wallet</h3>
                <p className="text-muted">Track your earnings and redeem coins.</p>
              </div>
            </section>
          )}

          {/* Wallet Transactions */}
          {activeView === 'wallet-transactions' && (
            <section className="fade visible flex flex-col items-center justify-start gap-[18px] min-h-[80vh]">
              <div className="card">
                <h3 className="mt-0 mb-4 text-xl font-semibold">Wallet Transactions</h3>
                <ul className="list-none p-0 m-0 space-y-2">
                  <li>+0.10 • Quiz Used</li>
                  <li>-2.00 • Withdrawn</li>
                </ul>
              </div>
            </section>
          )}

          {/* Settings */}
          {activeView === 'settings' && (
            <section className="fade visible flex flex-col items-center justify-start gap-[18px] min-h-[80vh]">
              <div className="card">
                <h3 className="mt-0 mb-4 text-xl font-semibold">Settings</h3>
                <p className="text-muted">Profile and preferences coming soon.</p>
              </div>
            </section>
          )}
        </main>
        <Footer />
      </div>
    </div>
  )
}

