// hooks/use-notifications.ts
import { useState, useEffect, useCallback } from 'react';

interface Notification {
  id: string;
  type: 'timesheet_extraction' | 'general' | 'task_update' | 'pto_update';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  action_url?: string;
  user_email: string;
  recipient_role?: 'employee' | 'manager' | 'all';
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => void;
  removeNotification: (notificationId: string) => void;
  createTimesheetExtractionNotification: (extractedBy: string) => void;
  loadNotifications: () => Promise<void>;
}

export const useNotifications = (currentUser: { role: string; username: string; email?: string }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  // Load notifications on component mount and set up polling
  useEffect(() => {
    if (currentUser?.email || currentUser?.username) {
      loadNotifications();
      // Poll for new notifications every 30 seconds
      const interval = setInterval(loadNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [currentUser]);

  // Update unread count when notifications change
  useEffect(() => {
    setUnreadCount(notifications.filter(n => !n.read).length);
  }, [notifications]);

  const loadNotifications = useCallback(async () => {
    if (!currentUser?.email && !currentUser?.username) return;
    
    setLoading(true);
    try {
      const userEmail = currentUser.email || currentUser.username;
      const response = await fetch(`/api/notifications?userEmail=${encodeURIComponent(userEmail)}&role=${currentUser.role}`);
      const data = await response.json();
      
      if (data.success && data.notifications) {
        const processedNotifications = data.notifications.map((n: any) => ({
          ...n,
          timestamp: new Date(n.timestamp)
        }));
        setNotifications(processedNotifications);
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  const addNotification = useCallback(async (notification: Omit<Notification, 'id' | 'timestamp' | 'read' | 'user_email'>) => {
    try {
      const userEmail = currentUser.email || currentUser.username;
      const response = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...notification,
          user_email: userEmail,
          timestamp: new Date().toISOString(),
          read: false
        })
      });

      if (response.ok) {
        // Reload notifications to get the latest data
        await loadNotifications();
      }
    } catch (error) {
      console.error('Error adding notification:', error);
    }
  }, [currentUser, loadNotifications]);

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const userEmail = currentUser.email || currentUser.username;
      const response = await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId, userEmail })
      });

      if (response.ok) {
        setNotifications(prev => 
          prev.map(notification =>
            notification.id === notificationId
              ? { ...notification, read: true }
              : notification
          )
        );
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }, [currentUser]);

  const markAllAsRead = useCallback(async () => {
    try {
      const userEmail = currentUser.email || currentUser.username;
      const response = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userEmail, role: currentUser.role })
      });

      if (response.ok) {
        // Remove all unread notifications from local state since they're deleted from DB
        setNotifications(prev => prev.filter(notification => notification.read));
      }
    } catch (error) {
      console.error('Error deleting all unread notifications:', error);
    }
  }, [currentUser]);

  const removeNotification = useCallback(async (notificationId: string) => {
    try {
      const userEmail = currentUser.email || currentUser.username;
      const response = await fetch(`/api/notifications?notificationId=${notificationId}&userEmail=${encodeURIComponent(userEmail)}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setNotifications(prev => prev.filter(n => n.id !== notificationId));
      }
    } catch (error) {
      console.error('Error removing notification:', error);
    }
  }, [currentUser]);

  // Specific method for timesheet extraction notifications
  const createTimesheetExtractionNotification = useCallback(async (extractedBy: string) => {
    // This is now handled by the backend API when extraction completes
    // But we can refresh notifications to get any new ones
    await loadNotifications();
  }, [loadNotifications]);

  // Method to broadcast notifications to all users (handled by backend)
  const broadcastNotification = useCallback(async (notification: Omit<Notification, 'id' | 'timestamp' | 'read' | 'user_email'>) => {
    try {
      // This would typically be handled by your backend API
      // For now, we'll add it as a local notification
      await addNotification(notification);
    } catch (error) {
      console.error('Error broadcasting notification:', error);
    }
  }, [addNotification]);

  return {
    notifications,
    unreadCount,
    loading,
    addNotification,
    markAsRead,
    markAllAsRead,
    removeNotification,
    createTimesheetExtractionNotification,
    broadcastNotification,
    loadNotifications,
  };
};