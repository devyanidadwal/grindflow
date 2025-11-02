'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'

export default function PublicUploadPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const docId = searchParams.get('doc')
  
  // Read score, keyword, and analysis data from URL params
  useEffect(() => {
    const scoreParam = searchParams.get('score')
    const keywordParam = searchParams.get('keyword')
    const verdictParam = searchParams.get('verdict')
    const rationaleParam = searchParams.get('rationale')
    const focusTopicsParam = searchParams.get('focus_topics')
    const repetitiveTopicsParam = searchParams.get('repetitive_topics')
    const suggestedPlanParam = searchParams.get('suggested_plan')
    
    if (scoreParam) {
      const parsed = parseFloat(scoreParam)
      if (!isNaN(parsed)) setScore(parsed)
    }
    if (keywordParam) setAnalysisKeyword(decodeURIComponent(keywordParam))
    
    if (verdictParam || rationaleParam || focusTopicsParam || repetitiveTopicsParam || suggestedPlanParam) {
      setAnalysisData({
        verdict: verdictParam || undefined,
        rationale: rationaleParam ? decodeURIComponent(rationaleParam) : undefined,
        focus_topics: focusTopicsParam ? JSON.parse(focusTopicsParam) : undefined,
        repetitive_topics: repetitiveTopicsParam ? JSON.parse(repetitiveTopicsParam) : undefined,
        suggested_plan: suggestedPlanParam ? JSON.parse(suggestedPlanParam) : undefined,
      })
    }
  }, [searchParams])
  
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [userEmail, setUserEmail] = useState('')
  const [userId, setUserId] = useState('')
  const [docName, setDocName] = useState('')
  const [subject, setSubject] = useState('')
  const [unit, setUnit] = useState('')
  const [year, setYear] = useState('')
  const [degree, setDegree] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [score, setScore] = useState<number | null>(null)
  const [analysisKeyword, setAnalysisKeyword] = useState('')
  const [analysisData, setAnalysisData] = useState<{
    verdict?: string
    rationale?: string
    focus_topics?: string[]
    repetitive_topics?: string[]
    suggested_plan?: string[]
  } | null>(null)

  useEffect(() => {
    let mounted = true
    // Quick check - don't block render
    supabase.auth.getSession().then(async ({ data, error }) => {
      if (!mounted) return
      if (error?.message?.includes('refresh') || error?.message?.includes('Refresh Token')) {
        supabase.auth.signOut().then(() => router.replace('/'))
        return
      }
      if (data?.session) {
        // Check if user has username
        const token = data.session.access_token
        try {
          const res = await fetch('/api/user/check-username', {
            headers: { Authorization: `Bearer ${token}` },
          })
          if (res.ok) {
            const { hasUsername } = await res.json()
            if (!hasUsername) {
              router.replace('/onboarding')
              return
            }
          } else {
            router.replace('/onboarding')
            return
          }
        } catch (e) {
          console.error('[PUBLIC-UPLOAD] Check username error:', e)
          router.replace('/onboarding')
          return
        }
        
        setIsAuthenticated(true)
        const email = data.session.user?.email || ''
        const username = email ? email.split('@')[0] : 'User'
        setUserEmail(username)
        setUserId(data.session.user?.id || '')
      } else {
        router.replace('/')
      }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_e, session) => {
      if (!mounted) return
      if (session) {
        // Check if user has username
        const token = session.access_token
        try {
          const res = await fetch('/api/user/check-username', {
            headers: { Authorization: `Bearer ${token}` },
          })
          if (res.ok) {
            const { hasUsername } = await res.json()
            if (!hasUsername) {
              router.replace('/onboarding')
              return
            }
          } else {
            router.replace('/onboarding')
            return
          }
        } catch (e) {
          console.error('[PUBLIC-UPLOAD] Check username error:', e)
          router.replace('/onboarding')
          return
        }
        
        setIsAuthenticated(true)
        const email = session.user?.email || ''
        const username = email ? email.split('@')[0] : 'User'
        setUserEmail(username)
        setUserId(session.user?.id || '')
      } else {
        setIsAuthenticated(false)
        setUserEmail('')
        router.replace('/')
      }
    })
    return () => { mounted = false; subscription.unsubscribe() }
  }, [router])

  useEffect(() => {
    if (!docId || !isAuthenticated) return
    async function loadDoc() {
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        const token = sessionData.session?.access_token
        if (!token) return
        
        const res = await fetch(`/api/documents?t=${Date.now()}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const { rows } = await res.json()
          const doc = rows?.find((d: any) => d.id === docId)
          if (doc) setDocName(doc.file_name || '')
        }
      } catch (e) {
        console.error('Failed to load document:', e)
      }
    }
    loadDoc()
  }, [docId, isAuthenticated])

  const handleSubmit = async () => {
    if (!docId) {
      toast.error('Document ID missing')
      return
    }
    
    if (!subject.trim()) {
      toast.error('Please enter a subject')
      return
    }

    setSubmitting(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) throw new Error('Not authenticated')

      const res = await fetch('/api/public-library/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          document_id: docId,
          subject: subject.trim(),
          unit: unit.trim() || null,
          year: year.trim() || null,
          degree: degree.trim() || null,
          score: score,
          analysis_keyword: analysisKeyword.trim() || null,
          verdict: analysisData?.verdict || null,
          rationale: analysisData?.rationale || null,
          focus_topics: analysisData?.focus_topics || null,
          repetitive_topics: analysisData?.repetitive_topics || null,
          suggested_plan: analysisData?.suggested_plan || null,
        }),
      })

      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || 'Failed to submit to public library')
      }

      toast.success('Document shared to public library!')
      router.push('/explore')
    } catch (e: any) {
      toast.error(e?.message || 'Failed to submit to public library')
    } finally {
      setSubmitting(false)
    }
  }

  if (!isAuthenticated) {
    return null
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
        <Header title="Share to Public Library" isAuthenticated={isAuthenticated} userEmail={userEmail} userId={userId || ''} />
        <main className="py-10 px-4">
          <div className="max-w-2xl mx-auto">
            <div className="card">
              <h2 className="mt-0 mb-4 text-2xl font-bold">Share Your Document</h2>
              <p className="mb-6 text-muted">
                Help others discover your high-quality notes. Provide context to organize them properly.
              </p>

              {docName && (
                <div className="mb-6 p-3 rounded-lg bg-white/5 border border-white/10">
                  <p className="text-sm text-muted mb-1">Document:</p>
                  <p className="font-medium mb-2">{docName}</p>
                  {score != null && (
                    <p className="text-sm text-muted">
                      <span className="font-medium text-accent">Score: {score}/100</span>
                      {analysisKeyword && (
                        <span className="ml-3">• Analyzed with: <span className="font-medium">{analysisKeyword}</span></span>
                      )}
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Subject *</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g., Mathematics, Computer Science, Physics"
                    className="input-field w-full"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Unit/Chapter</label>
                  <input
                    type="text"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="e.g., Unit 3, Chapter 5, Derivatives"
                    className="input-field w-full"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Year</label>
                    <input
                      type="text"
                      value={year}
                      onChange={(e) => setYear(e.target.value)}
                      placeholder="e.g., 3rd year, 1st year"
                      className="input-field w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Degree/Course</label>
                    <input
                      type="text"
                      value={degree}
                      onChange={(e) => setDegree(e.target.value)}
                      placeholder="e.g., BTech, BSc, MBA"
                      className="input-field w-full"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button onClick={() => router.back()} className="btn-ghost">Cancel</button>
                  <button onClick={handleSubmit} className="btn-primary" disabled={submitting || !subject.trim()}>
                    {submitting ? 'Submitting...' : 'Done'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

