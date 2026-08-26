import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, authFetch } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import type { Employee, Department, Permission } from "@shared/schema";
import {
  Plus,
  Search,
  Users,
  Loader2,
  UserPlus,
  Edit,
  Shield,
  Building2,
  Phone,
  Hash,
  Mail,
  Eye,
  EyeOff,
  Trash2,
  Power,
  PowerOff,
  Upload,
  PenLine,
  X,
  ChevronDown,
  ChevronLeft,
  ChevronsDownUp,
  ChevronsUpDown,
} from "lucide-react";
import { isUnauthorizedError } from "@/lib/auth-utils";
import { useAuth } from "@/hooks/use-auth";

const roleLabels: Record<string, string> = {
  admin: "مدير نظام",
  officer: "مسؤول",
  central_mail: "بريد مركزي",
  employee: "موظف",
};

const roleColors: Record<string, string> = {
  admin: "bg-red-100 text-red-700",
  officer: "bg-blue-100 text-blue-700",
  central_mail: "bg-purple-100 text-purple-700",
  employee: "bg-gray-100 text-gray-700",
};

const deptLevelLabels: Record<string, string> = {
  general_manager: "مدير عام",
  assistant: "معاون",
  directorate: "هيئة",
  section: "قسم",
  division: "شعبة",
  unit: "وحدة",
};


const adminSubGroups = [
  { key: "sys_view", label: "صلاحيات العرض", prefixes: ["SYS_VIEW_"] },
  { key: "sys_work", label: "صلاحيات العمل", prefixes: ["SYS_ORG_", "SYS_USERS_", "SYS_PERMS_", "SYS_SETTINGS_"] },
];

function PermissionsSection({ role, allPermissions, selectedKeys, onToggle }: {
  role: string;
  allPermissions: Permission[];
  selectedKeys: Set<string>;
  onToggle: (key: string) => void;
}) {
  const adminPerms = allPermissions.filter(p => p.category === "system_admin");

  if (role === "employee") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-muted-foreground" />
          <Label className="font-semibold text-sm text-muted-foreground">الصلاحيات</Label>
        </div>
        <div className="p-4 rounded-lg border border-dashed text-center text-muted-foreground text-sm" data-testid="text-employee-perms-placeholder">
          صلاحيات الموظف ستحدد لاحقاً ضمن قائمة الطلبات الخاصة وطلبات العمل
        </div>
      </div>
    );
  }

  if (role === "central_mail") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-muted-foreground" />
          <Label className="font-semibold text-sm text-muted-foreground">الصلاحيات</Label>
        </div>
        <div className="p-4 rounded-lg border border-dashed text-center text-muted-foreground text-sm" data-testid="text-central-mail-perms-placeholder">
          حساب البريد المركزي مخصص لإدخال وإسناد البريد الوارد الخارجي
        </div>
      </div>
    );
  }

  if (role === "officer") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-muted-foreground" />
          <Label className="font-semibold text-sm text-muted-foreground">الصلاحيات</Label>
        </div>
        <div className="p-4 rounded-lg border border-dashed text-center text-muted-foreground text-sm" data-testid="text-officer-perms-info">
          يتم تحديد صلاحيات الإجراءات تلقائياً بناءً على موقع المستخدم في مسار التدفق
        </div>
      </div>
    );
  }

  if (role === "admin") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary" />
          <Label className="font-semibold text-sm">صلاحيات إدارة النظام</Label>
        </div>
        <Tabs defaultValue="sys_view" dir="rtl">
          <TabsList className="w-full grid grid-cols-2">
            {adminSubGroups.map(g => (
              <TabsTrigger key={g.key} value={g.key} className="text-xs" data-testid={`tab-perm-${g.key}`}>{g.label}</TabsTrigger>
            ))}
          </TabsList>
          {adminSubGroups.map(group => {
            const groupPerms = adminPerms.filter(p => group.prefixes.some(prefix => p.key.startsWith(prefix)));
            return (
              <TabsContent key={group.key} value={group.key} className="mt-3 space-y-1.5">
                {groupPerms.map(perm => (
                  <div key={perm.id} className="flex items-center gap-3 p-2.5 rounded-lg border hover:bg-accent/50 transition-colors" data-testid={`perm-row-${perm.key}`}>
                    <Checkbox
                      checked={selectedKeys.has(perm.key)}
                      onCheckedChange={() => onToggle(perm.key)}
                      data-testid={`checkbox-perm-${perm.key}`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{perm.nameAr}</p>
                      {perm.description && <p className="text-xs text-muted-foreground">{perm.description}</p>}
                    </div>
                    {selectedKeys.has(perm.key) && (
                      <Badge variant="secondary" className="bg-green-100 text-green-700 text-[10px] shrink-0">ممنوحة</Badge>
                    )}
                  </div>
                ))}
                <div className="flex items-center gap-2 pt-2 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => groupPerms.forEach(p => { if (!selectedKeys.has(p.key)) onToggle(p.key); })}
                    data-testid={`button-select-all-${group.key}`}
                  >تحديد الكل</Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => groupPerms.forEach(p => { if (selectedKeys.has(p.key)) onToggle(p.key); })}
                    data-testid={`button-deselect-all-${group.key}`}
                  >إلغاء الكل</Button>
                </div>
              </TabsContent>
            );
          })}
        </Tabs>
      </div>
    );
  }

  return null;
}

function EmployeeFormDialog({ employee, departments, allPermissions, onClose }: {
  employee?: Employee;
  departments: Department[];
  allPermissions: Permission[];
  onClose: () => void;
}) {
  const { toast } = useToast();
  const isEdit = !!employee;

  const [fullName, setFullName] = useState(employee?.fullName || "");
  const [username, setUsername] = useState(employee?.username || "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [companyNumber, setCompanyNumber] = useState(employee?.companyNumber || "");
  const [mobilePhone, setMobilePhone] = useState(employee?.mobilePhone || "");
  const [landlinePhone, setLandlinePhone] = useState(employee?.landlinePhone || "");
  const [email, setEmail] = useState(employee?.email || "");
  const [role, setRole] = useState<string>(employee?.role || "employee");
  const [departmentId, setDepartmentId] = useState<number | null>(employee?.departmentId || null);
  const [deptSearch, setDeptSearch] = useState("");
  const [selectedPermKeys, setSelectedPermKeys] = useState<Set<string>>(new Set());
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);
  const [canAccessCorrespondence, setCanAccessCorrespondence] = useState(employee?.canAccessCorrespondence !== false);
  const [canAccessLeaveRequests, setCanAccessLeaveRequests] = useState(employee?.canAccessLeaveRequests !== false);
  const [canReceiveExternalIncoming, setCanReceiveExternalIncoming] = useState(employee?.canReceiveExternalIncoming === true);
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [signaturePreview, setSignaturePreview] = useState<string | null>(employee?.signatureUrl || null);
  const sigInputRef = useRef<HTMLInputElement>(null);

  const { data: existingPerms } = useQuery<any[]>({
    queryKey: ["/api/employees", employee?.id, "permissions"],
    queryFn: async () => {
      if (!employee?.id) return [];
      const res = await authFetch(`/api/employees/${employee.id}/permissions`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!employee?.id,
  });

  useEffect(() => {
    if (existingPerms && !permissionsLoaded) {
      const keys = new Set(existingPerms.map((up: any) => up.permission?.key).filter(Boolean));
      setSelectedPermKeys(keys);
      setPermissionsLoaded(true);
    }
  }, [existingPerms, permissionsLoaded]);

  const filteredDepts = useMemo(() => {
    if (!deptSearch) return departments;
    return departments.filter(d => d.name.includes(deptSearch));
  }, [departments, deptSearch]);

  const togglePerm = (key: string) => {
    setSelectedPermKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        fullName,
        username,
        companyNumber,
        mobilePhone: mobilePhone || null,
        landlinePhone,
        email: email || null,
        role,
        departmentId: (role === "admin" || role === "central_mail") ? null : departmentId,
        permissionKeys: Array.from(selectedPermKeys),
        canAccessCorrespondence: role === "central_mail" ? true : canAccessCorrespondence,
        canAccessLeaveRequests: role === "central_mail" ? false : canAccessLeaveRequests,
        canReceiveExternalIncoming: (role === "officer" || role === "admin") ? canReceiveExternalIncoming : false,
      };
      if (!isEdit || password) {
        payload.password = password;
      }

      if (isEdit) {
        const res = await apiRequest("PATCH", `/api/employees/${employee!.id}`, payload);
        return res.json();
      } else {
        const res = await apiRequest("POST", "/api/employees", payload);
        return res.json();
      }
    },
    onSuccess: async (data: any) => {
      if (signatureFile && data?.id) {
        try {
          const formData = new FormData();
          formData.append("signature", signatureFile);
          await authFetch(`/api/employees/${data.id}/signature`, { method: "POST", body: formData });
        } catch (e) {
          console.error("Failed to upload signature:", e);
        }
      }
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      toast({ title: isEdit ? "تم تحديث الحساب بنجاح" : "تم إنشاء الحساب بنجاح" });
      onClose();
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "غير مصرح", variant: "destructive" });
        return;
      }
      toast({ title: "حدث خطأ", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName) return toast({ title: "اسم الحساب مطلوب", variant: "destructive" });
    if (!username) return toast({ title: "اسم المستخدم مطلوب", variant: "destructive" });
    if (!isEdit && !password) return toast({ title: "كلمة المرور مطلوبة", variant: "destructive" });
    if (!companyNumber) return toast({ title: "الرقم الوظيفي مطلوب", variant: "destructive" });
    if (!landlinePhone) return toast({ title: "رقم الهاتف الأرضي مطلوب", variant: "destructive" });
    if ((role === "employee" || role === "officer") && !departmentId) return toast({ title: "الجهة مطلوبة", variant: "destructive" });
    mutation.mutate();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>اسم الحساب <span className="text-red-500">*</span></Label>
          <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="الاسم الكامل" data-testid="input-emp-fullname" />
        </div>
        <div className="space-y-2">
          <Label>اسم المستخدم <span className="text-red-500">*</span></Label>
          <Input value={username} onChange={e => setUsername(e.target.value)} placeholder="اسم المستخدم للدخول" disabled={isEdit} data-testid="input-emp-username" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{isEdit ? "كلمة المرور الجديدة" : "كلمة المرور"} {!isEdit && <span className="text-red-500">*</span>}</Label>
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={isEdit ? "اتركها فارغة لعدم التغيير" : "كلمة المرور"}
              data-testid="input-emp-password"
            />
            <button type="button" className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowPassword(!showPassword)}>
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div className="space-y-2">
          <Label>الرقم الوظيفي <span className="text-red-500">*</span></Label>
          <Input value={companyNumber} onChange={e => setCompanyNumber(e.target.value)} placeholder="رقم الشركة / الوظيفي" data-testid="input-emp-company-number" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>رقم الهاتف المحمول</Label>
          <Input value={mobilePhone} onChange={e => setMobilePhone(e.target.value)} placeholder="اختياري" data-testid="input-emp-mobile" />
        </div>
        <div className="space-y-2">
          <Label>رقم الهاتف الأرضي <span className="text-red-500">*</span></Label>
          <Input value={landlinePhone} onChange={e => setLandlinePhone(e.target.value)} placeholder="رقم الهاتف الأرضي" data-testid="input-emp-landline" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>البريد الإلكتروني</Label>
          <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="اختياري" data-testid="input-emp-email" />
        </div>
        <div className="space-y-2">
          <Label>الدور <span className="text-red-500">*</span></Label>
          <Select value={role} onValueChange={v => { setRole(v); if (v === "admin" || v === "central_mail") setDepartmentId(null); setSelectedPermKeys(new Set()); }}>
            <SelectTrigger data-testid="select-emp-role"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="employee">موظف</SelectItem>
              <SelectItem value="officer">مسؤول</SelectItem>
              <SelectItem value="central_mail">بريد مركزي</SelectItem>
              <SelectItem value="admin">مدير نظام</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {(role === "employee" || role === "officer") && (
        <div className="space-y-2">
          <Label>الجهة <span className="text-red-500">*</span></Label>
          <Select
            value={departmentId?.toString() || "none"}
            onValueChange={v => setDepartmentId(v === "none" ? null : parseInt(v))}
          >
            <SelectTrigger data-testid="select-emp-dept"><SelectValue placeholder="اختر الجهة" /></SelectTrigger>
            <SelectContent>
              <div className="p-2">
                <Input
                  placeholder="بحث في الجهات..."
                  value={deptSearch}
                  onChange={e => setDeptSearch(e.target.value)}
                  className="h-8 text-sm"
                  data-testid="input-dept-search"
                />
              </div>
              <SelectItem value="none">بدون تعيين</SelectItem>
              {filteredDepts.map(d => (
                <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="border-t pt-4">
        <PermissionsSection
          role={role}
          allPermissions={allPermissions}
          selectedKeys={selectedPermKeys}
          onToggle={togglePerm}
        />
      </div>

      {role !== "admin" && role !== "central_mail" && (
        <div className="border-t pt-4 space-y-3">
          <Label className="text-sm font-semibold">صلاحيات الوصول للوحدات</Label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center gap-2 cursor-pointer select-none" data-testid="toggle-access-correspondence">
              <input
                type="checkbox"
                checked={canAccessCorrespondence}
                onChange={e => setCanAccessCorrespondence(e.target.checked)}
                className="w-4 h-4 rounded border-input accent-primary"
              />
              <span className="text-sm">المراسلات</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none" data-testid="toggle-access-leave">
              <input
                type="checkbox"
                checked={canAccessLeaveRequests}
                onChange={e => setCanAccessLeaveRequests(e.target.checked)}
                className="w-4 h-4 rounded border-input accent-primary"
              />
              <span className="text-sm">الإجازات</span>
            </label>
          </div>
          <p className="text-xs text-muted-foreground">تحكم في الوحدات التي يمكن للمستخدم الوصول إليها</p>
        </div>
      )}

      {role === "central_mail" && (
        <div className="border-t pt-4 space-y-2">
          <Label className="text-sm font-semibold">صلاحيات الوصول للوحدات</Label>
          <div className="p-3 rounded-lg border border-dashed text-sm text-muted-foreground" data-testid="text-central-mail-access-info">
            حساب البريد المركزي يحصل تلقائياً على صلاحية الوصول للمراسلات فقط
          </div>
        </div>
      )}

      {(role === "officer" || role === "admin") && (
        <div className="border-t pt-4 space-y-3">
          <Label className="text-sm font-semibold">صلاحيات خاصة</Label>
          <div className="flex items-center justify-between p-3 rounded-lg border" data-testid="toggle-can-receive-external-incoming">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">صلاحية استلام وارد خارجي</p>
              <p className="text-xs text-muted-foreground">السماح لهذا الحساب باستلام المراسلات الواردة الخارجية من البريد المركزي</p>
            </div>
            <Switch
              checked={canReceiveExternalIncoming}
              onCheckedChange={setCanReceiveExternalIncoming}
              data-testid="switch-can-receive-external-incoming"
            />
          </div>
        </div>
      )}

      <div className="border-t pt-4 space-y-2">
        <Label>التوقيع الإلكتروني</Label>
        <input
          type="file"
          ref={sigInputRef}
          accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              if (file.size > 2 * 1024 * 1024) {
                toast({ title: "حجم الملف كبير", description: "الحد الأقصى 2 ميغابايت", variant: "destructive" });
                return;
              }
              setSignatureFile(file);
              setSignaturePreview(URL.createObjectURL(file));
            }
          }}
          data-testid="input-emp-signature"
        />
        {signaturePreview ? (
          <div className="relative border rounded-lg p-3 bg-muted/30">
            <img src={signaturePreview} alt="التوقيع" className="max-h-20 mx-auto object-contain" data-testid="img-signature-preview" />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute top-1 left-1 h-6 w-6"
              onClick={() => { setSignatureFile(null); setSignaturePreview(null); }}
              data-testid="button-remove-signature"
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        ) : (
          <Button type="button" variant="outline" className="w-full" onClick={() => sigInputRef.current?.click()} data-testid="button-upload-signature">
            <Upload className="w-4 h-4 ml-2" />
            رفع صورة التوقيع
          </Button>
        )}
        <p className="text-xs text-muted-foreground">PNG, JPG, WebP, SVG - الحد الأقصى 2MB</p>
      </div>

      <Button type="submit" className="w-full" disabled={mutation.isPending} data-testid="button-submit-employee">
        {mutation.isPending && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
        {isEdit ? "تحديث الحساب" : "إنشاء الحساب"}
      </Button>
    </form>
  );
}

function EmployeeCard({ employee, departments, onEdit, canManage, canActivate, canDelete, currentUserId }: {
  employee: Employee;
  departments: Department[];
  onEdit: (emp: Employee) => void;
  canManage: boolean;
  canActivate: boolean;
  canDelete: boolean;
  currentUserId: number;
}) {
  const dept = departments.find(d => d.id === employee.departmentId);
  const { toast } = useToast();
  const isSelf = employee.id === currentUserId;

  const toggleActiveMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", `/api/employees/${employee.id}/toggle-active`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      toast({ title: employee.isActive ? "تم إيقاف تنشيط الحساب" : "تم تنشيط الحساب" });
    },
    onError: (err: any) => {
      const msg = err?.message || "حدث خطأ";
      let errorText = msg;
      try { errorText = JSON.parse(msg.split(":").slice(1).join(":").trim()).message; } catch {}
      toast({ title: "خطأ", description: errorText, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/employees/${employee.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      toast({ title: "تم حذف الحساب بنجاح" });
    },
    onError: (err: any) => {
      const msg = err?.message || "حدث خطأ";
      let errorText = msg;
      try { errorText = JSON.parse(msg.split(":").slice(1).join(":").trim()).message; } catch {}
      toast({ title: "خطأ", description: errorText, variant: "destructive" });
    },
  });

  return (
    <Card className={`p-4 hover-elevate transition-all duration-150 ${!employee.isActive ? "opacity-60" : ""}`} data-testid={`card-employee-${employee.id}`}>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Users className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-medium text-sm truncate">{employee.fullName}</h3>
            <div className="flex items-center gap-1 shrink-0">
              {canManage && (
                <Button size="sm" variant="ghost" onClick={() => onEdit(employee)} data-testid={`button-edit-emp-${employee.id}`}>
                  <Edit className="w-3.5 h-3.5" />
                </Button>
              )}
              {canActivate && !isSelf && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => toggleActiveMutation.mutate()}
                  disabled={toggleActiveMutation.isPending}
                  className={employee.isActive ? "text-orange-600 hover:text-orange-700 hover:bg-orange-50" : "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"}
                  title={employee.isActive ? "إيقاف تنشيط الحساب" : "تنشيط الحساب"}
                  data-testid={`button-toggle-active-${employee.id}`}
                >
                  {toggleActiveMutation.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : employee.isActive ? (
                    <PowerOff className="w-3.5 h-3.5" />
                  ) : (
                    <Power className="w-3.5 h-3.5" />
                  )}
                </Button>
              )}
              {canDelete && !isSelf && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      title="حذف الحساب"
                      data-testid={`button-delete-emp-${employee.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent dir="rtl">
                    <AlertDialogHeader>
                      <AlertDialogTitle>تأكيد حذف الحساب</AlertDialogTitle>
                      <AlertDialogDescription>
                        هل أنت متأكد من حذف حساب <strong>{employee.fullName}</strong> ({employee.username})؟ هذا الإجراء لا يمكن التراجع عنه.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex-row-reverse gap-2">
                      <AlertDialogCancel data-testid="button-cancel-delete">إلغاء</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteMutation.mutate()}
                        className="bg-red-600 hover:bg-red-700"
                        data-testid="button-confirm-delete"
                      >
                        {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
                        حذف الحساب
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap mt-1">
            <Badge variant="secondary" className={`text-xs ${roleColors[employee.role] || "bg-gray-100 text-gray-700"}`}>
              {roleLabels[employee.role] || employee.role}
            </Badge>
            {dept && (
              <Badge variant="outline" className="text-xs">
                <Building2 className="w-3 h-3 ml-1" />
                {dept.name}
              </Badge>
            )}
            {employee.companyNumber && (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                <Hash className="w-3 h-3 ml-0.5" />
                {employee.companyNumber}
              </Badge>
            )}
            {!employee.isActive && (
              <Badge variant="destructive" className="text-xs">غير فعال</Badge>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2 flex-wrap">
            {employee.username && (
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                {employee.username}
              </span>
            )}
            {employee.landlinePhone && (
              <span className="flex items-center gap-1">
                <Phone className="w-3 h-3" />
                {employee.landlinePhone}
              </span>
            )}
            {employee.email && (
              <span className="flex items-center gap-1">
                <Mail className="w-3 h-3" />
                {employee.email}
              </span>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

function EmployeeTree({ departments, allDepartments, employees, rootId, level, onEdit, canManage, canActivate, canDelete, currentUserId, collapsedIds, onToggleCollapse }: {
  departments: Department[];
  allDepartments: Department[];
  employees: Employee[];
  rootId: number | null;
  level: number;
  onEdit: (emp: Employee) => void;
  canManage: boolean;
  canActivate: boolean;
  canDelete: boolean;
  currentUserId: number;
  collapsedIds: Set<number>;
  onToggleCollapse: (id: number) => void;
}) {
  const childDepts = departments.filter(d => d.parentId === rootId);
  if (childDepts.length === 0) return null;

  return (
    <div className={level > 0 ? "mr-6 border-r border-border pr-4" : ""}>
      {childDepts.map(dept => {
        const deptEmployees = employees.filter(e => e.departmentId === dept.id);
        const hasChildDepts = departments.some(d => d.parentId === dept.id);
        const hasDescendantEmployees = hasEmployeesInSubtree(dept.id, departments, employees);
        const isCollapsed = collapsedIds.has(dept.id);
        const totalEmps = countEmployeesInSubtree(dept.id, allDepartments, employees);

        if (deptEmployees.length === 0 && !hasDescendantEmployees) return null;

        return (
          <div key={dept.id} className="mb-2" data-testid={`dept-tree-node-${dept.id}`}>
            <div
              className="flex items-center gap-2 p-2 rounded-lg bg-muted/40 hover:bg-muted/60 cursor-pointer transition-colors"
              onClick={() => onToggleCollapse(dept.id)}
              data-testid={`button-toggle-dept-${dept.id}`}
            >
              {(hasChildDepts || deptEmployees.length > 0) ? (
                <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" tabIndex={-1}>
                  {isCollapsed ? <ChevronLeft className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </Button>
              ) : (
                <div className="w-6 h-6 shrink-0" />
              )}
              <Building2 className="w-4 h-4 text-primary shrink-0" />
              <span className="font-medium text-sm flex-1">{dept.name}</span>
              <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                {deptLevelLabels[dept.level] || dept.level}
              </Badge>
              <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                <Users className="w-3 h-3 ml-0.5" />
                {totalEmps}
              </Badge>
            </div>

            {!isCollapsed && (
              <>
                {deptEmployees.length > 0 && (
                  <div className="mr-8 mt-1 space-y-1">
                    {deptEmployees.map(emp => (
                      <EmployeeCard
                        key={emp.id}
                        employee={emp}
                        departments={allDepartments}
                        onEdit={onEdit}
                        canManage={canManage}
                        canActivate={canActivate}
                        canDelete={canDelete}
                        currentUserId={currentUserId}
                      />
                    ))}
                  </div>
                )}
                <EmployeeTree
                  departments={departments}
                  allDepartments={allDepartments}
                  employees={employees}
                  rootId={dept.id}
                  level={level + 1}
                  onEdit={onEdit}
                  canManage={canManage}
                  canActivate={canActivate}
                  canDelete={canDelete}
                  currentUserId={currentUserId}
                  collapsedIds={collapsedIds}
                  onToggleCollapse={onToggleCollapse}
                />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

function hasEmployeesInSubtree(deptId: number, departments: Department[], employees: Employee[]): boolean {
  if (employees.some(e => e.departmentId === deptId)) return true;
  const children = departments.filter(d => d.parentId === deptId);
  return children.some(c => hasEmployeesInSubtree(c.id, departments, employees));
}

function countEmployeesInSubtree(deptId: number, departments: Department[], employees: Employee[]): number {
  let count = employees.filter(e => e.departmentId === deptId).length;
  const children = departments.filter(d => d.parentId === deptId);
  for (const c of children) {
    count += countEmployeesInSubtree(c.id, departments, employees);
  }
  return count;
}

export default function EmployeesPage() {
  const [openCreate, setOpenCreate] = useState(false);
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [filterDept, setFilterDept] = useState<string>("all");
  const [collapsedIds, setCollapsedIds] = useState<Set<number>>(new Set());
  const initialCollapseApplied = useRef(false);
  const { user } = useAuth();

  const { data: employees, isLoading: empLoading } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
  });

  const { data: departments } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
  });

  const { data: allPermissions } = useQuery<Permission[]>({
    queryKey: ["/api/permissions"],
  });

  useEffect(() => {
    if (departments && departments.length > 0 && !initialCollapseApplied.current) {
      initialCollapseApplied.current = true;
      const gmIds = new Set(departments.filter(d => d.level === "general_manager").map(d => d.id));
      const toCollapse = departments.filter(d =>
        departments.some(c => c.parentId === d.id) && !gmIds.has(d.id)
      );
      setCollapsedIds(new Set(toCollapse.map(p => p.id)));
    }
  }, [departments]);

  const handleToggleCollapse = (id: number) => {
    setCollapsedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCollapseAll = () => {
    if (!departments) return;
    const parents = departments.filter(d => departments.some(c => c.parentId === d.id));
    setCollapsedIds(new Set(parents.map(p => p.id)));
  };

  const handleExpandAll = () => {
    setCollapsedIds(new Set());
  };

  const isAdmin = user?.role === "admin";
  const canManage = isAdmin;
  const canActivate = isAdmin;
  const canDelete = isAdmin;

  if (!isAdmin) {
    return (
      <div className="p-6 text-center" dir="rtl">
        <h1 className="text-2xl font-bold text-muted-foreground">غير مصرح</h1>
        <p className="text-muted-foreground mt-2">هذه الصفحة متاحة لمدير النظام فقط</p>
      </div>
    );
  }

  const filtered = (employees || []).filter(emp => {
    if (searchTerm && !emp.fullName.includes(searchTerm) && !emp.companyNumber?.includes(searchTerm) && !emp.username?.includes(searchTerm)) {
      return false;
    }
    if (filterRole !== "all" && emp.role !== filterRole) return false;
    if (filterDept !== "all" && emp.departmentId?.toString() !== filterDept) return false;
    return true;
  });

  const noDeptEmployees = filtered.filter(e => !e.departmentId);
  const isSearchOrFilter = searchTerm || filterRole !== "all" || filterDept !== "all";

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-employees-title">إدارة المستخدمين</h1>
          <p className="text-muted-foreground text-sm mt-1">إدارة الحسابات ومنح الصلاحيات</p>
        </div>
        <Dialog open={openCreate} onOpenChange={setOpenCreate}>
          {canManage && (
            <DialogTrigger asChild>
              <Button data-testid="button-add-employee">
                <UserPlus className="w-4 h-4 ml-2" />
                حساب جديد
              </Button>
            </DialogTrigger>
          )}
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
            <DialogHeader>
              <DialogTitle>إنشاء حساب جديد</DialogTitle>
            </DialogHeader>
            <EmployeeFormDialog
              departments={departments || []}
              allPermissions={allPermissions || []}
              onClose={() => setOpenCreate(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="بحث بالاسم، الرقم الوظيفي، أو اسم المستخدم..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pr-10"
            data-testid="input-search-employees"
          />
        </div>
        <Select value={filterRole} onValueChange={setFilterRole}>
          <SelectTrigger className="w-40" data-testid="select-filter-role">
            <SelectValue placeholder="الدور" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع الأدوار</SelectItem>
            {Object.entries(roleLabels).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterDept} onValueChange={setFilterDept}>
          <SelectTrigger className="w-48" data-testid="select-filter-dept">
            <SelectValue placeholder="الجهة" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع الجهات</SelectItem>
            {(departments || []).map(d => (
              <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Badge variant="secondary" className="text-xs">
          <Users className="w-3 h-3 ml-1" />
          {filtered.length} حساب
        </Badge>
        {!isSearchOrFilter && (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={handleExpandAll} data-testid="button-expand-all-emp">
              <ChevronsUpDown className="w-3.5 h-3.5 ml-1" />
              فتح الكل
            </Button>
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={handleCollapseAll} data-testid="button-collapse-all-emp">
              <ChevronsDownUp className="w-3.5 h-3.5 ml-1" />
              طي الكل
            </Button>
          </div>
        )}
      </div>

      {empLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-12">
          <div className="text-center text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">لا يوجد حسابات</p>
            <p className="text-sm mt-1">ابدأ بإنشاء الحسابات ومنح الصلاحيات</p>
          </div>
        </Card>
      ) : isSearchOrFilter ? (
        <div className="space-y-3">
          {filtered.map(emp => (
            <EmployeeCard
              key={emp.id}
              employee={emp}
              departments={departments || []}
              onEdit={(e) => setEditEmployee(e)}
              canManage={canManage}
              canActivate={canActivate}
              canDelete={canDelete}
              currentUserId={user?.id || 0}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {noDeptEmployees.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/40 mb-1">
                <Shield className="w-4 h-4 text-red-500 shrink-0" />
                <span className="font-medium text-sm">حسابات بدون جهة</span>
                <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                  <Users className="w-3 h-3 ml-0.5" />
                  {noDeptEmployees.length}
                </Badge>
              </div>
              <div className="mr-8 space-y-1">
                {noDeptEmployees.map(emp => (
                  <EmployeeCard
                    key={emp.id}
                    employee={emp}
                    departments={departments || []}
                    onEdit={(e) => setEditEmployee(e)}
                    canManage={canManage}
                    canActivate={canActivate}
                    canDelete={canDelete}
                    currentUserId={user?.id || 0}
                  />
                ))}
              </div>
            </div>
          )}
          <EmployeeTree
            departments={departments || []}
            allDepartments={departments || []}
            employees={filtered}
            rootId={null}
            level={0}
            onEdit={(e) => setEditEmployee(e)}
            canManage={canManage}
            canActivate={canActivate}
            canDelete={canDelete}
            currentUserId={user?.id || 0}
            collapsedIds={collapsedIds}
            onToggleCollapse={handleToggleCollapse}
          />
        </div>
      )}

      <Dialog open={!!editEmployee} onOpenChange={(o) => { if (!o) setEditEmployee(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>تعديل الحساب</DialogTitle>
          </DialogHeader>
          {editEmployee && (
            <EmployeeFormDialog
              employee={editEmployee}
              departments={departments || []}
              allPermissions={allPermissions || []}
              onClose={() => setEditEmployee(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
