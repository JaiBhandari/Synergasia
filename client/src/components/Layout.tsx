import Sidebar from "./Sidebar";
import NotificationDropdown from "./NotificationDropdown";
import { Toaster } from "@/components/ui/toaster";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { User } from "@shared/schema";
import { useResponsive } from "@/hooks/useResponsive";

interface LayoutProps {
  user: User;
  children: React.ReactNode;
}

export default function Layout({ user, children }: LayoutProps) {
  const { sidebarMode } = useResponsive();
  
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex h-screen w-full bg-background overflow-hidden" data-testid="layout-container">
        <Sidebar user={user} />
        
        <SidebarInset className="flex flex-1 flex-col h-screen overflow-hidden">
          {/* Top Bar */}
          <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6 flex-shrink-0" data-testid="layout-header">
            <div className="flex items-center gap-2">
              {sidebarMode === 'offcanvas' && (
                <SidebarTrigger data-testid="sidebar-trigger" />
              )}
              <div>
                <h2 className="text-2xl font-semibold text-foreground" data-testid="page-title">
                  {user.role === 'developer' && 'Developer Portal'}
                  {user.role === 'admin' && 'Administration'}
                  {user.role === 'counselor' && 'Counselor Dashboard'}
                  {user.role === 'student' && 'Student Portal'}
                </h2>
                <p className="text-sm text-muted-foreground" data-testid="welcome-message">
                  Welcome back, {user.firstName} {user.lastName}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4" data-testid="header-actions">
              {/* Notification dropdown for admin, counselor, and student */}
              {(user.role === 'admin' || user.role === 'counselor' || user.role === 'student') && (
                <NotificationDropdown />
              )}
              
              <div className="flex items-center space-x-3" data-testid="user-info">
                <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center" data-testid="user-avatar">
                  <span className="text-primary-foreground text-sm font-medium">
                    {user.firstName?.[0]}{user.lastName?.[0]}
                  </span>
                </div>
                <span className="text-sm font-medium text-foreground" data-testid="user-name">
                  {user.firstName} {user.lastName}
                </span>
              </div>
            </div>
          </header>

          {/* Content Area */}
          <main className="flex-1 overflow-y-auto p-6 bg-background" data-testid="main-content">
            {children}
          </main>
        </SidebarInset>
      </div>
      
      <Toaster />
    </SidebarProvider>
  );
}
