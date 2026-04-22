'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { toast } from 'sonner'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'

function PublicUploadContent() {
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

  const { isLoaded, isSignedIn, user } = useUser()
  useEffect(() => {
    if (!isLoaded) return
    if (!isSignedIn) { router.replace('/'); return }
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/user/check-username', { cache: 'no-store' })
        if (cancelled) return
        if (res.ok) {
          const { hasUsername } = await res.json()
          if (!hasUsername) { router.replace('/onboarding'); return }
        } else {
          router.replace('/onboarding'); return
        }
      } catch (e) {
        console.error('[PUBLIC-UPLOAD] Check username error:', e)
        router.replace('/onboarding'); return
      }
      setIsAuthenticated(true)
      const email = user?.primaryEmailAddress?.emailAddress || ''
      setUserEmail(email ? email.split('@')[0] : (user?.username || 'User'))
      setUserId(user?.id || '')
    })()
    return () => { cancelled = true }
  }, [isLoaded, isSignedIn, user, router])

  useEffect(() => {
    if (!docId || !isAuthenticated) return
    async function loadDoc() {
      try {
        const res = await fetch(`/api/documents?t=${Date.now()}`, { cache: 'no-store' })
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
      const res = await fetch('/api/public-library/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

export default function PublicUploadPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center">
          <div className="text-gray-400">Loading...</div>
        </div>
      </div>
    }>
      <PublicUploadContent />
    </Suspense>
  )
}
