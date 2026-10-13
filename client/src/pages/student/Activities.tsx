import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import ActivityLocker from "@/components/ActivityLocker";

export default function StudentActivities() {
  // Get current user data
  const { data: userData } = useQuery({
    queryKey: ["/api/auth/user"],
  });

  const { data: student } = useQuery({
    queryKey: ["/api/me/student"],
    queryFn: async () => {
      const response = await fetch("/api/me/student", {
        credentials: "include",
      });
      if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
      return response.json();
    },
  });

  if (!student) {
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
          <h1 className="text-3xl font-bold text-gray-900">My Activities</h1>
          <p className="text-gray-600">Manage your extracurricular activities, competitions, and achievements</p>
        </div>
      </div>

      {/* Activity Locker */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Trophy className="h-5 w-5 text-primary-600" />
            <span>Activity Locker</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ActivityLocker studentId={student?.id} userRole={userData?.role} />
        </CardContent>
      </Card>
    </div>
  );
}