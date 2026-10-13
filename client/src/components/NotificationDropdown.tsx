import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Bell, Check, CheckCheck, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { apiRequest } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "@/hooks/useAuth";

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  relatedId?: number;
  student?: {
    id: number;
    user: {
      firstName: string;
      lastName: string;
    };
  };
}

interface NotificationDropdownProps {
  className?: string;
}

export default function NotificationDropdown({ className }: NotificationDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const previousNotificationsRef = useRef<Notification[]>([]);
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch notifications - reduced polling frequency to prevent database overload
  const { data: notifications = [], refetch } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    refetchInterval: 30000, // Refetch every 30 seconds (was 2s, causing DB overload)
    staleTime: 20000, // Cache for 20 seconds
    gcTime: 60000, // Keep in memory for 60 seconds
  });

  // Fetch unread count - reduced polling frequency to prevent database overload
  const { data: countData } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/count"],
    refetchInterval: 30000, // Refetch every 30 seconds (was 3s, causing DB overload)
    staleTime: 20000, // Cache for 20 seconds
    gcTime: 60000, // Keep in memory for 60 seconds
  });

  const unreadCount = countData?.count || 0;

  // Effect to invalidate caches when notifications change
  useEffect(() => {
    if (notifications.length > 0) {
      const previousNotifications = previousNotificationsRef.current;
      
      // Check if there are new message notifications
      const newMessageNotifications = notifications.filter(notification => 
        notification.type === 'message_received' &&
        !previousNotifications.some(prev => prev.id === notification.id)
      );

      // Check if there are new task assignment notifications
      const newTaskNotifications = notifications.filter(notification => 
        notification.type === 'task_assigned' &&
        !previousNotifications.some(prev => prev.id === notification.id)
      );

      // If we have new message notifications, invalidate messages cache
      if (newMessageNotifications.length > 0) {
        // Force immediate cache invalidation and refetch
        queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
        queryClient.refetchQueries({ queryKey: ["/api/messages"] });
        
        // Also invalidate conversation-specific caches by invalidating all message queries
        queryClient.invalidateQueries({ 
          predicate: (query) => {
            return Array.isArray(query.queryKey) && 
                   query.queryKey.length >= 1 && 
                   query.queryKey[0] === "/api/messages";
          }
        });
      }

      // If we have new task notifications, invalidate tasks cache
      if (newTaskNotifications.length > 0) {
        // Force immediate cache invalidation and refetch for tasks
        queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
        queryClient.refetchQueries({ queryKey: ["/api/tasks"] });
        
        // Also invalidate task-specific caches by invalidating all task queries
        queryClient.invalidateQueries({ 
          predicate: (query) => {
            return Array.isArray(query.queryKey) && 
                   query.queryKey.length >= 1 && 
                   query.queryKey[0] === "/api/tasks";
          }
        });
      }

      // For student users: Force task cache refresh whenever task-related notifications exist
      // This ensures cache stays fresh even if we miss the exact moment of notification creation
      if (user?.role === 'student') {
        const hasTaskNotifications = notifications.some(n => n.type === 'task_assigned');
        if (hasTaskNotifications) {
          // Invalidate task cache every time for students with task notifications
          queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
          queryClient.refetchQueries({ queryKey: ["/api/tasks"] });
        }
      }

      // Update the ref for next time
      previousNotificationsRef.current = [...notifications];
    }
  }, [notifications, user?.role]);

  // Mark notification as read
  const markAsReadMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/notifications/${id}/read`, "PUT"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/count"] });
    },
  });

  // Mark all as read
  const markAllAsReadMutation = useMutation({
    mutationFn: () => apiRequest("/api/notifications/read-all", "PUT"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/count"] });
    },
  });

  const handleMarkAsRead = (id: number) => {
    markAsReadMutation.mutate(id);
  };

  const handleMarkAllAsRead = () => {
    markAllAsReadMutation.mutate();
  };

  const handleNotificationClick = (notification: Notification) => {
    // Mark as read if not already read
    if (!notification.isRead) {
      handleMarkAsRead(notification.id);
    }
    
    // Handle navigation based on notification type
    if (notification.type === 'message_received') {
      setLocation('/student/dashboard');
      setIsOpen(false); // Close the dropdown
    } else if (notification.type === 'event_reminder') {
      // Navigate to student planner to view the event
      setLocation('/student/planner');
      setIsOpen(false); // Close the dropdown
    }
    // Add other navigation cases here as needed
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "activity_created":
      case "activity_updated":
      case "activity_completed":
        return "🏆";
      case "task_assigned":
      case "task_completed":
        return "📋";
      case "document_uploaded":
        return "📄";
      case "profile_updated":
        return "👤";
      case "message_received":
        return "💬";
      case "event_reminder":
        return "⏰";
      default:
        return "📢";
    }
  };

  const getNotificationColor = (type: string, isRead: boolean) => {
    const baseClasses = isRead ? "bg-gray-50 border-gray-200" : "bg-blue-50 border-blue-200";
    return baseClasses;
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className={`relative ${className}`}>
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Notifications</CardTitle>
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleMarkAllAsRead}
                  disabled={markAllAsReadMutation.isPending}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  <CheckCheck className="h-4 w-4 mr-1" />
                  Mark all read
                </Button>
              )}
            </div>
            {unreadCount > 0 && (
              <p className="text-sm text-gray-600">
                {unreadCount} unread notification{unreadCount !== 1 ? "s" : ""}
              </p>
            )}
          </CardHeader>
          <Separator />
          <CardContent className="p-0">
            <ScrollArea className="h-80">
              {notifications.length === 0 ? (
                <div className="p-6 text-center text-gray-500">
                  <Bell className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  <p>No notifications yet</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-4 border-l-4 transition-colors cursor-pointer hover:bg-gray-50 ${getNotificationColor(
                        notification.type,
                        notification.isRead
                      )}`}
                      onClick={() => handleNotificationClick(notification)}
                      data-testid={`notification-item-${notification.id}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="text-lg flex-shrink-0 mt-0.5">
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {notification.title}
                            </p>
                            {!notification.isRead && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleMarkAsRead(notification.id)}
                                disabled={markAsReadMutation.isPending}
                                className="ml-2 p-1 h-6 w-6"
                              >
                                <Check className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                            {notification.message}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <Clock className="h-3 w-3 text-gray-400" />
                            <p className="text-xs text-gray-400">
                              {formatDistanceToNow(new Date(notification.createdAt), {
                                addSuffix: true,
                              })}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </PopoverContent>
    </Popover>
  );
}