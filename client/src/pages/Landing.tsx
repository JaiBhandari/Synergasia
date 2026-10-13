import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap, Users, Calendar, University } from "lucide-react";
import { Link } from "wouter";

export default function Landing() {

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-white">
      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="flex items-center justify-center mb-6">
            <div className="w-16 h-16 bg-primary-500 rounded-2xl flex items-center justify-center mr-4">
              <GraduationCap className="text-white text-2xl" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-gray-900">Synergasia</h1>
              <p className="text-xl text-gray-600">Student Profile Tracking System</p>
            </div>
          </div>
          
          <p className="text-lg text-gray-700 max-w-2xl mx-auto mb-8">
            A comprehensive platform for student counseling and profile management with 
            role-based access control for students, counselors, and administrators.
          </p>
          
          <Link href="/login">
            <Button 
              className="bg-primary-500 hover:bg-primary-600 text-white px-8 py-3 text-lg"
            >
              Sign In to Continue
            </Button>
          </Link>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          <Card className="text-center">
            <CardHeader>
              <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Users className="text-primary-600 text-xl" />
              </div>
              <CardTitle>Student Management</CardTitle>
              <CardDescription>
                Comprehensive student profile tracking and counselor assignment
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Manage student accounts, profiles, and track their academic progress 
                with dynamic form fields and role-based permissions.
              </p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <div className="w-12 h-12 bg-success-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Calendar className="text-success-600 text-xl" />
              </div>
              <CardTitle>Planner & Tasks</CardTitle>
              <CardDescription>
                Integrated calendar and task management system
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Schedule events, assign tasks, and track completion with 
                reminder notifications and activity feedback.
              </p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <div className="w-12 h-12 bg-warning-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <University className="text-warning-600 text-xl" />
              </div>
              <CardTitle>University Tracking</CardTitle>
              <CardDescription>
                University management and application tracking
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Manage university information, track application deadlines, 
                and help students make informed decisions.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <div className="text-center mt-16 text-gray-600">
          <p>Secure authentication powered by advanced role-based access control</p>
        </div>
      </div>
    </div>
  );
}
