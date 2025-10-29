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
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  // Quiz states
  const [quizSelectedDocId, setQuizSelectedDocId] = useState<string>('')
  const [quizSelectOpen, setQuizSelectOpen] = useState(false)
  const [quizKeywords, setQuizKeywords] = useState('')
  const [quizLoading, setQuizLoading] = useState(false)
  const [quizQuestions, setQuizQuestions] = useState<Array<{ question: string; options: string[]; correctIndex: number }>>([])
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({})
  const [quizScore, setQuizScore] = useState<number | null>(null)
  // Studyflow states
  const [studyflowSelectedDocId, setStudyflowSelectedDocId] = useState<string>('')
  const [studyflowSelectOpen, setStudyflowSelectOpen] = useState(false)
  const [studyflowLoading, setStudyflowLoading] = useState(false)
  const [studyflowAnalysisLoading, setStudyflowAnalysisLoading] = useState(false)
  const [studyflowAnalysis, setStudyflowAnalysis] = useState<string>('')
  const [studyflowDiagram, setStudyflowDiagram] = useState<string>('')
  const [showStudyflowAnalysis, setShowStudyflowAnalysis] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    let mounted = true
    let redirectTimeout: NodeJS.Timeout | null = null

    // Set up auth state listener FIRST so it catches immediate session changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return
      
      if (event === 'SIGNED_OUT' || !session) {
        setIsAuthenticated(false)
        setUserEmail('')
        setAuthStatus('Not signed in')
        setIsLoading(false)
        if (redirectTimeout) {
          clearTimeout(redirectTimeout)
        }
        router.replace('/login')
      } else if (session) {
        const email = session.user.email || 'User'
        setIsAuthenticated(true)
        setUserEmail(email)
        setAuthStatus(`Signed in as ${email}`)
        setIsLoading(false)
        if (redirectTimeout) {
          clearTimeout(redirectTimeout)
          redirectTimeout = null
        }
      }
    })

    // Initial auth check with retry
    async function checkAuth(retries = 2) {
      try {
        const { data, error } = await supabase.auth.getSession()
        if (!mounted) return
        
        if (error) {
          // eslint-disable-next-line no-console
          console.error('[AUTH] getSession error', error)
        }
        
        const session = data?.session
        if (session) {
          const email = session.user.email || 'User'
          setIsAuthenticated(true)
          setUserEmail(email)
          setAuthStatus(`Signed in as ${email}`)
          setIsLoading(false)
          if (redirectTimeout) {
            clearTimeout(redirectTimeout)
            redirectTimeout = null
          }
        } else {
          // No session - wait a bit for auth state change to fire, then redirect
          if (retries > 0) {
            setTimeout(() => {
              if (mounted) checkAuth(retries - 1)
            }, 300)
          } else {
            // After retries, set up a delayed redirect to give auth state change time
            setIsLoading(false)
            redirectTimeout = setTimeout(() => {
              if (mounted) {
                router.replace('/login')
              }
            }, 1500)
          }
        }
      } catch (err: any) {
        if (!mounted) return
        // eslint-disable-next-line no-console
        console.error('[AUTH] getSession failed', err)
        setIsLoading(false)
        // Don't redirect immediately on error - let auth state change handle it
      }
    }

    checkAuth()

    // Safety: ensure we never stay stuck loading
    const timeout = setTimeout(() => {
      if (mounted) setIsLoading(false)
    }, 3000)

    return () => {
      mounted = false
      subscription.unsubscribe()
      if (timeout) clearTimeout(timeout)
      if (redirectTimeout) clearTimeout(redirectTimeout)
    }
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
      if (!token) return
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

  useEffect(() => {
    if ((activeView === 'my-docs' || activeView === 'quiz' || activeView === 'studyflow') && isAuthenticated) {
      loadDocuments()
    }
  }, [activeView, isAuthenticated])

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
                  <button onClick={handleSignIn} className="btn-primary">Sign In</button>
                  <button onClick={handleSignUp} className="btn-secondary">Sign Up</button>
                  <button onClick={handleSignOut} className="btn-ghost">Sign Out</button>
                </div>
                <small className="text-xs text-muted">Use email/password accounts enabled in your Supabase project.</small>
              </div>
            </section>
          )}

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
                    <p className="text-xs text-muted mt-1">Size: {(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                )}
                <div className="flex gap-2.5">
                  <button onClick={handleUpload} className="btn-primary" disabled={!file || uploading}>{uploading ? 'Uploading…' : 'Upload'}</button>
                  <button onClick={() => toast.info('Mock analyze feature coming soon')} className="btn-secondary">Mock Analyze</button>
                </div>
              </div>
            </section>
          )}

          {activeView === 'my-docs' && (
            <section className="fade visible flex flex-col items-center justify-start gap-[18px] min-h-[80vh]">
              <div className="card">
                <h3 className="mt-0 mb-4 text-xl font-semibold">My Documents</h3>
                {docsLoading && <p className="text-muted">Loading…</p>}
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
                    {documents.map((doc) => (
                      <li key={doc.id} className="flex items-center justify-between border border-white/6 rounded-lg px-3 py-2 bg-white/5">
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
                          <button className="btn-primary" onClick={() => analyzeDocument(doc.id)} disabled={!!analyzingIds[doc.id]}>
                            {analyzingIds[doc.id] ? 'Analyzing…' : 'Analyze'}
                          </button>
                          <button className="btn-ghost" onClick={() => deleteDocument(doc.id)} disabled={!!deletingIds[doc.id]}>
                            {deletingIds[doc.id] ? 'Deleting…' : 'Delete'}
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {detailsDocId && scores[detailsDocId] && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" onClick={() => setDetailsDocId('')}>
                    <div className="card max-w-[860px] w-full max-h-[85vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
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
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {false && activeView === 'upload' && null}

          {false && activeView === 'document-pure' && null}

          {activeView === 'quiz' && (
            <section className="fade visible flex flex-col items-center justify-start gap-[18px] min-h-[80vh] w-full">
              <div className="card w-full">
                <h3 className="mt-0 mb-4 text-xl font-semibold">Quiz</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                  <div className="md:col-span-1">
                    <button
                      className="btn-secondary w-full"
                      onClick={() => setQuizSelectOpen(true)}
                    >
                      {quizSelectedDocId ? 'Change PDF' : 'Select PDF'}
                    </button>
                  </div>
                  <div className="md:col-span-2 flex gap-2">
                    <input
                      className="input-field flex-1"
                      placeholder="Enter keywords (e.g., derivatives, chain rule)"
                      value={quizKeywords}
                      onChange={(e) => setQuizKeywords(e.target.value)}
                    />
                    <button
                      className="btn-primary"
                      disabled={!quizSelectedDocId || quizLoading}
                      onClick={async () => {
                        try {
                          setQuizLoading(true)
                          setQuizScore(null)
                          setQuizQuestions([])
                          setQuizAnswers({})
                          const { data: sessionData } = await supabase.auth.getSession()
                          const token = sessionData.session?.access_token
                          if (!token) throw new Error('Not authenticated')
                          const res = await fetch('/api/quiz', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                            body: JSON.stringify({ id: quizSelectedDocId, keyword: quizKeywords }),
                          })
                          if (!res.ok) {
                            const t = await res.text()
                            throw new Error(t || 'Failed to generate quiz')
                          }
                          const j = await res.json()
                          const qs = (j?.questions || []).slice(0, 10)
                          setQuizQuestions(qs)
                          if (qs.length === 0) toast.info('No questions generated. Try different keywords.')
                        } catch (err: any) {
                          toast.error(err?.message || 'Quiz generation failed')
                        } finally {
                          setQuizLoading(false)
                        }
                      }}
                    >
                      {quizLoading ? 'Generating…' : 'Generate Quiz'}
                    </button>
                  </div>
                </div>

                {quizSelectedDocId && (
                  <div className="mb-3 text-sm text-muted">Selected document: {documents.find(d => d.id === quizSelectedDocId)?.file_name || quizSelectedDocId}</div>
                )}

                {quizQuestions.length > 0 && (
                  <div className="space-y-4 overflow-auto pr-1" style={{ maxHeight: 'calc(85vh - 220px)' }}>
                    {quizQuestions.map((q, idx) => (
                      <div key={idx} className="bg-transparent rounded-lg p-3 border border-white/6">
                        <div className="font-medium mb-2">{idx + 1}. {q.question}</div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {q.options.map((opt, oi) => (
                            <label key={oi} className={`cursor-pointer rounded-lg border border-white/6 p-2 flex items-center gap-2 ${quizAnswers[idx] === oi ? 'bg-accent/12' : 'bg-transparent'}`}>
                              <input
                                type="radio"
                                name={`q-${idx}`}
                                className="accent-current"
                                checked={quizAnswers[idx] === oi}
                                onChange={() => setQuizAnswers((s) => ({ ...s, [idx]: oi }))}
                              />
                              <span className="text-sm">{opt}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}

                    <div className="flex items-center gap-3">
                      <button
                        className="btn-primary"
                        onClick={() => {
                          let score = 0
                          quizQuestions.forEach((q, i) => {
                            if (quizAnswers[i] === q.correctIndex) score += 1
                          })
                          setQuizScore(score)
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
                )}
              </div>

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
              <div className="card w-full flex flex-col" style={{ height: 'calc(100vh - 180px)' }}>
                <div className="flex-shrink-0 mb-4">
                  <h3 className="mt-0 mb-4 text-xl font-semibold">Studyflow</h3>
                  <div className="flex gap-3 items-center">
                    <button
                      className="btn-secondary"
                      onClick={() => setStudyflowSelectOpen(true)}
                    >
                      {studyflowSelectedDocId ? 'Change PDF' : 'Select PDF'}
                    </button>
                    {studyflowSelectedDocId && (
                      <>
                        <button
                          className="btn-primary"
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
                          {studyflowLoading ? 'Generating…' : 'Generate Flow Analysis'}
                        </button>
                      </>
                    )}
                  </div>
                  {studyflowSelectedDocId && (
                    <div className="mt-3 text-sm text-muted">Selected document: {documents.find(d => d.id === studyflowSelectedDocId)?.file_name || studyflowSelectedDocId}</div>
                  )}
                </div>

                {(studyflowAnalysis || studyflowDiagram) && (
                  <div className="flex-1 overflow-auto pr-1 space-y-6" style={{ maxHeight: 'calc(100vh - 280px)' }}>
                    {studyflowDiagram && (
                      <div>
                        <h4 className="mb-3 text-lg font-semibold">Flow Diagram</h4>
                        <div className="bg-transparent rounded-lg p-4 border border-white/6">
                          <pre className="whitespace-pre-wrap text-sm leading-relaxed font-mono">{studyflowDiagram}</pre>
                        </div>
                        {studyflowDiagram && !studyflowAnalysis && (
                          <div className="mt-3">
                            <button
                              className="btn-secondary"
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
                              {studyflowAnalysisLoading ? 'Generating Analysis…' : 'DETAILED FLOW STATE ANALYSIS'}
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {studyflowAnalysis && (
                      <div>
                        <h4 className="mb-3 text-lg font-semibold">Flow State Analysis</h4>
                        <div className="bg-transparent rounded-lg p-4 border border-white/6">
                          <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans">{studyflowAnalysis}</pre>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

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


