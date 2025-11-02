'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

interface Notification {
  id: string
  user_id: string
  type: 'mention'
  title: string
  message: string
  related_message_id?: string
  created_at: string
  read: boolean
}

interface NotificationBellProps {
  userId?: string
}

export default function NotificationBell({ userId }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [showDropdown, setShowDropdown] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!userId) {
      setNotifications([])
      setUnreadCount(0)
      return
    }

    // Load notifications
    loadNotifications()

    // Subscribe to new notifications (with error handling)
    let channel: any = null
    try {
      channel = supabase
        .channel(`notifications:${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            const newNotification = payload.new as Notification
            setNotifications((prev) => [newNotification, ...prev])
            setUnreadCount((prev) => prev + 1)
            // Play notification sound
            playNotificationSound()
            toast.info(`You were mentioned by ${newNotification.title}`)
          }
        )
        .subscribe()
    } catch (e) {
      console.warn('[NOTIFICATIONS] Realtime subscription failed, will use polling:', e)
      // Fallback to polling if Realtime fails
    }

    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [userId])

  async function loadNotifications() {
    if (!userId) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) {
        if (error.code === 'PGRST116' || 
            error.message?.includes('does not exist') || 
            error.message?.includes('Could not find the table') ||
            error.message?.includes('schema cache')) {
          // Table doesn't exist yet - show helpful message
          console.warn('[NOTIFICATIONS] Notifications table does not exist. Please run the notifications setup in database-schema.sql or see SETUP-NOTIFICATIONS.md')
          return
        }
        throw error
      }

      setNotifications(data || [])
      setUnreadCount((data || []).filter((n) => !n.read).length)
    } catch (e: any) {
      console.error('[NOTIFICATIONS] Load error:', e.message || e)
    } finally {
      setLoading(false)
    }
  }

  async function markAsRead(notificationId: string) {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId)

      if (error) throw error

      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
      )
      setUnreadCount((prev) => Math.max(0, prev - 1))
    } catch (e: any) {
      console.error('[NOTIFICATIONS] Mark read error:', e)
    }
  }

  async function markAllAsRead() {
    if (!userId) return
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', userId)
        .eq('read', false)

      if (error) throw error

      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
      setUnreadCount(0)
    } catch (e: any) {
      console.error('[NOTIFICATIONS] Mark all read error:', e)
    }
  }

  function playNotificationSound() {
    try {
      // Create a simple notification sound using Web Audio API
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)

      oscillator.frequency.value = 800
      oscillator.type = 'sine'

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2)

      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 0.2)
    } catch (e) {
      console.error('[NOTIFICATIONS] Sound error:', e)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="btn-ghost text-xl relative"
        title="Notifications"
      >
        🔔
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {showDropdown && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowDropdown(false)}
          />
          <div className="absolute right-0 top-full mt-2 w-80 bg-card border border-white/10 rounded-lg shadow-lg z-50 max-h-96 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="font-semibold text-sm">Notifications</h3>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-accent hover:text-accent/80"
                >
                  Mark all read
                </button>
              )}
            </div>
            <div className="overflow-y-auto flex-1">
              {loading ? (
                <div className="p-4 text-center text-muted text-sm">Loading...</div>
              ) : notifications.length === 0 ? (
                <div className="p-4 text-center text-muted text-sm">No notifications</div>
              ) : (
                <div className="divide-y divide-white/10">
                  {notifications.map((notif) => (
                    <div
                      key={notif.id}
                      onClick={() => {
                        if (!notif.read) markAsRead(notif.id)
                      }}
                      className={`p-4 cursor-pointer hover:bg-white/5 transition-colors ${
                        !notif.read ? 'bg-white/5' : ''
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <div className="flex-1">
                          <div className="text-sm font-medium">{notif.title}</div>
                          <div className="text-xs text-muted mt-1">{notif.message}</div>
                          <div className="text-xs text-muted mt-1">
                            {new Date(notif.created_at).toLocaleString()}
                          </div>
                        </div>
                        {!notif.read && (
                          <div className="w-2 h-2 bg-accent rounded-full mt-1" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

