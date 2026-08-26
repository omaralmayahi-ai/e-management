import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import {
  FileText,
  LogIn,
  Eye,
  EyeOff,
  KeyRound,
  ArrowRight,
  Phone,
  User,
  Hash,
  Loader2,
  CheckCircle2,
} from "lucide-react";

export default function LandingPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const { login, isLoggingIn } = useAuth();
  const { toast } = useToast();
  const { data: publicSettings, isLoading: settingsLoading } = useQuery<{ orgName: string; systemName: string; theme: string; copyrightOwner: string; logoUrl: string | null }>({
    queryKey: ["/api/settings/public"],
    staleTime: 1000 * 60 * 5,
  });

  const [recoveryData, setRecoveryData] = useState({
    username: "",
    employeeName: "",
    companyNumber: "",
    mobilePhone: "",
    landlinePhone: "",
  });
  const [recoverySubmitted, setRecoverySubmitted] = useState(false);
  const [recoveryLoading, setRecoveryLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      toast({ title: "تنبيه", description: "يرجى إدخال اسم المستخدم وكلمة المرور", variant: "destructive" });
      return;
    }
    try {
      await login({ username, password });
    } catch (err: any) {
      const msg = err?.message || "حدث خطأ";
      const parsed = msg.includes(":") ? msg.split(":").slice(1).join(":").trim() : msg;
      let errorText = "حدث خطأ في تسجيل الدخول";
      try { errorText = JSON.parse(parsed).message; } catch { errorText = parsed; }
      toast({ title: "خطأ في تسجيل الدخول", description: errorText, variant: "destructive" });
    }
  };

  const handleRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryData.username || !recoveryData.employeeName) {
      toast({ title: "تنبيه", description: "يرجى إدخال اسم المستخدم واسم الموظف", variant: "destructive" });
      return;
    }
    setRecoveryLoading(true);
    try {
      await apiRequest("POST", "/api/auth/reset-request", recoveryData);
      setRecoverySubmitted(true);
    } catch (err: any) {
      toast({ title: "خطأ", description: "حدث خطأ في إرسال الطلب", variant: "destructive" });
    } finally {
      setRecoveryLoading(false);
    }
  };

  if (showRecovery) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 p-4" dir="rtl">
        <Card className="w-full max-w-md p-8 shadow-lg border-0 bg-white/90 backdrop-blur-sm">
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <KeyRound className="w-7 h-7 text-primary" />
            </div>
            <h2 className="text-xl font-bold">استعادة كلمة المرور</h2>
            <p className="text-sm text-muted-foreground mt-1">أدخل بياناتك وسيتم التواصل معك من قبل مدير النظام</p>
          </div>

          {recoverySubmitted ? (
            <div className="text-center py-6 space-y-3">
              <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto" />
              <h3 className="font-semibold text-lg">تم إرسال الطلب بنجاح</h3>
              <p className="text-sm text-muted-foreground">سيقوم مدير النظام بالتواصل معك عبر الهاتف لإبلاغك بكلمة المرور الجديدة</p>
              <Button variant="outline" onClick={() => { setShowRecovery(false); setRecoverySubmitted(false); }} className="mt-4" data-testid="button-back-to-login">
                <ArrowRight className="w-4 h-4 ml-2" />
                العودة لتسجيل الدخول
              </Button>
            </div>
          ) : (
            <form onSubmit={handleRecovery} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="rec-username">اسم المستخدم *</Label>
                <div className="relative">
                  <User className="absolute right-3 top-2.5 w-4 h-4 text-muted-foreground" />
                  <Input id="rec-username" className="pr-10" placeholder="أدخل اسم المستخدم" value={recoveryData.username}
                    onChange={(e) => setRecoveryData(d => ({ ...d, username: e.target.value }))} data-testid="input-rec-username" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rec-name">اسم الموظف الكامل *</Label>
                <Input id="rec-name" placeholder="أدخل اسمك الكامل" value={recoveryData.employeeName}
                  onChange={(e) => setRecoveryData(d => ({ ...d, employeeName: e.target.value }))} data-testid="input-rec-name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rec-company">رقم الشركة</Label>
                <div className="relative">
                  <Hash className="absolute right-3 top-2.5 w-4 h-4 text-muted-foreground" />
                  <Input id="rec-company" className="pr-10" placeholder="رقم الشركة للموظف" value={recoveryData.companyNumber}
                    onChange={(e) => setRecoveryData(d => ({ ...d, companyNumber: e.target.value }))} data-testid="input-rec-company" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="rec-mobile">هاتف موبايل</Label>
                  <div className="relative">
                    <Phone className="absolute right-3 top-2.5 w-4 h-4 text-muted-foreground" />
                    <Input id="rec-mobile" className="pr-10" placeholder="07xxxxxxxxx" value={recoveryData.mobilePhone}
                      onChange={(e) => setRecoveryData(d => ({ ...d, mobilePhone: e.target.value }))} data-testid="input-rec-mobile" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rec-landline">هاتف أرضي</Label>
                  <div className="relative">
                    <Phone className="absolute right-3 top-2.5 w-4 h-4 text-muted-foreground" />
                    <Input id="rec-landline" className="pr-10" placeholder="رقم الهاتف الأرضي" value={recoveryData.landlinePhone}
                      onChange={(e) => setRecoveryData(d => ({ ...d, landlinePhone: e.target.value }))} data-testid="input-rec-landline" />
                  </div>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={recoveryLoading} data-testid="button-send-recovery">
                {recoveryLoading ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
                إرسال الطلب
              </Button>
              <Button type="button" variant="ghost" className="w-full text-sm" onClick={() => setShowRecovery(false)} data-testid="button-cancel-recovery">
                <ArrowRight className="w-4 h-4 ml-2" />
                العودة لتسجيل الدخول
              </Button>
            </form>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 p-4" dir="rtl">
      <Card className="w-full max-w-sm p-8 shadow-lg border-0 bg-white/90 backdrop-blur-sm">
        <div className="text-center mb-8">
          {settingsLoading ? (
            <div className="w-20 h-20 mx-auto mb-4" />
          ) : publicSettings?.logoUrl ? (
            <div className="w-20 h-20 mx-auto mb-4">
              <img src={publicSettings.logoUrl} alt="شعار النظام" className="w-full h-full object-contain" data-testid="img-login-logo" />
            </div>
          ) : (
            <div className="w-16 h-16 rounded-xl bg-primary flex items-center justify-center mx-auto mb-4 shadow-md">
              <FileText className="w-8 h-8 text-primary-foreground" />
            </div>
          )}
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-system-name">{publicSettings?.systemName || "نظام إدارة المعاملات الإلكتروني"}</h1>
          <p className="text-sm text-muted-foreground mt-1" data-testid="text-org-name">{publicSettings?.orgName || "شركة نفط الوسط"}</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="username" className="text-sm font-medium">اسم المستخدم</Label>
            <div className="relative">
              <User className="absolute right-3 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input
                id="username"
                className="pr-10 h-10"
                placeholder="أدخل اسم المستخدم"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                data-testid="input-username"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-medium">كلمة المرور</Label>
            <div className="relative">
              <KeyRound className="absolute right-3 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                className="pr-10 pl-10 h-10"
                placeholder="أدخل كلمة المرور"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                data-testid="input-password"
              />
              <button
                type="button"
                className="absolute left-3 top-2.5 text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                data-testid="button-toggle-password"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <Button type="submit" className="w-full h-10" disabled={isLoggingIn} data-testid="button-login">
            {isLoggingIn ? (
              <Loader2 className="w-4 h-4 animate-spin ml-2" />
            ) : (
              <LogIn className="w-4 h-4 ml-2" />
            )}
            تسجيل الدخول
          </Button>
        </form>

        <div className="mt-4 text-center">
          <button
            type="button"
            className="text-xs text-primary hover:underline transition-colors"
            onClick={() => setShowRecovery(true)}
            data-testid="button-forgot-password"
          >
            نسيت كلمة المرور؟
          </button>
        </div>

        <div className="mt-6 pt-4 border-t text-center">
          <p className="text-[10px] text-muted-foreground/60" data-testid="text-login-copyright">
            {publicSettings?.copyrightOwner
              ? `جميع الحقوق محفوظة \u00A9 ${new Date().getFullYear()} ${publicSettings.copyrightOwner}`
              : `\u00A9 ${new Date().getFullYear()} نظام إدارة المعاملات الإلكتروني`}
          </p>
        </div>
      </Card>
    </div>
  );
}
