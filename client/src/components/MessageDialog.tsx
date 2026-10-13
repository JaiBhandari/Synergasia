import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Send, MessageSquare, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { formatDate } from "@/lib/utils";
import type { InsertMessage, Message } from "@shared/schema";

// Form validation schema
const messageFormSchema = z.object({
  subject: z.string().min(1, "Subject is required").max(200, "Subject must be under 200 characters"),
  content: z.string().min(1, "Message content is required").max(5000, "Message must be under 5000 characters"),
});

type MessageFormData = z.infer<typeof messageFormSchema>;

interface MessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: number;
  studentName: string;
  studentUserId: string;
}

interface MessageWithSender extends Message {
  sender?: {
    firstName?: string;
    lastName?: string;
    email?: string;
  };
}

export default function MessageDialog({ 
  open, 
  onOpenChange, 
  studentId, 
  studentName, 
  studentUserId 
}: MessageDialogProps) {
  const [showHistory, setShowHistory] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<MessageFormData>({
    resolver: zodResolver(messageFormSchema),
    defaultValues: {
      subject: "",
      content: "",
    },
  });

  // Fetch messages between counselor and student
  const { data: messages, isLoading: messagesLoading } = useQuery({
    queryKey: ["/api/messages", studentUserId],
    queryFn: async () => {
      const response = await fetch(`/api/messages?limit=100`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
      const allMessages = await response.json();
      
      // Filter messages to only show conversation with this specific student
      return allMessages.filter((msg: MessageWithSender) => 
        msg.senderId === studentUserId || msg.receiverId === studentUserId
      );
    },
    enabled: open && showHistory,
  });

  // Send message mutation
  const sendMessage = useMutation({
    mutationFn: async (data: MessageFormData) => {
      const messageData: Omit<InsertMessage, "senderId"> = {
        receiverId: studentUserId,
        subject: data.subject,
        content: data.content,
        isRead: false,
      };
      
      return apiRequest("/api/messages", "POST", messageData);
    },
    onSuccess: () => {
      toast({
        title: "Message sent successfully",
        description: `Your message has been sent to ${studentName}`,
      });
      
      form.reset();
      
      // Invalidate both general messages cache and conversation-specific cache
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/messages", studentUserId] });
      
      // Close dialog or switch to history view
      setShowHistory(true);
    },
    onError: (error: any) => {
      console.error("Error sending message:", error);
      toast({
        title: "Failed to send message",
        description: error.message || "Please try again later",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: MessageFormData) => {
    sendMessage.mutate(data);
  };

  const handleClose = () => {
    form.reset();
    setShowHistory(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            {showHistory ? `Message History - ${studentName}` : `Send Message to ${studentName}`}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col min-h-0">
          {/* Toggle buttons */}
          <div className="flex gap-2 mb-4">
            <Button
              variant={!showHistory ? "default" : "outline"}
              size="sm"
              onClick={() => setShowHistory(false)}
              data-testid="button-compose-message"
            >
              <Send className="h-4 w-4 mr-2" />
              Compose
            </Button>
            <Button
              variant={showHistory ? "default" : "outline"}
              size="sm"
              onClick={() => setShowHistory(true)}
              data-testid="button-message-history"
            >
              <Clock className="h-4 w-4 mr-2" />
              History
            </Button>
          </div>

          <Separator className="mb-4" />

          {showHistory ? (
            // Message History View
            <div className="flex-1 flex flex-col min-h-0">
              <div className="mb-4">
                <h3 className="text-lg font-semibold">Message History</h3>
                <p className="text-sm text-gray-600">
                  Conversation with {studentName} • Showing up to 100 recent messages
                </p>
              </div>

              <div 
                className="flex-1 pr-4 overflow-y-auto h-[400px] min-h-[300px] custom-scrollbar" 
                data-testid="message-history-scroll"
              >
                {messagesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                  </div>
                ) : !messages || messages.length === 0 ? (
                  <div className="text-center py-8" data-testid="no-messages-state">
                    <MessageSquare className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No messages yet</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Start a conversation by composing a message.
                    </p>
                    <p className="mt-2 text-xs text-gray-400">
                      Up to 100 recent messages will be shown here.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((message: MessageWithSender) => (
                      <Card key={message.id} className="overflow-hidden" data-testid={`message-${message.id}`}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Badge variant={message.receiverId === studentUserId ? "default" : "secondary"}>
                                {message.receiverId === studentUserId ? "Sent" : "Received"}
                              </Badge>
                              {!message.isRead && message.receiverId !== studentUserId && (
                                <Badge variant="destructive" className="text-xs">Unread</Badge>
                              )}
                            </div>
                            <span className="text-xs text-gray-500" data-testid={`message-date-${message.id}`}>
                              {formatDate(message.createdAt)}
                            </span>
                          </div>
                          
                          <h4 className="font-medium text-sm mb-2" data-testid={`message-subject-${message.id}`}>
                            {message.subject}
                          </h4>
                          
                          <p className="text-sm text-gray-700 whitespace-pre-wrap" data-testid={`message-content-${message.id}`}>
                            {message.content}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            // Compose Message View
            <div className="flex-1">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="subject"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Subject *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Enter message subject..."
                            {...field}
                            data-testid="input-message-subject"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="content"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Message *</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Type your message here..."
                            className="min-h-[200px] resize-y"
                            {...field}
                            data-testid="textarea-message-content"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end gap-2 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleClose}
                      disabled={sendMessage.isPending}
                      data-testid="button-cancel-message"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={sendMessage.isPending}
                      data-testid="button-send-message"
                    >
                      {sendMessage.isPending ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" />
                          Send Message
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}