'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import { motion } from 'framer-motion'

interface Message {
  id: string
  chatroom_id: string
  user_id: string
  user_email: string
  content: string
  created_at: string
}

interface Chatroom {
  id: string
  name: string
  is_private: boolean
  created_by: string
  created_at: string
  member_count?: number
}

export default function ChatPage() {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [userEmail, setUserEmail] = useState('')
  const [userId, setUserId] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [chatrooms, setChatrooms] = useState<Chatroom[]>([])
  const [activeRoom, setActiveRoom] = useState<string | null>(null)
  const [newMessage, setNewMessage] = useState('')
  const [newRoomName, setNewRoomName] = useState('')
  const [showCreateRoom, setShowCreateRoom] = useState(false)
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const publicRoomId = 'public'

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      if (data?.session) {
        setIsAuthenticated(true)
        setUserEmail(data.session.user?.email || '')
        setUserId(data.session.user?.id || '')
      } else {
        router.replace('/')
      }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!mounted) return
      if (session) {
        setIsAuthenticated(true)
        setUserEmail(session.user?.email || '')
        setUserId(session.user?.id || '')
      } else {
        router.replace('/')
      }
    })
    return () => { mounted = false; subscription.unsubscribe() }
  }, [router])

  useEffect(() => {
    if (!userId) return
    loadChatrooms()
    // Set public room as default
    setActiveRoom(publicRoomId)
  }, [userId])

  useEffect(() => {
    if (!activeRoom || !userId) return
    
    loadMessages(activeRoom)
    
    // Try to subscribe to realtime, fallback to polling if it fails
    let pollInterval: NodeJS.Timeout | null = null
    let cleanupRealtime: (() => void) | null = null
    
    // Try realtime subscription
    cleanupRealtime = subscribeToMessages(activeRoom)
    
    // Set up polling as fallback (always runs, but realtime will handle updates if available)
    // Poll every 3 seconds to check for new messages
    pollInterval = setInterval(() => {
      loadMessages(activeRoom)
    }, 3000)
    
    return () => {
      if (cleanupRealtime) cleanupRealtime()
      if (pollInterval) clearInterval(pollInterval)
    }
  }, [activeRoom, userId])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  async function loadChatrooms() {
    try {
      // Always add public room first
      const allRooms: Chatroom[] = []
      const publicRoom: Chatroom = {
        id: publicRoomId,
        name: 'Public Chat',
        is_private: false,
        created_by: '',
        created_at: new Date().toISOString(),
      }
      allRooms.push(publicRoom)

      // Try to load chatrooms (if table exists)
      // Load public rooms and rooms created by user
      const { data: publicRooms, error: publicError } = await supabase
        .from('chatrooms')
        .select('*')
        .eq('is_private', false)
        .order('created_at', { ascending: false })

      const { data: userRooms, error: userError } = await supabase
        .from('chatrooms')
        .select('*')
        .eq('created_by', userId)
        .order('created_at', { ascending: false })

      if (publicError || userError) {
        const error = publicError || userError
        // If table doesn't exist or RLS error, just use public room
        if (error && (error.code === 'PGRST116' || 
            error.message?.includes('does not exist') || 
            error.message?.includes('Could not find the table') ||
            error.message?.includes('schema cache'))) {
          console.warn('[CHAT] Chatrooms table does not exist yet. Please run database-schema.sql in Supabase SQL Editor')
          setChatrooms(allRooms)
          return
        }
        // For other errors, continue with what we have
      }

      // Combine results
      const data = [...(publicRooms || []), ...(userRooms || [])]
      // Remove duplicates
      const uniqueRooms = Array.from(new Map(data.map((r: any) => [r.id, r])).values())

      // Get user's private rooms
      const { data: memberRooms } = await supabase
        .from('chatroom_members')
        .select('chatroom_id, chatrooms(*)')
        .eq('user_id', userId)

      // Add other rooms
      uniqueRooms.forEach((room: any) => {
        if (room.id !== publicRoomId) {
          allRooms.push(room)
        }
      })

      // Add rooms from memberships
      if (memberRooms) {
        memberRooms.forEach((mr: any) => {
          if (mr.chatrooms && !allRooms.find(r => r.id === mr.chatroom_id)) {
            allRooms.push(mr.chatrooms)
          }
        })
      }

      setChatrooms(allRooms)
    } catch (e: any) {
      console.error('[CHAT] Load rooms error:', e.message || e)
      // Don't show error toast, just log it and show public room
      const publicRoom: Chatroom = {
        id: publicRoomId,
        name: 'Public Chat',
        is_private: false,
        created_by: '',
        created_at: new Date().toISOString(),
      }
      setChatrooms([publicRoom])
    }
  }

  async function loadMessages(roomId: string) {
    try {
      setLoading(true)
      // Load messages
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('chatroom_id', roomId)
        .order('created_at', { ascending: true })
        .limit(100)

      if (error) {
        // If table doesn't exist, just show empty messages
        if (error.code === 'PGRST116' || 
            error.message?.includes('does not exist') || 
            error.message?.includes('Could not find the table') ||
            error.message?.includes('schema cache')) {
          console.warn('[CHAT] Chat messages table does not exist yet. Please run database-schema.sql in Supabase SQL Editor')
          setMessages([])
          setLoading(false)
          return
        }
        throw error
      }

      // Fetch user emails for all messages
      const userIds = [...new Set((data || []).map((m: any) => m.user_id))]
      const emailMap: Record<string, string> = {}
      
      // Get current user email from session
      const { data: sessionData } = await supabase.auth.getSession()
      if (sessionData.session?.user?.id) {
        emailMap[sessionData.session.user.id] = sessionData.session.user.email || 'You'
      }

      // Fetch other user emails via API (optional - messages already have user_email)
      const otherUserIds = userIds.filter(id => id !== sessionData.session?.user?.id)
      if (otherUserIds.length > 0) {
        try {
          const token = sessionData.session?.access_token
          const res = await fetch('/api/chat/users', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ user_ids: otherUserIds }),
          })
          if (res.ok) {
            const { emails } = await res.json()
            Object.assign(emailMap, emails)
          }
        } catch (e) {
          // Silently fail - we can use user_email from message
        }
      }

      const formatted = (data || []).map((msg: any) => ({
        id: msg.id,
        chatroom_id: msg.chatroom_id,
        user_id: msg.user_id,
        user_email: msg.user_email || emailMap[msg.user_id] || 'Unknown',
        content: msg.content,
        created_at: msg.created_at,
      }))
      setMessages(prev => {
        // Merge with existing messages, avoiding duplicates
        const existingIds = new Set(prev.map(m => m.id))
        const newMessages = formatted.filter(m => !existingIds.has(m.id))
        return [...prev, ...newMessages].sort((a, b) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        )
      })
    } catch (e: any) {
      console.error('[CHAT] Load messages error:', e.message || e)
      // Don't show error toast for missing tables, just set empty on first load
      if (messages.length === 0) {
        setMessages([])
      }
    } finally {
      setLoading(false)
    }
  }

  function subscribeToMessages(roomId: string): (() => void) | null {
    try {
      const channel = supabase.channel(`chatroom:${roomId}`)
        .on('postgres_changes', 
          { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'chat_messages',
            filter: `chatroom_id=eq.${roomId}`
          }, 
          async (payload) => {
            const newMsg: Message = {
              id: payload.new.id,
              chatroom_id: payload.new.chatroom_id,
              user_id: payload.new.user_id,
              user_email: payload.new.user_email || 'User',
              content: payload.new.content,
              created_at: payload.new.created_at,
            }
            setMessages(prev => {
              // Avoid duplicates
              if (prev.find(m => m.id === newMsg.id)) return prev
              return [...prev, newMsg]
            })
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('[CHAT] Realtime subscription active')
          } else if (status === 'CHANNEL_ERROR') {
            console.warn('[CHAT] Realtime subscription error, will use polling')
          }
        })

      return () => {
        supabase.removeChannel(channel)
      }
    } catch (e) {
      console.warn('[CHAT] Failed to set up realtime subscription:', e)
      return null
    }
  }

  async function sendMessage() {
    if (!newMessage.trim() || !activeRoom || !userId || !userEmail) return

    try {
      const { error } = await supabase
        .from('chat_messages')
        .insert({
          chatroom_id: activeRoom,
          user_id: userId,
          user_email: userEmail,
          content: newMessage.trim(),
        })

      if (error) {
        if (error.code === 'PGRST116' || 
            error.message?.includes('does not exist') || 
            error.message?.includes('Could not find the table') ||
            error.message?.includes('schema cache')) {
          toast.error('Database tables not set up. Please run database-schema.sql in Supabase SQL Editor.')
          return
        }
        throw error
      }
      setNewMessage('')
    } catch (e: any) {
      console.error('[CHAT] Send message error:', e.message || e)
      toast.error(e.message || 'Failed to send message')
    }
  }

  async function createPrivateRoom() {
    if (!newRoomName.trim() || !userId) return

    try {
      const { data, error } = await supabase
        .from('chatrooms')
        .insert({
          name: newRoomName.trim(),
          is_private: true,
          created_by: userId,
        })
        .select()
        .single()

      if (error) {
        if (error.code === 'PGRST116' || 
            error.message?.includes('does not exist') || 
            error.message?.includes('Could not find the table') ||
            error.message?.includes('schema cache')) {
          toast.error('Database tables not set up. Please run database-schema.sql in Supabase SQL Editor.')
          return
        }
        throw error
      }

      // Add creator as member
      const { error: memberError } = await supabase
        .from('chatroom_members')
        .insert({
          chatroom_id: data.id,
          user_id: userId,
        })

      if (memberError && memberError.code !== 'PGRST116') {
        console.warn('Failed to add member, but room created:', memberError)
      }

      setNewRoomName('')
      setShowCreateRoom(false)
      setActiveRoom(data.id)
      loadChatrooms()
      toast.success('Private room created!')
    } catch (e: any) {
      console.error('[CHAT] Create room error:', e.message || e)
      toast.error(e.message || 'Failed to create room')
    }
  }

  async function joinRoom(roomId: string) {
    if (!userId || roomId === publicRoomId) {
      setActiveRoom(roomId)
      return
    }

    try {
      // Check if already a member
      const { data: existing } = await supabase
        .from('chatroom_members')
        .select('id')
        .eq('chatroom_id', roomId)
        .eq('user_id', userId)
        .single()

      if (!existing) {
        // Join the room
        const { error } = await supabase
          .from('chatroom_members')
          .insert({
            chatroom_id: roomId,
            user_id: userId,
          })

        if (error) throw error
        toast.success('Joined room!')
      }

      setActiveRoom(roomId)
    } catch (e: any) {
      console.error('[CHAT] Join room error:', e)
      toast.error('Failed to join room')
    }
  }

  const activeRoomData = chatrooms.find(r => r.id === activeRoom)
  const isPublicRoom = activeRoom === publicRoomId

  if (!isAuthenticated) {
    return null
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar
        activeView="chat"
        onViewChange={(view) => {
          if (view === 'explore') {
            router.push('/explore')
          } else if (view !== 'chat') {
            router.push(`/dashboard?view=${view}`)
          }
        }}
        username={userEmail || 'User'}
      />
      <div className="flex-1 flex flex-col bg-gradient-to-b from-[#0f1724] to-[#071029]">
        <Header title="Chat" isAuthenticated={isAuthenticated} userEmail={userEmail} />
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar with chatrooms */}
          <aside className="w-64 border-r border-white/10 bg-white/5 flex flex-col">
            <div className="p-4 border-b border-white/10">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold">Chatrooms</h2>
                <button
                  onClick={() => setShowCreateRoom(!showCreateRoom)}
                  className="btn-secondary text-xs px-2 py-1"
                  title="Create private room"
                >
                  +
                </button>
              </div>
              {showCreateRoom && (
                <div className="mb-3 space-y-2">
                  <input
                    type="text"
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    placeholder="Room name"
                    className="input-field w-full text-sm"
                    onKeyPress={(e) => e.key === 'Enter' && createPrivateRoom()}
                  />
                  <div className="flex gap-2">
                    <button onClick={createPrivateRoom} className="btn-primary text-xs flex-1">
                      Create
                    </button>
                    <button onClick={() => setShowCreateRoom(false)} className="btn-ghost text-xs">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {chatrooms.map((room) => (
                <button
                  key={room.id}
                  onClick={() => joinRoom(room.id)}
                  className={`w-full text-left p-2 rounded-lg transition-colors ${
                    activeRoom === room.id
                      ? 'bg-accent/20 text-accent'
                      : 'hover:bg-white/5 text-white/70'
                  }`}
                >
                  <div className="font-medium text-sm truncate">{room.name}</div>
                  <div className="text-xs text-muted mt-0.5">
                    {room.is_private ? 'Private' : 'Public'}
                  </div>
                </button>
              ))}
            </div>
          </aside>

          {/* Main chat area */}
          <div className="flex-1 flex flex-col">
            {activeRoom ? (
              <>
                {/* Chat header */}
                <div className="p-4 border-b border-white/10 bg-white/5">
                  <h3 className="font-semibold">{activeRoomData?.name || 'Chat'}</h3>
                  <p className="text-xs text-muted">
                    {isPublicRoom ? 'Public chat - All users can see messages' : 'Private room'}
                  </p>
                </div>

                {/* Messages */}
                <div
                  ref={messagesContainerRef}
                  className="flex-1 overflow-y-auto p-4 space-y-3"
                >
                  {loading && messages.length === 0 ? (
                    <div className="text-center text-muted">Loading messages...</div>
                  ) : messages.length === 0 ? (
                    <div className="text-center text-muted mt-8">
                      No messages yet. Start the conversation!
                    </div>
                  ) : (
                    messages.map((msg) => (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex ${msg.user_id === userId ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[70%] rounded-lg p-3 ${
                            msg.user_id === userId
                              ? 'bg-accent/20 text-right'
                              : 'bg-white/5 text-left'
                          }`}
                        >
                          {msg.user_id !== userId && (
                            <div className="text-xs font-medium text-accent mb-1">
                              {msg.user_email}
                            </div>
                          )}
                          <div className="text-sm">{msg.content}</div>
                          <div className="text-xs text-muted mt-1">
                            {new Date(msg.created_at).toLocaleTimeString()}
                          </div>
                        </div>
                      </motion.div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Message input */}
                <div className="p-4 border-t border-white/10 bg-white/5">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                      placeholder="Type a message..."
                      className="input-field flex-1"
                    />
                    <button onClick={sendMessage} className="btn-primary" disabled={!newMessage.trim()}>
                      Send
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted">
                Select a chatroom to start chatting
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

