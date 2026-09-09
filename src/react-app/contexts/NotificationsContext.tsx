import React, { useCallback, useEffect, useState } from 'react';
import { useApi, useAuth } from './auth-hooks';
import { NotificationsContext, type NotificationsContextType } from './notifications-context';

export interface Notification {
  id: number;
  user_id: number;
  school_id: number;
  title: string;
  message: string;
  notification_type: 'info' | 'success' | 'warning' | 'error';
  link_url?: string;
  is_read: boolean;
  read_at?: string;
  created_at: string;
}

const NotificationsProvider = ({ children }: { children: React.ReactNode }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const api = useApi();
  const { user, token } = useAuth();

  const fetchNotifications = useCallback(async () => {
    if (!user) return; // Don't fetch if no user
    try {
      setIsLoading(true);
      const response = await api(`/api/notifications`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch notifications');
      }

      const data = await response.json();
      setNotifications(data.data || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setIsLoading(false);
    }
  }, [api, user]);

  const markAsRead = useCallback(async (id: number) => {
    try {
      const response = await api(`/api/notifications/${id}/read`, {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error('Failed to mark notification as read');
      }

      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }, [api]);

  const markAllAsRead = useCallback(async () => {
    try {
      const response = await api(`/api/notifications/read-all`, {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error('Failed to mark all as read');
      }

      setNotifications(prev =>
        prev.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  }, [api]);

  const deleteNotification = useCallback(async (id: number) => {
    try {
      const response = await api(`/api/notifications/${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete notification');
      }

      setNotifications(prev => {
        const deleted = prev.find(n => n.id === id);
        if (deleted && !deleted.is_read) {
          setUnreadCount(prev => Math.max(0, prev - 1));
        }
        return prev.filter(n => n.id !== id);
      });
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  }, [api]);

  const clearAllNotifications = useCallback(async () => {
    try {
      const response = await api(`/api/notifications`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to clear notifications');
      }

      setNotifications([]);
      setUnreadCount(0);
    } catch (error) {
      console.error('Error clearing notifications:', error);
    }
  }, [api]);

  const addNotification = useCallback((notification: Notification) => {
    setNotifications(prev => [notification, ...prev]);
    if (!notification.is_read) {
      setUnreadCount(prev => prev + 1);
    }
  }, []);

  useEffect(() => {
    if (!user || !token) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    fetchNotifications();

    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications, user, token]);

  const value: NotificationsContextType = {
    notifications,
    unreadCount,
    isLoading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
    addNotification
  };

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
};

export { NotificationsProvider };
