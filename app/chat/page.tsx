'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
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

  const { isLoaded, isSignedIn, user } = useUser()
  useEffect(() => {
    if (!isLoaded) return
    if (!isSignedIn) { router.replace('/'); return }
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/user/check-username', { cache: 'no-store' })
        if (cancelled) return
        if (res.ok) {
          const { hasUsername, username: profileUsername } = await res.json()
          if (!hasUsername) { router.replace('/onboarding'); return }
          setIsAuthenticated(true)
          setUserId(user?.id || '')
          const email = user?.primaryEmailAddress?.emailAddress || ''
          setUserEmail(profileUsername || (email ? email.split('@')[0] : (user?.username || 'User')))
        } else {
          router.replace('/onboarding')
        }
      } catch (e) {
        console.error('[CHAT] Check username error:', e)
        router.replace('/onboarding')
      }
    })()
    return () => { cancelled = true }
  }, [isLoaded, isSignedIn, user, router])

  // Fetch username suggestions when @ is typed
  useEffect(() => {
    async function fetchSuggestions() {
      if (!mentionQuery || mentionQuery.length === 0) {
        setMentionSuggestions([])
        setShowMentionSuggestions(false)
        return
      }

      try {
        const res = await fetch(`/api/chat/search-usernames?q=${encodeURIComponent(mentionQuery)}&limit=5`)

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
    const publicRoom: Chatroom = {
      id: publicRoomId,
      name: 'Public Chat',
      is_private: false,
      created_by: '',
      created_at: new Date().toISOString(),
    }
    try {
      const res = await fetch('/api/chat/rooms', { cache: 'no-store' })
      if (!res.ok) { setChatrooms([publicRoom]); return }
      const { rooms } = await res.json()
      const mapped: Chatroom[] = (rooms || []).map((r: any) => ({
        id: r.id,
        name: r.name,
        is_private: !!r.isPrivate,
        created_by: r.createdBy || '',
        created_at: r.createdAt,
      }))
      setChatrooms([publicRoom, ...mapped.filter((r) => r.id !== publicRoomId)])
    } catch (e: any) {
      console.error('[CHAT] Load rooms error:', e.message || e)
      setChatrooms([publicRoom])
    }
  }

  async function loadMessages(roomId: string) {
    try {
      setLoading(true)
      const res = await fetch(`/api/chat/messages?roomId=${encodeURIComponent(roomId)}`, { cache: 'no-store' })
      if (!res.ok) { setMessages([]); return }
      const { messages: rows } = await res.json()

      const userIds = Array.from(new Set((rows || []).map((m: any) => m.userId)))
      const usernameMap: Record<string, string> = {}
      if (userIds.length > 0) {
        try {
          const u = await fetch('/api/chat/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_ids: userIds }),
          })
          if (u.ok) {
            const { usernames } = await u.json()
            Object.assign(usernameMap, usernames)
          }
        } catch (e) {
          console.error('[CHAT] Fetch usernames error:', e)
        }
      }

      const formatted: Message[] = (rows || []).map((m: any) => {
        let displayName = usernameMap[m.userId] || m.userEmail || 'Unknown'
        if (displayName.includes('@')) displayName = displayName.split('@')[0]
        return {
          id: m.id,
          chatroom_id: m.chatroomId,
          user_id: m.userId,
          user_email: displayName,
          content: m.content,
          created_at: m.createdAt,
        }
      })
      setMessages((prev) => {
        const existingIds = new Set(prev.map((m) => m.id))
        const fresh = formatted.filter((m) => !existingIds.has(m.id))
        return [...prev, ...fresh].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        )
      })
    } catch (e: any) {
      console.error('[CHAT] Load messages error:', e.message || e)
      if (messages.length === 0) setMessages([])
    } finally {
      setLoading(false)
    }
  }

  function subscribeToMessages(_roomId: string): (() => void) | null {
    // Realtime replaced with polling (see poll interval in the effect above).
    return null
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
      const res = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: activeRoom, content: messageContent }),
      })
      if (!res.ok) {
        const t = await res.text()
        throw new Error(t || 'Failed to send message')
      }
      const { message: inserted } = await res.json()

      if (mentions.length > 0 && inserted?.id) {
        try {
          await fetch('/api/chat/mentions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              mentions,
              messageId: inserted.id,
              roomName: activeRoomData?.name || activeRoom,
              fromUsername: userEmail,
            }),
          })
        } catch (e) {
          console.error('[CHAT] Mention notification error:', e)
        }
      }

      setNewMessage('')
      // Optimistic reload will pick up via polling
      loadMessages(activeRoom)
    } catch (e: any) {
      console.error('[CHAT] Send message error:', e.message || e)
      toast.error(e.message || 'Failed to send message')
    }
  }

  async function createPrivateRoom() {
    if (!newRoomName.trim() || !userId) return
    try {
      const res = await fetch('/api/chat/create-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newRoomName.trim(), is_private: true }),
      })
      if (!res.ok) {
        const t = await res.text()
        throw new Error(t || 'Failed to create room')
      }
      const { room } = await res.json()
      setNewRoomName('')
      setShowCreateRoom(false)
      if (room?.id) setActiveRoom(room.id)
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
      const res = await fetch('/api/chat/rooms/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId }),
      })
      if (!res.ok) throw new Error('join failed')
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

