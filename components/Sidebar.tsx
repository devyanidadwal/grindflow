'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface SidebarProps {
  activeView: string
  onViewChange: (view: string) => void
  username?: string
  coins?: number
}

export default function Sidebar({ activeView, onViewChange, username = 'Devyani', coins = 12.3 }: SidebarProps) {
  const [userEmail, setUserEmail] = useState<string>(username)
  const [userCoins, setUserCoins] = useState<number>(coins)
  const router = useRouter()

  useEffect(() => {
    async function updateAuthState() {
      const { data } = await supabase.auth.getSession()
      const email = data?.session?.user?.email
      if (email) {
        setUserEmail(email)
      }
    }
    updateAuthState()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async () => {
      await updateAuthState()
    })

    return () => subscription.unsubscribe()
  }, [])

  const navItems = [
    { id: 'home', label: 'Home' },
    { id: 'my-docs', label: 'My Documents' },
    { id: 'quiz', label: 'Quiz' },
    { id: 'studyflow', label: 'Studyflow' },
    { id: 'wallet', label: 'Wallet' },
    { id: 'wallet-transactions', label: 'Wallet Transactions' },
    { id: 'settings', label: 'Settings' },
  ]

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="w-[260px] p-6 flex flex-col gap-[18px] bg-gradient-to-b from-white/2 to-white/1 border-r border-white/3 min-h-screen">
      <div className="flex gap-3 items-center">
        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-accent to-[#9ad4ff] flex items-center justify-center font-bold text-[#071129] text-lg">
          GF
        </div>
        <div>
          <h1 className="m-0 text-lg font-semibold">GrindFlow</h1>
          <p className="m-0 text-xs text-muted">Peer-powered study notes</p>
        </div>
      </div>

      <nav className="flex flex-col gap-2">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id)}
            className={`text-left px-2.5 py-2.5 rounded-[10px] border-none bg-transparent text-inherit cursor-pointer transition-colors ${
              activeView === item.id
                ? 'bg-accent/12 font-semibold'
                : 'hover:bg-white/5'
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-2">
        <div className="flex gap-2.5 items-center">
          <div className="w-10 h-10 rounded-[10px] bg-[#10213a] flex items-center justify-center font-bold">
            {userEmail.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="text-sm font-medium">{userEmail}</div>
            <small className="text-xs text-muted">Coins: {userCoins.toFixed(2)}</small>
          </div>
        </div>
        <button onClick={handleLogout} className="btn-ghost text-sm">
          Logout
        </button>
      </div>
    </aside>
  )
}

