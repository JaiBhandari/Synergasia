import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, Mail, Clock, User, Send, ChevronDown, ChevronUp } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import type { Message } from "@shared/schema";

interface MessageWithSender extends Message {
  sender?: {
    firstName?: string;
    lastName?: string;
    email?: string;
  };
}

interface MessagesPanelProps {
  counselorId?: string;
  counselorName?: string;
}

export default function MessagesPanel({ counselorId, counselorName }: MessagesPanelProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [expandedMessages, setExpandedMessages] = useState<Set<number>>(new Set());

  // Fetch messages between student and counselor
  const { data: messages = [], isLoading, error } = useQuery({
    queryKey: ["/api/messages"],
    queryFn: async () => {
      const response = await fetch("/api/messages?limit=30", {
        credentials: "include",
      });
      if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
      const allMessages = await response.json();
      
      // Filter messages to only show conversation with counselor (if counselorId is available)
      if (counselorId) {
        return allMessages.filter((msg: MessageWithSender) => 
          msg.senderId === counselorId || msg.receiverId === counselorId
        );
      }
      
      // If no counselorId, return all messages (fallback)
      return allMessages;
    },
    enabled: !!user,
    refetchInterval: 5000, // Refetch every 5 seconds for real-time updates
    refetchIntervalInBackground: false, // Only when component is visible
  });

  // Mark message as read mutation
  const markAsRead = useMutation({
    mutationFn: async (messageId: number) => {
      return apiRequest(`/api/messages/${messageId}/read`, "PATCH", {});
    },
    onSuccess: () => {
      // Invalidate messages cache to refresh the list
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
    },
  });

  const handleMarkAsRead = (messageId: number, isRead: boolean | null) => {
    if (!isRead) {
      markAsRead.mutate(messageId);
    }
  };

  const toggleMessageExpansion = (messageId: number, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent triggering mark as read
    setExpandedMessages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  };

  const isMessageLong = (content: string) => {
    return content.length > 100 || content.split('\n').length > 2;
  };

  const formatDate = (dateString: string | Date | null) => {
    if (!dateString) return 'Unknown';
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid date';
    
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  if (isLoading) {
    return (
      <Card data-testid="messages-panel">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary-600" />
            Messages
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-3/4" data-testid={`message-skeleton-${i}`} />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card data-testid="messages-panel">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary-600" />
            Messages
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6" data-testid="messages-error-state">
            <Mail className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Unable to load messages</h3>
            <p className="mt-1 text-sm text-gray-500">
              There was an error loading your messages. Please try again later.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="messages-panel">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary-600" />
            Messages {counselorName && `with ${counselorName}`}
          </div>
          {messages.length > 0 && (
            <Badge variant="secondary" className="text-xs" data-testid="messages-count">
              {messages.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-4">
        {messages.length === 0 ? (
          <div className="text-center py-4" data-testid="no-messages-state">
            <MessageSquare className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No messages yet</h3>
            <p className="mt-1 text-sm text-gray-500">
              {counselorName 
                ? `Your conversation with ${counselorName} will appear here.`
                : 'Messages from your counselor will appear here.'
              }
            </p>
            <p className="mt-2 text-xs text-gray-400">
              Up to 30 recent messages will be shown.
            </p>
          </div>
        ) : (
          <div 
            className="max-h-48 overflow-y-auto custom-scrollbar" 
            data-testid="messages-scroll-area"
          >
            <div className="space-y-2">
              {messages.map((message: MessageWithSender) => {
                const isFromCounselor = message.senderId === counselorId;
                const isUnread = !message.isRead && isFromCounselor;
                const isExpanded = expandedMessages.has(message.id);
                const isLongMessage = isMessageLong(message.content);
                
                return (
                  <div
                    key={message.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors hover:bg-gray-50 ${
                      isUnread ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'
                    }`}
                    onClick={() => handleMarkAsRead(message.id, message.isRead)}
                    data-testid={`message-item-${message.id}`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                          {isFromCounselor ? (
                            <User className="h-3 w-3 text-primary-600" />
                          ) : (
                            <Send className="h-3 w-3 text-blue-600" />
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900" data-testid={`message-sender-${message.id}`}>
                            {isFromCounselor ? (counselorName || 'Counselor') : 'You'}
                          </span>
                          {isUnread && (
                            <Badge variant="destructive" className="text-xs" data-testid={`message-unread-${message.id}`}>
                              New
                            </Badge>
                          )}
                        </div>
                      </div>
                      <span className="text-xs text-gray-500" data-testid={`message-date-${message.id}`}>
                        {formatDate(message.createdAt)}
                      </span>
                    </div>
                    
                    <h4 className="text-sm font-medium text-gray-900 mb-1" data-testid={`message-subject-${message.id}`}>
                      {message.subject}
                    </h4>
                    
                    <div className="relative">
                      <p 
                        className={`text-sm text-gray-600 whitespace-pre-wrap ${
                          isLongMessage && !isExpanded ? 'line-clamp-2' : ''
                        }`} 
                        data-testid={`message-content-${message.id}`}
                      >
                        {message.content}
                      </p>
                      
                      {isLongMessage && (
                        <button
                          onClick={(e) => toggleMessageExpansion(message.id, e)}
                          className="mt-1 flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium transition-colors"
                          data-testid={`message-expand-toggle-${message.id}`}
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp className="h-3 w-3" />
                              Show less
                            </>
                          ) : (
                            <>
                              <ChevronDown className="h-3 w-3" />
                              Show more
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        
        {messages.length > 0 && (
          <div className="mt-4 pt-3 border-t border-gray-100">
            <p className="text-xs text-gray-500 text-center">
              Click on a message to mark it as read • Showing up to 30 recent messages
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}