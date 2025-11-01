'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import { motion } from 'framer-motion'

interface PublicDoc {
  id: string
  document_id: string
  subject: string
  unit: string | null
  year: string | null
  degree: string | null
  score: number | null
  analysis_keyword: string | null
  verdict: string | null
  rationale: string | null
  focus_topics: string[] | null
  repetitive_topics: string[] | null
  suggested_plan: string[] | null
  file_name: string
  storage_path: string
  uploaded_at: string
  uploaded_by: string
}

export default function ExplorePage() {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [userEmail, setUserEmail] = useState('')
  const [publicDocs, setPublicDocs] = useState<PublicDoc[]>([])
  const [docsLoading, setDocsLoading] = useState(false)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [selectedFilters, setSelectedFilters] = useState<{ subject?: string; year?: string; degree?: string }>({})
  const [viewAnalysisDocId, setViewAnalysisDocId] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    // Quick check
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      if (data?.session) {
        setIsAuthenticated(true)
        setUserEmail(data.session.user?.email || '')
      }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!mounted) return
      setIsAuthenticated(!!session)
      setUserEmail(session?.user?.email || '')
    })
    return () => { mounted = false; subscription.unsubscribe() }
  }, [router])

  useEffect(() => {
    // Load public docs even if not authenticated (browsing allowed)
    loadPublicDocs()
  }, [])

  // Auto-expand first level folders when docs load
  useEffect(() => {
    if (publicDocs.length > 0) {
      const subjects = Array.from(new Set(publicDocs.map((d) => d.subject).filter(Boolean)))
      const newExpanded = new Set<string>()
      subjects.forEach((s) => newExpanded.add(`subject-${s}`))
      setExpandedFolders(newExpanded)
    }
  }, [publicDocs])

  async function loadPublicDocs() {
    try {
      setDocsLoading(true)
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      const res = await fetch('/api/public-library', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || 'Failed to load public library')
      }
      const { rows } = await res.json()
      setPublicDocs(rows || [])
    } catch (e) {
      console.error('[EXPLORE] Load error:', e)
      toast.error('Failed to load public library')
    } finally {
      setDocsLoading(false)
    }
  }

  async function viewDocument(doc: PublicDoc) {
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      const res = await fetch(`/api/public-library/view?id=${encodeURIComponent(doc.document_id)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })

      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || 'Failed to get view URL')
      }

      const { url } = await res.json()
      if (url) {
        window.open(url, '_blank')
      }
    } catch (e: any) {
      toast.error(e?.message || 'Failed to open PDF')
    }
  }

  async function downloadDocument(doc: PublicDoc) {
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      // Use API endpoint for download to handle auth properly
      const res = await fetch(`/api/public-library/download?id=${encodeURIComponent(doc.document_id)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })

      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || 'Download failed')
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = doc.file_name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast.success('Download started')
    } catch (e: any) {
      toast.error(e?.message || 'Download failed')
    }
  }

  // Organize documents into folder structure
  const folderStructure: Record<string, Record<string, Record<string, PublicDoc[]>>> = {}
  
  publicDocs.forEach((doc) => {
    if (selectedFilters.subject && doc.subject !== selectedFilters.subject) return
    if (selectedFilters.year && doc.year !== selectedFilters.year) return
    if (selectedFilters.degree && doc.degree !== selectedFilters.degree) return

    const subject = doc.subject || 'Uncategorized'
    const year = doc.year || 'All Years'
    const degree = doc.degree || 'All Degrees'

    if (!folderStructure[subject]) folderStructure[subject] = {}
    if (!folderStructure[subject][year]) folderStructure[subject][year] = {}
    if (!folderStructure[subject][year][degree]) folderStructure[subject][year][degree] = []

    folderStructure[subject][year][degree].push(doc)
  })

  const subjects = Array.from(new Set(publicDocs.map((d) => d.subject).filter(Boolean)))
  const years = Array.from(new Set(publicDocs.map((d) => d.year).filter(Boolean)))
  const degrees = Array.from(new Set(publicDocs.map((d) => d.degree).filter(Boolean)))

  const toggleFolder = (key: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar
        activeView="explore"
        onViewChange={(view) => {
          try {
            const target = view && view !== 'home' ? `/dashboard?view=${encodeURIComponent(view)}` : '/dashboard'
            router.push(target)
          } catch {
            router.push('/dashboard')
          }
        }}
        username={userEmail || 'User'}
      />
      <div className="flex-1 flex flex-col bg-gradient-to-b from-[#0f1724] to-[#071029]">
        <Header title="Explore" isAuthenticated={isAuthenticated} userEmail={userEmail} />
        <main className="py-10 px-4">
          <div className="max-w-7xl mx-auto w-full">
            <h1 className="text-3xl font-bold mb-6">Public Library</h1>
            <p className="text-muted mb-6">Discover high-quality notes shared by the community</p>

            {/* Filters */}
            <div className="mb-6 flex flex-wrap gap-3">
              <select
                value={selectedFilters.subject || ''}
                onChange={(e) => setSelectedFilters((s) => ({ ...s, subject: e.target.value || undefined }))}
                className="input-field"
              >
                <option value="">All Subjects</option>
                {subjects.map((s) => (
                  <option key={String(s)} value={s ?? ''}>{s}</option>
                ))}
              </select>
              <select
                value={selectedFilters.year || ''}
                onChange={(e) => setSelectedFilters((s) => ({ ...s, year: e.target.value || undefined }))}
                className="input-field"
              >
                <option value="">All Years</option>
                {years.map((y) => (
                  <option key={String(y)} value={y ?? ''}>{y}</option>
                ))}
              </select>
              <select
                value={selectedFilters.degree || ''}
                onChange={(e) => setSelectedFilters((s) => ({ ...s, degree: e.target.value || undefined }))}
                className="input-field"
              >
                <option value="">All Degrees</option>
                {degrees.map((d) => (
                  <option key={String(d)} value={d ?? ''}>{d}</option>
                ))}
              </select>
              {(selectedFilters.subject || selectedFilters.year || selectedFilters.degree) && (
                <button
                  onClick={() => setSelectedFilters({})}
                  className="btn-ghost"
                >
                  Clear Filters
                </button>
              )}
            </div>

            {docsLoading && (
              <div className="text-center py-12">
                <div className="text-muted">Loading...</div>
              </div>
            )}

            {!docsLoading && publicDocs.length === 0 && (
              <div className="text-center py-12">
                <div className="text-muted">No documents in public library yet</div>
              </div>
            )}

            {!docsLoading && publicDocs.length > 0 && (
              <div className="space-y-4">
                {Object.entries(folderStructure).map(([subject, yearMap]) => (
                  <div key={subject} className="border border-white/10 rounded-lg bg-white/5 p-4">
                    <button
                      onClick={() => toggleFolder(`subject-${subject}`)}
                      className="w-full flex items-center gap-2 text-left font-semibold mb-2"
                    >
                      <svg
                        className={`w-5 h-5 transition-transform ${expandedFolders.has(`subject-${subject}`) ? 'rotate-90' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      {subject}
                    </button>

                    {expandedFolders.has(`subject-${subject}`) && (
                      <div className="ml-7 space-y-3">
                        {Object.entries(yearMap).map(([year, degreeMap]) => (
                          <div key={`${subject}-${year}`} className="border-l border-white/10 pl-4">
                            <button
                              onClick={() => toggleFolder(`year-${subject}-${year}`)}
                              className="flex items-center gap-2 text-sm font-medium text-muted mb-2"
                            >
                              <svg
                                className={`w-4 h-4 transition-transform ${expandedFolders.has(`year-${subject}-${year}`) ? 'rotate-90' : ''}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                              {year}
                            </button>

                            {expandedFolders.has(`year-${subject}-${year}`) && (
                              <div className="ml-6 space-y-3">
                                {Object.entries(degreeMap).map(([degree, docs]) => (
                                  <div key={`${subject}-${year}-${degree}`} className="border-l border-white/10 pl-4">
                                    <button
                                      onClick={() => toggleFolder(`degree-${subject}-${year}-${degree}`)}
                                      className="flex items-center gap-2 text-xs font-medium text-muted mb-2"
                                    >
                                      <svg
                                        className={`w-3 h-3 transition-transform ${expandedFolders.has(`degree-${subject}-${year}-${degree}`) ? 'rotate-90' : ''}`}
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                      </svg>
                                      {degree}
                                    </button>

                                    {expandedFolders.has(`degree-${subject}-${year}-${degree}`) && (
                                      <div className="ml-5 space-y-2">
                                        {docs.map((doc) => (
                                          <motion.div
                                            key={doc.id}
                                            initial={{ opacity: 0, y: 4 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                                          >
                                            <div className="flex-1 min-w-0">
                                              <div className="font-medium truncate">{doc.file_name}</div>
                                              {doc.unit && (
                                                <div className="text-xs text-muted">Unit: {doc.unit}</div>
                                              )}
                                              {(doc.score != null || doc.analysis_keyword) && (
                                                <div className="text-xs mt-1 flex items-center gap-2 flex-wrap">
                                                  {doc.score != null && (
                                                    <span className="text-accent font-medium">Score: {doc.score}/100</span>
                                                  )}
                                                  {doc.score != null && doc.analysis_keyword && <span className="text-muted">•</span>}
                                                  {doc.analysis_keyword && (
                                                    <span className="text-muted">Keyword: <span className="font-medium">{doc.analysis_keyword}</span></span>
                                                  )}
                                                  {(doc.verdict || doc.rationale || (Array.isArray(doc.focus_topics) && doc.focus_topics.length > 0)) && (
                                                    <>
                                                      <span className="text-muted">•</span>
                                                      <button
                                                        onClick={() => setViewAnalysisDocId(doc.id)}
                                                        className="text-accent hover:underline text-xs"
                                                      >
                                                        View Analysis
                                                      </button>
                                                    </>
                                                  )}
                                                </div>
                                              )}
                                              <div className="text-xs text-muted">
                                                {new Date(doc.uploaded_at).toLocaleDateString()}
                                              </div>
                                            </div>
                                            <div className="flex gap-2 ml-3">
                                              <button
                                                onClick={() => viewDocument(doc)}
                                                className="btn-secondary flex items-center gap-2"
                                                title="View PDF"
                                              >
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                                  <circle cx="12" cy="12" r="3" />
                                                </svg>
                                                View
                                              </button>
                                              <button
                                                onClick={() => downloadDocument(doc)}
                                                className="btn-primary flex items-center gap-2"
                                                title="Download PDF"
                                              >
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                                  <polyline points="7 10 12 15 17 10" />
                                                  <line x1="12" y1="15" x2="12" y2="3" />
                                                </svg>
                                                Download
                                              </button>
                                            </div>
                                          </motion.div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Analysis Details Modal */}
      {viewAnalysisDocId && (() => {
        const doc = publicDocs.find(d => d.id === viewAnalysisDocId)
        if (!doc) return null
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" onClick={() => setViewAnalysisDocId(null)}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.98 }} 
              animate={{ opacity: 1, scale: 1 }} 
              className="card w-full max-w-[900px] mx-auto max-h-[85vh] overflow-hidden" 
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="mt-0 mb-0 text-xl font-semibold">Detailed Analysis</h3>
                <button onClick={() => setViewAnalysisDocId(null)} className="btn-ghost p-1">×</button>
              </div>

              <div className="overflow-y-auto max-h-[calc(85vh-120px)] pr-2 space-y-4">
                <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                  <h4 className="font-semibold mb-2 text-sm text-muted">Document</h4>
                  <p className="m-0 font-medium">{doc.file_name}</p>
                  {doc.score != null && (
                    <div className="mt-2 flex items-center gap-3">
                      <span className="text-2xl font-bold text-accent">{doc.score}</span>
                      <span className="text-muted">/100</span>
                      {doc.verdict && (
                        <span className="text-sm font-medium">{doc.verdict}</span>
                      )}
                    </div>
                  )}
                  {doc.analysis_keyword && (
                    <div className="mt-2 text-sm text-muted">
                      Analyzed with: <span className="font-medium">{doc.analysis_keyword}</span>
                    </div>
                  )}
                </div>

                {doc.rationale && (
                  <section className="bg-white/5 rounded-lg p-4 border border-white/10">
                    <h4 className="font-semibold mb-2">Rationale</h4>
                    <p className="m-0 text-sm leading-relaxed">{doc.rationale}</p>
                  </section>
                )}

                {((Array.isArray(doc.focus_topics) && doc.focus_topics.length > 0) || (Array.isArray(doc.repetitive_topics) && doc.repetitive_topics.length > 0)) && (
                  <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {Array.isArray(doc.focus_topics) && doc.focus_topics.length > 0 && (
                      <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                        <h4 className="font-semibold mb-2 text-sm">Focus Topics</h4>
                        <ul className="m-0 pl-5 space-y-1 text-sm">
                          {(doc.focus_topics || []).map((t, i) => (
                            <li key={i}>{t}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {Array.isArray(doc.repetitive_topics) && doc.repetitive_topics.length > 0 && (
                      <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                        <h4 className="font-semibold mb-2 text-sm">Repetitive Topics</h4>
                        <ul className="m-0 pl-5 space-y-1 text-sm">
                          {(doc.repetitive_topics || []).map((t, i) => (
                            <li key={i}>{t}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </section>
                )}

                {Array.isArray(doc.suggested_plan) && doc.suggested_plan.length > 0 && (
                  <section className="bg-white/5 rounded-lg p-4 border border-white/10">
                    <h4 className="font-semibold mb-2">Suggested Study Plan</h4>
                    <ol className="m-0 pl-5 space-y-1 text-sm">
                      {(doc.suggested_plan || []).map((t, i) => (
                        <li key={i}>{t}</li>
                      ))}
                    </ol>
                  </section>
                )}
              </div>

              <div className="mt-4 flex justify-end">
                <button onClick={() => setViewAnalysisDocId(null)} className="btn-primary">
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )
      })()}
    </div>
  )
}

