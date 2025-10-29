import { ContainerTextFlip } from '@/components/ui/container-text-flip'
export default function Landing() {
  return (
    <main className="min-h-screen flex items-center">
      <div className="max-w-[1100px] mx-auto w-full px-6 md:px-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm text-xs text-muted hover:bg-white/10 transition-colors float-subtle">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
          Introducing GrindFlow
        </div>

        <h1 className="mt-5 text-5xl md:text-7xl font-extrabold leading-[1.08] tracking-tight">
          Make your study notes look
          <span className="relative inline-block align-baseline ml-2">
            <span className="sr-only"> ten times </span>
            <span className="mx-3">10x</span>
            {/* Container Text Flip for the word "better" */}
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
          <div className="card transition-transform duration-300 hover:translate-y-[-2px]">
            <div className="text-xl font-semibold mb-1">AI scoring</div>
            <p className="text-sm text-muted">Smart ratings with actionable suggestions.</p>
          </div>
          <div className="card transition-transform duration-300 hover:translate-y-[-2px]">
            <div className="text-xl font-semibold mb-1">Study flows</div>
            <p className="text-sm text-muted">Adaptive steps to master your topic.</p>
          </div>
          <div className="card transition-transform duration-300 hover:translate-y-[-2px]">
            <div className="text-xl font-semibold mb-1">Quizzes</div>
            <p className="text-sm text-muted">Auto-generated questions to test yourself.</p>
          </div>
        </div>
      </div>
    </main>
  )
}

