import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const taskFormSchema = z.object({
  studentId: z.number().min(1, "Please select a student"),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  dueDate: z.string().optional().refine((date) => {
    if (!date) return true; // Optional field
    const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local timezone
    return date >= todayStr;
  }, {
    message: "Due date cannot be in the past"
  }),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
});

type TaskFormData = z.infer<typeof taskFormSchema>;

interface TaskFormProps {
  studentId?: number;
  onSuccess?: () => void;
}

export default function TaskForm({ studentId, onSuccess }: TaskFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<TaskFormData>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      studentId: studentId || undefined,
      title: "",
      description: "",
      dueDate: "",
      priority: "medium",
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: (data: TaskFormData) => apiRequest("/api/tasks", "POST", data),
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ["/api/tasks"] });
      toast({
        title: "Success",
        description: "Task created successfully",
      });
      form.reset();
      onSuccess?.();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create task",
        variant: "destructive",
      });
      console.error("Error creating task:", error);
    },
  });

  const onSubmit = (data: TaskFormData) => {
    createTaskMutation.mutate(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Task Title *</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Complete college application essay" {...field} />
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
                <Textarea 
                  placeholder="Provide details about the task..."
                  {...field} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="dueDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Due Date</FormLabel>
              <FormControl>
                <Input 
                  type="date" 
                  min={new Date().toLocaleDateString('en-CA')} 
                  data-testid="input-due-date"
                  {...field} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="priority"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Priority</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-2 pt-4">
          <Button 
            type="submit" 
            disabled={createTaskMutation.isPending}
            className="flex-1"
          >
            {createTaskMutation.isPending ? "Creating..." : "Create Task"}
          </Button>
        </div>
      </form>
    </Form>
  );
}