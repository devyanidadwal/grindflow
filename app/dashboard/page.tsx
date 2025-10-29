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
    'qsui': 'Quiz / Study Flow',
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
    if (activeView === 'my-docs' && isAuthenticated) {
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

          {activeView === 'qsui' && (
            <section className="fade visible flex flex-col items-center justify-start gap-[18px] min-h-[80vh]">
              <div className="card">
                <h3 className="mt-0 mb-4 text-xl font-semibold">Quiz / Study Flow</h3>
                <p className="text-muted">Interactive study mode with generated questions.</p>
              </div>
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


