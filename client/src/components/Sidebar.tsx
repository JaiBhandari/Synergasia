import { Link, useLocation } from "wouter";
import { User } from "@shared/schema";
import { useResponsive } from "@/hooks/useResponsive";
import {
  Sidebar as SidebarContainer,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { 
  Users, 
  Bus, 
  ListCheck, 
  Calendar, 
  University, 
  User as UserIcon,
  FileText,
  LogOut,
  GraduationCap,
  Target,
  Trophy,
  LayoutDashboard,
  Building2,
  Settings,
  Archive
} from "lucide-react";

interface SidebarProps {
  user: User;
}

interface NavItem {
  path: string;
  label: string;
  icon: React.ElementType;
}

export default function Sidebar({ user }: SidebarProps) {
  const [location] = useLocation();
  const { sidebarMode, isMobile } = useResponsive();
  const { state, setOpenMobile } = useSidebar();

  const getNavItems = (): NavItem[] => {
    switch (user.role) {
      case 'developer':
        return [
          { path: "/", label: "Dashboard", icon: LayoutDashboard },
          { path: "/admin-management", label: "Admin Management", icon: Building2 },
          { path: "/system-settings", label: "System Settings", icon: Settings },
        ];
      case 'admin':
        return [
          { path: "/", label: "Dashboard", icon: LayoutDashboard },
          { path: "/admin/students", label: "Students", icon: Users },
          { path: "/admin/counselors", label: "Counselors", icon: Bus },
          { path: "/admin/archives", label: "Archives", icon: Archive },
          { path: "/admin/fields", label: "Profile Fields", icon: ListCheck },
          { path: "/admin/tasks", label: "Tasks", icon: Target },
          { path: "/admin/documents", label: "Documents", icon: FileText },
          { path: "/admin/planner", label: "Planner", icon: Calendar },
          { path: "/admin/universities", label: "Universities", icon: University },
          { path: "/admin/profile", label: "Profile", icon: UserIcon },
        ];
      case 'counselor':
        return [
          { path: "/", label: "Dashboard", icon: LayoutDashboard },
          { path: "/counselor/students", label: "Students", icon: Users },
          { path: "/counselor/tasks", label: "Tasks", icon: Target },
          { path: "/counselor/documents", label: "Documents", icon: FileText },
          { path: "/counselor/planner", label: "Planner", icon: Calendar },
          { path: "/counselor/universities", label: "Universities", icon: University },
          { path: "/counselor/profile", label: "Profile", icon: UserIcon },
        ];
      case 'student':
        return [
          { path: "/", label: "Dashboard", icon: LayoutDashboard },
          { path: "/student/profile", label: "Profile", icon: UserIcon },
          { path: "/student/activities", label: "Activities", icon: Trophy },
          { path: "/student/tasks", label: "Tasks", icon: Target },
          { path: "/student/documents", label: "Documents", icon: FileText },
          { path: "/student/planner", label: "Planner", icon: Calendar },
          { path: "/student/universities", label: "Universities", icon: University },
        ];
      default:
        return [];
    }
  };

  const navItems = getNavItems();

  const handleNavigationClick = () => {
    if (sidebarMode === 'offcanvas') {
      setOpenMobile(false);
    }
  };

  const getCollapsibleMode = () => {
    switch (sidebarMode) {
      case 'offcanvas':
        return 'offcanvas';
      case 'collapsed':
        return 'icon';
      case 'expanded':
      default:
        return 'none';
    }
  };

  return (
    <SidebarContainer 
      collapsible={getCollapsibleMode()} 
      data-testid="sidebar"
      className="h-screen flex flex-col border-r border-border/40"
      style={{ backgroundColor: 'hsl(40 35% 99%)' }}
    >
      <SidebarHeader className={`border-b border-border/40 transition-all duration-200 flex-shrink-0 ${
        sidebarMode === 'collapsed' ? 'p-3' : 'p-6'
      }`} data-testid="sidebar-header">
        <div className="flex items-center space-x-3">
          <div className={`transition-opacity duration-200 overflow-hidden ${
            sidebarMode === 'collapsed' ? 'opacity-0 w-0' : 'opacity-100 flex-1'
          }`}>
            <h1 className="font-logo text-2xl tracking-tight text-foreground truncate" data-testid="app-name">
              Synergasia
            </h1>
            {user.role === 'developer' && (
              <p className="font-ui text-xs text-terracotta font-medium truncate mt-1" data-testid="role-badge">
                Developer Portal
              </p>
            )}
            <p className="font-ui text-sm text-muted-foreground truncate mt-0.5" data-testid="app-subtitle">
              Student Tracking
            </p>
          </div>
        </div>
        
        {/* User Info */}
        <div className={`mt-4 rounded-xl transition-all duration-200 section-cream ${
          sidebarMode === 'collapsed' ? 'p-3 mx-auto w-fit flex justify-center' : 'p-4'
        }`} data-testid="user-info-sidebar">
          <div className={`flex items-center ${
            sidebarMode === 'collapsed' ? 'justify-center' : 'space-x-3'
          }`}>
            <div className={`bg-[#141413] rounded-full flex items-center justify-center flex-shrink-0 ${
              sidebarMode === 'collapsed' ? 'w-10 h-10' : 'w-9 h-9'
            }`} data-testid="user-avatar-sidebar">
              <span className="text-[hsl(40,33%,97%)] font-ui font-medium text-sm">
                {user.firstName?.[0]}{user.lastName?.[0]}
              </span>
            </div>
            <div className={`flex-1 transition-opacity duration-200 overflow-hidden ${
              sidebarMode === 'collapsed' ? 'opacity-0 w-0' : 'opacity-100 ml-3'
            }`}>
              <p className="font-ui text-sm font-medium text-foreground truncate" data-testid="user-name-sidebar">
                {user.firstName} {user.lastName}
              </p>
              <p className="font-ui text-xs text-muted-foreground font-medium capitalize truncate" data-testid="user-role-sidebar">
                {user.role}
              </p>
            </div>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className={`flex-1 overflow-y-auto transition-all duration-200 ${
        sidebarMode === 'collapsed' ? 'p-2' : 'p-4'
      }`} data-testid="sidebar-content">
        <SidebarMenu className={sidebarMode === 'collapsed' ? 'space-y-2' : 'space-y-1'}>
          {navItems.map((item) => (
            <SidebarMenuItem key={item.path} data-testid={`nav-item-${item.path.replace(/\//g, '-')}`}>
              <SidebarMenuButton 
                asChild
                isActive={location === item.path}
                tooltip={sidebarMode === 'collapsed' ? item.label : undefined}
                className={`w-full transition-all duration-200 rounded-lg font-ui ${
                  sidebarMode === 'collapsed' 
                    ? 'justify-center p-0 h-12 flex items-center' 
                    : 'justify-start'
                } ${
                  location === item.path 
                    ? "bg-[#141413] text-[hsl(40,33%,97%)] hover:bg-[#2a2a29]" 
                    : "text-foreground hover:bg-accent"
                }`}
              >
                <Link 
                  href={item.path} 
                  onClick={handleNavigationClick}
                  className={`flex items-center w-full h-full ${
                    sidebarMode === 'collapsed' ? 'justify-center' : 'px-3 py-2.5'
                  }`}
                >
                  <item.icon className={`h-5 w-5 flex-shrink-0 ${
                    sidebarMode === 'collapsed' ? '' : 'mr-3'
                  }`} />
                  <span className={`transition-opacity duration-200 overflow-hidden text-sm ${
                    sidebarMode === 'collapsed' ? 'opacity-0 w-0' : 'opacity-100'
                  }`}>
                    {item.label}
                  </span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className={`border-t border-border/40 transition-all duration-200 flex-shrink-0 ${
        sidebarMode === 'collapsed' ? 'p-2' : 'p-4'
      }`} data-testid="sidebar-footer">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton 
              asChild
              tooltip={sidebarMode === 'collapsed' ? 'Logout' : undefined}
              className={`w-full text-foreground hover:bg-accent rounded-lg font-ui transition-all duration-200 ${
                sidebarMode === 'collapsed' 
                  ? 'justify-center p-0 h-12 flex items-center' 
                  : 'justify-start'
              }`}
            >
              <button 
                onClick={() => window.location.href = '/api/logout'}
                data-testid="button-logout"
                className={`flex items-center w-full h-full ${
                  sidebarMode === 'collapsed' ? 'justify-center' : 'px-3 py-2.5'
                }`}
              >
                <LogOut className={`h-5 w-5 flex-shrink-0 ${
                  sidebarMode === 'collapsed' ? '' : 'mr-3'
                }`} />
                <span className={`transition-opacity duration-200 overflow-hidden text-sm ${
                  sidebarMode === 'collapsed' ? 'opacity-0 w-0' : 'opacity-100'
                }`}>
                  Logout
                </span>
              </button>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </SidebarContainer>
  );
}
