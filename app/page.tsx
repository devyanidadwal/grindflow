import { ContainerTextFlip } from '@/components/ui/container-text-flip'
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
          <a href="/login" className="btn-primary">Get started</a>
          <a href="/signin" className="btn-secondary">Create account</a>
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

