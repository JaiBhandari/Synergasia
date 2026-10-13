import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertTriangle, User, Mail } from "lucide-react";

const restoreSchema = z.object({
  email: z.string().email("Please provide a valid email address").min(1, "Email is required"),
});

interface RestoreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (email: string) => void;
  isLoading: boolean;
  title: string;
  description: string;
  itemName: string;
  itemType: "student" | "counselor";
}

export default function RestoreDialog({
  open,
  onOpenChange,
  onConfirm,
  isLoading,
  title,
  description,
  itemName,
  itemType
}: RestoreDialogProps) {
  const form = useForm<z.infer<typeof restoreSchema>>({
    resolver: zodResolver(restoreSchema),
    defaultValues: {
      email: "",
    },
  });

  const handleSubmit = (data: z.infer<typeof restoreSchema>) => {
    onConfirm(data.email);
  };

  const handleCancel = () => {
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="restore-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2" data-testid="restore-dialog-title">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <span>{title}</span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <User className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="font-medium text-gray-900">{itemName}</p>
              <p className="text-sm text-gray-500 capitalize">{itemType}</p>
            </div>
          </div>
          
          <div className="text-sm text-gray-600" data-testid="restore-dialog-description">
            {description}
          </div>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center space-x-2">
                      <Mail className="h-4 w-4" />
                      <span>Confirm Email Address *</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="Enter the original email address"
                        {...field}
                        data-testid="input-restore-email"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter className="space-x-3">
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={handleCancel}
                  disabled={isLoading}
                  data-testid="button-restore-cancel"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  className="bg-green-600 hover:bg-green-700"
                  disabled={isLoading}
                  data-testid="button-restore-confirm"
                >
                  {isLoading ? "Restoring..." : "Restore"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}