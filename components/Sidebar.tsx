'use client'

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'

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
    // Non-blocking auth check
    supabase.auth.getSession().then(({ data }) => {
      const email = data?.session?.user?.email
      if (email) {
        setUserEmail(email)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      const email = session?.user?.email
      if (email) {
        setUserEmail(email)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const navItems = useMemo(() => ([
    { id: 'home', label: 'Home', icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 12l9-9 9 9" />
        <path d="M9 21V9h6v12" />
      </svg>
    ) },
    { id: 'my-docs', label: 'My Documents', icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
      </svg>
    ) },
    { id: 'quiz', label: 'Quiz', icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 7a3 3 0 1 1 6 0c0 2-3 3-3 5" />
        <path d="M12 17h.01" />
      </svg>
    ) },
    { id: 'studyflow', label: 'Studyflow', icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 7h18" />
        <path d="M5 7v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7" />
      </svg>
    ) },
    { id: 'explore', label: 'Explore', icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
    ) },
    { id: 'chat', label: 'Chat', icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ) },
    { id: 'settings', label: 'Settings', icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c0 .66.39 1.26 1 1.51.32.13.66.2 1.01.2H21a2 2 0 1 1 0 4h-.09c-.35 0-.69.07-1.01.2-.61.25-1 .85-1 1.51z" />
      </svg>
    ) },
  ]), [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
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
        {navItems.map((item) => {
          const isActive = activeView === item.id
          const handleClick = () => {
            if (item.id === 'explore') {
              router.push('/explore')
            } else if (item.id === 'chat') {
              router.push('/chat')
            } else {
              onViewChange(item.id)
            }
          }
          
          return (
            <motion.button
              key={item.id}
              onClick={handleClick}
              className={`group relative text-left px-3 py-2.5 rounded-[10px] border-none bg-transparent text-inherit cursor-pointer flex items-center gap-2 transition-colors ${
                isActive ? 'font-semibold' : ''
              }`}
              whileHover={{ x: 2 }}
            >
              <span className={`inline-flex items-center justify-center w-7 h-7 rounded-md ${isActive ? 'bg-accent/20 text-accent' : 'bg-white/5 text-white/70 group-hover:text-white'}`}>
                {item.icon}
              </span>
              <span className="truncate">{item.label}</span>
              {isActive && (
                <motion.span
                  layoutId="active-pill"
                  className="absolute inset-0 -z-10 rounded-[10px] bg-accent/12"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
            </motion.button>
          )
        })}
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

