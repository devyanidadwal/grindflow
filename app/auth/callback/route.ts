import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') || '/dashboard'
  
  // Always use requestUrl.origin to ensure correct origin handling
  const origin = requestUrl.origin
  console.log('Auth callback - Origin:', origin, 'Code:', !!code)
  
  if (code) {
    // Important: PKCE code_verifier is stored in the browser (localStorage).
    // Attempting to exchange the code server-side here will fail with
    // "both auth code and code verifier should be non-empty" because the
    // server doesn't have the verifier. Instead, redirect the user back
    // to the client app (preserving the query string) so the client-side
    // Supabase SDK can complete the sign-in flow.
    const qs = requestUrl.searchParams.toString()
  // Redirect to a dedicated client completion page so the browser receives
  // the OAuth query params and can finish the PKCE exchange. Using a
  // dedicated `/auth/complete` route gives clearer UX and avoids middleware
  // rules that rewrite `/dashboard` -> `/`.
  const redirectUrl = new URL('/auth/complete', origin)
    if (qs) redirectUrl.search = qs

    console.log('Auth callback: delegating to client-side handler, redirect ->', redirectUrl.toString())
    return NextResponse.redirect(redirectUrl)
  }

  // If no code, redirect to home page
  return NextResponse.redirect(new URL('/signin', origin))
}