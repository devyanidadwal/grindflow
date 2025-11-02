'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import { motion } from 'framer-motion'
import { extractMentions, renderMessageWithMentions } from '@/lib/mentions'

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
  
  // Mention autocomplete states
  const [mentionSuggestions, setMentionSuggestions] = useState<Array<{ id: string; username: string }>>([])
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionIndex, setMentionIndex] = useState(0)
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0)
  const messageInputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return
      if (data?.session) {
        // Check if user has username
        const sessionToken = data.session.access_token
        try {
          const res = await fetch('/api/user/check-username', {
            headers: { Authorization: `Bearer ${sessionToken}` },
          })
          if (res.ok) {
            const { hasUsername, username: profileUsername } = await res.json()
            if (!hasUsername) {
              router.replace('/onboarding')
              return
            }
            // Set username from profile
            setIsAuthenticated(true)
            setUserId(data.session.user?.id || '')
            setUserEmail(profileUsername || data.session.user?.email?.split('@')[0] || 'User')
          } else {
            router.replace('/onboarding')
            return
          }
        } catch (e) {
          console.error('[CHAT] Check username error:', e)
          router.replace('/onboarding')
          return
        }
      } else {
        router.replace('/')
      }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_e, session) => {
      if (!mounted) return
      if (session) {
        // Check if user has username
        const sessionToken = session.access_token
        try {
          const res = await fetch('/api/user/check-username', {
            headers: { Authorization: `Bearer ${sessionToken}` },
          })
          if (res.ok) {
            const { hasUsername, username: profileUsername } = await res.json()
            if (!hasUsername) {
              router.replace('/onboarding')
              return
            }
            // Set username from profile
            setIsAuthenticated(true)
            setUserId(session.user?.id || '')
            setUserEmail(profileUsername || session.user?.email?.split('@')[0] || 'User')
          } else {
            router.replace('/onboarding')
            return
          }
        } catch (e) {
          console.error('[CHAT] Check username error:', e)
          router.replace('/onboarding')
          return
        }
      } else {
        router.replace('/')
      }
    })
    return () => { mounted = false; subscription.unsubscribe() }
  }, [router])

  // Fetch username suggestions when @ is typed
  useEffect(() => {
    async function fetchSuggestions() {
      if (!mentionQuery || mentionQuery.length === 0) {
        setMentionSuggestions([])
        setShowMentionSuggestions(false)
        return
      }

      try {
        const { data: sessionData } = await supabase.auth.getSession()
        const token = sessionData.session?.access_token
        if (!token) return

        const res = await fetch(`/api/chat/search-usernames?q=${encodeURIComponent(mentionQuery)}&limit=5`, {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (res.ok) {
          const { usernames } = await res.json()
          setMentionSuggestions(usernames || [])
          setShowMentionSuggestions(usernames && usernames.length > 0)
          setSelectedMentionIndex(0)
        }
      } catch (e) {
        console.error('[CHAT] Fetch suggestions error:', e)
      }
    }

    const debounceTimer = setTimeout(fetchSuggestions, 200)
    return () => clearTimeout(debounceTimer)
  }, [mentionQuery])

  // Close suggestions when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (showMentionSuggestions && messageInputRef.current) {
        const target = event.target as Node
        if (!messageInputRef.current.contains(target)) {
          setShowMentionSuggestions(false)
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showMentionSuggestions])

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
        if (error !== null && (error.code === 'PGRST116' || 
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

      // Fetch usernames for all messages
      const userIds = [...new Set((data || []).map((m: any) => m.user_id))]
      const usernameMap: Record<string, string> = {}
      
      // Get current user username from profile
      const { data: sessionData } = await supabase.auth.getSession()
      if (sessionData.session?.user?.id) {
        try {
          const token = sessionData.session.access_token
          const res = await fetch('/api/user/check-username', {
            headers: { Authorization: `Bearer ${token}` },
          })
          if (res.ok) {
            const { username } = await res.json()
            if (username) {
              usernameMap[sessionData.session.user.id] = username
            }
          }
        } catch (e) {
          // Fallback to email username
          const email = sessionData.session.user.email || ''
          usernameMap[sessionData.session.user.id] = email ? email.split('@')[0] : 'You'
        }
      }

      // Fetch other usernames via API
      const allUserIds = userIds.filter(id => !usernameMap[id])
      if (allUserIds.length > 0) {
        try {
          const token = sessionData.session?.access_token
          const res = await fetch('/api/chat/users', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ user_ids: allUserIds }),
          })
          if (res.ok) {
            const { usernames } = await res.json()
            Object.assign(usernameMap, usernames)
          }
        } catch (e) {
          console.error('[CHAT] Fetch usernames error:', e)
        }
      }

      const formatted = (data || []).map((msg: any) => {
        // Get username from map, fallback to message user_email, then to 'Unknown'
        let displayName = usernameMap[msg.user_id]
        
        if (!displayName) {
          // Fallback: if user_email in message is still email, extract username
          displayName = msg.user_email || 'Unknown'
          if (displayName.includes('@')) {
            displayName = displayName.split('@')[0]
          }
        }
        
        return {
          id: msg.id,
          chatroom_id: msg.chatroom_id,
          user_id: msg.user_id,
          user_email: displayName,
          content: msg.content,
          created_at: msg.created_at,
        }
      })
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
            // Fetch username for the new message
            let displayName = payload.new.user_email || 'User'
            
            // If it's an email, try to fetch the actual username
            if (displayName.includes('@')) {
              try {
                const { data: sessionData } = await supabase.auth.getSession()
                const token = sessionData.session?.access_token
                if (token) {
                  const res = await fetch('/api/chat/users', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ user_ids: [payload.new.user_id] }),
                  })
                  if (res.ok) {
                    const { usernames } = await res.json()
                    displayName = usernames[payload.new.user_id] || displayName.split('@')[0]
                  } else {
                    displayName = displayName.split('@')[0]
                  }
                } else {
                  displayName = displayName.split('@')[0]
                }
              } catch (e) {
                displayName = displayName.split('@')[0]
              }
            }
            
            const newMsg: Message = {
              id: payload.new.id,
              chatroom_id: payload.new.chatroom_id,
              user_id: payload.new.user_id,
              user_email: displayName,
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

  function selectMention(username: string) {
    if (!messageInputRef.current) return
    
    const cursorPos = messageInputRef.current.selectionStart || 0
    const textBefore = newMessage.substring(0, mentionIndex)
    const textAfter = newMessage.substring(cursorPos)
    const newText = `${textBefore}@${username} ${textAfter}`
    
    setNewMessage(newText)
    setShowMentionSuggestions(false)
    setMentionQuery('')
    
    // Focus back on input and position cursor after the mention
    setTimeout(() => {
      if (messageInputRef.current) {
        const newCursorPos = mentionIndex + username.length + 2 // @username + space
        messageInputRef.current.focus()
        messageInputRef.current.setSelectionRange(newCursorPos, newCursorPos)
      }
    }, 0)
  }

  async function sendMessage() {
    if (!newMessage.trim() || !activeRoom || !userId || !userEmail) return

    const messageContent = newMessage.trim()
    const mentions = extractMentions(messageContent)

    try {
      // Ensure we're using the profile username (userEmail should already be the username from onboarding)
      // But double-check by fetching it if needed
      let displayUsername = userEmail
      
      // Verify it's actually a username and not an email-derived value
      if (displayUsername.includes('@')) {
        // If somehow it's still an email, fetch the actual username
        try {
          const { data: sessionData } = await supabase.auth.getSession()
          const token = sessionData.session?.access_token
          if (token) {
            const res = await fetch('/api/user/check-username', {
              headers: { Authorization: `Bearer ${token}` },
            })
            if (res.ok) {
              const { username } = await res.json()
              if (username) displayUsername = username
            }
          }
        } catch (e) {
          // Keep userEmail if fetch fails
        }
      }

      const { data: insertedData, error } = await supabase
        .from('chat_messages')
        .insert({
          chatroom_id: activeRoom,
          user_id: userId,
          user_email: displayUsername,
          content: messageContent,
        })
        .select('id')
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

      // Handle mentions if any
      if (mentions.length > 0 && insertedData?.id) {
        try {
          const { data: sessionData } = await supabase.auth.getSession()
          const token = sessionData.session?.access_token
          if (token) {
            await fetch('/api/chat/mentions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                mentions,
                messageId: insertedData.id,
                roomName: activeRoomData?.name || activeRoom,
                fromUsername: displayUsername,
              }),
            })
          }
        } catch (e) {
          console.error('[CHAT] Mention notification error:', e)
          // Don't fail message sending if mention notification fails
        }
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
    <div className="flex h-screen overflow-hidden">
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
      <div className="flex-1 flex flex-col bg-gradient-to-b from-[#0f1724] to-[#071029] h-screen overflow-hidden">
        <Header title="Chat" isAuthenticated={isAuthenticated} userEmail={userEmail} userId={userId} />
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* Sidebar with chatrooms */}
          <aside className="w-64 border-r border-white/10 bg-white/5 flex flex-col min-w-0">
            <div className="p-4 border-b border-white/10 flex-shrink-0">
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
            <div className="flex-1 overflow-y-auto p-2 space-y-1 min-h-0">
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
          <div className="flex-1 flex flex-col min-w-0">
            {activeRoom ? (
              <>
                {/* Chat header */}
                <div className="p-4 border-b border-white/10 bg-white/5 flex-shrink-0">
                  <h3 className="font-semibold">{activeRoomData?.name || 'Chat'}</h3>
                  <p className="text-xs text-muted">
                    {isPublicRoom ? 'Public chat - All users can see messages' : 'Private room'}
                  </p>
                </div>

                {/* Messages */}
                <div
                  ref={messagesContainerRef}
                  className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0"
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
                          <div className="text-sm">
                            {renderMessageWithMentions(msg.content).map((part, idx) => 
                              part.type === 'mention' ? (
                                <span key={idx} className="text-accent font-medium">
                                  {part.content}
                                </span>
                              ) : (
                                <span key={idx}>{part.content}</span>
                              )
                            )}
                          </div>
                          <div className="text-xs text-muted mt-1">
                            {new Date(msg.created_at).toLocaleTimeString()}
                          </div>
                        </div>
                      </motion.div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Message input - Fixed at bottom */}
                <div className="p-4 border-t border-white/10 bg-white/5 flex-shrink-0">
                  <div className="flex gap-2 relative">
                    <div className="relative flex-1">
                      <textarea
                        ref={messageInputRef}
                        placeholder="Type a message... Use @ to mention someone"
                        value={newMessage}
                        onChange={(e) => {
                          const value = e.target.value
                          setNewMessage(value)
                          
                          // Detect @mention pattern
                          const cursorPos = e.target.selectionStart || 0
                          const textBeforeCursor = value.substring(0, cursorPos)
                          const mentionMatch = textBeforeCursor.match(/@(\w*)$/)
                          
                          if (mentionMatch) {
                            const query = mentionMatch[1]
                            setMentionQuery(query)
                            setMentionIndex(cursorPos - query.length - 1) // Position of @
                            setShowMentionSuggestions(true)
                          } else {
                            setShowMentionSuggestions(false)
                            setMentionQuery('')
                          }
                        }}
                        onKeyDown={(e) => {
                          if (showMentionSuggestions && mentionSuggestions.length > 0) {
                            if (e.key === 'ArrowDown') {
                              e.preventDefault()
                              setSelectedMentionIndex((prev) => 
                                prev < mentionSuggestions.length - 1 ? prev + 1 : 0
                              )
                            } else if (e.key === 'ArrowUp') {
                              e.preventDefault()
                              setSelectedMentionIndex((prev) => 
                                prev > 0 ? prev - 1 : mentionSuggestions.length - 1
                              )
                            } else if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault()
                              if (mentionSuggestions[selectedMentionIndex]) {
                                selectMention(mentionSuggestions[selectedMentionIndex].username)
                              } else {
                                sendMessage()
                              }
                            } else if (e.key === 'Escape') {
                              setShowMentionSuggestions(false)
                            }
                          } else if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            sendMessage()
                          }
                        }}
                        onClick={() => {
                          // Hide suggestions when clicking outside the mention area
                          if (showMentionSuggestions) {
                            const cursorPos = messageInputRef.current?.selectionStart || 0
                            const textBeforeCursor = newMessage.substring(0, cursorPos)
                            const mentionMatch = textBeforeCursor.match(/@(\w*)$/)
                            if (!mentionMatch) {
                              setShowMentionSuggestions(false)
                            }
                          }
                        }}
                        className="input-field w-full text-sm resize-none"
                        rows={1}
                        style={{ minHeight: '40px', maxHeight: '120px' }}
                      />
                      
                      {/* Mention suggestions dropdown */}
                      {showMentionSuggestions && mentionSuggestions.length > 0 && (
                        <div className="absolute bottom-full left-0 mb-2 w-full max-w-xs bg-card border border-white/10 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                          {mentionSuggestions.map((user, idx) => (
                            <button
                              key={user.id}
                              onClick={() => selectMention(user.username)}
                              className={`w-full text-left px-4 py-2 hover:bg-white/10 transition-colors ${
                                idx === selectedMentionIndex ? 'bg-accent/20 text-accent' : ''
                              }`}
                            >
                              <div className="text-sm font-medium">@{user.username}</div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
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

