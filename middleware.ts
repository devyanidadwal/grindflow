import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Check if the route requires authentication
  const requiresAuth = ['/dashboard', '/onboarding'].some(path => pathname.startsWith(path))
  
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.delete({
            name,
            ...options,
          })
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()

  // NOTE: don't rewrite or redirect /dashboard here. The Supabase PKCE flow
  // stores the verifier in browser localStorage and the browser completes the
  // session creation client-side. Middleware runs on the server and cannot
  // reliably detect a session stored only in localStorage, which causes valid
  // sign-ins to be redirected away from the dashboard. Let the client handle
  // navigation to `/dashboard` after it finishes the OAuth exchange.

  // Redirect signin/login to home page as well
  if (pathname === '/signin' || pathname === '/login') {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return response
}

// Ensure the middleware is only called for relevant paths
export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
}