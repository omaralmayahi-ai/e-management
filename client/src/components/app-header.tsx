import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import {
  Bell,
  LogOut,
  CheckCheck,
  Clock,
  KeyRound,
  Palette,
  Sun,
  Moon,
  ChevronDown,
  Eye,
  EyeOff,
  Loader2,
  User,
  PenLine,
  Upload,
  Trash2,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

const roleLabels: Record<string, string> = {
  admin: "مدير النظام",
  officer: "مسؤول",
  general_manager: "مدير عام",
  assistant: "معاون",
  directorate_head: "رئيس هيئة",
  section_head: "رئيس قسم",
  division_head: "رئيس شعبة",
  unit_head: "رئيس وحدة",
  employee: "موظف",
};

const themeOptions = [
  { value: "blue", label: "أزرق", color: "hsl(210 82% 42%)" },
  { value: "teal", label: "أخضر مائي", color: "hsl(178 72% 38%)" },
  { value: "green", label: "أخضر", color: "hsl(152 62% 36%)" },
  { value: "purple", label: "بنفسجي", color: "hsl(262 68% 48%)" },
  { value: "warm", label: "دافئ", color: "hsl(24 78% 42%)" },
];

export function AppHeader() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [notifOpen, setNotifOpen] = useState(false);
  const [pwDialogOpen, setPwDialogOpen] = useState(false);
  const [sigDialogOpen, setSigDialogOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const sigFileRef = useRef<HTMLInputElement>(null);

  const isDark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");
  const [darkMode, setDarkMode] = useState(isDark);

  const currentTheme = typeof document !== "undefined"
    ? document.documentElement.getAttribute("data-theme") || "blue"
    : "blue";

  const { data: unreadCount } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
    refetchInterval: 30000,
  });

  const { data: notifications } = useQuery<any[]>({
    queryKey: ["/api/notifications"],
    enabled: notifOpen,
  });

  const markReadMutation = useMutation({
    mutationFn: async (notifId: number) => {
      await apiRequest("PATCH", `/api/notifications/${notifId}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", "/api/notifications/read-all");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/auth/change-password", { currentPassword, newPassword });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "تم", description: "تم تغيير كلمة المرور بنجاح" });
      setPwDialogOpen(false);
      setNewPassword("");
      setConfirmPassword("");
      setCurrentPassword("");
    },
    onError: () => {
      toast({ title: "خطأ", description: "حدث خطأ في تغيير كلمة المرور. تأكد من كلمة المرور الحالية", variant: "destructive" });
    },
  });

  const uploadSignatureMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("signature", file);
      const res = await fetch(`/api/employees/${user?.id}/signature`, { method: "POST", body: formData, credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "تم", description: "تم تحديث التوقيع الإلكتروني بنجاح" });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setSigDialogOpen(false);
    },
    onError: () => {
      toast({ title: "خطأ", description: "حدث خطأ في رفع التوقيع", variant: "destructive" });
    },
  });

  const deleteSignatureMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/employees/${user?.id}/signature`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "تم", description: "تم حذف التوقيع الإلكتروني" });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setSigDialogOpen(false);
    },
    onError: () => {
      toast({ title: "خطأ", description: "حدث خطأ في حذف التوقيع", variant: "destructive" });
    },
  });

  const handleChangePassword = () => {
    if (newPassword.length < 6) {
      toast({ title: "تنبيه", description: "كلمة المرور يجب أن تكون 6 أحرف على الأقل", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "تنبيه", description: "كلمتا المرور غير متطابقتين", variant: "destructive" });
      return;
    }
    changePasswordMutation.mutate();
  };

  const toggleDarkMode = () => {
    const newDark = !darkMode;
    setDarkMode(newDark);
    if (newDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("darkMode", newDark ? "true" : "false");
  };

  const setTheme = (theme: string) => {
    if (theme === "blue") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", theme);
    }
    localStorage.setItem("userTheme", theme);
  };

  const displayName = user?.fullName || "مستخدم";
  const getInitials = () => {
    if (displayName) {
      const parts = displayName.split(" ");
      if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`;
      return displayName[0];
    }
    return "م";
  };

  return (
    <>
      <header className="flex items-center justify-between gap-2 px-3 border-b h-12 shrink-0 bg-background" dir="rtl">
        <div className="flex items-center gap-2">
          <SidebarTrigger data-testid="button-sidebar-toggle" />
        </div>

        <div className="flex items-center gap-1">
          <Popover open={notifOpen} onOpenChange={setNotifOpen}>
            <PopoverTrigger asChild>
              <Button size="icon" variant="ghost" className="relative" data-testid="button-notifications">
                <Bell className="w-4 h-4" />
                {(unreadCount?.count || 0) > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center" data-testid="badge-unread-count">
                    {unreadCount!.count > 9 ? "9+" : unreadCount!.count}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent side="bottom" align="start" className="w-80 p-0" dir="rtl">
              <div className="flex items-center justify-between p-3 border-b">
                <h3 className="font-semibold text-sm">الإشعارات</h3>
                {(unreadCount?.count || 0) > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs h-7"
                    onClick={() => markAllReadMutation.mutate()}
                    data-testid="button-mark-all-read"
                  >
                    <CheckCheck className="w-3 h-3 ml-1" />
                    قراءة الكل
                  </Button>
                )}
              </div>
              <ScrollArea className="max-h-64">
                {!notifications || notifications.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground text-sm">
                    <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    لا توجد إشعارات
                  </div>
                ) : (
                  <div className="divide-y">
                    {notifications.slice(0, 10).map((notif: any) => {
                      const isCorrespondence = notif.category === "correspondence" || (notif.category !== "system" && notif.sentById === null);
                      const hasEntity = isCorrespondence && notif.relatedEntityId;
                      return (
                        <div
                          key={notif.id}
                          className={`p-3 text-sm cursor-pointer hover:bg-muted/50 transition-colors ${!notif.isRead ? "bg-primary/5" : ""}`}
                          onClick={() => {
                            if (!notif.isRead) markReadMutation.mutate(notif.notificationId);
                            setNotifOpen(false);
                            if (hasEntity) {
                              const incomingType = notif.relatedEntityType === "external_incoming" ? "in_external" : "in_internal";
                              setLocation("/correspondence");
                              setTimeout(() => {
                                window.dispatchEvent(new CustomEvent("notif-nav", {
                                  detail: { tab: "incoming", subTab: incomingType, openId: notif.relatedEntityId }
                                }));
                              }, 50);
                            } else if (isCorrespondence) {
                              setLocation("/correspondence");
                              setTimeout(() => {
                                window.dispatchEvent(new CustomEvent("notif-nav", {
                                  detail: { tab: "incoming" }
                                }));
                              }, 50);
                            } else {
                              setLocation("/notifications?tab=system");
                            }
                          }}
                          data-testid={`notification-item-${notif.id}`}
                        >
                          <div className="flex items-start gap-2">
                            {!notif.isRead && (
                              <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm leading-relaxed ${!notif.isRead ? "font-medium" : "text-muted-foreground"}`}>
                                {notif.message}
                              </p>
                              <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground">
                                <Clock className="w-3 h-3" />
                                {new Date(notif.sentAt || notif.createdAt).toLocaleDateString("ar-IQ")} {new Date(notif.sentAt || notif.createdAt).toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit" })}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
              {notifications && notifications.length > 0 && (
                <div className="p-2 border-t">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => { setNotifOpen(false); setLocation("/notifications"); }}
                    data-testid="button-view-all-notifications"
                  >
                    عرض جميع الإشعارات
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>

          <DropdownMenu dir="rtl">
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2 h-9 px-2" data-testid="button-user-menu">
                <Avatar className="w-7 h-7">
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">{getInitials()}</AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium hidden sm:inline">{displayName}</span>
                {user?.role && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 hidden sm:inline-flex" data-testid="badge-user-role">
                    {roleLabels[user.role] || user.role}
                  </Badge>
                )}
                <ChevronDown className="w-3 h-3 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">{displayName}</p>
                  <p className="text-xs text-muted-foreground">{user?.username}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setPwDialogOpen(true)} data-testid="menu-change-password">
                <KeyRound className="w-4 h-4 ml-2" />
                تغيير كلمة المرور
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSigDialogOpen(true)} data-testid="menu-change-signature">
                <PenLine className="w-4 h-4 ml-2" />
                التوقيع الإلكتروني
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger data-testid="menu-theme">
                  <Palette className="w-4 h-4 ml-2" />
                  لون النظام
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuRadioGroup value={currentTheme} onValueChange={setTheme}>
                    {themeOptions.map((t) => (
                      <DropdownMenuRadioItem key={t.value} value={t.value} data-testid={`theme-${t.value}`}>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.color }} />
                          {t.label}
                        </div>
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuItem onClick={toggleDarkMode} data-testid="menu-dark-mode">
                {darkMode ? <Sun className="w-4 h-4 ml-2" /> : <Moon className="w-4 h-4 ml-2" />}
                {darkMode ? "الوضع الفاتح" : "الوضع الداكن"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => logout()} className="text-destructive" data-testid="menu-logout">
                <LogOut className="w-4 h-4 ml-2" />
                تسجيل الخروج
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <Dialog open={pwDialogOpen} onOpenChange={setPwDialogOpen}>
        <DialogContent dir="rtl" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-right">تغيير كلمة المرور</DialogTitle>
            <DialogDescription className="text-right">أدخل كلمة المرور الحالية والجديدة</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-pw-header">كلمة المرور الحالية</Label>
              <Input
                id="current-pw-header"
                type={showPassword ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                data-testid="input-current-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-pw-header">كلمة المرور الجديدة</Label>
              <div className="relative">
                <Input
                  id="new-pw-header"
                  type={showPassword ? "text" : "password"}
                  placeholder="6 أحرف على الأقل"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="pl-10"
                  data-testid="input-new-password-dialog"
                />
                <button
                  type="button"
                  className="absolute left-3 top-2.5 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-pw-header">تأكيد كلمة المرور</Label>
              <Input
                id="confirm-pw-header"
                type="password"
                placeholder="أعد إدخال كلمة المرور"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                data-testid="input-confirm-password-dialog"
              />
            </div>
            <Button
              className="w-full"
              onClick={handleChangePassword}
              disabled={changePasswordMutation.isPending}
              data-testid="button-save-password"
            >
              {changePasswordMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
              حفظ كلمة المرور
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={sigDialogOpen} onOpenChange={setSigDialogOpen}>
        <DialogContent dir="rtl" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-right">التوقيع الإلكتروني</DialogTitle>
            <DialogDescription className="text-right">رفع أو تغيير صورة التوقيع الإلكتروني</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {(user as any)?.signatureUrl ? (
              <div className="space-y-3">
                <div className="border rounded-lg p-4 bg-muted/30">
                  <p className="text-xs text-muted-foreground mb-2">التوقيع الحالي</p>
                  <img src={(user as any).signatureUrl} alt="التوقيع" className="max-h-24 mx-auto object-contain" data-testid="img-current-signature" />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => sigFileRef.current?.click()} data-testid="button-replace-signature">
                    <Upload className="w-4 h-4 ml-2" />
                    استبدال التوقيع
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={() => deleteSignatureMutation.mutate()}
                    disabled={deleteSignatureMutation.isPending}
                    data-testid="button-delete-signature"
                  >
                    {deleteSignatureMutation.isPending ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <Trash2 className="w-4 h-4 ml-2" />}
                    حذف التوقيع
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 border rounded-lg bg-muted/30">
                <PenLine className="w-10 h-10 mx-auto mb-2 text-muted-foreground opacity-50" />
                <p className="text-sm text-muted-foreground mb-3">لا يوجد توقيع إلكتروني</p>
                <Button variant="outline" onClick={() => sigFileRef.current?.click()} data-testid="button-add-signature">
                  <Upload className="w-4 h-4 ml-2" />
                  رفع صورة التوقيع
                </Button>
              </div>
            )}
            <input
              type="file"
              ref={sigFileRef}
              className="hidden"
              accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  if (file.size > 2 * 1024 * 1024) {
                    toast({ title: "حجم الملف كبير", description: "الحد الأقصى 2 ميغابايت", variant: "destructive" });
                    return;
                  }
                  uploadSignatureMutation.mutate(file);
                }
                e.target.value = "";
              }}
              data-testid="input-signature-file"
            />
            <p className="text-xs text-muted-foreground">PNG, JPG, WebP, SVG - الحد الأقصى 2MB</p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
