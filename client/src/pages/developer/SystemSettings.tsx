import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Settings, Database, Mail, Shield, Bell, Loader2, CheckCircle, XCircle } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { SystemSettings } from "@shared/schema";

export default function SystemSettings() {
  const { toast } = useToast();
  
  // Fetch system settings
  const { data: settings, isLoading } = useQuery<SystemSettings>({
    queryKey: ['/api/system-settings'],
  });

  // Fetch database status
  const { data: dbStatus, refetch: refetchDbStatus } = useQuery<{
    connected: boolean;
    activeConnections?: number;
    maxConnections?: number;
  }>({
    queryKey: ['/api/system-settings/database-status'],
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Form state
  const [formData, setFormData] = useState({
    // General Settings
    platformName: "Synergasia",
    supportEmail: "support@synergasia.com",
    platformDescription: "Advanced student support platform for academic counseling",
    maintenanceMode: false,
    // Database Settings
    autoBackup: true,
    queryLogging: false,
    // Email Settings
    smtpHost: "",
    smtpPort: 587,
    smtpUser: "",
    smtpPassword: "",
    emailNotifications: true,
    // Security Settings
    sessionTimeout: 60,
    maxLoginAttempts: 5,
    twoFactorAuth: false,
    passwordComplexity: true,
    // Notification Settings
    systemAlerts: true,
    userActivityAlerts: false,
    performanceAlerts: true,
  });

  // Update form data when settings are loaded
  useEffect(() => {
    if (settings) {
      setFormData({
        platformName: settings.platformName || "Synergasia",
        supportEmail: settings.supportEmail || "support@synergasia.com",
        platformDescription: settings.platformDescription || "Advanced student support platform for academic counseling",
        maintenanceMode: settings.maintenanceMode || false,
        autoBackup: settings.autoBackup ?? true,
        queryLogging: settings.queryLogging || false,
        smtpHost: settings.smtpHost || "",
        smtpPort: settings.smtpPort || 587,
        smtpUser: settings.smtpUser || "",
        smtpPassword: settings.smtpPassword || "",
        emailNotifications: settings.emailNotifications ?? true,
        sessionTimeout: settings.sessionTimeout || 60,
        maxLoginAttempts: settings.maxLoginAttempts || 5,
        twoFactorAuth: settings.twoFactorAuth || false,
        passwordComplexity: settings.passwordComplexity ?? true,
        systemAlerts: settings.systemAlerts ?? true,
        userActivityAlerts: settings.userActivityAlerts || false,
        performanceAlerts: settings.performanceAlerts ?? true,
      });
    }
  }, [settings]);

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: () => apiRequest('/api/system-settings', 'PUT', formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/system-settings'] });
      toast({
        title: "Settings Saved",
        description: "System settings have been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save settings",
        variant: "destructive",
      });
    },
  });

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = () => {
    updateSettingsMutation.mutate();
  };

  const handleReset = () => {
    const defaultSettings = {
      platformName: "Synergasia",
      supportEmail: "support@synergasia.com",
      platformDescription: "Advanced student support platform for academic counseling",
      maintenanceMode: false,
      autoBackup: true,
      queryLogging: false,
      smtpHost: "",
      smtpPort: 587,
      smtpUser: "",
      smtpPassword: "",
      emailNotifications: true,
      sessionTimeout: 60,
      maxLoginAttempts: 5,
      twoFactorAuth: false,
      passwordComplexity: true,
      systemAlerts: true,
      userActivityAlerts: false,
      performanceAlerts: true,
    };
    setFormData(defaultSettings);
    toast({
      title: "Reset to Defaults",
      description: "Settings have been reset to default values. Click Save to apply.",
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">System Settings</h1>
        <p className="text-gray-600">Configure system-wide settings and preferences.</p>
      </div>

      {/* General Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>General Settings</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="platform-name">Platform Name</Label>
              <Input 
                id="platform-name" 
                value={formData.platformName}
                onChange={(e) => handleInputChange('platformName', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="support-email">Support Email</Label>
              <Input 
                id="support-email" 
                type="email" 
                value={formData.supportEmail}
                onChange={(e) => handleInputChange('supportEmail', e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="platform-description">Platform Description</Label>
            <Textarea 
              id="platform-description" 
              value={formData.platformDescription}
              onChange={(e) => handleInputChange('platformDescription', e.target.value)}
              rows={3}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Maintenance Mode</Label>
              <p className="text-sm text-gray-500">Put the platform in maintenance mode</p>
            </div>
            <Switch 
              checked={formData.maintenanceMode}
              onCheckedChange={(checked) => handleInputChange('maintenanceMode', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Database Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Database className="h-5 w-5" />
            <span>Database Settings</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Database Status</Label>
              <div className="flex items-center space-x-2">
                {dbStatus?.connected ? (
                  <>
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="text-sm text-green-600">Connected</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4 text-red-500" />
                    <span className="text-sm text-red-600">Disconnected</span>
                  </>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Connection Pool</Label>
              <div className="text-sm text-gray-600">
                {dbStatus?.connected ? (
                  `Active: ${dbStatus.activeConnections || 0}/${dbStatus.maxConnections || 100} connections`
                ) : (
                  'N/A'
                )}
              </div>
            </div>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Auto Backup</Label>
              <p className="text-sm text-gray-500">Automatically backup database daily</p>
            </div>
            <Switch 
              checked={formData.autoBackup}
              onCheckedChange={(checked) => handleInputChange('autoBackup', checked)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Query Logging</Label>
              <p className="text-sm text-gray-500">Log slow queries for optimization</p>
            </div>
            <Switch 
              checked={formData.queryLogging}
              onCheckedChange={(checked) => handleInputChange('queryLogging', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Email Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Mail className="h-5 w-5" />
            <span>Email Settings</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="smtp-host">SMTP Host</Label>
              <Input 
                id="smtp-host" 
                placeholder="smtp.gmail.com"
                value={formData.smtpHost}
                onChange={(e) => handleInputChange('smtpHost', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtp-port">SMTP Port</Label>
              <Input 
                id="smtp-port" 
                type="number" 
                placeholder="587"
                value={formData.smtpPort}
                onChange={(e) => handleInputChange('smtpPort', parseInt(e.target.value) || 587)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="smtp-user">SMTP Username</Label>
              <Input 
                id="smtp-user" 
                type="email" 
                placeholder="your-email@domain.com"
                value={formData.smtpUser}
                onChange={(e) => handleInputChange('smtpUser', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtp-pass">SMTP Password</Label>
              <Input 
                id="smtp-pass" 
                type="password" 
                placeholder="••••••••"
                value={formData.smtpPassword}
                onChange={(e) => handleInputChange('smtpPassword', e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Email Notifications</Label>
              <p className="text-sm text-gray-500">Send system notifications via email</p>
            </div>
            <Switch 
              checked={formData.emailNotifications}
              onCheckedChange={(checked) => handleInputChange('emailNotifications', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Security Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Shield className="h-5 w-5" />
            <span>Security Settings</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="session-timeout">Session Timeout (minutes)</Label>
              <Input 
                id="session-timeout" 
                type="number" 
                value={formData.sessionTimeout}
                onChange={(e) => handleInputChange('sessionTimeout', parseInt(e.target.value) || 60)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="max-login-attempts">Max Login Attempts</Label>
              <Input 
                id="max-login-attempts" 
                type="number" 
                value={formData.maxLoginAttempts}
                onChange={(e) => handleInputChange('maxLoginAttempts', parseInt(e.target.value) || 5)}
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Two-Factor Authentication</Label>
              <p className="text-sm text-gray-500">Require 2FA for admin accounts</p>
            </div>
            <Switch 
              checked={formData.twoFactorAuth}
              onCheckedChange={(checked) => handleInputChange('twoFactorAuth', checked)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Password Complexity</Label>
              <p className="text-sm text-gray-500">Enforce strong password requirements</p>
            </div>
            <Switch 
              checked={formData.passwordComplexity}
              onCheckedChange={(checked) => handleInputChange('passwordComplexity', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Bell className="h-5 w-5" />
            <span>Notification Settings</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>System Alerts</Label>
              <p className="text-sm text-gray-500">Notify admins of system issues</p>
            </div>
            <Switch 
              checked={formData.systemAlerts}
              onCheckedChange={(checked) => handleInputChange('systemAlerts', checked)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>User Activity Alerts</Label>
              <p className="text-sm text-gray-500">Notify of suspicious user activity</p>
            </div>
            <Switch 
              checked={formData.userActivityAlerts}
              onCheckedChange={(checked) => handleInputChange('userActivityAlerts', checked)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Performance Alerts</Label>
              <p className="text-sm text-gray-500">Notify when system performance degrades</p>
            </div>
            <Switch 
              checked={formData.performanceAlerts}
              onCheckedChange={(checked) => handleInputChange('performanceAlerts', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Save Settings */}
      <div className="flex justify-end space-x-2">
        <Button 
          variant="outline" 
          onClick={handleReset}
          disabled={updateSettingsMutation.isPending}
        >
          Reset to Defaults
        </Button>
        <Button 
          onClick={handleSave}
          disabled={updateSettingsMutation.isPending}
        >
          {updateSettingsMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Settings'
          )}
        </Button>
      </div>
    </div>
  );
}