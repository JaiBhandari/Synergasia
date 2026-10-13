import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";

const verifyCodeSchema = z.object({
  email: z.string().email("Invalid email address"),
  code: z.string().length(6, "Code must be 6 digits"),
});

type VerifyCodeForm = z.infer<typeof verifyCodeSchema>;

export default function VerifyCode() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  
  // Initialize state from sessionStorage to persist across navigation
  const [email, setEmail] = useState(() => {
    return sessionStorage.getItem('resetEmail') || "";
  });
  const [step, setStep] = useState<"email" | "code">(() => {
    const savedStep = sessionStorage.getItem('resetStep');
    return (savedStep as "email" | "code") || "email";
  });

  // Helper function to update state and sessionStorage
  const updateEmail = (newEmail: string) => {
    setEmail(newEmail);
    if (newEmail) {
      sessionStorage.setItem('resetEmail', newEmail);
    } else {
      sessionStorage.removeItem('resetEmail');
    }
  };

  const updateStep = (newStep: "email" | "code") => {
    setStep(newStep);
    sessionStorage.setItem('resetStep', newStep);
  };


  const clearResetState = () => {
    sessionStorage.removeItem('resetEmail');
    sessionStorage.removeItem('resetStep');
  };

  const emailForm = useForm<{ email: string }>({
    defaultValues: { email: email || "" },
  });

  const codeForm = useForm<VerifyCodeForm>({
    resolver: zodResolver(verifyCodeSchema),
    defaultValues: { email: email || "", code: "" },
  });


  // Check for email parameter in URL on component mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const emailParam = urlParams.get('email');
    
    if (emailParam) {
      // If email is provided in URL, set it and go directly to code step
      updateEmail(emailParam);
      emailForm.setValue('email', emailParam);
      codeForm.setValue('email', emailParam);
      updateStep('code');
      
      // Clean up URL to remove the email parameter
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
  }, []);

  // Send verification code
  const sendCodeMutation = useMutation({
    mutationFn: async (data: { email: string }) => {
      const response = await apiRequest("/api/auth/forgot-password", "POST", data);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Code sent",
        description: "A verification code has been sent to your email",
      });
      updateEmail(emailForm.getValues("email"));
      codeForm.setValue("email", emailForm.getValues("email"));
      updateStep("code");
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send code",
        description: error.message || "Please try again later",
        variant: "destructive",
      });
    },
  });

  // Verify code
  const verifyCodeMutation = useMutation({
    mutationFn: async (data: VerifyCodeForm) => {
      const response = await apiRequest("/api/auth/verify-reset-code", "POST", data);
      return await response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Code verified",
        description: "Please enter your new password",
      });
      // Redirect to ResetPassword page with token in URL
      setLocation(`/reset-password?token=${data.resetToken}`);
    },
    onError: (error: any) => {
      toast({
        title: "Invalid code",
        description: error.message || "Please check your code and try again",
        variant: "destructive",
      });
    },
  });


  const onSendCode = (data: { email: string }) => {
    sendCodeMutation.mutate(data);
  };

  const onVerifyCode = (data: VerifyCodeForm) => {
    verifyCodeMutation.mutate(data);
  };


  const handleResendCode = () => {
    if (email) {
      sendCodeMutation.mutate({ email });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Reset Password</CardTitle>
          <CardDescription>
            {step === "email" && "Enter your email to receive a verification code"}
            {step === "code" && "Enter the 6-digit code sent to your email"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === "email" && (
            <form onSubmit={emailForm.handleSubmit(onSendCode)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  {...emailForm.register("email", { required: true })}
                  placeholder="Enter your email"
                />
              </div>
              <Button 
                type="submit" 
                className="w-full"
                disabled={sendCodeMutation.isPending}
              >
                {sendCodeMutation.isPending ? "Sending..." : "Send Verification Code"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  clearResetState(); // Clear persisted state when going back to login
                  setLocation("/");
                }}
              >
                Back to Login
              </Button>
            </form>
          )}

          {step === "code" && (
            <form onSubmit={codeForm.handleSubmit(onVerifyCode)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">Verification Code</Label>
                <Input
                  id="code"
                  type="text"
                  {...codeForm.register("code")}
                  placeholder="Enter 6-digit code"
                  maxLength={6}
                  className="text-center text-2xl tracking-widest"
                />
                {codeForm.formState.errors.code && (
                  <p className="text-sm text-red-600">
                    {codeForm.formState.errors.code.message}
                  </p>
                )}
              </div>
              <Button 
                type="submit" 
                className="w-full"
                disabled={verifyCodeMutation.isPending}
              >
                {verifyCodeMutation.isPending ? "Verifying..." : "Verify Code"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleResendCode}
                disabled={sendCodeMutation.isPending}
              >
                {sendCodeMutation.isPending ? "Sending..." : "Resend Code"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  updateStep("email");
                  updateEmail(""); // Clear email when going back
                  clearResetState(); // Clear all persisted state
                }}
              >
                Change Email
              </Button>
            </form>
          )}

        </CardContent>
      </Card>
    </div>
  );
}