import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon, Plus, Clock, User, Search, CalendarDays, Trash2, Users, Edit, Bell, List, CheckCircle2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const eventSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  startDate: z.date(),
  endDate: z.date().optional(),
  reminderCount: z.number().min(0).optional(),
  reminderInterval: z.string().optional(),
});

export default function AdminPlanner() {
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: students } = useQuery({
    queryKey: ["/api/students"],
  });

  const { data: events, isLoading: eventsLoading } = useQuery({
    queryKey: selectedStudentId ? [`/api/students/${selectedStudentId}/planner`] : ["no-student"],
    enabled: !!selectedStudentId,
  });

  const filteredStudents = Array.isArray(students) ? students.filter((student: any) =>
    `${student.user?.firstName} ${student.user?.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())
  ) : [];

  const selectedStudent = Array.isArray(students) ? students.find((student: any) => student.adminStudentId === selectedStudentId) : null;

  const form = useForm<z.infer<typeof eventSchema>>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      title: "",
      description: "",
      startDate: selectedDate,
      reminderCount: 0,
      reminderInterval: "days",
    },
  });

  const createEventMutation = useMutation({
    mutationFn: async (data: z.infer<typeof eventSchema>) => {
      if (!selectedStudentId) throw new Error("No student selected");
      
      await apiRequest(`/api/students/${selectedStudentId}/planner`, "POST", {
        ...data,
        startDate: data.startDate.toISOString(),
        endDate: data.endDate?.toISOString() || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/students/${selectedStudentId}/planner`] });
      setIsAddModalOpen(false);
      form.reset();
      toast({
        title: "Success",
        description: "Event created successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create event",
        variant: "destructive",
      });
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest(`/api/students/${selectedStudentId}/planner/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/students/${selectedStudentId}/planner`] });
      toast({
        title: "Success",
        description: "Event deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete event",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof eventSchema>) => {
    createEventMutation.mutate(data);
  };

  // Function to open modal and set form with selected date
  const openAddModal = () => {
    form.reset({
      title: "",
      description: "",
      startDate: selectedDate,
      reminderCount: 0,
      reminderInterval: "days",
    });
    setIsAddModalOpen(true);
  };

  // Filter events for selected date
  const selectedDateEvents = Array.isArray(events) ? events.filter((event: any) => {
    const eventDate = new Date(event.startDate);
    return (
      eventDate.getDate() === selectedDate.getDate() &&
      eventDate.getMonth() === selectedDate.getMonth() &&
      eventDate.getFullYear() === selectedDate.getFullYear()
    );
  }) : [];

  // Sort events by date
  const sortedEvents = Array.isArray(events) ? [...events].sort((a: any, b: any) => 
    new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
  ) : [];

  const upcomingEvents = sortedEvents.filter((event: any) => 
    new Date(event.startDate) >= new Date()
  );

  // Get dates that have events for highlighting
  const eventDates = Array.isArray(events) ? events.map((event: any) => {
    const eventDate = new Date(event.startDate);
    return new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
  }) : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Student Planner Management</h1>
          <p className="text-gray-600">Manage academic schedules for your students</p>
        </div>
        {selectedStudentId && (
          <div className="flex gap-2">
            <Select value={view} onValueChange={(value: "calendar" | "list") => setView(value)}>
              <SelectTrigger className="w-[180px]" data-testid="select-view">
                <SelectValue placeholder="Select view" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="calendar">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4" />
                    Calendar View
                  </div>
                </SelectItem>
                <SelectItem value="list">
                  <div className="flex items-center gap-2">
                    <List className="w-4 h-4" />
                    List View
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
              <DialogTrigger asChild>
                <Button onClick={openAddModal} data-testid="button-add-event">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Event
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Add Event for {selectedStudent?.user?.firstName}</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pr-4">
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Title *</FormLabel>
                          <FormControl>
                            <Input placeholder="Event title" {...field} data-testid="input-event-title" />
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
                            <Textarea placeholder="Event description" {...field} data-testid="input-event-description" />
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
                          <FormLabel>Start Date *</FormLabel>
                          <FormControl>
                            <Input
                              type="datetime-local"
                              {...field}
                              value={field.value ? new Date(field.value.getTime() - field.value.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ""}
                              onChange={(e) => field.onChange(new Date(e.target.value))}
                              data-testid="input-start-date"
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
                          <FormLabel>End Date</FormLabel>
                          <FormControl>
                            <Input
                              type="datetime-local"
                              {...field}
                              value={field.value ? new Date(field.value.getTime() - field.value.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ""}
                              onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : undefined)}
                              data-testid="input-end-date"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="reminderCount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Number of Reminders</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                              data-testid="input-reminder-count"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {(form.watch("reminderCount") || 0) > 0 && (
                      <FormField
                        control={form.control}
                        name="reminderInterval"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Reminder Interval</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-reminder-interval">
                                  <SelectValue placeholder="Select interval" />
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
                    )}

                    <div className="flex justify-end space-x-2">
                      <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)} data-testid="button-cancel">
                        Cancel
                      </Button>
                      <Button type="submit" disabled={createEventMutation.isPending} data-testid="button-create-event">
                        {createEventMutation.isPending ? "Creating..." : "Create Event"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      {/* Student Selection - Moved below header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Select Student
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-center">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search students..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-search-students"
              />
            </div>
            
            {selectedStudentId && selectedStudent && (
              <div className="flex items-center gap-2 px-3 py-2 bg-primary-50 border border-primary-200 rounded-lg">
                <User className="w-4 h-4 text-primary-600" />
                <span className="font-medium text-primary-800">
                  {selectedStudent.user?.firstName} {selectedStudent.user?.lastName}
                </span>
                <Badge variant="secondary" className="ml-2">ID: STU-{selectedStudent.adminStudentId}</Badge>
              </div>
            )}
          </div>
          
          {Array.isArray(students) && students.length > 0 && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 max-h-48 overflow-y-auto">
              {filteredStudents.map((student: any) => (
                <div
                  key={student.id}
                  onClick={() => setSelectedStudentId(student.adminStudentId)}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedStudentId === student.adminStudentId
                      ? "bg-primary-50 border-primary-500"
                      : "hover:bg-gray-50 border-gray-200"
                  }`}
                  data-testid={`student-card-${student.adminStudentId}`}
                >
                  <div className="font-medium">
                    {student.user?.firstName} {student.user?.lastName}
                  </div>
                  <div className="text-sm text-gray-500">
                    Student ID: STU-{student.adminStudentId}
                  </div>
                  <div className="text-xs text-gray-400 truncate">
                    {student.user?.email}
                  </div>
                </div>
              ))}
              
              {filteredStudents.length === 0 && (
                <div className="col-span-full text-center text-gray-500 py-4">
                  No students found
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Main Content Area */}
        {!selectedStudentId ? (
          <Card className="lg:col-span-3">
            <CardContent className="h-96 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <User className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>Select a student to view their planner</p>
                <p className="text-sm mt-2">Search for a student above to get started</p>
              </div>
            </CardContent>
          </Card>
        ) : view === "calendar" ? (
          <>
            {/* Calendar View - Optimized size */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center space-x-2">
                  <CalendarIcon className="h-5 w-5" />
                  <span>{selectedStudent?.user?.firstName}'s Calendar</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {eventsLoading ? (
                  <div className="h-80 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
                  </div>
                ) : (
                  <div className="flex justify-center">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => date && setSelectedDate(date)}
                      className="rounded-md border"
                      modifiers={{
                        hasEvent: eventDates,
                      }}
                      modifiersStyles={{
                        hasEvent: {
                          color: '#fb923c',
                          fontWeight: 'bold',
                        },
                      }}
                      data-testid="calendar-view"
                    />
                  </div>
                )}
                
                {/* Legend for calendar */}
                {eventDates.length > 0 && (
                  <div className="mt-4 flex items-center justify-center gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-orange-400 rounded"></div>
                      <span className="text-gray-600">Has Events</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Selected Date Events - Optimized layout */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">
                  {format(selectedDate, "MMMM d, yyyy")}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {selectedDateEvents.length === 0 ? (
                    <div className="text-center text-gray-500 py-6">
                      <CalendarIcon className="w-6 h-6 mx-auto mb-2 text-gray-300" />
                      <p className="text-sm">No events on this date</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        onClick={openAddModal}
                        data-testid="button-add-event-empty"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Add Event
                      </Button>
                    </div>
                  ) : (
                    selectedDateEvents.map((event: any) => (
                      <div key={event.id} className="p-3 bg-gray-50 rounded-lg border" data-testid={`event-card-${event.id}`}>
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
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteEventMutation.mutate(event.id)}
                            className="text-red-600 hover:text-red-700"
                            data-testid={`button-delete-event-${event.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          /* List View */
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <List className="w-5 h-5" />
                All Events for {selectedStudent?.user?.firstName}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {eventsLoading ? (
                <div className="h-96 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
                </div>
              ) : sortedEvents.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>No events scheduled</p>
                  <p className="text-sm mt-2">Create the first event for this student</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold mb-2">Upcoming Events</h3>
                    {upcomingEvents.length === 0 ? (
                      <p className="text-gray-500 text-sm">No upcoming events</p>
                    ) : (
                      <div className="space-y-3">
                        {upcomingEvents.map((event: any) => (
                          <div key={event.id} className="p-4 border rounded-lg hover:bg-gray-50">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h4 className="font-medium">{event.title}</h4>
                                {event.description && (
                                  <p className="text-sm text-gray-600 mt-1">{event.description}</p>
                                )}
                                <div className="flex items-center gap-4 text-sm text-gray-500 mt-2">
                                  <div className="flex items-center gap-1">
                                    <Clock className="w-4 h-4" />
                                    {format(new Date(event.startDate), "PPp")}
                                  </div>
                                  {event.endDate && (
                                    <div>
                                      to {format(new Date(event.endDate), "PPp")}
                                    </div>
                                  )}
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
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteEventMutation.mutate(event.id)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-2">Past Events</h3>
                    {sortedEvents.filter((e: any) => new Date(e.startDate) < new Date()).length === 0 ? (
                      <p className="text-gray-500 text-sm">No past events</p>
                    ) : (
                      <div className="space-y-3">
                        {sortedEvents
                          .filter((event: any) => new Date(event.startDate) < new Date())
                          .map((event: any) => (
                            <div key={event.id} className="p-4 border rounded-lg bg-gray-50">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <h4 className="font-medium text-gray-700">{event.title}</h4>
                                  {event.description && (
                                    <p className="text-sm text-gray-500 mt-1">{event.description}</p>
                                  )}
                                  <div className="flex items-center gap-4 text-sm text-gray-400 mt-2">
                                    <div className="flex items-center gap-1">
                                      <Clock className="w-4 h-4" />
                                      {format(new Date(event.startDate), "PPp")}
                                    </div>
                                  </div>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deleteEventMutation.mutate(event.id)}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Summary Statistics */}
      {selectedStudentId && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Events</p>
                  <p className="text-2xl font-bold">{sortedEvents.length}</p>
                </div>
                <CalendarDays className="w-8 h-8 text-gray-400" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Upcoming</p>
                  <p className="text-2xl font-bold">{upcomingEvents.length}</p>
                </div>
                <Clock className="w-8 h-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Past Events</p>
                  <p className="text-2xl font-bold">{sortedEvents.length - upcomingEvents.length}</p>
                </div>
                <CheckCircle2 className="w-8 h-8 text-gray-400" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}