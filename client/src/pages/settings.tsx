import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import type { Employee, Department, Correspondence } from "@shared/schema";
import { Switch } from "@/components/ui/switch";
import {
  Settings,
  Palette,
  Database,
  Users,
  Activity,
  Save,
  Loader2,
  CheckCircle2,
  Clock,
  KeyRound,
  XCircle,
  Eye,
  EyeOff,
  Shield,
  Upload,
  ImageIcon,
  Trash2,
  Copyright,
  User,
  Search,
  Bell,
  Send,
  Printer,
  Network,
  FileX,
  AlertTriangle,
  Ban,
  RotateCcw,
  ShieldAlert,
} from "lucide-react";

function printTable({ title, headers, rows, filters }: { title: string; headers: string[]; rows: string[][]; filters?: string[] }) {
  const win = window.open("", "_blank");
  if (!win) return;
  const filterHtml = filters?.length ? `<div style="margin-bottom:12px;font-size:12px;color:#666;display:flex;gap:16px;flex-wrap:wrap;justify-content:center;">${filters.map(f => `<span style="background:#f0f0f0;padding:2px 10px;border-radius:8px;">${f}</span>`).join("")}</div>` : "";
  win.document.write(`<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${title}</title><style>
    @media print { @page { size: A4 landscape; margin: 15mm; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; margin: 0; padding: 20px; direction: rtl; }
    h2 { text-align: center; margin-bottom: 4px; font-size: 18px; }
    .date { text-align: center; font-size: 11px; color: #888; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { background: #1a365d; color: white; padding: 8px 10px; text-align: right; font-weight: 600; }
    td { padding: 7px 10px; border-bottom: 1px solid #e2e8f0; text-align: right; }
    tr:nth-child(even) { background: #f8fafc; }
    .count { text-align: center; font-size: 11px; color: #666; margin-top: 8px; }
  </style></head><body>
    <h2>${title}</h2>
    <div class="date">${new Date().toLocaleDateString("ar-IQ", { year: "numeric", month: "long", day: "numeric" })} - ${new Date().toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit" })}</div>
    ${filterHtml}
    <table><thead><tr>${headers.map(h => `<th>${h}</th>`).join("")}</tr></thead>
    <tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>
    <div class="count">عدد السجلات: ${rows.length}</div>
  </body></html>`);
  win.document.close();
  setTimeout(() => win.print(), 300);
}

function GeneralSettings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: settings, isLoading } = useQuery<Record<string, string>>({ queryKey: ["/api/settings"] });
  const { data: publicSettings } = useQuery<{ logoUrl: string | null; copyrightOwner: string }>({ queryKey: ["/api/settings/public"] });
  const [orgName, setOrgName] = useState("");
  const [systemName, setSystemName] = useState("");
  const [copyrightOwner, setCopyrightOwner] = useState("");
  const [extStartNumber, setExtStartNumber] = useState("");
  const [extEndNumber, setExtEndNumber] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (settings && !initialized) {
      setOrgName(settings.orgName || "");
      setSystemName(settings.systemName || "");
      setCopyrightOwner(settings.copyrightOwner || "");
      setExtStartNumber(settings.externalOutgoingStartNumber || "");
      setExtEndNumber(settings.externalOutgoingEndNumber || "");
      setInitialized(true);
    }
  }, [settings, initialized]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PUT", "/api/settings", { orgName, systemName, copyrightOwner, externalOutgoingStartNumber: extStartNumber, externalOutgoingEndNumber: extEndNumber });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/settings/public"] });
      toast({ title: "تم الحفظ", description: "تم حفظ الإعدادات بنجاح" });
    },
  });

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "خطأ", description: "يرجى اختيار ملف صورة فقط", variant: "destructive" });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "خطأ", description: "حجم الملف يجب أن لا يتجاوز 2MB", variant: "destructive" });
      return;
    }
    setLogoUploading(true);
    try {
      const formData = new FormData();
      formData.append("logo", file);
      const res = await fetch("/api/settings/logo", { method: "POST", body: formData, credentials: "include" });
      if (!res.ok) throw new Error("Upload failed");
      queryClient.invalidateQueries({ queryKey: ["/api/settings/public"] });
      toast({ title: "تم رفع الشعار بنجاح" });
    } catch {
      toast({ title: "خطأ في رفع الشعار", variant: "destructive" });
    } finally {
      setLogoUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleLogoDelete = async () => {
    try {
      await apiRequest("DELETE", "/api/settings/logo");
      queryClient.invalidateQueries({ queryKey: ["/api/settings/public"] });
      toast({ title: "تم حذف الشعار" });
    } catch {
      toast({ title: "خطأ في حذف الشعار", variant: "destructive" });
    }
  };

  if (isLoading) return <Skeleton className="h-48" />;

  const currentYear = new Date().getFullYear();
  const copyrightPreview = copyrightOwner
    ? `جميع الحقوق محفوظة \u00A9 ${currentYear} ${copyrightOwner}`
    : "";

  return (
    <Card className="p-6">
      <h3 className="font-semibold mb-4 flex items-center gap-2">
        <Settings className="w-4 h-4 text-primary" />
        الإعدادات العامة
      </h3>
      <div className="space-y-6">
        <div className="space-y-4 max-w-md">
          <div className="space-y-2">
            <Label>اسم المؤسسة</Label>
            <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="شركة نفط الوسط" data-testid="input-org-name" />
          </div>
          <div className="space-y-2">
            <Label>اسم النظام</Label>
            <Input value={systemName} onChange={(e) => setSystemName(e.target.value)} placeholder="نظام إدارة المعاملات الإلكتروني" data-testid="input-system-name" />
          </div>
        </div>

        <div className="border-t pt-4">
          <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
            <Database className="w-4 h-4 text-primary" />
            الترقيم التسلسلي للصادر الخارجي
          </h4>
          <p className="text-xs text-muted-foreground mb-3">
            يتم تثبيت بداية ونهاية الرقم التسلسلي للصادر الخارجي لمرة واحدة. عند بداية كل سنة جديدة يتم إعادة العداد تلقائياً إلى رقم البداية المحدد.
          </p>
          <div className="grid grid-cols-2 gap-4 max-w-md">
            <div className="space-y-2">
              <Label>رقم البداية</Label>
              <Input
                type="number"
                min="1"
                value={extStartNumber}
                onChange={(e) => setExtStartNumber(e.target.value)}
                placeholder="مثال: 1"
                data-testid="input-ext-start-number"
              />
            </div>
            <div className="space-y-2">
              <Label>رقم النهاية</Label>
              <Input
                type="number"
                min="1"
                value={extEndNumber}
                onChange={(e) => setExtEndNumber(e.target.value)}
                placeholder="مثال: 9999"
                data-testid="input-ext-end-number"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            الرقم التسلسلي للصادر الخارجي مشترك لجميع الجهات داخل المؤسسة (عداد واحد موحد). أما الصادر الداخلي فلكل جهة مركزية عداد مستقل يبدأ من 1.
          </p>
        </div>

        <div className="border-t pt-4">
          <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-primary" />
            شعار النظام
          </h4>
          <div className="flex items-start gap-4">
            <div className="w-20 h-20 rounded-lg border-2 border-dashed flex items-center justify-center bg-muted/30 overflow-hidden shrink-0" data-testid="logo-preview">
              {publicSettings?.logoUrl ? (
                <img src={publicSettings.logoUrl + "?t=" + Date.now()} alt="شعار النظام" className="w-full h-full object-contain" />
              ) : (
                <ImageIcon className="w-8 h-8 text-muted-foreground/40" />
              )}
            </div>
            <div className="space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
                className="hidden"
                onChange={handleLogoUpload}
                data-testid="input-logo-file"
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={logoUploading}
                  data-testid="button-upload-logo"
                >
                  {logoUploading ? <Loader2 className="w-4 h-4 ml-1 animate-spin" /> : <Upload className="w-4 h-4 ml-1" />}
                  رفع شعار
                </Button>
                {publicSettings?.logoUrl && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={handleLogoDelete}
                    data-testid="button-delete-logo"
                  >
                    <Trash2 className="w-4 h-4 ml-1" />
                    حذف
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">PNG, JPG, SVG أو WebP - حجم أقصى 2MB</p>
            </div>
          </div>
        </div>

        <div className="border-t pt-4">
          <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
            <Copyright className="w-4 h-4 text-primary" />
            حقوق الملكية
          </h4>
          <div className="space-y-3 max-w-md">
            <div className="space-y-2">
              <Label>الجهة المالكة</Label>
              <Input
                value={copyrightOwner}
                onChange={(e) => setCopyrightOwner(e.target.value)}
                placeholder="مثال: شركة نفط الوسط"
                data-testid="input-copyright-owner"
              />
              <p className="text-xs text-muted-foreground">أدخل اسم الجهة المالكة لتظهر في عبارة حقوق الملكية</p>
            </div>
            {copyrightPreview && (
              <div className="p-3 rounded-lg bg-muted/50 border text-sm text-center" data-testid="text-copyright-preview">
                {copyrightPreview}
              </div>
            )}
          </div>
        </div>

        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} data-testid="button-save-settings">
          {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <Save className="w-4 h-4 ml-2" />}
          حفظ الإعدادات
        </Button>
      </div>
    </Card>
  );
}

const themePresets = [
  { id: "blue", name: "أزرق هادئ", primary: "210 82% 42%", desc: "اللون الافتراضي - مهني وهادئ" },
  { id: "teal", name: "أخضر مائي", primary: "178 72% 38%", desc: "منعش وحديث" },
  { id: "green", name: "أخضر طبيعي", primary: "152 62% 36%", desc: "مريح للعين وطبيعي" },
  { id: "purple", name: "بنفسجي أنيق", primary: "262 68% 48%", desc: "أنيق ومميز" },
  { id: "warm", name: "دافئ", primary: "24 78% 42%", desc: "دافئ وودي" },
];

function ThemeSettings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: settings } = useQuery<Record<string, string>>({ queryKey: ["/api/settings"] });
  const currentTheme = settings?.theme || "blue";

  const saveMutation = useMutation({
    mutationFn: async (themeId: string) => {
      await apiRequest("PUT", "/api/settings", { theme: themeId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/settings/public"] });
      toast({ title: "تم", description: "تم تغيير الثيم بنجاح" });
    },
  });

  return (
    <Card className="p-6">
      <h3 className="font-semibold mb-4 flex items-center gap-2">
        <Palette className="w-4 h-4 text-primary" />
        ثيم الألوان
      </h3>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {themePresets.map((theme) => (
          <button
            key={theme.id}
            onClick={() => saveMutation.mutate(theme.id)}
            className={`p-4 rounded-lg border-2 text-right transition-all ${
              currentTheme === theme.id
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/30"
            }`}
            data-testid={`button-theme-${theme.id}`}
          >
            <div className="flex items-center gap-3 mb-2">
              <div
                className="w-8 h-8 rounded-full shrink-0"
                style={{ backgroundColor: `hsl(${theme.primary})` }}
              />
              <span className="font-medium text-sm">{theme.name}</span>
              {currentTheme === theme.id && <CheckCircle2 className="w-4 h-4 text-primary mr-auto" />}
            </div>
            <p className="text-xs text-muted-foreground">{theme.desc}</p>
          </button>
        ))}
      </div>
    </Card>
  );
}

function PasswordResetRequests() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: requests, isLoading } = useQuery<any[]>({ queryKey: ["/api/password-reset-requests"] });
  const { data: allEmployees } = useQuery<Employee[]>({ queryKey: ["/api/employees"] });
  const [newPasswords, setNewPasswords] = useState<Record<number, string>>({});
  const [showPw, setShowPw] = useState<Record<number, boolean>>({});
  const [searchUser, setSearchUser] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [activeTab, setActiveTab] = useState<"pending" | "processed">("pending");

  const processMutation = useMutation({
    mutationFn: async ({ id, status, newPassword }: { id: number; status: string; newPassword?: string }) => {
      await apiRequest("PATCH", `/api/password-reset-requests/${id}`, { status, newPassword });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/password-reset-requests"] });
      toast({ title: "تم", description: "تم معالجة الطلب" });
    },
  });

  if (isLoading) return <Skeleton className="h-48" />;

  const filterRequests = (list: any[]) => {
    return list.filter((r: any) => {
      if (searchUser !== "all" && r.username !== searchUser && r.employeeName !== searchUser) return false;
      if (dateFrom) {
        const reqDate = new Date(r.createdAt).toISOString().split("T")[0];
        if (reqDate < dateFrom) return false;
      }
      if (dateTo) {
        const reqDate = new Date(r.createdAt).toISOString().split("T")[0];
        if (reqDate > dateTo) return false;
      }
      return true;
    });
  };

  const pendingRequests = filterRequests(requests?.filter(r => r.status === "pending") || []);
  const processedRequests = filterRequests(requests?.filter(r => r.status !== "pending") || []);

  const uniqueUsers = Array.from(new Set((requests || []).map(r => r.username)));

  const clearFilters = () => {
    setSearchUser("all");
    setDateFrom("");
    setDateTo("");
  };

  return (
    <Card className="p-6">
      <h3 className="font-semibold mb-4 flex items-center gap-2">
        <KeyRound className="w-4 h-4 text-primary" />
        طلبات إعادة تعيين كلمة المرور
        {pendingRequests.length > 0 && (
          <Badge variant="destructive" className="mr-2">{pendingRequests.length} طلب جديد</Badge>
        )}
      </h3>

      <div className="flex items-end gap-3 mb-4 flex-wrap">
        <div className="space-y-1">
          <Label className="text-xs">الحساب</Label>
          <Select value={searchUser} onValueChange={setSearchUser}>
            <SelectTrigger className="h-9 text-sm w-48" data-testid="select-reset-user">
              <SelectValue placeholder="جميع الحسابات" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الحسابات</SelectItem>
              {uniqueUsers.map(u => (
                <SelectItem key={u} value={u}>{u}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">من تاريخ</Label>
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-9 text-sm w-40" data-testid="input-reset-date-from" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">إلى تاريخ</Label>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-9 text-sm w-40" data-testid="input-reset-date-to" />
        </div>
        {(searchUser !== "all" || dateFrom || dateTo) && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 text-xs" data-testid="button-clear-reset-filters">
            مسح الفلاتر
          </Button>
        )}
      </div>

      <div className="flex gap-2 mb-4">
        <Button
          variant={activeTab === "pending" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveTab("pending")}
          data-testid="tab-pending-requests"
        >
          طلبات قيد الانتظار
          {pendingRequests.length > 0 && <Badge variant="secondary" className="mr-2 bg-white/20 text-inherit">{pendingRequests.length}</Badge>}
        </Button>
        <Button
          variant={activeTab === "processed" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveTab("processed")}
          data-testid="tab-processed-requests"
        >
          طلبات منجزة
          {processedRequests.length > 0 && <Badge variant="secondary" className="mr-2">{processedRequests.length}</Badge>}
        </Button>
      </div>

      {activeTab === "pending" && (
        <>
          {pendingRequests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <KeyRound className="w-8 h-8 mx-auto mb-2 opacity-40" />
              لا توجد طلبات قيد الانتظار
            </div>
          ) : (
            <div className="space-y-3">
              {pendingRequests.map((req: any) => (
                <div key={req.id} className="p-4 rounded-lg border bg-amber-50/50 dark:bg-amber-950/20 space-y-3" data-testid={`reset-request-${req.id}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{req.employeeName}</p>
                      <p className="text-sm text-muted-foreground">المستخدم: {req.username}</p>
                      {req.companyNumber && <p className="text-xs text-muted-foreground">رقم الشركة: {req.companyNumber}</p>}
                      {req.mobilePhone && <p className="text-xs text-muted-foreground">موبايل: {req.mobilePhone}</p>}
                      {req.landlinePhone && <p className="text-xs text-muted-foreground">أرضي: {req.landlinePhone}</p>}
                      <p className="text-xs text-muted-foreground mt-1">{new Date(req.createdAt).toLocaleDateString("ar-IQ")} - {new Date(req.createdAt).toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit" })}</p>
                    </div>
                    <Badge variant="secondary" className="bg-amber-100 text-amber-700">قيد الانتظار</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Input
                        type={showPw[req.id] ? "text" : "password"}
                        placeholder="كلمة المرور الجديدة"
                        value={newPasswords[req.id] || ""}
                        onChange={(e) => setNewPasswords(p => ({ ...p, [req.id]: e.target.value }))}
                        className="pl-10"
                        data-testid={`input-new-password-${req.id}`}
                      />
                      <button type="button" className="absolute left-3 top-2.5 text-muted-foreground"
                        onClick={() => setShowPw(p => ({ ...p, [req.id]: !p[req.id] }))}>
                        {showPw[req.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <Button size="sm" onClick={() => processMutation.mutate({ id: req.id, status: "completed", newPassword: newPasswords[req.id] })}
                      disabled={!newPasswords[req.id] || newPasswords[req.id].length < 6 || processMutation.isPending}
                      data-testid={`button-approve-reset-${req.id}`}>
                      <CheckCircle2 className="w-4 h-4 ml-1" />
                      تعيين
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => processMutation.mutate({ id: req.id, status: "rejected" })}
                      disabled={processMutation.isPending}
                      data-testid={`button-reject-reset-${req.id}`}>
                      <XCircle className="w-4 h-4 ml-1" />
                      رفض
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === "processed" && (
        <>
          {processedRequests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
              لا توجد طلبات منجزة
            </div>
          ) : (
            <div className="space-y-2">
              {processedRequests.map((req: any) => (
                <div key={req.id} className="p-3 rounded-lg border" data-testid={`processed-request-${req.id}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{req.employeeName}</p>
                      <p className="text-xs text-muted-foreground">المستخدم: {req.username}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        تاريخ الطلب: {new Date(req.createdAt).toLocaleDateString("ar-IQ")}
                        {req.processedAt && ` | تاريخ المعالجة: ${new Date(req.processedAt).toLocaleDateString("ar-IQ")}`}
                      </p>
                    </div>
                    <Badge variant="secondary" className={req.status === "completed" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}>
                      {req.status === "completed" ? "تم التعيين" : "مرفوض"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Card>
  );
}

function ActiveUsersLog() {
  const { data: users, isLoading } = useQuery<any[]>({ queryKey: ["/api/active-users"] });
  const [searchText, setSearchText] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const roleLabels: Record<string, string> = {
    admin: "مدير نظام",
    officer: "مسؤول",
    employee: "موظف",
  };

  const filtered = useMemo(() => {
    if (!users) return [];
    return users.filter((u: any) => {
      if (searchText) {
        const s = searchText.toLowerCase();
        if (!u.fullName?.toLowerCase().includes(s) && !u.username?.toLowerCase().includes(s) && !u.departmentName?.toLowerCase().includes(s)) return false;
      }
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      if (statusFilter === "online" && !u.isOnline) return false;
      if (statusFilter === "offline" && u.isOnline) return false;
      return true;
    });
  }, [users, searchText, roleFilter, statusFilter]);

  const onlineCount = users?.filter((u: any) => u.isOnline).length || 0;
  const offlineCount = users ? users.length - onlineCount : 0;

  if (isLoading) return <Skeleton className="h-48" />;

  const handlePrintUsers = () => {
    const activeFilters: string[] = [];
    if (searchText) activeFilters.push(`بحث: ${searchText}`);
    if (roleFilter !== "all") activeFilters.push(`الفئة: ${roleLabels[roleFilter] || roleFilter}`);
    if (statusFilter === "online") activeFilters.push("الحالة: متصل");
    if (statusFilter === "offline") activeFilters.push("الحالة: غير متصل");

    printTable({
      title: "تقرير المستخدمين",
      headers: ["#", "الاسم", "اسم المستخدم", "القسم", "الفئة", "الحالة", "آخر اتصال", "IP", "الموقع"],
      rows: filtered.map((u: any, i: number) => [
        (i + 1).toString(),
        u.fullName || "-",
        u.username || "-",
        u.departmentName || "-",
        roleLabels[u.role] || u.role || "-",
        u.isOnline ? "متصل" : "غير متصل",
        u.lastLoginAt ? `${new Date(u.lastLoginAt).toLocaleDateString("ar-IQ")} ${new Date(u.lastLoginAt).toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit" })}` : "لم يسجل دخول",
        u.lastLoginIp || "-",
        u.lastLoginLocation || "-",
      ]),
      filters: activeFilters.length > 0 ? activeFilters : undefined,
    });
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          المستخدمون ({users?.length || 0})
        </h3>
        <Button variant="outline" size="sm" onClick={handlePrintUsers} disabled={filtered.length === 0} className="gap-1.5 h-8 text-xs" data-testid="button-print-users">
          <Printer className="w-3.5 h-3.5" />
          طباعة
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3 text-xs">
        <Badge variant="outline" className="gap-1">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          متصل: {onlineCount}
        </Badge>
        <Badge variant="outline" className="gap-1">
          <div className="w-2 h-2 rounded-full bg-gray-400" />
          غير متصل: {offlineCount}
        </Badge>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="بحث بالاسم أو اسم المستخدم أو القسم..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="pr-9"
            data-testid="input-users-search"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[150px]" data-testid="select-users-role">
            <SelectValue placeholder="الفئة" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع الفئات</SelectItem>
            <SelectItem value="admin">مدير نظام</SelectItem>
            <SelectItem value="officer">مسؤول</SelectItem>
            <SelectItem value="employee">موظف</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]" data-testid="select-users-status">
            <SelectValue placeholder="الحالة" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع الحالات</SelectItem>
            <SelectItem value="online">متصل</SelectItem>
            <SelectItem value="offline">غير متصل</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="text-xs text-muted-foreground mb-2">
        عرض {filtered.length} من {users?.length || 0} مستخدم
      </div>

      <div className="space-y-2 max-h-[500px] overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">لا توجد نتائج مطابقة</div>
        ) : (
          filtered.map((u: any) => (
            <div key={u.id} className="flex items-center justify-between p-3 rounded-lg border bg-background" data-testid={`user-row-${u.id}`}>
              <div className="flex items-center gap-3">
                <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${u.isOnline ? "bg-emerald-500 animate-pulse" : "bg-gray-400"}`} />
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{u.fullName}</p>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{roleLabels[u.role] || u.role}</Badge>
                    {u.isOnline ? (
                      <Badge className="text-[10px] px-1.5 py-0 bg-emerald-100 text-emerald-700 hover:bg-emerald-100">متصل</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-gray-500">غير متصل</Badge>
                    )}
                    {!u.isActive && <Badge variant="destructive" className="text-[10px] px-1.5 py-0">حساب معطّل</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {u.username}
                    {u.departmentName && <span className="mr-2">- {u.departmentName}</span>}
                  </p>
                </div>
              </div>
              <div className="text-left shrink-0">
                {u.lastLoginAt ? (
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="text-[10px] text-muted-foreground">آخر اتصال</span>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {new Date(u.lastLoginAt).toLocaleDateString("ar-IQ")} {new Date(u.lastLoginAt).toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                    {u.lastLoginIp && (
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                        <span className="font-mono">{u.lastLoginIp}</span>
                        {u.lastLoginLocation && (
                          <span className="text-primary/70">({u.lastLoginLocation})</span>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">لم يسجل دخول بعد</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}

function ActivityLog() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string>("all");
  const [selectedRole, setSelectedRole] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const queryParams = new URLSearchParams();
  if (selectedUserId !== "all") queryParams.set("userId", selectedUserId);
  if (dateFrom) queryParams.set("dateFrom", dateFrom);
  if (dateTo) queryParams.set("dateTo", dateTo);
  const queryString = queryParams.toString();

  const { data: logs, isLoading } = useQuery<any[]>({
    queryKey: ["/api/activity-log", queryString],
    queryFn: async () => {
      const res = await fetch(`/api/activity-log${queryString ? `?${queryString}` : ""}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data: allEmployees } = useQuery<Employee[]>({ queryKey: ["/api/employees"] });

  const filteredLogs = useMemo(() => {
    return (logs || []).filter((log: any) => {
      if (selectedRole !== "all" && log.performerRole !== selectedRole) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.trim().toLowerCase();
      return (
        (log.performerName && log.performerName.toLowerCase().includes(q)) ||
        (log.performerUsername && log.performerUsername.toLowerCase().includes(q)) ||
        (log.details && log.details.toLowerCase().includes(q)) ||
        (log.action && log.action.toLowerCase().includes(q))
      );
    });
  }, [logs, searchQuery, selectedRole]);

  const actionLabels: Record<string, string> = {
    login: "تسجيل دخول",
    logout: "تسجيل خروج",
    change_password: "تغيير كلمة المرور",
    admin_reset_password: "إعادة تعيين كلمة مرور",
    create: "إنشاء",
    update: "تعديل",
    delete: "حذف",
    upload_logo: "رفع شعار",
    delete_logo: "حذف شعار",
    update_signature: "تحديث التوقيع",
    delete_signature: "حذف التوقيع",
  };

  const moduleLabels: Record<string, string> = {
    auth: "المصادقة",
    settings: "الإعدادات",
    correspondence: "المراسلات",
    departments: "الأقسام",
    employees: "الموظفين",
    leave_requests: "الإجازات",
    service_requests: "الخدمات",
    permissions: "الصلاحيات",
  };

  const roleLabels: Record<string, string> = {
    admin: "مدير النظام",
    officer: "مسؤول",
    employee: "موظف",
  };

  const actionColors: Record<string, string> = {
    login: "bg-emerald-100 text-emerald-700",
    logout: "bg-slate-100 text-slate-700",
    create: "bg-blue-100 text-blue-700",
    update: "bg-amber-100 text-amber-700",
    delete: "bg-red-100 text-red-700",
    change_password: "bg-purple-100 text-purple-700",
    admin_reset_password: "bg-orange-100 text-orange-700",
    upload_logo: "bg-teal-100 text-teal-700",
    delete_logo: "bg-red-100 text-red-700",
    update_signature: "bg-indigo-100 text-indigo-700",
    delete_signature: "bg-rose-100 text-rose-700",
  };

  const clearFilters = () => {
    setSelectedUserId("all");
    setSelectedRole("all");
    setDateFrom("");
    setDateTo("");
    setSearchQuery("");
  };

  const handlePrintActivity = () => {
    const activeFilters: string[] = [];
    if (selectedUserId !== "all") {
      const emp = allEmployees?.find(e => e.id.toString() === selectedUserId);
      activeFilters.push(`المستخدم: ${emp?.fullName || selectedUserId}`);
    }
    if (selectedRole !== "all") activeFilters.push(`الفئة: ${roleLabels[selectedRole] || selectedRole}`);
    if (dateFrom) activeFilters.push(`من: ${dateFrom}`);
    if (dateTo) activeFilters.push(`إلى: ${dateTo}`);
    if (searchQuery) activeFilters.push(`بحث: ${searchQuery}`);

    printTable({
      title: "سجل النشاطات",
      headers: ["#", "النشاط", "الوحدة", "المستخدم", "الفئة", "التفاصيل", "IP", "التاريخ والوقت"],
      rows: filteredLogs.map((log: any, i: number) => [
        (i + 1).toString(),
        actionLabels[log.action] || log.action || "-",
        moduleLabels[log.module] || log.module || "-",
        log.performerName ? `${log.performerName} (${log.performerUsername})` : "-",
        roleLabels[log.performerRole] || log.performerRole || "-",
        log.details || "-",
        log.ipAddress || "-",
        log.createdAt ? `${new Date(log.createdAt).toLocaleDateString("ar-IQ")} ${new Date(log.createdAt).toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : "-",
      ]),
      filters: activeFilters.length > 0 ? activeFilters : undefined,
    });
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4 gap-3">
        <h3 className="font-semibold flex items-center gap-2 shrink-0">
          <Activity className="w-4 h-4 text-primary" />
          سجل النشاطات
        </h3>
        <div className="flex items-center gap-2">
          <div className="relative w-full max-w-xs">
            <Search className="absolute right-3 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="بحث باسم المستخدم أو النشاط..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-10 h-9 text-sm"
              data-testid="input-activity-search"
            />
          </div>
          <Button variant="outline" size="sm" onClick={handlePrintActivity} disabled={filteredLogs.length === 0} className="gap-1.5 h-9 text-xs shrink-0" data-testid="button-print-activity">
            <Printer className="w-3.5 h-3.5" />
            طباعة
          </Button>
        </div>
      </div>

      <div className="flex items-end gap-3 mb-4 flex-wrap">
        <div className="space-y-1">
          <Label className="text-xs">المستخدم</Label>
          <Select value={selectedUserId} onValueChange={setSelectedUserId}>
            <SelectTrigger className="h-9 text-sm w-48" data-testid="select-activity-user">
              <SelectValue placeholder="جميع المستخدمين" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع المستخدمين</SelectItem>
              {(allEmployees || []).map(e => (
                <SelectItem key={e.id} value={e.id.toString()}>{e.fullName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">فئة الحساب</Label>
          <Select value={selectedRole} onValueChange={setSelectedRole}>
            <SelectTrigger className="h-9 text-sm w-40" data-testid="select-activity-role">
              <SelectValue placeholder="جميع الفئات" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الفئات</SelectItem>
              <SelectItem value="admin">مدير نظام</SelectItem>
              <SelectItem value="officer">مسؤول</SelectItem>
              <SelectItem value="employee">موظف</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">من تاريخ</Label>
          <Input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="h-9 text-sm w-40"
            data-testid="input-activity-date-from"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">إلى تاريخ</Label>
          <Input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="h-9 text-sm w-40"
            data-testid="input-activity-date-to"
          />
        </div>
        {(selectedUserId !== "all" || selectedRole !== "all" || dateFrom || dateTo) && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 text-xs" data-testid="button-clear-activity-filters">
            مسح الفلاتر
          </Button>
        )}
      </div>
      <div className="text-xs text-muted-foreground mb-2">
        عرض {filteredLogs.length} من {logs?.length || 0} نشاط
      </div>
      {!logs || logs.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          <Activity className="w-8 h-8 mx-auto mb-2 opacity-40" />
          لا توجد نشاطات مسجلة
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          <Search className="w-8 h-8 mx-auto mb-2 opacity-40" />
          لا توجد نتائج مطابقة للبحث
        </div>
      ) : (
        <div className="space-y-2 max-h-[600px] overflow-y-auto">
          {filteredLogs.map((log: any) => (
            <div key={log.id} className="p-3 rounded-lg border bg-background text-sm" data-testid={`activity-log-item-${log.id}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${actionColors[log.action] || "bg-gray-100 text-gray-700"}`}>
                      {actionLabels[log.action] || log.action}
                    </span>
                    {log.module && (
                      <span className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                        {moduleLabels[log.module] || log.module}
                      </span>
                    )}
                  </div>
                  {log.performerName && (
                    <div className="flex items-center gap-2 text-xs">
                      <User className="w-3 h-3 text-muted-foreground shrink-0" />
                      <span className="font-medium">{log.performerName}</span>
                      <span className="text-muted-foreground">({log.performerUsername})</span>
                      {log.performerRole && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                          {roleLabels[log.performerRole] || log.performerRole}
                        </Badge>
                      )}
                    </div>
                  )}
                  {log.details && (
                    <p className="text-xs text-muted-foreground leading-relaxed">{log.details}</p>
                  )}
                  {log.ipAddress && (
                    <span className="text-[10px] text-muted-foreground/60">IP: {log.ipAddress}</span>
                  )}
                </div>
                <div className="text-[11px] text-muted-foreground flex flex-col items-end gap-0.5 shrink-0 pt-0.5">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(log.createdAt).toLocaleDateString("ar-IQ")}
                  </div>
                  <span>{new Date(log.createdAt).toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function SystemNotifications() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const [targetType, setTargetType] = useState<string>("");
  const [selectedEmployees, setSelectedEmployees] = useState<number[]>([]);
  const [empSearch, setEmpSearch] = useState("");

  const { data: employees } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
  });

  const activeEmployees = useMemo(() => (employees || []).filter(e => e.isActive), [employees]);

  const filteredEmployees = useMemo(() => {
    if (!empSearch) return activeEmployees;
    return activeEmployees.filter(e =>
      e.fullName.includes(empSearch) || e.username?.includes(empSearch)
    );
  }, [activeEmployees, empSearch]);

  const sendMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/notifications/send", {
        message,
        targetType,
        specificEmployeeIds: targetType === "specific" ? selectedEmployees : undefined,
      });
    },
    onSuccess: () => {
      toast({ title: "تم إرسال الإشعار بنجاح" });
      setMessage("");
      setTargetType("");
      setSelectedEmployees([]);
      queryClient.invalidateQueries({ queryKey: ["/api/activity-log"] });
    },
    onError: () => {
      toast({ title: "خطأ", description: "حدث خطأ في إرسال الإشعار", variant: "destructive" });
    },
  });

  const targetLabels: Record<string, string> = {
    all: "جميع الحسابات",
    admin: "فئة مدير النظام",
    officer: "فئة المسؤول",
    employee: "فئة الموظف",
    specific: "حسابات محددة",
  };

  const toggleEmployee = (id: number) => {
    setSelectedEmployees(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const canSend = message.trim() && targetType && (targetType !== "specific" || selectedEmployees.length > 0);

  return (
    <Card className="p-6" data-testid="card-notifications">
      <div className="flex items-center gap-2 mb-4">
        <Bell className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold">إرسال إشعارات النظام</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        إرسال إشعارات لمستخدمي النظام لإبلاغهم بأحداث مهمة مثل تحديثات النظام أو مواعيد الصيانة
      </p>

      <div className="space-y-4">
        <div>
          <Label className="text-sm mb-1.5 block">نص الإشعار</Label>
          <Textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="اكتب نص الإشعار هنا..."
            className="min-h-[100px]"
            data-testid="input-notification-message"
          />
        </div>

        <div>
          <Label className="text-sm mb-1.5 block">إرسال إلى</Label>
          <Select value={targetType} onValueChange={setTargetType}>
            <SelectTrigger data-testid="select-notification-target">
              <SelectValue placeholder="اختر فئة المستلمين" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الحسابات</SelectItem>
              <SelectItem value="admin">فئة مدير النظام</SelectItem>
              <SelectItem value="officer">فئة المسؤول</SelectItem>
              <SelectItem value="employee">فئة الموظف</SelectItem>
              <SelectItem value="specific">حسابات محددة</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {targetType === "specific" && (
          <div className="border rounded-lg p-3 space-y-2">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={empSearch}
                onChange={e => setEmpSearch(e.target.value)}
                placeholder="بحث عن مستخدم..."
                className="pr-9"
                data-testid="input-search-recipients"
              />
            </div>
            {selectedEmployees.length > 0 && (
              <p className="text-xs text-primary font-medium">
                تم اختيار {selectedEmployees.length} مستخدم
              </p>
            )}
            <div className="max-h-48 overflow-y-auto space-y-1">
              {filteredEmployees.map(emp => (
                <label
                  key={emp.id}
                  className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer text-sm"
                  data-testid={`checkbox-recipient-${emp.id}`}
                >
                  <Checkbox
                    checked={selectedEmployees.includes(emp.id)}
                    onCheckedChange={() => toggleEmployee(emp.id)}
                  />
                  <span className="flex-1">{emp.fullName}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {emp.username}
                  </Badge>
                </label>
              ))}
            </div>
          </div>
        )}

        <Button
          onClick={() => sendMutation.mutate()}
          disabled={!canSend || sendMutation.isPending}
          className="w-full"
          data-testid="button-send-notification"
        >
          {sendMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin ml-2" />
          ) : (
            <Send className="w-4 h-4 ml-2" />
          )}
          إرسال الإشعار
          {targetType && targetType !== "specific" && (
            <span className="text-xs opacity-80 mr-2">({targetLabels[targetType]})</span>
          )}
          {targetType === "specific" && selectedEmployees.length > 0 && (
            <span className="text-xs opacity-80 mr-2">({selectedEmployees.length} مستخدم)</span>
          )}
        </Button>
      </div>
    </Card>
  );
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const levelColorClasses: Record<string, { border: string; bg: string; dot: string }> = {
  general_manager: { border: "border-chart-5", bg: "bg-chart-5/10", dot: "bg-chart-5" },
  assistant: { border: "border-chart-1", bg: "bg-chart-1/10", dot: "bg-chart-1" },
  directorate: { border: "border-chart-2", bg: "bg-chart-2/10", dot: "bg-chart-2" },
  section: { border: "border-chart-3", bg: "bg-chart-3/10", dot: "bg-chart-3" },
  division: { border: "border-chart-4", bg: "bg-chart-4/10", dot: "bg-chart-4" },
  unit: { border: "border-primary", bg: "bg-primary/10", dot: "bg-primary" },
};

const printLevelColors: Record<string, { border: string; bg: string; stripe: string }> = {
  general_manager: { border: "#c2410c", bg: "#fff7ed", stripe: "#c2410c" },
  assistant: { border: "#1d4ed8", bg: "#eff6ff", stripe: "#1d4ed8" },
  directorate: { border: "#0e7490", bg: "#ecfeff", stripe: "#0e7490" },
  section: { border: "#15803d", bg: "#f0fdf4", stripe: "#15803d" },
  division: { border: "#7c3aed", bg: "#f5f3ff", stripe: "#7c3aed" },
  unit: { border: "#6b7280", bg: "#f9fafb", stripe: "#6b7280" },
};

function OrgChartTab() {
  const [paperSize, setPaperSize] = useState<"A4" | "A3">("A4");
  const [showManagers, setShowManagers] = useState(false);

  const { data: departments } = useQuery<Department[]>({ queryKey: ["/api/departments"] });
  const { data: employees } = useQuery<Employee[]>({ queryKey: ["/api/employees"] });

  const managerMap = useMemo(() => {
    const map = new Map<number, { fullName: string; username: string }>();
    if (departments && employees) {
      for (const dept of departments) {
        let mgr = null;
        if (dept.managerId) {
          mgr = employees.find(e => e.id === dept.managerId);
        }
        if (!mgr) {
          mgr = employees.find(e => e.departmentId === dept.id);
        }
        if (mgr) map.set(dept.id, { fullName: mgr.fullName, username: (mgr as any).username || "" });
      }
    }
    return map;
  }, [departments, employees]);

  const roots = departments?.filter(d => !d.parentId) || [];

  const renderTreeNode = (dept: Department, allDepts: Department[], level: number): any => {
    const children = allDepts.filter(d => d.parentId === dept.id);
    const mgr = showManagers ? managerMap.get(dept.id) : null;
    const deptLevel = dept.level || "unit";
    const colors = levelColorClasses[deptLevel] || levelColorClasses.unit;
    return (
      <div key={dept.id} className="mb-1.5" data-testid={`orgchart-node-${dept.id}`}>
        <div className={`p-2 rounded-lg border-[1.5px] transition-all ${
          !dept.isActive ? "opacity-50 border-dashed" : colors.border
        } ${colors.bg}`}>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full shrink-0 ${colors.dot}`} />
            <div className="flex-1 min-w-0">
              <span className="font-medium text-sm">{dept.name}</span>
            </div>
            {mgr && (
              <div className="text-xs text-muted-foreground text-left shrink-0">
                <span>{mgr.fullName}</span>
                <span className="text-[11px] opacity-60 mr-1.5">{mgr.username}</span>
              </div>
            )}
          </div>
        </div>
        {children.length > 0 && (
          <div className={`mr-5 border-r-2 pr-4 mt-1 ${colors.border}`}>
            {children.map(c => renderTreeNode(c, allDepts, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const buildNodeHtml = (dept: Department, allDepts: Department[], level: number): string => {
    const children = allDepts.filter(d => d.parentId === dept.id);
    const inactiveCls = !dept.isActive ? " oc-inactive" : "";
    const mgr = showManagers ? managerMap.get(dept.id) : null;
    const deptLevel = dept.level || "unit";
    const pc = printLevelColors[deptLevel] || printLevelColors.unit;
    return `<div class="oc-node">
      <div class="oc-card${inactiveCls}" style="border-color:${pc.border};background:${pc.bg};border-right:3px solid ${pc.border}">
        <span class="oc-dot" style="background:${pc.border}"></span>
        <span class="oc-name">${escapeHtml(dept.name)}</span>
        ${mgr ? `<span class="oc-mgr">${escapeHtml(mgr.fullName)} <span class="oc-uname">${escapeHtml(mgr.username)}</span></span>` : ""}
      </div>
      ${children.length > 0 ? `<div class="oc-children" style="border-color:${pc.stripe}">${children.map(c => buildNodeHtml(c, allDepts, level + 1)).join("")}</div>` : ""}
    </div>`;
  };

  const handlePrint = () => {
    if (!departments) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    const isA3 = paperSize === "A3";
    const pageSize = isA3 ? "A3" : "A4";
    const fs = isA3 ? { name: 11, mgr: 9, uname: 8, title: 18, indent: 18, border: 2 }
                     : { name: 9, mgr: 7.5, uname: 6.5, title: 15, indent: 14, border: 1.5 };

    printWindow.document.write(`<!DOCTYPE html>
<html dir="rtl" lang="ar"><head><meta charset="utf-8"/><title>الهيكل التنظيمي</title>
<style>
@page { size: ${pageSize}; margin: 8mm; }
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; direction: rtl; }
h1 { text-align: center; margin-bottom: 10px; font-size: ${fs.title}px; font-weight: 700; }
.oc-node { margin-bottom: 3px; }
.oc-card {
  border: 1px solid #bbb; border-radius: 6px;
  padding: 3px 8px; background: #fff;
  display: flex; align-items: center; gap: 6px;
}
.oc-card.oc-inactive { opacity: 0.5; border-style: dashed; }
.oc-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.oc-name { font-weight: 600; font-size: ${fs.name}px; flex: 1; }
.oc-mgr { font-size: ${fs.mgr}px; color: #555; white-space: nowrap; }
.oc-uname { font-size: ${fs.uname}px; color: #888; margin-right: 4px; }
.oc-children {
  margin-right: ${fs.indent}px; padding-right: ${fs.indent - 4}px;
  border-right: ${fs.border}px solid #ccc; margin-top: 2px;
}
</style></head><body>
<h1>الهيكل التنظيمي</h1>
${roots.map(r => buildNodeHtml(r, departments, 0)).join("")}
</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 400);
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="outline" size="sm" onClick={handlePrint} data-testid="button-print-org-chart">
            <Printer className="w-4 h-4 ml-2" />
            طباعة
          </Button>
          <Select value={paperSize} onValueChange={(v) => setPaperSize(v as "A4" | "A3")}>
            <SelectTrigger className="w-[80px] h-8 text-xs" data-testid="select-paper-size">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="A4">A4</SelectItem>
              <SelectItem value="A3">A3</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2 border rounded-md px-2 py-1">
            <Label className="text-xs cursor-pointer" htmlFor="show-managers">أسماء المسؤولين</Label>
            <Switch id="show-managers" checked={showManagers} onCheckedChange={setShowManagers} data-testid="switch-show-managers" />
          </div>
        </div>
      </div>
      <div className="overflow-auto border rounded-lg bg-muted/10 p-4" style={{ minHeight: "450px", maxHeight: "calc(100vh - 260px)" }}>
        {departments && departments.length > 0 ? (
          <div>
            {roots.map(r => renderTreeNode(r, departments, 0))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <Network className="w-12 h-12 mb-3 opacity-30" />
            <p>لا توجد بيانات للهيكل التنظيمي</p>
          </div>
        )}
      </div>
    </Card>
  );
}

const corrTypeLabels: Record<string, string> = {
  internal_outgoing: "صادر داخلي",
  external_outgoing: "صادر خارجي",
  internal_incoming: "وارد داخلي",
  external_incoming: "وارد خارجي",
};

function DeletionRequestsManagement() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [processTarget, setProcessTarget] = useState<any | null>(null);
  const [processAction, setProcessAction] = useState<"approve" | "reject">("approve");
  const [adminNotes, setAdminNotes] = useState("");
  const [filterDeptId, setFilterDeptId] = useState<string>("all");

  const { data: requests, isLoading } = useQuery<any[]>({ queryKey: ["/api/admin/deletion-requests"] });
  const { data: departments } = useQuery<Department[]>({ queryKey: ["/api/departments"] });

  const processMutation = useMutation({
    mutationFn: async () => {
      if (!processTarget) return;
      const url = `/api/admin/deletion-requests/${processTarget.id}/${processAction}`;
      const res = await apiRequest("POST", url, { adminNotes });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: processAction === "approve" ? "تمت الموافقة على طلب الحذف وحذف المراسلة" : "تم رفض طلب الحذف" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/deletion-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/deleted-correspondence"] });
      queryClient.invalidateQueries({ queryKey: ["/api/correspondence"] });
      setProcessTarget(null);
      setAdminNotes("");
    },
    onError: (error: any) => {
      toast({ title: error.message || "حدث خطأ في معالجة الطلب", variant: "destructive" });
    },
  });

  const pendingRequests = requests?.filter((r: any) => r.status === "pending") || [];
  const filteredRequests = filterDeptId === "all"
    ? pendingRequests
    : pendingRequests.filter((r: any) => r.requestedDepartmentId === parseInt(filterDeptId));

  const requestDeptIds = Array.from(new Set(pendingRequests.map((r: any) => r.requestedDepartmentId)));
  const requestDepts = departments?.filter(d => requestDeptIds.includes(d.id)) || [];

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Trash2 className="w-5 h-5 text-chart-1" />
          <h3 className="text-lg font-semibold">طلبات حذف المراسلات</h3>
          {pendingRequests.length > 0 && (
            <Badge variant="destructive" className="text-xs">{pendingRequests.length}</Badge>
          )}
        </div>
        {pendingRequests.length > 0 && (
          <Select value={filterDeptId} onValueChange={setFilterDeptId} data-testid="select-filter-dept-deletion">
            <SelectTrigger className="w-[200px]" data-testid="select-trigger-filter-dept-deletion">
              <SelectValue placeholder="جميع الأقسام" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الأقسام</SelectItem>
              {requestDepts.map(d => (
                <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        طلبات الأقسام لحذف مراسلات صادرة حاصلة على توقيع نهائي. الموافقة تحذف المراسلة وترسل إشعاراً لجميع الجهات المعنية.
      </p>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12" />)}</div>
      ) : pendingRequests.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <CheckCircle2 className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p>لا توجد طلبات حذف معلّقة</p>
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <CheckCircle2 className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p>لا توجد طلبات حذف معلّقة لهذا القسم</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-2 text-right font-medium">موضوع المراسلة</th>
                <th className="p-2 text-right font-medium">العدد</th>
                <th className="p-2 text-right font-medium">الجهة الطالبة</th>
                <th className="p-2 text-right font-medium">مقدم الطلب</th>
                <th className="p-2 text-right font-medium">سبب الحذف</th>
                <th className="p-2 text-right font-medium">تاريخ الطلب</th>
                <th className="p-2 text-center font-medium">إجراء</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map((r: any) => (
                <tr key={r.id} className="border-t hover:bg-muted/20" data-testid={`row-deletion-request-${r.id}`}>
                  <td className="p-2 font-medium">{r.correspondence?.subject || "-"}</td>
                  <td className="p-2 text-muted-foreground">{r.correspondence?.referenceNumber || "-"}</td>
                  <td className="p-2 text-muted-foreground">{r.departmentName}</td>
                  <td className="p-2 text-muted-foreground">{r.requesterName}</td>
                  <td className="p-2 text-xs text-muted-foreground max-w-[200px]">{r.reason}</td>
                  <td className="p-2 text-muted-foreground text-xs">
                    {r.createdAt ? new Date(r.createdAt).toLocaleDateString("ar") : "-"}
                  </td>
                  <td className="p-2 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => { setProcessTarget(r); setProcessAction("approve"); setAdminNotes(""); }}
                        data-testid={`button-approve-deletion-${r.id}`}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setProcessTarget(r); setProcessAction("reject"); setAdminNotes(""); }}
                        data-testid={`button-reject-deletion-${r.id}`}
                      >
                        <XCircle className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AlertDialog open={!!processTarget} onOpenChange={o => { if (!o) setProcessTarget(null); }}>
        <AlertDialogContent dir="rtl" className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {processAction === "approve" ? (
                <><AlertTriangle className="w-5 h-5 text-destructive" /> الموافقة على حذف المراسلة</>
              ) : (
                <><XCircle className="w-5 h-5 text-muted-foreground" /> رفض طلب الحذف</>
              )}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {processAction === "approve" ? (
                <>سيتم حذف المراسلة <strong>{processTarget?.correspondence?.subject}</strong> ({processTarget?.correspondence?.referenceNumber}) وإرسال إشعار لجميع الجهات التي عملت عليها.</>
              ) : (
                <>سيتم رفض طلب حذف المراسلة وإشعار مقدم الطلب.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="my-2">
            <Label className="text-sm font-medium">ملاحظات (اختياري)</Label>
            <Textarea
              value={adminNotes}
              onChange={e => setAdminNotes(e.target.value)}
              placeholder="أضف ملاحظات..."
              className="mt-1"
              data-testid="input-deletion-admin-notes"
            />
          </div>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>تراجع</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); processMutation.mutate(); }}
              className={processAction === "approve" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
              disabled={processMutation.isPending}
              data-testid="button-confirm-process-deletion"
            >
              {processMutation.isPending ? "جارٍ المعالجة..." : processAction === "approve" ? "تأكيد الحذف" : "رفض الطلب"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function DeletedCorrespondence() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: deleted, isLoading } = useQuery<Correspondence[]>({ queryKey: ["/api/admin/deleted-correspondence"] });
  const { data: departments } = useQuery<Department[]>({ queryKey: ["/api/departments"] });
  const { data: employees } = useQuery<Employee[]>({ queryKey: ["/api/employees"] });
  const [restoreTarget, setRestoreTarget] = useState<Correspondence | null>(null);
  const [filterDeptId, setFilterDeptId] = useState<string>("all");

  const getDeptName = (id: number | null | undefined) => {
    if (!id || !departments) return "-";
    return departments.find(d => d.id === id)?.name || "-";
  };

  const getEmpName = (id: number | null | undefined) => {
    if (!id || !employees) return "-";
    return employees.find(e => e.id === id)?.fullName || "-";
  };

  const restoreMutation = useMutation({
    mutationFn: async () => {
      if (!restoreTarget) return;
      const res = await apiRequest("PATCH", `/api/admin/correspondence/${restoreTarget.id}/restore`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "تم إلغاء حذف المراسلة واستعادتها بنجاح" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/deleted-correspondence"] });
      queryClient.invalidateQueries({ queryKey: ["/api/correspondence"] });
      setRestoreTarget(null);
    },
    onError: (error: any) => {
      toast({ title: error.message || "حدث خطأ في استعادة المراسلة", variant: "destructive" });
    },
  });

  const filteredDeleted = !deleted ? [] : filterDeptId === "all"
    ? deleted
    : deleted.filter(c => c.senderDepartmentId === parseInt(filterDeptId));

  const deletedDeptIds = Array.from(new Set((deleted || []).map(c => c.senderDepartmentId).filter(Boolean)));
  const deletedDepts = departments?.filter(d => deletedDeptIds.includes(d.id)) || [];

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FileX className="w-5 h-5 text-destructive" />
          <h3 className="text-lg font-semibold">المراسلات المحذوفة</h3>
        </div>
        {deleted && deleted.length > 0 && (
          <Select value={filterDeptId} onValueChange={setFilterDeptId} data-testid="select-filter-dept-deleted">
            <SelectTrigger className="w-[200px]" data-testid="select-trigger-filter-dept-deleted">
              <SelectValue placeholder="جميع الأقسام" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الأقسام</SelectItem>
              {deletedDepts.map(d => (
                <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        سجل المراسلات المحذوفة بواسطة مدير النظام. يمكن إلغاء الحذف واستعادة المراسلة مع إشعار جميع الجهات المعنية.
      </p>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12" />)}</div>
      ) : !deleted || deleted.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <FileX className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p>لا توجد مراسلات محذوفة</p>
        </div>
      ) : filteredDeleted.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <FileX className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p>لا توجد مراسلات محذوفة لهذا القسم</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-2 text-right font-medium">الموضوع</th>
                <th className="p-2 text-right font-medium">النوع</th>
                <th className="p-2 text-right font-medium">الجهة المرسلة</th>
                <th className="p-2 text-right font-medium">الرقم المرجعي</th>
                <th className="p-2 text-right font-medium">سبب الحذف</th>
                <th className="p-2 text-right font-medium">حذف بواسطة</th>
                <th className="p-2 text-right font-medium">تاريخ الحذف</th>
                <th className="p-2 text-center font-medium">إجراء</th>
              </tr>
            </thead>
            <tbody>
              {filteredDeleted.map(c => (
                <tr key={c.id} className="border-t hover:bg-muted/20" data-testid={`row-deleted-corr-${c.id}`}>
                  <td className="p-2 font-medium">{c.subject}</td>
                  <td className="p-2">
                    <Badge variant="secondary" className="text-xs">{corrTypeLabels[c.type] || c.type}</Badge>
                  </td>
                  <td className="p-2 text-muted-foreground">{getDeptName(c.senderDepartmentId)}</td>
                  <td className="p-2 text-muted-foreground">{c.referenceNumber || "-"}</td>
                  <td className="p-2 text-xs text-muted-foreground max-w-[200px] truncate">{c.deleteReason || "-"}</td>
                  <td className="p-2 text-muted-foreground">{getEmpName(c.deletedById)}</td>
                  <td className="p-2 text-muted-foreground text-xs">
                    {c.deletedAt ? new Date(c.deletedAt).toLocaleDateString("ar") : "-"}
                  </td>
                  <td className="p-2 text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-primary hover:text-primary"
                      onClick={() => setRestoreTarget(c)}
                      title="إلغاء الحذف"
                      data-testid={`button-restore-corr-${c.id}`}
                    >
                      <RotateCcw className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AlertDialog open={!!restoreTarget} onOpenChange={o => { if (!o) setRestoreTarget(null); }}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-primary" />
              إلغاء حذف المراسلة
            </AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من إلغاء حذف المراسلة <strong>{restoreTarget?.subject}</strong> ({restoreTarget?.referenceNumber || "بدون رقم"})؟
              <br />سيتم استعادتها وإرسال إشعار لجميع الجهات التي عملت عليها.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>تراجع</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); restoreMutation.mutate(); }}
              disabled={restoreMutation.isPending}
              data-testid="button-confirm-restore"
            >
              {restoreMutation.isPending ? "جارٍ الاستعادة..." : "تأكيد الاستعادة"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

const factoryResetCategories: Record<string, { label: string; desc: string }> = {
  correspondence: { label: "المراسلات بجميع أنواعها", desc: "حذف جميع المراسلات الصادرة والواردة وسير العمل والمرفقات والنسخ" },
  notifications: { label: "الإشعارات", desc: "حذف جميع إشعارات النظام ومستلمي الإشعارات" },
  users: { label: "المستخدمين", desc: "حذف جميع الحسابات مع الحفاظ على حساب مدير النظام (admin) وإعادة كلمة المرور الافتراضية" },
  departments: { label: "الهيكل التنظيمي", desc: "حذف جميع التشكيلات والأقسام من الهيكل التنظيمي" },
  leave_requests: { label: "الإجازات", desc: "حذف جميع طلبات الإجازة" },
  service_requests: { label: "طلبات الخدمة", desc: "حذف جميع طلبات الخدمة (صيانة، تقنية، إدارية)" },
  settings: { label: "الإعدادات", desc: "إعادة جميع إعدادات النظام إلى القيم الافتراضية وحذف سجل النشاطات وطلبات إعادة كلمة المرور" },
};

function DataResetTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [confirmText, setConfirmText] = useState("");
  const [showDialog, setShowDialog] = useState(false);

  const hasResetPerm = user?.role === "admin";

  const toggleCategory = (cat: string) => {
    setSelectedCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const selectAll = () => {
    if (selectedCategories.length === Object.keys(factoryResetCategories).length) {
      setSelectedCategories([]);
    } else {
      setSelectedCategories(Object.keys(factoryResetCategories));
    }
  };

  const resetMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/factory-reset", {
        categories: selectedCategories,
        confirmText,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: data.message || "تم إعادة ضبط المصنع بنجاح" });
      queryClient.invalidateQueries();
      setSelectedCategories([]);
      setConfirmText("");
      setShowDialog(false);
    },
    onError: (error: any) => {
      toast({ title: error.message || "حدث خطأ في إعادة ضبط المصنع", variant: "destructive" });
    },
  });

  if (!hasResetPerm) {
    return (
      <Card className="p-6">
        <div className="text-center py-8">
          <ShieldAlert className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-30" />
          <p className="text-muted-foreground">ليس لديك صلاحية إعادة ضبط المصنع</p>
          <p className="text-xs text-muted-foreground mt-1">يجب منحك صلاحية SYS_DATA_RESET من قبل مدير النظام</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-2">
        <RotateCcw className="w-5 h-5 text-destructive" />
        <h3 className="text-lg font-semibold text-destructive">إعادة ضبط المصنع</h3>
      </div>
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 mb-6">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-destructive">تحذير مهم</p>
            <p className="text-xs text-muted-foreground mt-1">
              هذه العملية لا يمكن التراجع عنها. سيتم حذف البيانات المحددة نهائياً وإعادة النظام للحالة الافتراضية.
              حساب مدير النظام (admin) لن يتم حذفه وستُعاد كلمة المرور إلى الافتراضية.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-sm font-medium">البيانات المراد إعادة ضبطها</Label>
            <Button variant="ghost" size="sm" onClick={selectAll} className="text-xs h-7" data-testid="button-select-all-reset">
              {selectedCategories.length === Object.keys(factoryResetCategories).length ? "إلغاء تحديد الكل" : "تحديد الكل"}
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {Object.entries(factoryResetCategories).map(([key, { label, desc }]) => (
              <div
                key={key}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedCategories.includes(key)
                    ? "border-destructive/50 bg-destructive/5"
                    : "border-border hover:border-muted-foreground/30"
                }`}
                onClick={() => toggleCategory(key)}
                data-testid={`toggle-reset-${key}`}
              >
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={selectedCategories.includes(key)}
                    onCheckedChange={() => toggleCategory(key)}
                  />
                  <span className="text-sm font-medium">{label}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 mr-6">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-2">
          <Button
            variant="destructive"
            disabled={selectedCategories.length === 0}
            onClick={() => setShowDialog(true)}
            data-testid="button-open-reset-dialog"
          >
            <RotateCcw className="w-4 h-4 ml-2" />
            إعادة ضبط المصنع
          </Button>
        </div>
      </div>

      <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
        <AlertDialogContent dir="rtl" className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="w-5 h-5" />
              تأكيد إعادة ضبط المصنع
            </AlertDialogTitle>
            <AlertDialogDescription>
              أنت على وشك إعادة ضبط المصنع وحذف البيانات التالية نهائياً:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 my-2">
            <div className="rounded-lg border bg-muted/30 p-3">
              <ul className="space-y-1 text-sm">
                {selectedCategories.map(cat => (
                  <li key={cat} className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-destructive" />
                    {factoryResetCategories[cat]?.label}
                  </li>
                ))}
              </ul>
              {(selectedCategories.includes("users") || selectedCategories.length === Object.keys(factoryResetCategories).length) && (
                <p className="text-xs text-primary mt-2 pt-2 border-t">
                  حساب مدير النظام (admin) سيبقى محفوظاً مع إعادة كلمة المرور الافتراضية
                </p>
              )}
            </div>
            <div>
              <Label className="text-sm font-medium">للتأكيد، اكتب: <span className="text-destructive font-bold">تأكيد ضبط المصنع</span></Label>
              <Input
                value={confirmText}
                onChange={e => setConfirmText(e.target.value)}
                placeholder="تأكيد ضبط المصنع"
                className="mt-1"
                dir="rtl"
                data-testid="input-reset-confirm"
              />
            </div>
          </div>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel onClick={() => setConfirmText("")}>تراجع</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => resetMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={resetMutation.isPending || confirmText !== "تأكيد ضبط المصنع"}
              data-testid="button-confirm-reset"
            >
              {resetMutation.isPending ? "جارٍ إعادة الضبط..." : "تأكيد ضبط المصنع"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();

  if (user?.role !== "admin") {
    return (
      <div className="p-6 text-center" dir="rtl">
        <Shield className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-40" />
        <h2 className="text-lg font-semibold mb-2">غير مصرح</h2>
        <p className="text-muted-foreground">هذه الصفحة متاحة لمدير النظام فقط</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-settings-title">إعدادات النظام</h1>
        <p className="text-muted-foreground text-sm mt-1">إدارة إعدادات النظام والمستخدمين</p>
      </div>

      <Tabs defaultValue="general" dir="rtl">
        <TabsList className="grid grid-cols-10 w-full max-w-5xl">
          <TabsTrigger value="general" data-testid="tab-general">عام</TabsTrigger>
          <TabsTrigger value="theme" data-testid="tab-theme">الثيم</TabsTrigger>
          <TabsTrigger value="orgchart" data-testid="tab-orgchart">الهيكل التنظيمي</TabsTrigger>
          <TabsTrigger value="deletion-requests" data-testid="tab-deletion-requests">طلبات الحذف</TabsTrigger>
          <TabsTrigger value="corr-deleted" data-testid="tab-corr-deleted">المحذوفة</TabsTrigger>
          <TabsTrigger value="notifications" data-testid="tab-notifications">الإشعارات</TabsTrigger>
          <TabsTrigger value="passwords" data-testid="tab-passwords">كلمات المرور</TabsTrigger>
          <TabsTrigger value="users" data-testid="tab-users">المستخدمون</TabsTrigger>
          <TabsTrigger value="activity" data-testid="tab-activity">النشاطات</TabsTrigger>
          <TabsTrigger value="data-reset" data-testid="tab-data-reset" className="text-destructive">ضبط المصنع</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-4">
          <GeneralSettings />
        </TabsContent>
        <TabsContent value="theme" className="mt-4">
          <ThemeSettings />
        </TabsContent>
        <TabsContent value="orgchart" className="mt-4">
          <OrgChartTab />
        </TabsContent>
        <TabsContent value="deletion-requests" className="mt-4">
          <DeletionRequestsManagement />
        </TabsContent>
        <TabsContent value="corr-deleted" className="mt-4">
          <DeletedCorrespondence />
        </TabsContent>
        <TabsContent value="notifications" className="mt-4">
          <SystemNotifications />
        </TabsContent>
        <TabsContent value="passwords" className="mt-4">
          <PasswordResetRequests />
        </TabsContent>
        <TabsContent value="users" className="mt-4">
          <ActiveUsersLog />
        </TabsContent>
        <TabsContent value="activity" className="mt-4">
          <ActivityLog />
        </TabsContent>
        <TabsContent value="data-reset" className="mt-4">
          <DataResetTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
