"use client"

import { useEffect, useRef, useState } from "react"

interface MermaidDiagramProps {
  chart: string
}

export default function MermaidDiagram({ chart }: MermaidDiagramProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [svg, setSvg] = useState<string | null>(null)

  useEffect(() => {
    if (!chart?.trim()) return

    let cancelled = false

    async function render() {
      try {
        setError(null)
        const mermaid = (await import("mermaid")).default

        mermaid.initialize({
          startOnLoad: false,
          theme: "dark",
          themeVariables: {
            darkMode: true,
            background: "transparent",
            primaryColor: "#6c8cff",
            primaryTextColor: "#eaf0ff",
            primaryBorderColor: "rgba(255,255,255,0.12)",
            lineColor: "rgba(108,140,255,0.7)",
            secondaryColor: "rgba(255,255,255,0.06)",
            tertiaryColor: "rgba(255,255,255,0.03)",
            nodeBorder: "rgba(255,255,255,0.12)",
            clusterBkg: "rgba(255,255,255,0.03)",
            titleColor: "#eaf0ff",
            edgeLabelBackground: "rgba(15,23,36,0.9)",
            fontFamily: "Poppins, sans-serif",
            fontSize: "14px",
          },
        })

        const id = `mermaid-${Date.now()}`
        const { svg: rendered } = await mermaid.render(id, chart)
        if (!cancelled) setSvg(rendered)
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to render diagram")
      }
    }

    render()
    return () => { cancelled = true }
  }, [chart])

  if (error) {
    return (
      <div className="rounded-lg border border-white/8 p-4 text-sm text-muted">
        <p className="mb-1 font-medium text-red-400">Diagram render error</p>
        <pre className="whitespace-pre-wrap text-xs opacity-70">{chart}</pre>
      </div>
    )
  }

  if (!svg) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-muted">
        <svg className="animate-spin mr-2" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
        Rendering diagram…
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-white/8 bg-[radial-gradient(circle_at_10%_10%,rgba(108,140,255,0.06),transparent_50%)] overflow-auto">
      <div className="flex items-center px-3 py-2 border-b border-white/8">
        <span className="text-xs text-muted">Flow diagram</span>
      </div>
      <div
        ref={ref}
        className="p-4 flex justify-center"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  )
}
