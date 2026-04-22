import { toast } from 'sonner'

// Small wrapper around fetch that converts common API failures into
// user-friendly toasts. Returns the parsed JSON or null on error.
export async function apiFetch<T = any>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T | null> {
  let res: Response
  try {
    res = await fetch(input, init)
  } catch (e: any) {
    toast.error('Network error. Check your connection and try again.')
    return null
  }

  if (res.status === 429) {
    const retry = res.headers.get('Retry-After')
    const secs = retry ? parseInt(retry, 10) : 10
    toast.warning(`Too many requests. Try again in ${isNaN(secs) ? 10 : secs}s.`)
    return null
  }

  if (res.status === 503) {
    let msg = 'AI service temporarily unavailable. Try again shortly.'
    try {
      const body = await res.clone().json()
      if (body?.error) msg = body.error
    } catch {}
    toast.error(msg)
    return null
  }

  if (!res.ok) {
    let msg = `Request failed (${res.status})`
    try {
      const body = await res.clone().json()
      if (body?.error) msg = body.error
    } catch {
      try {
        const text = await res.clone().text()
        if (text) msg = text
      } catch {}
    }
    toast.error(msg)
    return null
  }

  try {
    return (await res.json()) as T
  } catch {
    return null
  }
}
