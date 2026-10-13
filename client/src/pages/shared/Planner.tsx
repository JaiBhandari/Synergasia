import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Calendar as CalendarIcon, Plus, Clock, Bell, Edit, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { format } from "date-fns";

const eventSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  startDate: z.date(),
  endDate: z.date().optional(),
  reminderCount: z.number().min(0).default(0),
  reminderInterval: z.enum(["minutes", "hours", "days"]).optional(),
  reminderIntervalValue: z.number().min(1).optional(),
}).refine((data) => {
  if (!data.reminderCount || !data.reminderInterval || !data.endDate || !data.reminderIntervalValue) {
    return true; // Skip validation if no reminders or no end date
  }
  
  // Calculate when the earliest reminder would be sent
  const now = new Date();
  const endDate = new Date(data.endDate);
  
  // Convert interval to minutes for calculation using actual user value
  let intervalInMinutes = data.reminderIntervalValue;
  switch (data.reminderInterval) {
    case 'minutes':
      // Already in minutes
      break;
    case 'hours':
      intervalInMinutes = data.reminderIntervalValue * 60;
      break;
    case 'days':
      intervalInMinutes = data.reminderIntervalValue * 60 * 24;
      break;
  }
  
  // Calculate the earliest reminder time (furthest back from end date)
  const earliestReminderTime = new Date(endDate.getTime() - (data.reminderCount * intervalInMinutes * 60 * 1000));
  
  return earliestReminderTime > now;
}, {
  message: "Reminders cannot be set in the past. Some of your reminders would be scheduled for times that have already passed. Please check your reminder count, interval value, and event end date.",
  path: ["reminderCount"]
});

export default function Planner() {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: events, isLoading } = useQuery({
    queryKey: ["/api/planner"],
  });

  const form = useForm<z.infer<typeof eventSchema>>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      title: "",
      description: "",
      startDate: selectedDate,
      reminderCount: 0,
      reminderInterval: "days",
      reminderIntervalValue: 1,
    },
  });

  const createEventMutation = useMutation({
    mutationFn: async (data: z.infer<typeof eventSchema>) => {
      await apiRequest("/api/planner", "POST", {
        ...data,
        startDate: data.startDate.toISOString(),
        endDate: data.endDate?.toISOString() || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/planner"] });
      setIsAddModalOpen(false);
      form.reset();
      toast({
        title: "Success",
        description: "Event created successfully",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest(`/api/planner/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/planner"] });
      toast({
        title: "Success",
        description: "Event deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateEventMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: z.infer<typeof eventSchema> }) => {
      await apiRequest(`/api/planner/${id}`, "PUT", {
        ...data,
        startDate: data.startDate.toISOString(),
        endDate: data.endDate?.toISOString() || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/planner"] });
      setIsEditModalOpen(false);
      setEditingEvent(null);
      form.reset();
      toast({
        title: "Success",
        description: "Event updated successfully",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof eventSchema>) => {
    createEventMutation.mutate(data);
  };

  const onEditSubmit = (data: z.infer<typeof eventSchema>) => {
    if (editingEvent) {
      updateEventMutation.mutate({ id: editingEvent.id, data });
    }
  };

  // Function to open modal and set form with selected date
  const openAddModal = () => {
    form.reset({
      title: "",
      description: "",
      startDate: selectedDate,
      reminderCount: 0,
    });
    setIsAddModalOpen(true);
  };

  // Function to open edit modal and set form with event data
  const handleEditEvent = (event: any) => {
    setEditingEvent(event);
    form.reset({
      title: event.title || "",
      description: event.description || "",
      startDate: new Date(event.startDate),
      endDate: event.endDate ? new Date(event.endDate) : undefined,
      reminderCount: event.reminderCount || 0,
      reminderInterval: event.reminderInterval || "days",
      reminderIntervalValue: event.reminderIntervalValue || 1,
    });
    setIsEditModalOpen(true);
  };

  // Filter events for selected date
  const selectedDateEvents = Array.isArray(events) ? events.filter((event: any) => {
    const eventDate = new Date(event.startDate);
    return eventDate.toDateString() === selectedDate.toDateString();
  }) : [];

  // Get upcoming events
  const upcomingEvents = Array.isArray(events) ? events.filter((event: any) => {
    const eventDate = new Date(event.startDate);
    return eventDate >= new Date();
  }).sort((a: any, b: any) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()) : [];

  // Extract event dates for calendar highlighting
  const eventDates = useMemo(() => {
    if (!Array.isArray(events)) return [];
    return events.map((event: any) => new Date(event.startDate));
  }, [events]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Planner</h1>
          <p className="text-gray-600">Manage your schedule and upcoming events</p>
        </div>
        
        <div className="flex items-center space-x-3">
          <div className="flex bg-gray-100 rounded-lg p-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setView("calendar")}
              className={view === "calendar" ? "bg-primary-500 text-white hover:bg-primary-600 shadow-sm" : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"}
            >
              Calendar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setView("list")}
              className={view === "list" ? "bg-primary-500 text-white hover:bg-primary-600 shadow-sm" : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"}
            >
              List
            </Button>
          </div>
          
          <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
            <DialogTrigger asChild>
              <Button 
                className="bg-primary-500 hover:bg-primary-600"
                onClick={openAddModal}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Event
              </Button>
            </DialogTrigger>
            
            <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Event</DialogTitle>
              </DialogHeader>
              
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pr-4">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Event Title *</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter event title" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Event description..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Date & Time *</FormLabel>
                        <FormControl>
                          <Input 
                            type="datetime-local" 
                            value={field.value ? format(field.value, "yyyy-MM-dd'T'HH:mm") : ""}
                            onChange={(e) => field.onChange(new Date(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="endDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Date & Time</FormLabel>
                        <FormControl>
                          <Input 
                            type="datetime-local" 
                            value={field.value ? format(field.value, "yyyy-MM-dd'T'HH:mm") : ""}
                            onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : undefined)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="reminderCount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Reminders</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              min="0" 
                              placeholder="0"
                              value={field.value}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="reminderInterval"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Interval</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="minutes">Minutes</SelectItem>
                              <SelectItem value="hours">Hours</SelectItem>
                              <SelectItem value="days">Days</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {(form.watch("reminderCount") || 0) > 0 && form.watch("reminderInterval") && (
                    <FormField
                      control={form.control}
                      name="reminderIntervalValue"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Interval Value ({form.watch("reminderInterval") === "minutes" ? "minutes" : 
                                            form.watch("reminderInterval") === "hours" ? "hours" : "days"} before event ends)
                          </FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              min="1"
                              max={form.watch("reminderInterval") === "minutes" ? "1440" : 
                                   form.watch("reminderInterval") === "hours" ? "168" : "30"}
                              placeholder={form.watch("reminderInterval") === "minutes" ? "30" : 
                                         form.watch("reminderInterval") === "hours" ? "2" : "3"}
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || undefined)}
                              data-testid="input-reminder-interval-value"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  
                  <div className="flex space-x-3 pt-4">
                    <Button 
                      type="button" 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => setIsAddModalOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      className="flex-1 bg-primary-500 hover:bg-primary-600"
                      disabled={createEventMutation.isPending}
                    >
                      {createEventMutation.isPending ? "Creating..." : "Create Event"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          {/* Edit Event Modal */}
          <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>            
            <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Event</DialogTitle>
              </DialogHeader>
              
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onEditSubmit)} className="space-y-4 pr-4">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Event Title *</FormLabel>
                        <FormControl>
                          <Input data-testid="input-title" placeholder="Enter event title" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea data-testid="input-description" placeholder="Event description..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Date & Time *</FormLabel>
                        <FormControl>
                          <Input 
                            data-testid="input-startdate"
                            type="datetime-local" 
                            value={field.value ? format(field.value, "yyyy-MM-dd'T'HH:mm") : ""}
                            onChange={(e) => field.onChange(new Date(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="endDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Date & Time</FormLabel>
                        <FormControl>
                          <Input 
                            data-testid="input-enddate"
                            type="datetime-local" 
                            value={field.value ? format(field.value, "yyyy-MM-dd'T'HH:mm") : ""}
                            onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : undefined)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="reminderCount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Reminders</FormLabel>
                          <FormControl>
                            <Input 
                              data-testid="input-reminder-count"
                              type="number" 
                              min="0" 
                              placeholder="0"
                              value={field.value}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="reminderInterval"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Interval</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-reminder-interval">
                                <SelectValue placeholder="Select" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="minutes">Minutes</SelectItem>
                              <SelectItem value="hours">Hours</SelectItem>
                              <SelectItem value="days">Days</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {(form.watch("reminderCount") || 0) > 0 && form.watch("reminderInterval") && (
                    <FormField
                      control={form.control}
                      name="reminderIntervalValue"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Interval Value ({form.watch("reminderInterval") === "minutes" ? "minutes" : 
                                            form.watch("reminderInterval") === "hours" ? "hours" : "days"} before event ends)
                          </FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              min="1"
                              max={form.watch("reminderInterval") === "minutes" ? "1440" : 
                                   form.watch("reminderInterval") === "hours" ? "168" : "30"}
                              placeholder={form.watch("reminderInterval") === "minutes" ? "30" : 
                                         form.watch("reminderInterval") === "hours" ? "2" : "3"}
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || undefined)}
                              data-testid="input-reminder-interval-value-edit"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  
                  <div className="flex space-x-3 pt-4">
                    <Button 
                      type="button" 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => setIsEditModalOpen(false)}
                      data-testid="button-cancel"
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      className="flex-1 bg-primary-500 hover:bg-primary-600"
                      disabled={updateEventMutation.isPending}
                      data-testid="button-update-event"
                    >
                      {updateEventMutation.isPending ? "Updating..." : "Update Event"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {view === "calendar" ? (
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          {/* Calendar - takes up 3/4 of the space */}
          <div className="xl:col-span-3 space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center space-x-2">
                    <CalendarIcon className="h-5 w-5" />
                    <span>Calendar</span>
                  </CardTitle>
                  <div className="flex items-center space-x-2 text-sm">
                    <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                    <span className="text-gray-600">Has Events</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  eventDates={eventDates}
                  className="rounded-md border w-full mx-auto"
                  classNames={{
                    months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0 w-full",
                    month: "space-y-4 w-full",
                    caption: "flex justify-center pt-1 relative items-center mb-4",
                    caption_label: "text-lg font-semibold",
                    table: "w-full border-collapse space-y-1",
                    head_row: "flex w-full",
                    head_cell: "text-muted-foreground rounded-md w-full font-medium text-sm p-3 text-center",
                    row: "flex w-full mt-2",
                    cell: "w-full text-center text-sm p-1 relative h-14",
                    day: "h-12 w-full p-0 font-normal aria-selected:opacity-100 text-sm hover:bg-accent hover:text-accent-foreground rounded-md transition-colors",
                    day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                    day_today: "bg-accent text-accent-foreground font-semibold",
                    day_outside: "day-outside text-muted-foreground aria-selected:bg-accent/50 aria-selected:text-muted-foreground opacity-50",
                    day_disabled: "text-muted-foreground opacity-30"
                  }}
                />
              </CardContent>
            </Card>
          </div>

          {/* Selected Date Events - takes up 1/4 of the space */}
          <Card className="xl:col-span-1">
            <CardHeader>
              <CardTitle>
                {format(selectedDate, "MMMM d, yyyy")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {selectedDateEvents.map((event: any) => (
                  <div key={event.id} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">{event.title}</h4>
                        {event.description && (
                          <p className="text-sm text-gray-600 mt-1">{event.description}</p>
                        )}
                        <div className="flex items-center space-x-2 mt-2">
                          <Clock className="h-4 w-4 text-gray-400" />
                          <span className="text-sm text-gray-600">
                            {format(new Date(event.startDate), "h:mm a")}
                            {event.endDate && ` - ${format(new Date(event.endDate), "h:mm a")}`}
                          </span>
                        </div>
                        {event.reminderCount > 0 && (
                          <div className="flex items-center space-x-2 mt-1">
                            <Bell className="h-4 w-4 text-blue-500" />
                            <span className="text-sm text-blue-600">
                              {event.reminderCount} reminder{event.reminderCount > 1 ? 's' : ''}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex space-x-1">
                        {!event.title.startsWith("Task Due:") && event.createdById === user?.id && (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleEditEvent(event)}
                            data-testid="button-edit-event"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                        {event.createdById === user?.id && (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => deleteEventMutation.mutate(event.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                
                {selectedDateEvents.length === 0 && (
                  <div className="text-center py-8">
                    <CalendarIcon className="mx-auto h-8 w-8 text-gray-400" />
                    <p className="text-sm text-gray-500 mt-2">No events scheduled</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        /* List View */
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Events</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {upcomingEvents.map((event: any) => (
                <div key={event.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                  <div className="flex items-center space-x-4">
                    <div className="text-center">
                      <div className="text-lg font-bold text-primary-600">
                        {format(new Date(event.startDate), "d")}
                      </div>
                      <div className="text-sm text-gray-500">
                        {format(new Date(event.startDate), "MMM")}
                      </div>
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">{event.title}</h3>
                      {event.description && (
                        <p className="text-sm text-gray-600">{event.description}</p>
                      )}
                      <div className="flex items-center space-x-4 mt-1">
                        <div className="flex items-center space-x-1">
                          <Clock className="h-4 w-4 text-gray-400" />
                          <span className="text-sm text-gray-600">
                            {format(new Date(event.startDate), "h:mm a")}
                          </span>
                        </div>
                        {event.reminderCount > 0 && (
                          <Badge variant="outline" className="text-blue-600">
                            <Bell className="h-3 w-3 mr-1" />
                            {event.reminderCount} reminder{event.reminderCount > 1 ? 's' : ''}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    {!event.title.startsWith("Task Due:") && event.createdById === user?.id && (
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleEditEvent(event)}
                        data-testid="button-edit-event"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                    {event.createdById === user?.id && (
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => deleteEventMutation.mutate(event.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              
              {upcomingEvents.length === 0 && (
                <div className="text-center py-12">
                  <CalendarIcon className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No upcoming events</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Create your first event to get started.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
