'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import PaymentModal from '@/components/PaymentModal'

export default function ProUpgradePage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [userEmail, setUserEmail] = useState('')
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<{ name: string; price: number } | null>(null)
  const router = useRouter()

  useEffect(() => {
    async function checkAuth() {
      try {
        const { data, error } = await supabase.auth.getSession()
        
        // Handle refresh token errors
        if (error && (error.message?.includes('refresh') || error.message?.includes('Refresh Token'))) {
          console.log('[PRO-UPGRADE] Invalid refresh token, clearing session')
          await supabase.auth.signOut()
          router.replace('/login')
          setIsLoading(false)
          return
        }
        
        if (data?.session) {
          setIsAuthenticated(true)
          setUserEmail(data.session.user?.email || '')
        } else {
          router.replace('/login')
        }
        setIsLoading(false)
      } catch (e) {
        console.error('[PRO-UPGRADE] Auth check error:', e)
        await supabase.auth.signOut()
        router.replace('/login')
        setIsLoading(false)
      }
    }
    checkAuth()
  }, [router])

  const handleSubscribe = (plan: string, price: number) => {
    setSelectedPlan({ name: plan, price })
    setShowPaymentModal(true)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-xl font-semibold mb-2">Loading...</div>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  const plans = [
    {
      name: 'Basic',
      price: 10,
      color: 'from-blue-500 to-cyan-500',
      bgColor: 'bg-gradient-to-br from-blue-600/20 via-cyan-600/15 to-blue-500/10',
      borderColor: 'border-blue-500/30',
      buttonColor: 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700',
      features: [
        'Upload up to 20 documents/month',
        'Basic AI analysis',
        'Standard quiz generation',
        'Document viewer access',
        'Email support',
        '5 GB storage',
      ],
      recommended: false,
    },
    {
      name: 'Advanced',
      price: 15,
      color: 'from-purple-500 to-pink-500',
      bgColor: 'bg-gradient-to-br from-purple-600/20 via-pink-600/15 to-purple-500/10',
      borderColor: 'border-purple-500/40',
      buttonColor: 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700',
      features: [
        'Upload up to 50 documents/month',
        'Advanced AI analysis & insights',
        'Enhanced quiz generation',
        'Priority document processing',
        'Study flow customization',
        'Priority email support',
        '25 GB storage',
        'Export documents as PDF',
      ],
      recommended: true,
    },
    {
      name: 'Advanced Plus',
      price: 20,
      color: 'from-orange-500 to-yellow-500',
      bgColor: 'bg-gradient-to-br from-orange-600/20 via-yellow-600/15 to-orange-500/10',
      borderColor: 'border-orange-500/30',
      buttonColor: 'bg-gradient-to-r from-orange-600 to-yellow-600 hover:from-orange-700 hover:to-yellow-700',
      features: [
        'Unlimited document uploads',
        'Premium AI analysis with detailed feedback',
        'Advanced quiz generation with explanations',
        'Instant document processing',
        'Custom study flow creation',
        'Collaboration features',
        '24/7 priority support',
        'Unlimited storage',
        'API access',
        'White-label options',
      ],
      recommended: false,
    },
  ]

  return (
    <div className="flex min-h-screen">
      <Sidebar activeView="pro-upgrade" onViewChange={() => {}} username={userEmail || 'User'} />
      <div className="flex-1 flex flex-col bg-gradient-to-b from-[#0f1724] to-[#071029]">
        <Header title="Pro Upgrade" isAuthenticated={isAuthenticated} userEmail={userEmail} />
        <main className="py-10 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-accent to-[#9ad4ff] bg-clip-text text-transparent">
            Pro Upgrade
          </h1>
          <p className="text-lg text-muted max-w-2xl mx-auto">
            Unlock the full potential of GrindFlow with our premium plans. Choose the plan that fits your needs.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl overflow-hidden border bg-card ${
                plan.recommended
                  ? 'border-accent shadow-2xl shadow-accent/30 scale-105 ring-2 ring-accent/20'
                  : plan.borderColor
              } transition-all duration-300 hover:scale-105 hover:shadow-2xl`}
            >
              {/* Card Content */}
              <div className="relative z-10 p-6 md:p-8">
                {/* Recommended Badge (inside to avoid clipping) */}
                {plan.recommended && (
                  <div className="flex justify-center -mt-2 mb-3">
                    <span className="bg-gradient-to-r from-accent to-[#9ad4ff] text-[#071129] px-5 py-1.5 rounded-full text-sm font-bold shadow-lg">
                      Most Popular
                    </span>
                  </div>
                )}

                {/* Plan Header */}
                <div className="text-center mb-8 mt-4">
                  <h3 className={`text-2xl font-bold mb-4 bg-gradient-to-r ${plan.color} bg-clip-text text-transparent`}>
                    {plan.name}
                  </h3>
                  <div className="flex items-baseline justify-center gap-2">
                    <span className="text-6xl font-extrabold text-white">${plan.price}</span>
                    <span className="text-lg text-gray-400">/month</span>
                  </div>
                </div>

                {/* Features List */}
                <ul className="space-y-3.5 mb-6 md:mb-8">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <svg
                        className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                          plan.recommended ? 'text-accent' : 'text-white/70'
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2.5}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      <span className="text-sm text-white/90 leading-relaxed">{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA Button */}
                <button
                  onClick={() => handleSubscribe(plan.name, plan.price)}
                  style={
                    plan.recommended
                      ? {}
                      : plan.name === 'Basic'
                      ? { background: 'linear-gradient(to right, #2563eb, #0891b2)' }
                      : plan.name === 'Advanced Plus'
                      ? { background: 'linear-gradient(to right, #ea580c, #ca8a04)' }
                      : {}
                  }
                  className={`group w-full rounded-xl py-3.5 px-6 font-semibold transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-0 focus-visible:ring-accent/60 shadow-lg text-white ${
                    plan.recommended
                      ? 'bg-accent text-[#071129] hover:bg-accent/90 shadow-accent/20 ring-1 ring-accent/30'
                      : ''
                  }`}
                  onMouseEnter={(e) => {
                    if (plan.recommended) {
                      e.currentTarget.style.opacity = '0.9'
                    } else if (plan.name === 'Basic') {
                      e.currentTarget.style.background = 'linear-gradient(to right, #1d4ed8, #0e7490)'
                    } else if (plan.name === 'Advanced Plus') {
                      e.currentTarget.style.background = 'linear-gradient(to right, #c2410c, #a16207)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (plan.recommended) {
                      e.currentTarget.style.opacity = '1'
                    } else if (plan.name === 'Basic') {
                      e.currentTarget.style.background = 'linear-gradient(to right, #2563eb, #0891b2)'
                    } else if (plan.name === 'Advanced Plus') {
                      e.currentTarget.style.background = 'linear-gradient(to right, #ea580c, #ca8a04)'
                    }
                  }}
                >
                  <span className="inline-flex items-center justify-center gap-2">
                    <span>Subscribe Now</span>
                    <svg
                      className={`h-4 w-4 transition-transform group-hover:translate-x-0.5 ${
                        plan.recommended ? 'text-[#071129]' : 'text-white/90'
                      }`}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M5 12h14" />
                      <path d="M12 5l7 7-7 7" />
                    </svg>
                  </span>
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Additional Info */}
        <div className="mt-16 text-center">
          <p className="text-muted text-sm mb-4">
            All plans include a 7-day free trial. Cancel anytime. No hidden fees.
          </p>
          <div className="flex items-center justify-center gap-6 text-sm text-muted">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Secure payments</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Money-back guarantee</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>24/7 support</span>
            </div>
          </div>
        </div>

        {/* Back to Dashboard */}
        <div className="mt-12 text-center">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-accent hover:text-accent/80 transition-colors"
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>
        </main>
      </div>

      {/* Payment Modal */}
      {selectedPlan && (
        <PaymentModal
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          planName={selectedPlan.name}
          planPrice={selectedPlan.price}
        />
      )}
    </div>
  )
}

