'use client'

import { useState, useEffect, useRef } from 'react'

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
  const pollRef = useRef<any>(null)

  useEffect(() => {
    if (!userId) {
      setNotifications([])
      setUnreadCount(0)
      return
    }

    loadNotifications()
    pollRef.current = setInterval(loadNotifications, 15000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [userId])

  async function loadNotifications() {
    setLoading(true)
    try {
      const res = await fetch('/api/notifications', { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      const rows: any[] = data.notifications || []
      const mapped: Notification[] = rows.map((r) => ({
        id: r.id,
        user_id: r.userId,
        type: r.type,
        title: r.title,
        message: r.message,
        related_message_id: r.relatedMessageId || undefined,
        created_at: r.createdAt,
        read: !!r.read,
      }))
      setNotifications(mapped)
      setUnreadCount(mapped.filter((n) => !n.read).length)
    } catch (e: any) {
      console.error('[NOTIFICATIONS] Load error:', e.message || e)
    } finally {
      setLoading(false)
    }
  }

  async function markAsRead(notificationId: string) {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: notificationId }),
      })
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
      )
      setUnreadCount((prev) => Math.max(0, prev - 1))
    } catch (e: any) {
      console.error('[NOTIFICATIONS] Mark read error:', e)
    }
  }

  async function markAllAsRead() {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      })
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
      setUnreadCount(0)
    } catch (e: any) {
      console.error('[NOTIFICATIONS] Mark all read error:', e)
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
