import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertDepartmentSchema } from "@shared/schema";
import type { Department } from "@shared/schema";
import {
  Plus,
  Building2,
  Search,
  Loader2,
  FolderTree,
  Crown,
  UserCog,
  Landmark,
  LayoutGrid,
  GitBranch,
  Box,
  Edit,
  Trash2,
  Power,
  PowerOff,
  ChevronDown,
  ChevronLeft,
  Filter,
} from "lucide-react";
import { z } from "zod";
import { isUnauthorizedError } from "@/lib/auth-utils";

const formSchema = insertDepartmentSchema.extend({
  name: z.string().min(1, "اسم القسم مطلوب"),
}).superRefine((data: any, ctx) => {
  if (data.isCentral && (!data.code || data.code.trim() === "")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "رمز التشكيل مطلوب للأقسام المركزية",
      path: ["code"],
    });
  }
});

const levelRanks: Record<string, number> = {
  general_manager: 1,
  assistant: 2,
  directorate: 3,
  section: 4,
  division: 5,
  unit: 6,
};

function getValidParents(departments: Department[], childLevel: string, excludeId?: number): Department[] {
  const childRank = levelRanks[childLevel] || 99;
  return departments.filter(d => {
    if (excludeId && d.id === excludeId) return false;
    const parentRank = levelRanks[d.level] || 99;
    return parentRank < childRank;
  });
}

const levelLabels: Record<string, string> = {
  general_manager: "مدير عام",
  assistant: "معاون",
  directorate: "هيئة",
  section: "قسم",
  division: "شعبة",
  unit: "وحدة",
};

const levelColors: Record<string, string> = {
  general_manager: "text-chart-5",
  assistant: "text-chart-1",
  directorate: "text-chart-2",
  section: "text-chart-3",
  division: "text-chart-4",
  unit: "text-primary",
};

const levelBgColors: Record<string, string> = {
  general_manager: "bg-chart-5/10",
  assistant: "bg-chart-1/10",
  directorate: "bg-chart-2/10",
  section: "bg-chart-3/10",
  division: "bg-chart-4/10",
  unit: "bg-primary/10",
};

const levelIcons: Record<string, any> = {
  general_manager: Crown,
  assistant: UserCog,
  directorate: Landmark,
  section: LayoutGrid,
  division: GitBranch,
  unit: Box,
};

function DepartmentEditDialog({ dept, departments, onClose }: {
  dept: Department;
  departments: Department[];
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: dept.name,
    level: dept.level,
    code: dept.code || "",
    isCentral: dept.isCentral || false,
    parentId: dept.parentId,
    description: dept.description || "",
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PATCH", `/api/departments/${dept.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      toast({ title: "تم تحديث الجهة بنجاح" });
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

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>اسم الجهة</Label>
        <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} data-testid="input-edit-dept-name" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>المستوى</Label>
          <Select value={formData.level} onValueChange={v => {
              const newValid = getValidParents(departments, v, dept.id);
              const parentStillValid = formData.parentId ? newValid.some(d => d.id === formData.parentId) : true;
              setFormData({ ...formData, level: v as any, parentId: parentStillValid ? formData.parentId : null });
            }}>
            <SelectTrigger data-testid="select-edit-dept-level"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(levelLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{formData.isCentral ? "رمز التشكيل (مطلوب)" : "رمز الجهة"}</Label>
          <Input value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value })} data-testid="input-edit-dept-code" />
          {formData.isCentral && !formData.code?.trim() && (
            <p className="text-xs text-destructive">رمز التشكيل مطلوب للأقسام المركزية</p>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between rounded-lg border p-3">
        <Label>قسم مركزي</Label>
        <Switch checked={formData.isCentral} onCheckedChange={v => setFormData({ ...formData, isCentral: v })} data-testid="switch-edit-dept-central" />
      </div>
      <div className="space-y-2">
        <Label>الجهة الأم</Label>
        <Select value={formData.parentId?.toString() || "none"} onValueChange={v => setFormData({ ...formData, parentId: v === "none" ? null : parseInt(v) })}>
          <SelectTrigger data-testid="select-edit-dept-parent"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">بدون</SelectItem>
            {getValidParents(departments, formData.level, dept.id).map(d => <SelectItem key={d.id} value={d.id.toString()}>{d.name} ({levelLabels[d.level]})</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>الوصف</Label>
        <Textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} rows={2} data-testid="input-edit-dept-description" />
      </div>

      <Button className="w-full" disabled={updateMutation.isPending || (formData.isCentral && !formData.code?.trim())} onClick={() => updateMutation.mutate(formData)} data-testid="button-save-dept">
        {updateMutation.isPending && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
        حفظ التعديلات
      </Button>
    </div>
  );
}

function DepartmentActionButtons({ dept, canManage, canActivate, canDelete, onEdit, onToggleActive, onDelete }: {
  dept: Department;
  canManage: boolean;
  canActivate: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
}) {
  return (
    <>
      {canManage && (
        <Button size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100 transition-opacity" onClick={onEdit} data-testid={`button-edit-dept-${dept.id}`}>
          <Edit className="w-3.5 h-3.5" />
        </Button>
      )}
      {canActivate && (
        <Button
          size="sm"
          variant="ghost"
          className="opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={onToggleActive}
          title={dept.isActive ? "إيقاف التنشيط" : "تنشيط"}
          data-testid={`button-toggle-dept-${dept.id}`}
        >
          {dept.isActive ? <PowerOff className="w-3.5 h-3.5 text-muted-foreground" /> : <Power className="w-3.5 h-3.5 text-muted-foreground" />}
        </Button>
      )}
      {canDelete && (
        <Button
          size="sm"
          variant="ghost"
          className="opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={onDelete}
          title="حذف"
          data-testid={`button-delete-dept-${dept.id}`}
        >
          <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
        </Button>
      )}
    </>
  );
}

function DepartmentTree({ departments, allDepartments, rootId = null, level = 0, onEdit, canManage, canActivate, canDelete, onToggleActive, onDelete, collapsedIds, onToggleCollapse }: {
  departments: Department[];
  allDepartments: Department[];
  rootId?: number | null;
  level?: number;
  onEdit: (dept: Department) => void;
  canManage: boolean;
  canActivate: boolean;
  canDelete: boolean;
  onToggleActive: (dept: Department) => void;
  onDelete: (dept: Department) => void;
  collapsedIds: Set<number>;
  onToggleCollapse: (id: number) => void;
}) {
  const children = departments.filter(d => d.parentId === rootId);
  if (children.length === 0) return null;

  return (
    <div className={level > 0 ? "mr-6 border-r border-border pr-4" : ""}>
      {children.map(dept => {
        const deptLevel = dept.level || "unit";
        const IconComp = levelIcons[deptLevel] || Building2;
        const iconColor = levelColors[deptLevel] || "text-primary";
        const iconBg = levelBgColors[deptLevel] || "bg-primary/10";
        const hasChildren = departments.some(d => d.parentId === dept.id);
        const isCollapsed = collapsedIds.has(dept.id);
        const directChildCount = allDepartments.filter(d => d.parentId === dept.id).length;

        return (
          <div key={dept.id} className="mb-2">
            <Card className={`p-3 hover-elevate transition-all duration-150 group ${!dept.isActive ? "opacity-50" : ""}`} data-testid={`card-department-${dept.id}`}>
              <div className="flex items-center gap-3">
                {directChildCount > 0 ? (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 shrink-0"
                    onClick={() => onToggleCollapse(dept.id)}
                    data-testid={`button-toggle-collapse-${dept.id}`}
                  >
                    {isCollapsed ? (
                      <ChevronLeft className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </Button>
                ) : (
                  <div className="w-6 h-6 shrink-0" />
                )}
                <div className={`w-9 h-9 rounded-md flex items-center justify-center shrink-0 ${iconBg}`}>
                  <IconComp className={`w-4 h-4 ${iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm truncate">{dept.name}</h3>
                </div>
                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  {!dept.isActive && (
                    <Badge variant="destructive" className="text-xs">
                      معطّل
                    </Badge>
                  )}
                  <Badge variant="secondary" className={`text-xs ${levelBgColors[deptLevel]} ${levelColors[deptLevel]}`}>
                    {levelLabels[deptLevel]}
                  </Badge>
                  {dept.isCentral && (
                    <Badge variant="secondary" className="text-xs bg-chart-5/10 text-chart-5">
                      مركزي
                    </Badge>
                  )}
                  {dept.code && (
                    <Badge variant="outline" className="text-xs text-muted-foreground">
                      {dept.code}
                    </Badge>
                  )}
                  {directChildCount > 0 && (
                    <Badge variant="outline" className="text-xs text-muted-foreground">
                      {directChildCount}
                    </Badge>
                  )}
                  <DepartmentActionButtons
                    dept={dept}
                    canManage={canManage}
                    canActivate={canActivate}
                    canDelete={canDelete}
                    onEdit={() => onEdit(dept)}
                    onToggleActive={() => onToggleActive(dept)}
                    onDelete={() => onDelete(dept)}
                  />
                </div>
              </div>
            </Card>
            {!isCollapsed && hasChildren && (
              <DepartmentTree departments={departments} allDepartments={allDepartments} rootId={dept.id} level={level + 1} onEdit={onEdit} canManage={canManage} canActivate={canActivate} canDelete={canDelete} onToggleActive={onToggleActive} onDelete={onDelete} collapsedIds={collapsedIds} onToggleCollapse={onToggleCollapse} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function DepartmentsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [editDept, setEditDept] = useState<Department | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [toggleDept, setToggleDept] = useState<Department | null>(null);
  const [deleteDept, setDeleteDept] = useState<Department | null>(null);
  const [collapsedIds, setCollapsedIds] = useState<Set<number>>(new Set());
  const [filterParentId, setFilterParentId] = useState<number | null>(null);
  const [filterLevel, setFilterLevel] = useState<string>("");
  const initialCollapseApplied = useRef(false);

  const { data: departments, isLoading } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
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

  const isAdmin = user?.role === "admin";
  const canManage = isAdmin;
  const canActivate = isAdmin;
  const canDelete = isAdmin;

  const parseErrorMessage = (error: Error) => {
    try {
      const match = error.message.match(/\{.*\}/);
      if (match) return JSON.parse(match[0]).message;
    } catch {}
    return error.message;
  };

  const toggleActiveMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("PATCH", `/api/departments/${id}/toggle-active`);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      toast({ title: data.isActive ? "تم تنشيط الجهة" : "تم إيقاف تنشيط الجهة" });
      setToggleDept(null);
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "غير مصرح", variant: "destructive" });
      } else {
        toast({ title: "حدث خطأ", description: parseErrorMessage(error), variant: "destructive" });
      }
      setToggleDept(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/departments/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      toast({ title: "تم حذف الجهة بنجاح" });
      setDeleteDept(null);
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "غير مصرح", variant: "destructive" });
      } else {
        toast({ title: "حدث خطأ", description: parseErrorMessage(error), variant: "destructive" });
      }
      setDeleteDept(null);
    },
  });

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      parentId: undefined as number | undefined,
      level: "unit" as const,
      isCentral: false,
      code: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/departments", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      toast({ title: "تم إنشاء القسم بنجاح" });
      setOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "غير مصرح", description: "جاري إعادة تسجيل الدخول...", variant: "destructive" });
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
        return;
      }
      toast({ title: "حدث خطأ", description: error.message, variant: "destructive" });
    },
  });

  const watchLevel = form.watch("level");
  const validParents = departments ? getValidParents(departments, watchLevel || "unit") : [];

  const filteredDepartments = departments?.filter(d => {
    if (!searchTerm) return true;
    return d.name.includes(searchTerm);
  });

  const centralParents = departments?.filter(d => d.isCentral) || [];

  const availableChildLevels = (() => {
    if (!departments) return [];
    let subset = departments;
    if (filterParentId) {
      const getAllDescendantIds = (parentId: number): number[] => {
        const kids = departments.filter(d => d.parentId === parentId);
        return kids.flatMap(k => [k.id, ...getAllDescendantIds(k.id)]);
      };
      const descendantIds = new Set([filterParentId, ...getAllDescendantIds(filterParentId)]);
      subset = departments.filter(d => descendantIds.has(d.id));
    }
    const levels = new Set(subset.map(d => d.level));
    return Object.keys(levelLabels).filter((l: any) => levels.has(l)) as (keyof typeof levelLabels)[];
  })();

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

  const { treeDepartments, treeRootId } = (() => {
    if (!departments) return { treeDepartments: [], treeRootId: null as number | null };
    let subset = departments;
    let rootId: number | null = null;

    if (filterParentId) {
      const getAllDescendantIds = (parentId: number): number[] => {
        const kids = departments.filter(d => d.parentId === parentId);
        return kids.flatMap(k => [k.id, ...getAllDescendantIds(k.id)]);
      };
      const descendantIds = new Set([filterParentId, ...getAllDescendantIds(filterParentId)]);
      subset = departments.filter(d => descendantIds.has(d.id));
      const parent = departments.find(d => d.id === filterParentId);
      rootId = parent?.parentId ?? null;
    }

    if (filterLevel) {
      const matchingIds = new Set<number>();
      const addAncestors = (id: number) => {
        matchingIds.add(id);
        const dept = subset.find(d => d.id === id);
        if (dept?.parentId) {
          const parent = subset.find(d => d.id === dept.parentId);
          if (parent) addAncestors(parent.id);
        }
      };
      subset.filter(d => d.level === filterLevel).forEach(d => addAncestors(d.id));
      subset = subset.filter(d => matchingIds.has(d.id));
    }

    return { treeDepartments: subset, treeRootId: rootId };
  })();

  if (!isAdmin) {
    return (
      <div className="p-6 text-center" dir="rtl">
        <h1 className="text-2xl font-bold text-muted-foreground">غير مصرح</h1>
        <p className="text-muted-foreground mt-2">هذه الصفحة متاحة لمدير النظام فقط</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-departments-title">الهيكل التنظيمي</h1>
          <p className="text-muted-foreground text-sm mt-1">إدارة الأقسام والإدارات</p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={open} onOpenChange={setOpen}>
          {canManage && (
            <DialogTrigger asChild>
              <Button data-testid="button-add-department">
                <Plus className="w-4 h-4 ml-2" />
                قسم جديد
              </Button>
            </DialogTrigger>
          )}
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
            <DialogHeader>
              <DialogTitle>إنشاء قسم جديد</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>اسم القسم</FormLabel>
                    <FormControl><Input {...field} value={field.value || ""} placeholder="مثال: قسم الموارد البشرية" data-testid="input-dept-name" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="level" render={({ field }) => (
                    <FormItem>
                      <FormLabel>المستوى</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || "unit"}>
                        <FormControl><SelectTrigger data-testid="select-dept-level"><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          {Object.entries(levelLabels).map(([key, label]) => (
                            <SelectItem key={key} value={key}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="code" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{form.watch("isCentral") ? "رمز التشكيل (مطلوب)" : "رمز القسم (اختياري)"}</FormLabel>
                      <FormControl><Input {...field} value={field.value || ""} placeholder="مثال: HR-01" data-testid="input-dept-code" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="isCentral" render={({ field }) => (
                  <FormItem className="flex items-center justify-between gap-2 rounded-lg border p-3">
                    <FormLabel className="mb-0">قسم مركزي</FormLabel>
                    <FormControl>
                      <Switch checked={field.value || false} onCheckedChange={field.onChange} data-testid="switch-dept-central" />
                    </FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="parentId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>القسم الأب (اختياري)</FormLabel>
                    <Select onValueChange={(v) => field.onChange(v === "none" ? undefined : parseInt(v))} value={field.value?.toString() || "none"}>
                      <FormControl><SelectTrigger><SelectValue placeholder="اختر القسم الأب" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="none">بدون (قسم رئيسي)</SelectItem>
                        {validParents.map(d => <SelectItem key={d.id} value={d.id.toString()}>{d.name} ({levelLabels[d.level]})</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel>الوصف (اختياري)</FormLabel>
                    <FormControl><Textarea {...field} value={field.value || ""} placeholder="وصف القسم ومهامه" rows={3} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-department">
                  {createMutation.isPending && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
                  إنشاء القسم
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="بحث في الأقسام..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pr-10"
              data-testid="input-search-departments"
            />
          </div>
          <Badge variant="secondary" className="text-xs">
            <Building2 className="w-3 h-3 ml-1" />
            {departments?.length || 0} قسم
          </Badge>
        </div>

        {!searchTerm && (
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
              <Filter className="w-3.5 h-3.5" />
              <span>تصفية:</span>
            </div>
            <Select
              value={filterParentId?.toString() || "all"}
              onValueChange={(v) => {
                setFilterParentId(v === "all" ? null : parseInt(v));
                setFilterLevel("");
              }}
            >
              <SelectTrigger className="w-48 h-8 text-xs" data-testid="select-filter-parent">
                <SelectValue placeholder="جميع الجهات" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الجهات</SelectItem>
                {centralParents.map(d => (
                  <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filterLevel || "all"}
              onValueChange={(v) => setFilterLevel(v === "all" ? "" : v)}
            >
              <SelectTrigger className="w-40 h-8 text-xs" data-testid="select-filter-level">
                <SelectValue placeholder="جميع المستويات" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع المستويات</SelectItem>
                {availableChildLevels.map(l => (
                  <SelectItem key={l} value={l}>{levelLabels[l]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(filterParentId || filterLevel) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={() => { setFilterParentId(null); setFilterLevel(""); }}
                data-testid="button-clear-filters"
              >
                مسح الفلاتر
              </Button>
            )}
            <div className="mr-auto flex items-center gap-1">
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={handleExpandAll} data-testid="button-expand-all">
                توسيع الكل
              </Button>
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={handleCollapseAll} data-testid="button-collapse-all">
                طي الكل
              </Button>
            </div>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}
        </div>
      ) : departments && departments.length > 0 ? (
        searchTerm ? (
          <div className="space-y-2">
            {filteredDepartments?.map(dept => {
              const deptLevel = dept.level || "unit";
              const IconComp = levelIcons[deptLevel] || Building2;
              const iconColor = levelColors[deptLevel] || "text-primary";
              const iconBg = levelBgColors[deptLevel] || "bg-primary/10";
              return (
                <Card key={dept.id} className={`p-3 hover-elevate transition-all duration-150 group ${!dept.isActive ? "opacity-50" : ""}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-md flex items-center justify-center shrink-0 ${iconBg}`}>
                      <IconComp className={`w-4 h-4 ${iconColor}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm">{dept.name}</h3>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap shrink-0">
                      {!dept.isActive && (
                        <Badge variant="destructive" className="text-xs">
                          معطّل
                        </Badge>
                      )}
                      <Badge variant="secondary" className={`text-xs ${levelBgColors[deptLevel]} ${levelColors[deptLevel]}`}>
                        {levelLabels[deptLevel]}
                      </Badge>
                      {dept.isCentral && (
                        <Badge variant="secondary" className="text-xs bg-chart-5/10 text-chart-5">
                          مركزي
                        </Badge>
                      )}
                      {dept.code && (
                        <Badge variant="outline" className="text-xs text-muted-foreground">
                          {dept.code}
                        </Badge>
                      )}
                      <DepartmentActionButtons
                        dept={dept}
                        canManage={canManage}
                        canActivate={canActivate}
                        canDelete={canDelete}
                        onEdit={() => setEditDept(dept)}
                        onToggleActive={() => setToggleDept(dept)}
                        onDelete={() => setDeleteDept(dept)}
                      />
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <DepartmentTree departments={treeDepartments} allDepartments={departments} rootId={treeRootId} onEdit={setEditDept} canManage={canManage} canActivate={canActivate} canDelete={canDelete} onToggleActive={setToggleDept} onDelete={setDeleteDept} collapsedIds={collapsedIds} onToggleCollapse={handleToggleCollapse} />
        )
      ) : (
        <Card className="p-12">
          <div className="text-center text-muted-foreground">
            <FolderTree className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">لا توجد أقسام</p>
            <p className="text-sm mt-1">ابدأ بإنشاء الهيكل التنظيمي</p>
          </div>
        </Card>
      )}

      <Dialog open={!!editDept} onOpenChange={(o) => { if (!o) setEditDept(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>تعديل الجهة - {editDept?.name}</DialogTitle>
            <DialogDescription>تعديل بيانات الجهة</DialogDescription>
          </DialogHeader>
          {editDept && departments && (
            <DepartmentEditDialog dept={editDept} departments={departments} onClose={() => setEditDept(null)} />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toggleDept} onOpenChange={(o) => { if (!o) setToggleDept(null); }}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {toggleDept?.isActive ? "إيقاف تنشيط الجهة" : "تنشيط الجهة"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {toggleDept?.isActive
                ? `هل أنت متأكد من إيقاف تنشيط "${toggleDept?.name}"؟ لن تظهر في قوائم الاختيار.`
                : `هل أنت متأكد من تنشيط "${toggleDept?.name}"؟`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel data-testid="button-cancel-toggle">إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => toggleDept && toggleActiveMutation.mutate(toggleDept.id)}
              data-testid="button-confirm-toggle"
            >
              {toggleActiveMutation.isPending && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
              {toggleDept?.isActive ? "إيقاف التنشيط" : "تنشيط"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteDept} onOpenChange={(o) => { if (!o) setDeleteDept(null); }}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف الجهة</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف "{deleteDept?.name}"؟ لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel data-testid="button-cancel-delete">إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteDept && deleteMutation.mutate(deleteDept.id)}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
