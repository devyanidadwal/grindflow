export function normalizeForPrompt(input: string): string {
  if (!input) return ''
  const lines = input.split(/\r?\n/)
  const seen: Record<string, number> = {}
  const kept: string[] = []
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    if (trimmed.length <= 50) {
      const key = trimmed.toLowerCase()
      seen[key] = (seen[key] || 0) + 1
      if (seen[key] > 2) continue
    }
    kept.push(trimmed)
  }
  const joined = kept.join('\n')
  return joined.replace(/[\t ]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n')
}

export function buildShortText(normalized: string, maxChars: number): string {
  if (!normalized) return ''
  return normalized.length > maxChars ? normalized.slice(0, maxChars) + '\n... [truncated]' : normalized
}

export function keywordFocusedSlice(text: string, keywords: string, maxLines: number): string | null {
  const focusTerms = String(keywords || '')
    .split(/[,\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  if (focusTerms.length === 0) return null
  const snippets: string[] = []
  for (const line of text.split(/\r?\n/)) {
    const low = line.toLowerCase()
    if (focusTerms.some((t) => low.includes(t))) {
      snippets.push(line)
      if (snippets.length >= maxLines) break
    }
  }
  return snippets.length >= 5 ? snippets.join('\n') : null
}


