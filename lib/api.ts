const API_BASE_URL = typeof window !== 'undefined' 
  ? window.location.origin 
  : (process.env.NEXT_PUBLIC_API_BASE_URL || '')

export async function apiGet(path: string, options: RequestInit = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) }
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'GET',
    headers,
    credentials: 'include',
    ...options,
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function apiPost(path: string, body: FormData | object, options: RequestInit = {}) {
  const headers = body instanceof FormData ? {} : { 'Content-Type': 'application/json', ...(options.headers || {}) }
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers,
    body: body instanceof FormData ? body : JSON.stringify(body),
    credentials: 'include',
    ...options,
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

