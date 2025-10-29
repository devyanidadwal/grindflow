"use client"

import { useMemo, useState } from 'react'

interface PrettyFlowProps {
  content: string
}

// Escapes HTML to safely inject highlighted markup
function escapeHtml(str: string) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export default function PrettyFlow({ content }: PrettyFlowProps) {
  const [fontSize, setFontSize] = useState(14)
  const [wrap, setWrap] = useState(true)

  // Lightweight highlighting for arrows and brackets commonly used in ASCII flows
  const highlighted = useMemo(() => {
    const escaped = escapeHtml(content)
    return escaped
      .replace(/(->|=>|⇒|→)/g, '<span class="text-accent">$1</span>')
      .replace(/([|+-]{2,}|\.{2,})/g, '<span class="text-white\/60">$1</span>')
      .replace(/([\[\](){}])/g, '<span class="text-white\/70">$1</span>')
  }, [content])

  return (
    <div className="rounded-lg border border-white/8 bg-[radial-gradient(circle_at_10%_10%,rgba(255,255,255,0.06),transparent_40%),linear-gradient(180deg,rgba(255,255,255,0.03),transparent)]">
      <div className="flex items-center justify-between px-2 py-1 border-b border-white/8">
        <div className="text-xs text-muted">Flow diagram</div>
        <div className="flex items-center gap-1">
          <button
            className="btn-ghost text-xs px-2 py-1"
            onClick={() => setFontSize((s) => Math.max(10, s - 1))}
            aria-label="Decrease font size"
          >
            A-
          </button>
          <button
            className="btn-ghost text-xs px-2 py-1"
            onClick={() => setFontSize((s) => Math.min(24, s + 1))}
            aria-label="Increase font size"
          >
            A+
          </button>
          <button
            className="btn-ghost text-xs px-2 py-1"
            onClick={() => setWrap((w) => !w)}
            aria-label="Toggle wrap"
          >
            {wrap ? 'No Wrap' : 'Wrap'}
          </button>
        </div>
      </div>
      <div className="overflow-auto p-3">
        <pre
          className="m-0 font-mono leading-7 text-eaf0ff/95"
          style={{ fontSize, whiteSpace: wrap ? 'pre-wrap' as const : 'pre' as const }}
        >
          <code
            // Using dangerouslySetInnerHTML for lightweight highlighting; content is escaped above
            dangerouslySetInnerHTML={{ __html: highlighted }}
          />
        </pre>
      </div>
    </div>
  )
}


