import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { Router, Route, Switch, useLocation } from "wouter";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import VerifyCode from "@/pages/VerifyCode";
import ResetPassword from "@/pages/ResetPassword";
import { Toaster } from "@/components/ui/toaster";
import { useEffect } from "react";

// CSRF Token synchronization
function CsrfSync() {
  useEffect(() => {
    const fetchCsrf = async () => {
      try {
        await fetch("/api/csrf-token", { credentials: "include" });
      } catch (err) {
        console.error("Failed to fetch CSRF token:", err);
      }
    };
    fetchCsrf();
  }, []);
  return null;
}

// Import pages for different roles
import AdminDashboard from "@/pages/admin/Dashboard";
import AdminStudents from "@/pages/admin/Students";
import AdminCounselors from "@/pages/admin/Counselors";
import Archives from "@/pages/admin/Archives";
import AdminProfileFields from "@/pages/admin/ProfileFields";
import AdminUniversities from "@/pages/admin/Universities";
import AdminTasks from "@/pages/admin/Tasks";
import AdminPlanner from "@/pages/admin/Planner";
import ViewStudent from "@/pages/admin/ViewStudent";
import EditStudent from "@/pages/admin/EditStudent";
import EditCounselor from "@/pages/admin/EditCounselor";
import ViewCounselor from "@/pages/admin/ViewCounselor";
import AdminProfile from "@/pages/admin/AdminProfile";
import AdminViewUniversity from "@/pages/admin/ViewUniversity";

import CounselorDashboard from "@/pages/counselor/Dashboard";
import CounselorProfile from "@/pages/counselor/Profile";
import CounselorStudents from "@/pages/counselor/Students";
import CounselorViewStudent from "@/pages/counselor/ViewStudent";
import CounselorEditStudent from "@/pages/counselor/EditStudent";
import CounselorTasks from "@/pages/counselor/Tasks";
import CounselorDocuments from "@/pages/counselor/Documents";
import CounselorPlanner from "@/pages/counselor/Planner";
import CounselorUniversities from "@/pages/counselor/Universities";
import CounselorViewUniversity from "@/pages/counselor/ViewUniversity";

import StudentDashboard from "@/pages/student/Dashboard";
import StudentProfile from "@/pages/student/Profile";
import StudentActivities from "@/pages/student/Activities";
import StudentTasks from "@/pages/student/Tasks";
import StudentDocuments from "@/pages/student/Documents";
import StudentUniversities from "@/pages/student/Universities";
import SharedPlanner from "@/pages/shared/Planner";
import SharedViewUniversity from "@/pages/shared/ViewUniversity";

import DeveloperDashboard from "@/pages/developer/Dashboard";
import DeveloperAdmins from "@/pages/developer/AdminManagement";
import DeveloperSystemSettings from "@/pages/developer/SystemSettings";
import type { User } from "@shared/schema";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: async ({ queryKey }) => {
        const response = await fetch(queryKey[0] as string, {
          credentials: "include",
        });
        if (!response.ok) {
          throw new Error(`${response.status}: ${response.statusText}`);
        }
        return response.json();
      },
    },
  },
});

function AppContent() {
  const { data: user, isLoading } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    retry: false,
  });
  
  const [location] = useLocation();
  console.log("Current app location:", location);
  console.log("User role:", user?.role);

  // Manual route matching for counselor edit/view student
  if (location.startsWith('/counselor/students/') && user?.role === 'counselor') {
    // Check if it's an edit route first
    if (location.includes('/edit/')) {
      const studentId = location.split('/').pop();
      console.log("Manual route match - Edit Student ID:", studentId);
      return (
        <Layout user={user!}>
          <CounselorEditStudent studentId={studentId} />
        </Layout>
      );
    }
    // Otherwise it's a view route
    const studentId = location.split('/')[3];
    console.log("Manual route match - View Student ID:", studentId);
    return (
      <Layout user={user!}>
        <CounselorViewStudent studentId={studentId} />
      </Layout>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (!user) {
    // Handle auth pages
    if (location === '/verify-code') {
      return <VerifyCode />;
    }
    if (location === '/reset-password') {
      return <ResetPassword />;
    }
    return <Login />;
  }

  // Redirect authenticated users away from /login to their dashboard
  if (location === '/login') {
    const dashboardMap: Record<string, string> = {
      admin: '/admin/dashboard',
      counselor: '/counselor/dashboard',
      student: '/student/dashboard',
      developer: '/developer/dashboard',
    };
    const dest = dashboardMap[user.role ?? ''] ?? '/admin/dashboard';
    window.location.replace(dest);
    return null;
  }

  // Simple conditional rendering instead of wouter routing
  function renderCurrentPage() {
    // Developer routes
    if (user?.role === 'developer') {
      if (location === '/' || location === '/developer' || location === '/developer/dashboard') {
        return <DeveloperDashboard />;
      }
      if (location === '/admin-management') {
        return <DeveloperAdmins />;
      }
      if (location === '/system-settings') {
        return <DeveloperSystemSettings />;
      }
    }

    // Admin routes
    if (user?.role === 'admin') {
      if (location === '/' || location === '/admin' || location === '/admin/dashboard') {
        return <AdminDashboard />;
      }
      if (location === '/admin/students') return <AdminStudents />;
      if (location === '/admin/counselors') return <AdminCounselors />;
      if (location === '/admin/archives') return <Archives />;
      if (location === '/admin/fields') return <AdminProfileFields />;
      if (location === '/admin/universities') return <AdminUniversities />;
      if (location === '/admin/tasks') return <AdminTasks />;
      if (location === '/admin/documents') return <CounselorDocuments />;
      if (location === '/admin/planner') return <AdminPlanner />;
      if (location === '/admin/profile') return <AdminProfile />;
      if (location.startsWith('/admin/students/') && location.includes('/edit/')) {
        return <EditStudent />;
      }
      if (location.startsWith('/admin/students/')) {
        return <ViewStudent />;
      }
      if (location.startsWith('/admin/counselors/') && location.includes('/edit')) {
        return <EditCounselor />;
      }
      if (location.startsWith('/admin/counselors/')) {
        return <ViewCounselor />;
      }
      if (location.startsWith('/admin/universities/') && location !== '/admin/universities') {
        const universityId = location.split('/').pop();
        return <AdminViewUniversity universityId={universityId} />;
      }
    }

    // Counselor routes
    if (user?.role === 'counselor') {
      if (location === '/' || location === '/counselor' || location === '/counselor/dashboard') {
        return <CounselorDashboard />;
      }
      if (location === '/counselor/profile') return <CounselorProfile />;
      if (location === '/counselor/students') return <CounselorStudents />;
      if (location === '/counselor/tasks') return <CounselorTasks />;
      if (location === '/counselor/documents') return <CounselorDocuments />;
      if (location === '/counselor/planner') return <CounselorPlanner />;
      if (location === '/counselor/universities') return <CounselorUniversities />;
      if (location.startsWith('/counselor/universities/') && location !== '/counselor/universities') {
        const universityId = location.split('/').pop();
        return <CounselorViewUniversity universityId={universityId} />;
      }
      // Note: Edit/view student routes are handled in the manual route matching above
    }

    // Student routes
    if (user?.role === 'student') {
      if (location === '/' || location === '/student' || location === '/student/dashboard') {
        return <StudentDashboard />;
      }
      if (location === '/student/profile') return <StudentProfile />;
      if (location === '/student/activities') return <StudentActivities />;
      if (location === '/student/tasks') return <StudentTasks />;
      if (location === '/student/documents') return <StudentDocuments />;
      if (location === '/student/universities') return <StudentUniversities />;
      if (location === '/student/planner' || location.startsWith('/student/planner/')) {
        return <SharedPlanner />;
      }
      if (location.startsWith('/student/universities/') && location !== '/student/universities') {
        return <SharedViewUniversity />;
      }
    }

    // 404 fallback
    return (
      <div className="p-6 text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Page Not Found</h2>
        <p className="text-gray-600">The page you're looking for doesn't exist.</p>
        <p className="text-sm text-gray-500 mt-2">Current location: {location}</p>
        <p className="text-sm text-gray-500">User role: {user?.role}</p>
      </div>
    );
  }

  return (
    <Layout user={user}>
      {renderCurrentPage()}
    </Layout>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <CsrfSync />
        <AppContent />
        <Toaster />
      </Router>
    </QueryClientProvider>
  );
}