import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

function OrganicAnimation() {
  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
      {/* Main organic blob */}
      <div 
        className="absolute w-64 h-64 animate-morph animate-float-gentle"
        style={{
          background: 'linear-gradient(135deg, hsl(16 65% 55% / 0.7), hsl(16 50% 65% / 0.5))',
          filter: 'blur(0px)',
        }}
      />
      
      {/* Secondary floating elements */}
      <div 
        className="absolute w-20 h-20 rounded-full animate-float-slow animation-delay-500"
        style={{
          background: 'hsl(16 55% 60% / 0.6)',
          top: '20%',
          left: '25%',
        }}
      />
      
      <div 
        className="absolute w-12 h-12 rounded-full animate-float-gentle animation-delay-1000"
        style={{
          background: 'hsl(16 45% 65% / 0.5)',
          bottom: '30%',
          right: '20%',
        }}
      />
      
      <div 
        className="absolute w-8 h-8 rounded-full animate-pulse-soft animation-delay-200"
        style={{
          background: 'hsl(16 60% 55% / 0.7)',
          top: '35%',
          right: '30%',
        }}
      />
      
      {/* Static "S" in the center of the blob */}
      <div 
        className="absolute font-logo text-white"
        style={{
          fontSize: '200px',
          fontWeight: 700,
          lineHeight: 1,
          maskImage: 'radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(255,255,255,0.8) 60%, rgba(255,255,255,0.2) 100%)',
          WebkitMaskImage: 'radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(255,255,255,0.8) 60%, rgba(255,255,255,0.2) 100%)',
          filter: 'drop-shadow(0 0 15px rgba(255,255,255,0.15))',
        }}
      >
        S
      </div>
    </div>
  );
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        const data = await response.json();
        const role = data?.user?.role ?? data?.role;
        const dashboardMap: Record<string, string> = {
          admin: '/admin/dashboard',
          counselor: '/counselor/dashboard',
          student: '/student/dashboard',
          developer: '/developer/dashboard',
        };
        window.location.href = dashboardMap[role] ?? '/login';
      } else {
        const error = await response.json();
        toast({
          title: "Login Failed",
          description: error.message || "Invalid credentials",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Login Failed", 
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen flex"
      style={{ backgroundColor: 'hsl(40 33% 97%)' }}
    >
      {/* Left side - Animated graphic */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 animate-fade-in">
          <OrganicAnimation />
        </div>
        
        {/* Branding text overlay */}
        <div className="absolute bottom-12 left-12 right-12 animate-slide-up animation-delay-500">
          <h2 className="font-heading text-3xl font-bold text-foreground/80 leading-tight">
            Guiding students toward
            <br />
            <span className="text-terracotta">their future</span>
          </h2>
          <p className="mt-4 font-ui text-lg text-muted-foreground max-w-md">
            A comprehensive platform for student counseling, profile management, and university planning.
          </p>
        </div>
      </div>
      
      {/* Right side - Login form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 sm:px-12 lg:px-16">
        <div className="w-full max-w-md animate-slide-up">
          {/* Logo and title */}
          <div className="text-center mb-10 opacity-0 animate-fade-in" style={{ animationDelay: '0.2s', animationFillMode: 'forwards' }}>
            <h1 className="font-logo text-4xl sm:text-5xl tracking-tight text-foreground mb-3">
              Synergasia
            </h1>
          </div>

          {/* Login card */}
          <Card 
            className="border-0 shadow-elevated opacity-0 animate-slide-up"
            style={{ 
              animationDelay: '0.3s', 
              animationFillMode: 'forwards',
              backgroundColor: 'hsl(40 35% 99%)',
            }}
          >
            <CardHeader className="space-y-1 pb-6">
              <CardTitle className="font-heading text-2xl font-semibold">Welcome back</CardTitle>
              <CardDescription className="font-ui text-base">
                Sign in to your account to continue
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-5">
                <div 
                  className="space-y-2 opacity-0 animate-slide-up"
                  style={{ animationDelay: '0.4s', animationFillMode: 'forwards' }}
                >
                  <Label htmlFor="email" className="font-ui text-sm font-medium">
                    Email address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-12 font-ui bg-white/50 border-border/60 focus:border-foreground/30 transition-colors"
                    placeholder="your@email.com"
                    data-testid="input-email"
                  />
                </div>
                <div 
                  className="space-y-2 opacity-0 animate-slide-up"
                  style={{ animationDelay: '0.5s', animationFillMode: 'forwards' }}
                >
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="font-ui text-sm font-medium">
                      Password
                    </Label>
                    <Link 
                      href="/verify-code"
                      className="font-ui text-sm text-muted-foreground hover:text-foreground transition-colors"
                      data-testid="link-forgot-password"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-12 font-ui bg-white/50 border-border/60 focus:border-foreground/30 transition-colors"
                    placeholder="Enter your password"
                    data-testid="input-password"
                  />
                </div>
                <div 
                  className="opacity-0 animate-slide-up"
                  style={{ animationDelay: '0.6s', animationFillMode: 'forwards' }}
                >
                  <Button 
                    type="submit"
                    className="w-full h-12 font-ui text-base font-medium btn-anthropic rounded-lg" 
                    disabled={isLoading}
                    data-testid="login-btn"
                    style={{
                      backgroundColor: '#141413',
                      color: 'hsl(40 33% 97%)',
                    }}
                  >
                    {isLoading ? "Signing in..." : "Sign in"}
                  </Button>
                </div>
              </form>
              <div 
                className="mt-6 pt-6 border-t border-border/50 opacity-0 animate-fade-in"
                style={{ animationDelay: '0.7s', animationFillMode: 'forwards' }}
              >
                <p className="font-ui text-sm text-muted-foreground text-center">
                  For admin access, please contact your administrator
                </p>
              </div>
            </CardContent>
          </Card>
          
        </div>
      </div>
    </div>
  );
}
