'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import SoftCard from '@/components/ui/soft-card'
import PrettyFlow from '@/components/ui/pretty-flow'
import { motion } from 'framer-motion'
import ModalPortal from '@/components/ui/modal-portal'
import UpdateUsernameSection from '@/components/settings/UpdateUsernameSection'
import ManageDocumentsSection from '@/components/settings/ManageDocumentsSection'

function DashboardContent() {
  const searchParams = useSearchParams()
  const [activeView, setActiveView] = useState('home')
  const [showAuth, setShowAuth] = useState(false)
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [documents, setDocuments] = useState<Array<{ id: string; file_name: string; publicUrl: string | null; storage_path: string; size_bytes: number | null; created_at?: string }>>([])
  const [docsLoading, setDocsLoading] = useState(false)
  const [deletingIds, setDeletingIds] = useState<Record<string, boolean>>({})
  const [uploading, setUploading] = useState(false)
  const [analysisQuery, setAnalysisQuery] = useState('')
  const [analyzingIds, setAnalyzingIds] = useState<Record<string, boolean>>({})
  const [scores, setScores] = useState<Record<string, { score: number; verdict: string; rationale?: string; focus_topics?: string[]; repetitive_topics?: string[]; suggested_plan?: string[] }>>({})
  const [detailsDocId, setDetailsDocId] = useState<string>('')
  const [authStatus, setAuthStatus] = useState('Not signed in')
  const [userEmail, setUserEmail] = useState<string>('')
  const [userId, setUserId] = useState<string>('')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  // Quiz states
  const [quizSelectedDocId, setQuizSelectedDocId] = useState<string>('')
  const [quizSelectOpen, setQuizSelectOpen] = useState(false)
  const [quizKeywords, setQuizKeywords] = useState('')
  const [quizLoading, setQuizLoading] = useState(false)
  const [quizQuestions, setQuizQuestions] = useState<Array<{ question: string; options: string[]; correctIndex: number }>>([])
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({})
  const [quizScore, setQuizScore] = useState<number | null>(null)
  const [showQuizResults, setShowQuizResults] = useState(false)
  // Studyflow states
  const [studyflowSelectedDocId, setStudyflowSelectedDocId] = useState<string>('')
  const [studyflowSelectOpen, setStudyflowSelectOpen] = useState(false)
  const [studyflowLoading, setStudyflowLoading] = useState(false)
  const [studyflowAnalysisLoading, setStudyflowAnalysisLoading] = useState(false)
  const [studyflowAnalysis, setStudyflowAnalysis] = useState<string>('')
  const [studyflowDiagram, setStudyflowDiagram] = useState<string>('')
  const [showStudyflowAnalysis, setShowStudyflowAnalysis] = useState(false)
  const [showUploadToPublicPopup, setShowUploadToPublicPopup] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  // Read view from URL query parameter on mount and when it changes
  useEffect(() => {
    const viewParam = searchParams.get('view')
    if (viewParam && ['home', 'my-docs', 'quiz', 'studyflow', 'settings'].includes(viewParam)) {
      setActiveView(viewParam)
    }
  }, [searchParams])

  useEffect(() => {
    let mounted = true

    // Quick synchronous check first
    supabase.auth.getSession().then(async ({ data, error }) => {
      if (!mounted) return
      if (data?.session) {
        // Check if user has username, redirect to onboarding if not
        const token = data.session.access_token
        try {
          const res = await fetch('/api/user/check-username', {
            headers: { Authorization: `Bearer ${token}` },
          })
          if (res.ok) {
            const { hasUsername, username: profileUsername } = await res.json()
            if (!hasUsername) {
              router.replace('/onboarding')
              return
            }
            // Use the profile username or fallback to email username
            const email = data.session.user.email || ''
            const displayUsername = profileUsername || (email ? email.split('@')[0] : 'User')
        setIsAuthenticated(true)
            setUserEmail(displayUsername)
            setUserId(data.session.user.id)
            setAuthStatus(`Signed in as ${displayUsername}`)
          } else {
            // If check fails, redirect to onboarding to be safe
            router.replace('/onboarding')
          }
        } catch (e) {
          console.error('[DASHBOARD] Check username error:', e)
          router.replace('/onboarding')
        }
      } else if (error?.message?.includes('refresh') || error?.message?.includes('Refresh Token')) {
        supabase.auth.signOut().then(() => router.replace('/'))
      } else {
        // No session, redirect to home
        router.replace('/')
      }
    })

    // Set up auth state listener for real-time updates
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (!mounted) return
        
      if (event === 'SIGNED_OUT' || !session) {
        setIsAuthenticated(false)
        setUserEmail('')
        setAuthStatus('Not signed in')
        docsLoadedRef.current = false // Reset so docs reload on next login
        router.replace('/')
      } else if (session) {
        // Check if user has username
        const token = session.access_token
        try {
          const res = await fetch('/api/user/check-username', {
            headers: { Authorization: `Bearer ${token}` },
          })
          if (res.ok) {
            const { hasUsername, username: profileUsername } = await res.json()
            if (!hasUsername) {
              router.replace('/onboarding')
              return
            }
            // Use the profile username or fallback to email username
            const email = session.user.email || ''
            const displayUsername = profileUsername || (email ? email.split('@')[0] : 'User')
          setIsAuthenticated(true)
            setUserEmail(displayUsername)
            setUserId(session.user.id)
            setAuthStatus(`Signed in as ${displayUsername}`)
            docsLoadedRef.current = false // Reset so docs load for new session
        } else {
            router.replace('/onboarding')
        }
        } catch (e) {
          console.error('[DASHBOARD] Check username error:', e)
          router.replace('/onboarding')
        }
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [router])

  // Email/password sign-in removed in favor of Google OAuth

  const handleGoogleSignIn = async () => {
    try {
      const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/dashboard` : undefined
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
      })
      if (error) throw error
      // For OAuth, Supabase will redirect; as a guard, show a toast
      toast.info('Redirecting to Google…')
    } catch (e: any) {
      toast.error(`Google sign-in failed: ${e.message || e}`)
    }
  }

  // Email/password sign-up removed

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setUserEmail('')
    setAuthStatus('Not signed in')
    toast.success('Signed out')
    router.replace('/')
  }

  const handleUpload = async () => {
    if (!file) {
      toast.error('Choose a PDF first.')
      return
    }

    try {
      setUploading(true)
      const form = new FormData()
      form.append('file', file)

      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const headers: HeadersInit = {}
      if (token) headers['Authorization'] = `Bearer ${token}`

      const res = await fetch('/api/upload', {
        method: 'POST',
        headers,
        body: form,
        credentials: 'include',
      })

      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(errorText || 'Upload failed')
      }

      const result = await res.json()
      toast.success('Document uploaded!')
      if (result?.db?.warning) {
        toast.info(`Uploaded, but metadata was not saved: ${result?.db?.message || 'check Supabase table & policies'}`)
      }
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      // refresh documents list after successful upload (background)
      loadDocuments()
    } catch (e: any) {
      toast.error('Upload failed. Check console for details.')
      // eslint-disable-next-line no-console
      console.error(e)
    } finally {
      setUploading(false)
    }
  }

  const pageTitles: Record<string, string> = {
    'home': 'Dashboard',
    'my-docs': 'My Documents',
    'upload': 'Upload Page',
    'document-pure': 'Document Viewer',
    'quiz': 'Quiz',
    'studyflow': 'Studyflow',
    'wallet': 'Wallet',
    'wallet-transactions': 'Wallet Transactions',
    'settings': 'Settings',
  }

  async function loadDocuments() {
    try {
      setDocsLoading(true)
      // Clear current list immediately to avoid showing stale rows during reload
      setDocuments([])
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) {
        // Avoid getting stuck on Loading… if token is missing
        setDocsLoading(false)
        return
      }
      const res = await fetch(`/api/documents?t=${Date.now()}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' as RequestCache })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text)
      }
      const payload = await res.json()
      setDocuments(payload.rows || [])
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[DOCS] fetch error', err)
      toast.error('Could not load documents. Check server logs and Supabase setup.')
    } finally {
      setDocsLoading(false)
    }
  }

  async function deleteDocument(id: string) {
    try {
      setDeletingIds((s) => ({ ...s, [id]: true }))
      const prevDocs = documents
      setDocuments((d) => d.filter((x) => x.id !== id))
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) return
      const res = await fetch(`/api/documents/${id}?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        let msg = 'Failed'
        try { const j = await res.json(); msg = j?.error || msg } catch {}
        throw new Error(msg)
      }
      const j = await res.json()
      toast.success(j?.removedFromStorage ? 'Document removed from library and storage' : 'Document removed (file already gone)')
      loadDocuments()
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[DOCS] delete error', err)
      toast.error(`Could not delete this document: ${(err as any)?.message || ''}`)
      await loadDocuments()
    } finally {
      setDeletingIds((s) => { const n = { ...s }; delete n[id]; return n })
    }
  }

  async function analyzeDocument(id: string) {
    try {
      setAnalyzingIds((s) => ({ ...s, [id]: true }))
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) return
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id, context: analysisQuery }),
      })
      if (!res.ok) {
        let msg = 'Failed'
        try { const j = await res.json(); msg = j?.error || msg } catch {}
        throw new Error(msg)
      }
      const data = await res.json()
      const r = data?.result
      if (r?.score != null) {
        setScores((s) => ({ ...s, [id]: { score: r.score, verdict: r.verdict || '', rationale: r.rationale, focus_topics: r.focus_topics, repetitive_topics: r.repetitive_topics, suggested_plan: r.suggested_plan } }))
        toast.success(`Score: ${r.score}`)
        if (r.score >= 80) {
          setShowUploadToPublicPopup(id)
        }
      } else {
        toast.info('Analysis complete, but no score returned')
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[ANALYZE] error', e)
      toast.error(`Analyze failed: ${(e as any)?.message || ''}`)
    } finally {
      setAnalyzingIds((s) => { const n = { ...s }; delete n[id]; return n })
    }
  }

  const docsLoadedRef = useRef(false)
  useEffect(() => {
    // Load documents when switching to views that need them (non-blocking)
    if ((activeView === 'my-docs' || activeView === 'quiz' || activeView === 'studyflow') && isAuthenticated) {
      if (!docsLoadedRef.current || activeView === 'my-docs') {
        docsLoadedRef.current = true
      loadDocuments()
      }
    }
  }, [activeView, isAuthenticated])

  // Render immediately, auth will update async

  return (
    <div className="flex min-h-screen">
      <Sidebar 
        activeView={activeView} 
        onViewChange={(view) => {
          setActiveView(view)
          // Update URL to preserve view when navigating
          const params = new URLSearchParams(window.location.search)
          if (view === 'home') {
            params.delete('view')
          } else {
            params.set('view', view)
          }
          const newUrl = params.toString() ? `/dashboard?${params.toString()}` : '/dashboard'
          window.history.pushState({}, '', newUrl)
        }} 
      />
      <div className="flex-1 flex flex-col">
        <Header
          title={activeView === 'auth' ? 'AUTH' : pageTitles[activeView] || 'Dashboard'}
          onAuthToggle={() => {
            setActiveView('auth')
            setShowAuth(true)
          }}
          isAuthenticated={isAuthenticated}
          userEmail={userEmail}
          userId={userId}
        />
        <main className="p-7 flex-1 max-w-[1100px] mx-auto w-full">
          {(activeView === 'auth' || showAuth) && (
            <section className="fade visible flex flex-col items-center justify-center gap-[18px] min-h-[80vh]">
              <div className="card">
                <h3 className="mt-0 mb-4 text-xl font-semibold">Continue with Google</h3>
                <p className="mb-2 text-sm">{authStatus}</p>
                <div className="mt-1">
                  <button onClick={handleGoogleSignIn} className="btn-secondary inline-flex items-center gap-2">
                    <svg width="16" height="16" viewBox="0 0 533.5 544.3" aria-hidden="true"><path fill="#4285F4" d="M533.5 278.4c0-18.6-1.7-37-5.2-54.8H272.1v103.8h147c-6.3 34.1-25.4 63-54.2 82.3v68h87.5c51.2-47.2 81.1-116.8 81.1-199.3z"/><path fill="#34A853" d="M272.1 544.3c73.4 0 135.3-24.3 180.4-66.1l-87.5-68c-24.3 16.3-55.3 26.1-92.9 26.1-71.3 0-131.8-48-153.5-112.4H28.7v70.7C73.3 486.4 166.5 544.3 272.1 544.3z"/><path fill="#FBBC05" d="M118.6 323.9c-10.8-31.9-10.8-66.4 0-98.3V154.9H28.7c-38.3 76.3-38.3 167.8 0 244.1l89.9-75.1z"/><path fill="#EA4335" d="M272.1 106.6c39.8-.6 78.1 14.3 107.1 41.9l79.8-79.8C404.9 25.2 340.6-.2 272.1 0 166.5 0 73.3 57.9 28.7 154.9l89.9 70.7c21.7-64.5 82.2-112.4 153.5-119z"/></svg>
                    Continue with Google
                  </button>
                </div>
                <div className="mt-3">
                  <button onClick={handleSignOut} className="btn-ghost">Sign Out</button>
                </div>
              </div>
            </section>
          )}

          {activeView === 'home' && (
            <section className="fade visible flex flex-col items-center justify-center gap-[18px] min-h-[80vh]">
              <SoftCard>
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
                    className={`block w-full cursor-pointer border border-dashed rounded-xl p-6 transition-colors text-center select-none ${isDragging ? 'bg-accent/10 border-accent/40' : 'bg-white/3 border-white/6 hover:bg-white/5'}`}
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files?.[0]) setFile(e.dataTransfer.files[0]) }}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <span className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-white/5 text-accent">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="17 8 12 3 7 8" />
                          <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                      </span>
                      <span className="text-accent font-semibold">Click to choose PDF</span>
                      <span className="block text-xs text-muted">or drag and drop • PDF up to 20MB</span>
                      {file && (
                        <span className="mt-1 inline-flex items-center gap-2 text-[13px] text-eaf0ff bg-white/5 border border-white/10 rounded-full px-3 py-1">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <path d="M14 2v6h6" />
                          </svg>
                          {file.name}
                          <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); setFile(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
                            className="ml-1 rounded-full bg-white/10 hover:bg-white/20 px-1"
                            aria-label="Remove selected file"
                          >
                            ×
                          </button>
                        </span>
                      )}
                    </div>
                  </label>
                </div>
                {uploading && (
                  <div className="mb-3">
                    <div className="h-1.5 bg-white/5 rounded overflow-hidden">
                      <div className="h-full bg-accent" style={{ width: '65%' }} />
                    </div>
                    <div className="text-xs text-muted mt-2">Uploading… Please keep this tab open.</div>
                  </div>
                )}
                <div className="flex gap-2.5">
                  <button onClick={handleUpload} className="btn-primary" disabled={!file || uploading}>{uploading ? 'Uploading…' : 'Upload'}</button>
                  {/* <button onClick={() => toast.info('Mock analyze feature coming soon')} className="btn-secondary">Mock Analyze</button> */}
                </div>
              </SoftCard>
            </section>
          )}

          {activeView === 'my-docs' && (
            <section className="fade visible flex flex-col items-center justify-start gap-[18px] min-h-[80vh]">
              <SoftCard>
                <h3 className="mt-0 mb-4 text-xl font-semibold">My Documents</h3>
                {docsLoading && (
                  <div className="space-y-2">
                    {[0,1,2].map((i) => (
                      <div key={i} className="h-[58px] rounded-lg overflow-hidden bg-white/5 border border-white/6">
                        <div className="h-full w-full animate-pulse bg-gradient-to-r from-white/5 via-white/10 to-white/5 bg-[length:200%_100%]" />
                      </div>
                    ))}
                  </div>
                )}
                <div className="mb-3">
                  <label className="block text-sm text-muted mb-1">Analysis context (what are you studying?)</label>
                  <input value={analysisQuery} onChange={(e) => setAnalysisQuery(e.target.value)} placeholder="e.g., Midsem exam for MAIT University, Chapters 5-7"
                    className="input-field w-full" />
                </div>
                {!docsLoading && documents.length === 0 && (
                  <p className="text-muted">No documents yet. Upload a PDF from the Dashboard.</p>
                )}
                {!docsLoading && documents.length > 0 && (
                  <ul className="list-none p-0 m-0 space-y-3">
                    {documents.map((doc, i) => (
                      <motion.li
                        key={doc.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="flex items-center justify-between border border-white/6 rounded-lg px-3 py-2 bg-white/5 transition-transform duration-200 hover:translate-y-[-1px]"
                      >
                        <div className="min-w-0">
                          <div className="font-medium truncate max-w-[520px]">{doc.file_name}</div>
                          <div className="text-xs text-muted">{(doc.size_bytes ? (doc.size_bytes / 1024 / 1024).toFixed(2) : '—')} MB • {doc.created_at ? new Date(doc.created_at).toLocaleString() : ''}</div>
                          {scores[doc.id] && (
                            <div className="mt-1 text-sm flex items-center gap-2">
                              <span>Score: <span className="font-semibold">{scores[doc.id].score}</span> — {scores[doc.id].verdict}</span>
                              <button className="btn-ghost" onClick={() => setDetailsDocId(doc.id)}>View details</button>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {doc.publicUrl && (
                            <a className="btn-secondary" href={doc.publicUrl} target="_blank" rel="noreferrer">Open</a>
                          )}
                          <button className="btn-primary inline-flex items-center gap-2" onClick={() => analyzeDocument(doc.id)} disabled={!!analyzingIds[doc.id]}>
                            {analyzingIds[doc.id] ? (
                              <>
                                <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                                </svg>
                                Analyzing…
                              </>
                            ) : 'Analyze'}
                          </button>
                          <button className="btn-ghost" onClick={() => deleteDocument(doc.id)} disabled={!!deletingIds[doc.id]}>
                            {deletingIds[doc.id] ? 'Deleting…' : 'Delete'}
                          </button>
                        </div>
                      </motion.li>
                    ))}
                  </ul>
                )}
                {detailsDocId && scores[detailsDocId] && (
                  <ModalPortal>
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" onClick={() => setDetailsDocId('')}>
                      <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="card w-full max-w-[900px] mx-auto max-h-[85vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
                      <div className="sticky top-0 bg-card pb-2 mb-2">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="mt-0 mb-1 text-xl font-semibold">Detailed analysis</h3>
                            <div className="text-xs text-muted">Context: {analysisQuery || 'General'}</div>
                          </div>
                          <button className="btn-ghost" onClick={() => setDetailsDocId('')}>Close</button>
                        </div>
                      </div>

                      <div className="overflow-auto pr-1" style={{ maxHeight: 'calc(85vh - 56px)' }}>
                        <section className="mb-3">
                          <div className="font-semibold mb-1">Summary</div>
                          <p className="m-0 text-sm leading-relaxed">{scores[detailsDocId].rationale || '—'}</p>
                        </section>

                        <section className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                          <div className="bg-white/3 rounded-lg p-3 border border-white/6">
                            <div className="font-semibold mb-1">Focus topics</div>
                            <ul className="list-disc pl-5 m-0 text-sm space-y-1">
                              {(scores[detailsDocId].focus_topics || []).map((t, i) => (<li key={i}>{t}</li>))}
                            </ul>
                          </div>
                          <div className="bg-white/3 rounded-lg p-3 border border-white/6">
                            <div className="font-semibold mb-1">Repetitive / low-value</div>
                            <ul className="list-disc pl-5 m-0 text-sm space-y-1">
                              {(scores[detailsDocId].repetitive_topics || []).map((t, i) => (<li key={i}>{t}</li>))}
                            </ul>
                          </div>
                        </section>

                        <section>
                          <div className="font-semibold mb-1">Suggested plan</div>
                          <ol className="list-decimal pl-5 m-0 text-sm space-y-1">
                            {(scores[detailsDocId].suggested_plan || []).map((t, i) => (<li key={i}>{t}</li>))}
                          </ol>
                        </section>
                      </div>
                      </motion.div>
                    </div>
                  </ModalPortal>
                )}
              </SoftCard>
            </section>
          )}

          {false && activeView === 'upload' && null}

          {false && activeView === 'document-pure' && null}

          {activeView === 'quiz' && (
            <section className="fade visible flex flex-col items-center justify-start gap-[18px] min-h-[80vh] w-full">
              <SoftCard className="w-full">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <h3 className="mt-0 mb-0 text-xl font-semibold">Quiz</h3>
                  {quizSelectedDocId && (
                    <span className="text-xs text-muted">Source: {documents.find(d => d.id === quizSelectedDocId)?.file_name || quizSelectedDocId}</span>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                  <div className="md:col-span-1">
                    <button
                      className="btn-secondary w-full flex items-center justify-center gap-2"
                      onClick={() => setQuizSelectOpen(true)}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg>
                      {quizSelectedDocId ? 'Change PDF' : 'Select PDF'}
                    </button>
                    {quizSelectedDocId && (
                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        <div className="inline-flex items-center gap-2 text-[13px] text-eaf0ff bg-white/5 border border-white/10 rounded-full px-3 py-1">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg>
                        <span className="truncate max-w-[220px]">{documents.find(d => d.id === quizSelectedDocId)?.file_name || quizSelectedDocId}</span>
                        <button type="button" onClick={() => setQuizSelectedDocId('')} className="ml-1 rounded-full bg-white/10 hover:bg-white/20 px-1" aria-label="Clear selected document">×</button>
                        </div>
                        {documents.find(d => d.id === quizSelectedDocId)?.publicUrl && (
                          <a
                            href={documents.find(d => d.id === quizSelectedDocId)?.publicUrl || '#'}
                            target="_blank"
                            rel="noreferrer"
                            className="btn-secondary text-xs px-2 py-1 inline-flex items-center gap-1"
                            title="View PDF"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                            View PDF
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="md:col-span-2 flex gap-2">
                    <div className="relative flex-1">
                      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                      </span>
                      <input
                        className="input-field pl-8 w-full"
                        placeholder="Enter keywords (e.g., derivatives, chain rule)"
                        value={quizKeywords}
                        onChange={(e) => setQuizKeywords(e.target.value)}
                      />
                    </div>
                    <button
                      className="btn-primary inline-flex items-center gap-2"
                      disabled={!quizSelectedDocId || quizLoading}
                      onClick={async () => {
                        try {
                          setQuizLoading(true)
                          setQuizScore(null)
                          setQuizQuestions([])
                          setQuizAnswers({})
                          setShowQuizResults(false)
                          const { data: sessionData } = await supabase.auth.getSession()
                          const token = sessionData.session?.access_token
                          if (!token) throw new Error('Not authenticated')
                          const controller = new AbortController()
                          const QUIZ_TIMEOUT_MS = 20000
                          const t = setTimeout(() => controller.abort(), QUIZ_TIMEOUT_MS)
                          const res = await fetch('/api/quiz', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                            body: JSON.stringify({ id: quizSelectedDocId, keyword: quizKeywords }),
                            signal: controller.signal,
                          })
                          clearTimeout(t)
                          if (!res.ok) {
                            const t = await res.text()
                            throw new Error(t || 'Failed to generate quiz')
                          }
                          const j = await res.json()
                          const qs = (j?.questions || []).slice(0, 10)
                          setQuizQuestions(qs)
                          if (qs.length === 0) toast.info('No questions generated. Try different keywords.')
                        } catch (err: any) {
                          if (err?.name === 'AbortError') {
                            toast.error('Quiz generation timed out. Please try again or add keywords.')
                          } else {
                          toast.error(err?.message || 'Quiz generation failed')
                          }
                        } finally {
                          setQuizLoading(false)
                        }
                      }}
                    >
                      {quizLoading ? (
                        <>
                          <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                          Generating…
                        </>
                      ) : 'Generate Quiz'}
                    </button>
                  </div>
                </div>

                {quizLoading && quizQuestions.length === 0 && (
                  <div className="space-y-3">
                    {[0,1,2,3].map((i) => (
                      <div key={i} className="rounded-lg p-3 border border-white/6 bg-white/5">
                        <div className="h-4 w-2/3 mb-2 animate-pulse bg-white/10 rounded" />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {[0,1,2,3].map((j) => (<div key={j} className="h-8 rounded bg-white/10 animate-pulse" />))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {quizQuestions.length === 0 && !quizLoading && (
                  <div className="rounded-lg border border-dashed border-white/8 bg-white/3 p-8 text-center text-sm text-muted">Start by selecting a PDF and entering a few keywords. We’ll generate up to 10 questions for quick practice.</div>
                )}

                {quizQuestions.length > 0 && (
                  <div className="space-y-4 overflow-auto pr-1" style={{ maxHeight: 'calc(85vh - 260px)' }}>
                    <div className="sticky top-0 z-10 -mt-1 mb-2 bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/70 rounded-lg border border-white/6 p-3 flex items-center justify-between">
                      <div className="text-sm text-muted">{quizQuestions.length} questions • select the best answer</div>
                      <div className="h-1 w-32 rounded bg-white/10 overflow-hidden">
                        <div className="h-full bg-accent" style={{ width: `${Math.round((Object.keys(quizAnswers).length/quizQuestions.length)*100)}%` }} />
                      </div>
                    </div>

                    {quizQuestions.map((q, idx) => (
                      <SoftCard key={idx} className="!p-4">
                        <div className="font-medium mb-3 leading-relaxed">{idx + 1}. {q.question}</div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {q.options.map((opt, oi) => {
                            const checked = quizAnswers[idx] === oi
                            const isCorrect = q.correctIndex === oi
                            const show = showQuizResults
                            return (
                              <label
                                key={oi}
                                className={`cursor-pointer rounded-lg border p-3 flex items-center gap-2 transition-colors ${
                                  show
                                    ? (isCorrect
                                        ? 'border-emerald-400/40 bg-emerald-500/10'
                                        : (checked ? 'border-red-400/40 bg-red-500/10' : 'border-white/6 bg-white/3'))
                                    : (checked ? 'border-accent/40 bg-accent/10' : 'border-white/6 bg-white/3 hover:bg-white/5')
                                }`}
                              >
                                <input
                                  type="radio"
                                  name={`q-${idx}`}
                                  className="sr-only"
                                  checked={checked}
                                  onChange={() => setQuizAnswers((s) => ({ ...s, [idx]: oi }))}
                                />
                                <span className={`inline-flex h-4 w-4 rounded-full border ${
                                  show ? (isCorrect ? 'bg-emerald-400 border-emerald-400' : (checked ? 'bg-red-400 border-red-400' : 'border-white/20')) : (checked ? 'bg-accent border-accent' : 'border-white/20')
                                }`} />
                                <span className="text-sm">{opt}</span>
                              </label>
                            )
                          })}
                        </div>
                      </SoftCard>
                    ))}

                    <div className="sticky bottom-0 z-10 bg-gradient-to-t from-card to-transparent pt-4">
                      <div className="flex items-center gap-3">
                        <button
                          className="btn-primary"
                          onClick={() => {
                            let score = 0
                            quizQuestions.forEach((q, i) => { if (quizAnswers[i] === q.correctIndex) score += 1 })
                            setQuizScore(score)
                            setShowQuizResults(true)
                            toast.success(`You scored ${score}/${quizQuestions.length}`)
                          }}
                        >
                          Check Score
                        </button>
                        <button
                          className="btn-ghost"
                          onClick={() => {
                            setQuizQuestions([])
                            setQuizAnswers({})
                          setQuizScore(null)
                          setShowQuizResults(false)
                            setQuizKeywords('')
                            setQuizSelectedDocId('')
                          }}
                        >
                          Exit
                        </button>
                        {quizScore != null && (
                          <div className="text-sm">Score: <span className="font-semibold">{quizScore}/{quizQuestions.length}</span></div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </SoftCard>

              {quizSelectOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" onClick={() => setQuizSelectOpen(false)}>
                  <div className="card max-w-[860px] w-full max-h-[85vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
                    <div className="sticky top-0 bg-card pb-2 mb-2">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="mt-0 mb-1 text-xl font-semibold">Select a PDF</h3>
                          <div className="text-xs text-muted">Choose from your uploaded documents</div>
                        </div>
                        <button className="btn-ghost" onClick={() => setQuizSelectOpen(false)}>Close</button>
                      </div>
                    </div>

                    <div className="overflow-auto pr-1" style={{ maxHeight: 'calc(85vh - 56px)' }}>
                      {docsLoading && <p className="text-muted px-1">Loading…</p>}
                      {!docsLoading && documents.length === 0 && (
                        <p className="text-muted px-1">No documents yet. Upload a PDF from Home.</p>
                      )}
                      <ul className="list-none p-0 m-0 space-y-2">
                        {documents.map((doc) => (
                          <li key={doc.id} className="flex items-center justify-between border border-white/6 rounded-lg px-3 py-2 bg-white/5">
                            <div className="min-w-0">
                              <div className="font-medium truncate max-w-[520px]">{doc.file_name}</div>
                              <div className="text-xs text-muted">{(doc.size_bytes ? (doc.size_bytes / 1024 / 1024).toFixed(2) : '—')} MB • {doc.created_at ? new Date(doc.created_at).toLocaleString() : ''}</div>
                            </div>
                            <button
                              className="btn-primary"
                              onClick={() => {
                                setQuizSelectedDocId(doc.id)
                                setQuizSelectOpen(false)
                              }}
                            >
                              Select
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}

          {activeView === 'studyflow' && (
            <section className="fade visible flex flex-col items-center justify-start gap-[18px] min-h-[80vh] w-full">
              <SoftCard className="w-full flex flex-col" style={{ height: 'calc(100vh - 180px)' } as any}>
                <div className="flex-shrink-0 mb-4">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <h3 className="mt-0 mb-0 text-xl font-semibold">Studyflow</h3>
                    {studyflowSelectedDocId && (
                      <span className="text-xs text-muted">Source: {documents.find(d => d.id === studyflowSelectedDocId)?.file_name || studyflowSelectedDocId}</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-3 items-center">
                    <button
                      className="btn-secondary inline-flex items-center gap-2"
                      onClick={() => setStudyflowSelectOpen(true)}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg>
                      {studyflowSelectedDocId ? 'Change PDF' : 'Select PDF'}
                    </button>
                    {studyflowSelectedDocId && (
                      <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-2 text-[13px] text-eaf0ff bg-white/5 border border-white/10 rounded-full px-3 py-1">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg>
                        <span className="truncate max-w-[260px]">{documents.find(d => d.id === studyflowSelectedDocId)?.file_name || studyflowSelectedDocId}</span>
                        <button type="button" onClick={() => setStudyflowSelectedDocId('')} className="ml-1 rounded-full bg-white/10 hover:bg-white/20 px-1" aria-label="Clear selected document">×</button>
                      </span>
                        {documents.find(d => d.id === studyflowSelectedDocId)?.publicUrl && (
                          <a
                            href={documents.find(d => d.id === studyflowSelectedDocId)?.publicUrl || '#'}
                            target="_blank"
                            rel="noreferrer"
                            className="btn-secondary text-xs px-2 py-1 inline-flex items-center gap-1"
                            title="View PDF"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                            View PDF
                          </a>
                        )}
                      </div>
                    )}
                    {studyflowSelectedDocId && (
                      <button
                        className="btn-primary inline-flex items-center gap-2"
                        disabled={studyflowLoading}
                        onClick={async () => {
                            try {
                              setStudyflowLoading(true)
                              setStudyflowDiagram('')
                              setStudyflowAnalysis('')
                              setShowStudyflowAnalysis(false)
                              const { data: sessionData } = await supabase.auth.getSession()
                              const token = sessionData.session?.access_token
                              if (!token) throw new Error('Not authenticated')
                              const res = await fetch('/api/studyflow', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                                body: JSON.stringify({ id: studyflowSelectedDocId, type: 'diagram' }),
                              })
                              if (!res.ok) {
                                const t = await res.text()
                                throw new Error(t || 'Failed to generate flow diagram')
                              }
                              const j = await res.json()
                              setStudyflowDiagram(j?.flowDiagram || '')
                              if (!j?.flowDiagram) {
                                toast.info('Flow diagram generated, but no content returned')
                              } else {
                                toast.success('Flow diagram generated successfully')
                              }
                            } catch (err: any) {
                              toast.error(err?.message || 'Flow diagram generation failed')
                            } finally {
                              setStudyflowLoading(false)
                            }
                          }}
                        >
                          {studyflowLoading ? (
                            <>
                              <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                              Generating…
                            </>
                          ) : 'Generate Flow'}
                        </button>
                    )}
                  </div>
                  {studyflowSelectedDocId && (
                    <div className="mt-3 text-sm text-muted">Selected document: {documents.find(d => d.id === studyflowSelectedDocId)?.file_name || studyflowSelectedDocId}</div>
                  )}
                </div>

                {(!studyflowAnalysis && !studyflowDiagram) && (
                  <div className="rounded-lg border border-dashed border-white/8 bg-white/3 p-8 text-center text-sm text-muted">Select a PDF and generate a flow to visualize the study path. You can optionally add a detailed analysis after that.</div>
                )}

                {(studyflowAnalysis || studyflowDiagram) && (
                  <div className="flex-1 overflow-auto pr-1 space-y-6" style={{ maxHeight: 'calc(100vh - 280px)' }}>
                    {studyflowDiagram && (
                      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                        <h4 className="mb-3 text-lg font-semibold">Flow Diagram</h4>
                        <SoftCard className="!p-0">
                          <PrettyFlow content={studyflowDiagram} />
                        </SoftCard>
                        {studyflowDiagram && !studyflowAnalysis && (
                          <div className="mt-3">
                            <button
                              className="btn-secondary inline-flex items-center gap-2"
                              disabled={studyflowAnalysisLoading}
                              onClick={async () => {
                                try {
                                  setStudyflowAnalysisLoading(true)
                                  const { data: sessionData } = await supabase.auth.getSession()
                                  const token = sessionData.session?.access_token
                                  if (!token) throw new Error('Not authenticated')
                                  const res = await fetch('/api/studyflow', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                                    body: JSON.stringify({ id: studyflowSelectedDocId, type: 'analysis' }),
                                  })
                                  if (!res.ok) {
                                    const t = await res.text()
                                    throw new Error(t || 'Failed to generate flow analysis')
                                  }
                                  const j = await res.json()
                                  setStudyflowAnalysis(j?.flowAnalysis || '')
                                  setShowStudyflowAnalysis(true)
                                  if (!j?.flowAnalysis) {
                                    toast.info('Flow analysis generated, but no content returned')
                                  } else {
                                    toast.success('Flow analysis generated successfully')
                                  }
                                } catch (err: any) {
                                  toast.error(err?.message || 'Flow analysis generation failed')
                                } finally {
                                  setStudyflowAnalysisLoading(false)
                                }
                              }}
                            >
                              {studyflowAnalysisLoading ? (
                                <>
                                  <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                                  Generating Analysis…
                                </>
                              ) : 'Generate Detailed Analysis'}
                            </button>
                          </div>
                        )}
                      </motion.div>
                    )}

                    {studyflowAnalysis && (
                      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                        <h4 className="mb-3 text-lg font-semibold">Flow State Analysis</h4>
                        <SoftCard className="!p-4">
                          <div className="flex items-center justify-end mb-2">
                            <button className="btn-ghost text-xs" onClick={() => { navigator.clipboard.writeText(studyflowAnalysis) ; toast.success('Copied analysis') }}>Copy</button>
                          </div>
                          <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans">{studyflowAnalysis}</pre>
                        </SoftCard>
                      </motion.div>
                    )}
                  </div>
                )}
              </SoftCard>

              {studyflowSelectOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" onClick={() => setStudyflowSelectOpen(false)}>
                  <div className="card max-w-[860px] w-full max-h-[85vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
                    <div className="sticky top-0 bg-card pb-2 mb-2">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="mt-0 mb-1 text-xl font-semibold">Select a PDF</h3>
                          <div className="text-xs text-muted">Choose from your uploaded documents</div>
                        </div>
                        <button className="btn-ghost" onClick={() => setStudyflowSelectOpen(false)}>Close</button>
                      </div>
                    </div>

                    <div className="overflow-auto pr-1" style={{ maxHeight: 'calc(85vh - 56px)' }}>
                      {docsLoading && <p className="text-muted px-1">Loading…</p>}
                      {!docsLoading && documents.length === 0 && (
                        <p className="text-muted px-1">No documents yet. Upload a PDF from Home.</p>
                      )}
                      <ul className="list-none p-0 m-0 space-y-2">
                        {documents.map((doc) => (
                          <li key={doc.id} className="flex items-center justify-between border border-white/6 rounded-lg px-3 py-2 bg-white/5">
                            <div className="min-w-0">
                              <div className="font-medium truncate max-w-[520px]">{doc.file_name}</div>
                              <div className="text-xs text-muted">{(doc.size_bytes ? (doc.size_bytes / 1024 / 1024).toFixed(2) : '—')} MB • {doc.created_at ? new Date(doc.created_at).toLocaleString() : ''}</div>
                            </div>
                            <button
                              className="btn-primary"
                              onClick={() => {
                                setStudyflowSelectedDocId(doc.id)
                                setStudyflowSelectOpen(false)
                              }}
                            >
                              Select
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}

          {activeView === 'wallet' && (
            <section className="fade visible flex flex-col items-center justify-start gap-[18px] min-h-[80vh]">
              <div className="card">
                <h3 className="mt-0 mb-4 text-xl font-semibold">Wallet</h3>
                <p className="text-muted">Track your earnings and redeem coins.</p>
              </div>
            </section>
          )}

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

          {activeView === 'settings' && (
            <section className="fade visible overflow-y-auto flex flex-col gap-[18px] max-w-4xl mx-auto w-full" style={{ maxHeight: 'calc(100vh - 140px)' }}>
              {/* Profile Settings */}
              <div className="card">
                <h3 className="mt-0 mb-6 text-xl font-semibold">Profile Settings</h3>
                <UpdateUsernameSection userEmail={userEmail} />
              </div>

              {/* Document Management */}
              <div className="card">
                <h3 className="mt-0 mb-6 text-xl font-semibold">Manage Your Documents</h3>
                <ManageDocumentsSection 
                  documents={documents}
                  docsLoading={docsLoading}
                  deletingIds={deletingIds}
                  onDelete={async (id: string) => {
                    try {
                      setDeletingIds((s) => ({ ...s, [id]: true }))
                      const { data: sessionData } = await supabase.auth.getSession()
                      const token = sessionData.session?.access_token
                      if (!token) throw new Error('Not authenticated')

                      const res = await fetch(`/api/documents?id=${id}`, {
                        method: 'DELETE',
                        headers: { Authorization: `Bearer ${token}` },
                      })
                      if (!res.ok) {
                        const text = await res.text()
                        throw new Error(text || 'Failed to delete document')
                      }
                      toast.success('Document deleted')
                      loadDocuments()
                    } catch (err: any) {
                      toast.error(err?.message || 'Delete failed')
                    } finally {
                      setDeletingIds((s) => { const n = { ...s }; delete n[id]; return n })
                    }
                  }}
                  onView={(doc) => {
                    if (doc.publicUrl) {
                      window.open(doc.publicUrl, '_blank')
                    } else {
                      toast.error('Document URL not available')
                    }
                  }}
                />
              </div>

              {/* Account Actions */}
              <div className="card">
                <h3 className="mt-0 mb-6 text-xl font-semibold">Account Actions</h3>
                <div className="space-y-4">
                  {isAuthenticated ? (
                    <button
                      onClick={handleSignOut}
                      className="btn-secondary w-full text-left flex items-center justify-between"
                    >
                      <span>Sign Out</span>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                        <polyline points="16 17 21 12 16 7" />
                        <line x1="21" y1="12" x2="9" y2="12" />
                      </svg>
                    </button>
                  ) : (
                    <button
                      onClick={handleGoogleSignIn}
                      className="btn-primary w-full flex items-center justify-center gap-2"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                      Continue with Google
                    </button>
                  )}
                </div>
              </div>
            </section>
          )}
        </main>

        {/* Upload to Public Library Popup */}
        {showUploadToPublicPopup && (
          <ModalPortal>
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" onClick={() => setShowUploadToPublicPopup(null)}>
              <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="card w-full max-w-md mx-auto" onClick={(e) => e.stopPropagation()}>
                <div className="mb-4">
                  <h3 className="mt-0 mb-2 text-xl font-semibold">Great Score! 🎉</h3>
                  <p className="text-sm text-muted">
                    Your document scored {scores[showUploadToPublicPopup]?.score || '80+'}. Would you like to share it in the public library?
                  </p>
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setShowUploadToPublicPopup(null)} className="btn-ghost">No, Thanks</button>
                  <button
                    onClick={() => {
                      const docId = showUploadToPublicPopup
                      const analysisData = scores[docId]
                      const keyword = analysisQuery
                      setShowUploadToPublicPopup(null)
                      const params = new URLSearchParams({ doc: docId })
                      if (analysisData?.score != null) params.set('score', analysisData.score.toString())
                      if (keyword) params.set('keyword', keyword)
                      if (analysisData) {
                        params.set('verdict', analysisData.verdict || '')
                        if (analysisData.rationale) params.set('rationale', analysisData.rationale)
                        if (analysisData.focus_topics?.length) params.set('focus_topics', JSON.stringify(analysisData.focus_topics))
                        if (analysisData.repetitive_topics?.length) params.set('repetitive_topics', JSON.stringify(analysisData.repetitive_topics))
                        if (analysisData.suggested_plan?.length) params.set('suggested_plan', JSON.stringify(analysisData.suggested_plan))
                      }
                      router.push(`/public-upload?${params.toString()}`)
                    }}
                    className="btn-primary"
                  >
                    Yes, Share It
                  </button>
                </div>
              </motion.div>
            </div>
          </ModalPortal>
        )}
         {/* Footer removed as requested */}
       </div>
     </div>
   )
 }

export default function Dashboard() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center">
          <div className="text-gray-400">Loading...</div>
        </div>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  )
}


