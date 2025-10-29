'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

export default function LogoutPage() {
  const router = useRouter()

  useEffect(() => {
    async function run() {
      await supabase.auth.signOut()
      toast.success('Signed out')
      router.replace('/login')
    }
    run()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="text-xl font-semibold mb-2">Signing you out…</div>
        <div className="text-sm text-muted">Redirecting to login</div>
      </div>
    </div>
  )
}


