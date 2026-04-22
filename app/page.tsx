"use client"

import { ContainerTextFlip } from '@/components/ui/container-text-flip'
import Link from 'next/link'
import SoftCard from '@/components/ui/soft-card'
export default function Landing() {

  return (
    <main className="relative min-h-screen flex items-center">
      {/* Subtle decorative background accents */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-accent/10 blur-3xl" />
        <div className="absolute top-40 -right-24 h-72 w-72 rounded-full bg-[#9ad4ff]/10 blur-3xl" />
      </div>
      <div className="max-w-[1100px] mx-auto w-full px-6 md:px-8">
        <div className="absolute top-6 right-6">
          <Link href="/about" className="inline-flex items-center justify-center h-10 w-10 rounded-full border border-white/10 bg-white/5 hover:bg-white/10" aria-label="About us">
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="currentColor" d="M12 2C6.475 2 2 6.588 2 12.253c0 4.52 2.865 8.35 6.839 9.703c.5.096.683-.22.683-.49c0-.242-.01-1.048-.015-1.901c-2.782.616-3.37-1.215-3.37-1.215c-.455-1.177-1.11-1.49-1.11-1.49c-.908-.64.069-.627.069-.627c1.003.072 1.53 1.05 1.53 1.05c.892 1.57 2.341 1.116 2.91.853c.091-.665.35-1.116.636-1.373c-2.222-.258-4.555-1.144-4.555-5.09c0-1.124.387-2.043 1.021-2.763c-.103-.258-.443-1.3.097-2.71c0 0 .836-.275 2.74 1.055A9.29 9.29 0 0 1 12 6.844c.847.004 1.7.117 2.497.343c1.902-1.33 2.737-1.055 2.737-1.055c.542 1.41.202 2.452.1 2.71c.636.72 1.02 1.639 1.02 2.763c0 3.957-2.337 4.828-4.565 5.082c.36.32.682.948.682 1.912c0 1.38-.013 2.493-.013 2.832c0 .272.18.592.688.49C19.138 20.6 22 16.77 22 12.252C22 6.588 17.523 2 12 2Z"/>
            </svg>
          </Link>
        </div>
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm text-xs text-muted hover:bg-white/10 transition-colors float-subtle">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
          Introducing GrindFlow
        </div>

        <h1 className="mt-5 text-5xl md:text-7xl font-extrabold leading-[1.08] tracking-tight fade visible">
          Make your study notes look
          <span className="relative inline-block align-baseline ml-2">
            <span className="sr-only"> ten times </span>
            <span className="mx-3">10x</span>
            <ContainerTextFlip
              words={["better", "cleaner", "sharper"]}
              className="align-middle ml-2"
              textClassName="px-2"
              interval={2400}
              animationDuration={600}
            />
          </span>
        </h1>

        <p className="mt-6 max-w-[680px] text-lg text-muted">
          Upload your notes, get AI feedback, generate quizzes, and earn coins for sharing quality content. Minimalist motion, maximal clarity.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/signin" className="btn-primary inline-flex items-center gap-2">Sign in</Link>
          <Link href="/login" className="btn-secondary inline-flex items-center gap-2">Create account</Link>
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-3">
          <SoftCard>
            <div className="inline-flex items-center gap-2 text-xs mb-2">
              <span className="px-2 py-1 rounded-full bg-white/8 border border-white/10 text-muted">Feature</span>
              <span className="px-2 py-1 rounded-full bg-accent/15 text-accent">AI</span>
            </div>
            <div className="text-xl font-semibold mb-1">AI scoring</div>
            <p className="text-sm text-muted">Smart ratings with actionable suggestions.</p>
          </SoftCard>
          <SoftCard>
            <div className="inline-flex items-center gap-2 text-xs mb-2">
              <span className="px-2 py-1 rounded-full bg-white/8 border border-white/10 text-muted">Workflow</span>
              <span className="px-2 py-1 rounded-full bg-accent/15 text-accent">Flow</span>
            </div>
            <div className="text-xl font-semibold mb-1">Study flows</div>
            <p className="text-sm text-muted">Adaptive steps to master your topic.</p>
          </SoftCard>
          <SoftCard>
            <div className="inline-flex items-center gap-2 text-xs mb-2">
              <span className="px-2 py-1 rounded-full bg-white/8 border border-white/10 text-muted">Practice</span>
              <span className="px-2 py-1 rounded-full bg-accent/15 text-accent">Quiz</span>
            </div>
            <div className="text-xl font-semibold mb-1">Quizzes</div>
            <p className="text-sm text-muted">Auto-generated questions to test yourself.</p>
          </SoftCard>
        </div>

        {/* Removed trust strip and secondary cards as requested */}
      </div>
    </main>
  )
}

