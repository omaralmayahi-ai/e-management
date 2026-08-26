import { useState, useEffect } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/app-header";
import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { KeyRound, Eye, EyeOff, Loader2 } from "lucide-react";
import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import CorrespondencePage from "@/pages/correspondence";
import LeaveRequestsPage from "@/pages/leave-requests";
import ServiceRequestsPage from "@/pages/service-requests";
import DepartmentsPage from "@/pages/departments";
import EmployeesPage from "@/pages/employees";
import SettingsPage from "@/pages/settings";
import NotificationsPage from "@/pages/notifications";
import FlowTemplatesPage from "@/pages/flow-templates";

function ProtectedRoute({ component: Component, accessKey }: { component: React.ComponentType; accessKey?: "canAccessCorrespondence" | "canAccessLeaveRequests" | "canAccessServiceRequests" }) {
  const { user } = useAuth();
  const isCentralMail = user?.role === "central_mail";
  if (accessKey && user?.role !== "admin") {
    if (isCentralMail && accessKey === "canAccessCorrespondence") {
    } else if (isCentralMail) {
      return <Dashboard />;
    } else if (!user?.[accessKey]) {
      return <Dashboard />;
    }
  }
  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/correspondence">{() => <ProtectedRoute component={CorrespondencePage} accessKey="canAccessCorrespondence" />}</Route>
      <Route path="/leave-requests">{() => <ProtectedRoute component={LeaveRequestsPage} accessKey="canAccessLeaveRequests" />}</Route>
      <Route path="/service-requests">{() => <ProtectedRoute component={ServiceRequestsPage} accessKey="canAccessServiceRequests" />}</Route>
      <Route path="/departments" component={DepartmentsPage} />
      <Route path="/employees" component={EmployeesPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route path="/notifications" component={NotificationsPage} />
      <Route path="/flow-templates" component={FlowTemplatesPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function ChangePasswordDialog() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { changePassword, isChangingPassword } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast({ title: "تنبيه", description: "كلمة المرور يجب أن تكون 6 أحرف على الأقل", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "تنبيه", description: "كلمتا المرور غير متطابقتين", variant: "destructive" });
      return;
    }
    try {
      await changePassword({ newPassword });
      toast({ title: "تم", description: "تم تغيير كلمة المرور بنجاح" });
    } catch {
      toast({ title: "خطأ", description: "حدث خطأ في تغيير كلمة المرور", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 p-4" dir="rtl">
      <Card className="w-full max-w-sm p-8 shadow-lg border-0 bg-white/90 backdrop-blur-sm">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-xl bg-amber-500/10 flex items-center justify-center mx-auto mb-3">
            <KeyRound className="w-7 h-7 text-amber-600" />
          </div>
          <h2 className="text-xl font-bold">تغيير كلمة المرور</h2>
          <p className="text-sm text-muted-foreground mt-1">يجب تغيير كلمة المرور قبل المتابعة</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-pw">كلمة المرور الجديدة</Label>
            <div className="relative">
              <Input id="new-pw" type={showPassword ? "text" : "password"} className="pl-10"
                placeholder="6 أحرف على الأقل" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                data-testid="input-new-password" />
              <button type="button" className="absolute left-3 top-2.5 text-muted-foreground hover:text-foreground"
                onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-pw">تأكيد كلمة المرور</Label>
            <Input id="confirm-pw" type="password" placeholder="أعد إدخال كلمة المرور" value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)} data-testid="input-confirm-password" />
          </div>
          <Button type="submit" className="w-full" disabled={isChangingPassword} data-testid="button-change-password">
            {isChangingPassword ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
            تغيير كلمة المرور
          </Button>
        </form>
      </Card>
    </div>
  );
}

function AuthenticatedApp() {
  const style = {
    "--sidebar-width": "17rem",
    "--sidebar-width-icon": "3.5rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full" dir="rtl">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <AppHeader />
          <main className="flex-1 overflow-auto">
            <Router />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function ThemeApplier() {
  const { data: settings } = useQuery<Record<string, string>>({
    queryKey: ["/api/settings/public"],
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    const userTheme = localStorage.getItem("userTheme");
    const theme = userTheme || settings?.theme || "blue";
    if (theme === "blue") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", theme);
    }
  }, [settings?.theme]);

  useEffect(() => {
    const darkMode = localStorage.getItem("darkMode");
    if (darkMode === "true") {
      document.documentElement.classList.add("dark");
    }
  }, []);

  return null;
}

function AppContent() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen" dir="rtl">
        <div className="text-center space-y-4">
          <Skeleton className="w-16 h-16 rounded-full mx-auto" />
          <Skeleton className="w-48 h-4 mx-auto" />
          <Skeleton className="w-32 h-3 mx-auto" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <LandingPage />;
  }

  if (user.mustChangePassword) {
    return <ChangePasswordDialog />;
  }

  return <AuthenticatedApp />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <ThemeApplier />
        <AppContent />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
