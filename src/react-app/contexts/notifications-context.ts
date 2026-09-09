import { createContext } from 'react'

import type { Notification } from './NotificationsContext'

export interface NotificationsContextType {
  notifications: Notification[]
  unreadCount: number
  isLoading: boolean
  fetchNotifications: () => Promise<void>
  markAsRead: (id: number) => Promise<void>
  markAllAsRead: () => Promise<void>
  deleteNotification: (id: number) => Promise<void>
  clearAllNotifications: () => Promise<void>
  addNotification: (notification: Notification) => void
}

export const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined)
