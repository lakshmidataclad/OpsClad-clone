import React, { useState } from 'react';
import { Bell, X, Check, Clock, FileText, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useNotifications } from '@/hooks/use-notifications';

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

interface NotificationInboxProps {
  currentUser: {
    id: string;
    role: string;
    username: string;
    email?: string;
  };
}

const NotificationInbox: React.FC<NotificationInboxProps> = ({ currentUser }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showAllModal, setShowAllModal] = useState(false);
  
  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    removeNotification,
    loadNotifications
  } = useNotifications(currentUser);

  const handleNotificationAction = (notification: Notification) => {
    if (!notification.read) {
      markAsRead(notification.id);
    }
    
    if (notification.action_url) {
      window.location.href = notification.action_url;
    }
    
    setIsOpen(false);
    setShowAllModal(false);
  };

  const handleMarkAsRead = (e: React.MouseEvent, notificationId: string) => {
    e.stopPropagation();
    markAsRead(notificationId);
  };

  const handleRemoveNotification = (e: React.MouseEvent, notificationId: string) => {
    e.stopPropagation();
    removeNotification(notificationId);
  };

  const handleMarkAllAsRead = () => {
    markAllAsRead();
  };

  const handleRefresh = async () => {
    await loadNotifications();
  };

  const handleViewAll = () => {
    setIsOpen(false);
    setShowAllModal(true);
  };

  const formatTime = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'timesheet_extraction':
        return <FileText className="w-4 h-4 text-blue-400" />;
      case 'task_update':
        return <Check className="w-4 h-4 text-green-400" />;
      case 'pto_update':
        return <Clock className="w-4 h-4 text-orange-400" />;
      default:
        return <Bell className="w-4 h-4 text-gray-400" />;
    }
  };

  const getNotificationTypeColor = (type: string, isRead: boolean) => {
    const baseColors = {
      timesheet_extraction: isRead ? 'border-l-blue-700' : 'border-l-blue-400',
      task_update: isRead ? 'border-l-green-700' : 'border-l-green-400',
      pto_update: isRead ? 'border-l-orange-700' : 'border-l-orange-400',
      general: isRead ? 'border-l-gray-700' : 'border-l-gray-400'
    };
    return baseColors[type as keyof typeof baseColors] || baseColors.general;
  };

  const renderNotificationItem = (notification: Notification) => (
    <div
      key={notification.id}
      className={`border-l-4 p-4 border-b border-gray-700 hover:bg-gray-750 transition-colors cursor-pointer ${
        !notification.read ? 'bg-gray-750/50' : ''
      } ${getNotificationTypeColor(notification.type, notification.read)}`}
      onClick={() => handleNotificationAction(notification)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3 flex-1">
          <div className="mt-1">
            {getNotificationIcon(notification.type)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className={`text-sm font-medium ${
                !notification.read ? 'text-white' : 'text-gray-300'
              }`}>
                {notification.title}
              </h4>
              {!notification.read && (
                <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
              )}
            </div>
            <p className="text-xs text-gray-400 mb-2 line-clamp-2">
              {notification.message}
            </p>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatTime(notification.timestamp)}
              </span>
              <div className="flex items-center gap-1">
                {!notification.read && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="p-1 h-6 text-gray-400 hover:text-green-400"
                    onClick={(e) => handleMarkAsRead(e, notification.id)}
                    title="Mark as read"
                  >
                    <Check className="w-3 h-3" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="p-1 h-6 text-gray-400 hover:text-red-400"
                  onClick={(e) => handleRemoveNotification(e, notification.id)}
                  title="Remove notification"
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="relative">
      {/* Notification Bell Button */}
      <Button
        variant="ghost"
        className="relative p-2 text-red-500 hover:text-red-500 hover:bg-gray-700"
        onClick={() => setIsOpen(!isOpen)}
        disabled={loading}
      >
        {loading ? (
          <RefreshCw className="w-5 h-5 animate-spin" />
        ) : (
          <Bell className="w-5 h-5" />
        )}
        {unreadCount > 0 && (
          <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center p-0 min-w-[20px]">
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
      </Button>

      {/* Notification Dropdown */}
      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          
          <Card className="absolute right-0 top-full mt-2 w-80 max-h-96 bg-gray-900 border-gray-950 shadow-xl z-50">
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <div className="flex items-center gap-2">
                <h3 className="text-white font-medium">Notifications</h3>
                {unreadCount > 0 && (
                  <Badge variant="secondary" className="bg-red-500/20 text-red-400 text-xs">
                    {unreadCount}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="p-1 text-gray-400 hover:text-white"
                  onClick={handleRefresh}
                  disabled={loading}
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
                {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-blue-400 hover:text-blue-300 px-2"
                    onClick={handleMarkAllAsRead}
                  >
                    Mark all read
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="p-1 text-gray-400 hover:text-white"
                  onClick={() => setIsOpen(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="max-h-64 overflow-y-auto">
              {loading && notifications.length === 0 ? (
                <div className="p-4 text-center text-gray-400">
                  <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin opacity-50" />
                  <p className="text-sm">Loading notifications...</p>
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-4 text-center text-gray-400">
                  <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No notifications</p>
                </div>
              ) : (
                notifications.slice(0, 5).map((notification) => renderNotificationItem(notification))
              )}
            </div>

            {notifications.length > 0 && (
              <div className="p-3 border-t border-gray-700">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs text-gray-400 hover:text-white"
                  onClick={handleViewAll}
                >
                  View all notifications
                </Button>
              </div>
            )}
          </Card>
        </>
      )}

      {/* Full Notifications Modal */}
      {showAllModal && (
        <>
          <div 
            className="fixed inset-0 bg-black/70 z-50" 
            onClick={() => setShowAllModal(false)}
          />
          
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-3xl max-h-[85vh] bg-gray-900 border-gray-950 shadow-2xl flex flex-col">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-700 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <Bell className="w-6 h-6 text-red-500" />
                  <div>
                    <h2 className="text-xl font-semibold text-white">All Notifications</h2>
                    {unreadCount > 0 && (
                      <p className="text-sm text-gray-400 mt-1">
                        {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-gray-400 hover:text-white"
                    onClick={handleRefresh}
                    disabled={loading}
                  >
                    <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                  </Button>
                  {unreadCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-sm text-blue-400 hover:text-blue-300"
                      onClick={handleMarkAllAsRead}
                    >
                      Mark all read
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-gray-400 hover:text-white"
                    onClick={() => setShowAllModal(false)}
                  >
                    <X className="w-6 h-6" />
                  </Button>
                </div>
              </div>

              {/* Modal Content - Scrollable */}
              <div className="flex-1 overflow-y-auto">
                {loading && notifications.length === 0 ? (
                  <div className="p-8 text-center text-gray-400">
                    <RefreshCw className="w-12 h-12 mx-auto mb-4 animate-spin opacity-50" />
                    <p className="text-lg">Loading notifications...</p>
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="p-8 text-center text-gray-400">
                    <Bell className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg">No notifications</p>
                    <p className="text-sm mt-2">You're all caught up!</p>
                  </div>
                ) : (
                  notifications.map((notification) => renderNotificationItem(notification))
                )}
              </div>

              {/* Modal Footer */}
              {notifications.length > 0 && (
                <div className="p-4 border-t border-gray-700 flex-shrink-0 text-center text-sm text-gray-400">
                  Showing {notifications.length} notification{notifications.length !== 1 ? 's' : ''}
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationInbox;