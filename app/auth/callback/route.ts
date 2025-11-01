import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const origin = requestUrl.origin
  
  if (code) {
    const response = NextResponse.next({
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
    
    try {
      const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(code)
      if (error) throw error
      
      // Only redirect after successful session exchange
      return NextResponse.redirect(new URL('/dashboard', origin), {
        // Copy over the set cookies to the redirect response
        headers: response.headers
      })
    } catch (error) {
      console.error('Auth error:', error)
      return NextResponse.redirect(new URL('/', origin))
    }
  }

  // If no code, redirect to home page
  return NextResponse.redirect(new URL('/', origin))
}