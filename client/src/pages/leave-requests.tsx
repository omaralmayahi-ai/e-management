import { useState, useMemo } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { insertLeaveRequestSchema } from "@shared/schema";
import type { LeaveRequest, Employee, Department } from "@shared/schema";
import {
  Plus,
  CalendarDays,
  Search,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  CalendarRange,
  ShieldCheck,
  AlertTriangle,
  UserCheck,
  Building2,
  ArrowLeft,
  X,
  Wallet,
  FileText,
  Ban,
} from "lucide-react";
import { z } from "zod";
import { isUnauthorizedError } from "@/lib/auth-utils";

const formSchema = insertLeaveRequestSchema.extend({
  leaveType: z.enum(["annual", "sick", "emergency", "unpaid", "maternity", "study", "other"]),
  startDate: z.string().min(1, "تاريخ البداية مطلوب"),
  endDate: z.string().min(1, "تاريخ النهاية مطلوب"),
});

const leaveTypeLabels: Record<string, string> = {
  annual: "إجازة سنوية",
  sick: "إجازة مرضية",
  emergency: "إجازة طارئة",
  unpaid: "إجازة بدون راتب",
  maternity: "إجازة أمومة",
  study: "إجازة دراسية",
  other: "أخرى",
};

const leaveTypeColors: Record<string, string> = {
  annual: "bg-chart-1/10 text-chart-1",
  sick: "bg-destructive/10 text-destructive",
  emergency: "bg-chart-5/10 text-chart-5",
  unpaid: "bg-muted text-muted-foreground",
  maternity: "bg-chart-3/10 text-chart-3",
  study: "bg-chart-4/10 text-chart-4",
  other: "bg-chart-2/10 text-chart-2",
};

const statusLabels: Record<string, string> = {
  pending: "قيد الانتظار",
  approved_by_direct: "موافقة المسؤول المباشر",
  approved_by_section: "موافقة رئيس القسم",
  approved_by_hr: "موافقة الموارد البشرية",
  approved: "معتمد نهائياً",
  rejected: "مرفوض",
  cancelled: "ملغي",
};

const statusColors: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  approved_by_direct: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  approved_by_section: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
  approved_by_hr: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
  approved: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  rejected: "bg-destructive/10 text-destructive border-destructive/20",
  cancelled: "bg-muted text-muted-foreground border-border",
};

const workflowSteps = [
  { key: "pending", label: "تقديم الطلب" },
  { key: "approved_by_direct", label: "المسؤول المباشر" },
  { key: "approved_by_section", label: "رئيس القسم" },
  { key: "approved_by_hr", label: "الموارد البشرية" },
  { key: "approved", label: "الاعتماد النهائي" },
];

interface ActionModalState {
  request: LeaveRequest;
  nextStatus: string;
  actionType: "approve" | "reject" | "cancel";
  title: string;
  description: string;
}

export default function LeaveRequestsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedAction, setSelectedAction] = useState<ActionModalState | null>(null);
  const [actionNotes, setActionNotes] = useState("");

  const { data: items, isLoading } = useQuery<LeaveRequest[]>({
    queryKey: ["/api/leave-requests"],
  });

  const { data: employees } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
  });

  const { data: departments } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
  });

  const employeeMap = useMemo(() => {
    const map = new Map<number, Employee>();
    employees?.forEach((e) => map.set(e.id, e));
    return map;
  }, [employees]);

  const departmentMap = useMemo(() => {
    const map = new Map<number, Department>();
    departments?.forEach((d) => map.set(d.id, d));
    return map;
  }, [departments]);

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      leaveType: "annual" as const,
      startDate: "",
      endDate: "",
      reason: "",
      status: "pending" as const,
      notes: "",
      employeeId: user?.id || 0,
    },
  });

  const watchStartDate = form.watch("startDate");
  const watchEndDate = form.watch("endDate");

  const requestedDays = useMemo(() => {
    if (!watchStartDate || !watchEndDate) return 0;
    const s = new Date(watchStartDate);
    const e = new Date(watchEndDate);
    if (isNaN(s.getTime()) || isNaN(e.getTime()) || e < s) return 0;
    return Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  }, [watchStartDate, watchEndDate]);

  const currentUserBalance = user?.leaveBalance ?? 30;
  const isBalanceExceeded = requestedDays > currentUserBalance;

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const payload = {
        ...data,
        startDate: new Date(data.startDate).toISOString(),
        endDate: new Date(data.endDate).toISOString(),
      };
      const res = await apiRequest("POST", "/api/leave-requests", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leave-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({ title: "تم تقديم طلب الإجازة بنجاح", description: "تم إرسال الطلب للاعتماد عبر السلسلة الإدارية" });
      setOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "غير مصرح", description: "جاري إعادة تسجيل الدخول...", variant: "destructive" });
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
        return;
      }
      toast({ title: "تعذر تقديم الطلب", description: error.message, variant: "destructive" });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: number; status: string; notes?: string }) => {
      const res = await apiRequest("PATCH", `/api/leave-requests/${id}/status`, { status, notes });
      return res.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/leave-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      toast({
        title: "تم تحديث حالة طلب الإجازة",
        description: `أصبح الطلب الآن: ${statusLabels[variables.status] || variables.status}`,
      });
      setSelectedAction(null);
      setActionNotes("");
    },
    onError: (error: Error) => {
      toast({ title: "تعذر تحديث حالة الطلب", description: error.message, variant: "destructive" });
    },
  });

  const filteredItems = items?.filter((item) => {
    const matchesSearch =
      !searchTerm ||
      leaveTypeLabels[item.leaveType]?.includes(searchTerm) ||
      item.reason?.includes(searchTerm) ||
      employeeMap.get(item.employeeId)?.fullName.includes(searchTerm);

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "pending_all" && item.status?.startsWith("approved_by_") || item.status === "pending") ||
      item.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getDaysDiff = (start: string | Date, end: string | Date) => {
    const s = new Date(start);
    const e = new Date(end);
    return Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  };

  const getNextApprovalStep = (currentStatus: string) => {
    switch (currentStatus) {
      case "pending":
        return {
          status: "approved_by_direct",
          label: "موافقة المسؤول المباشر",
          description: "اعتماد أولي من قبل المسؤول المباشر ونقله لرئيس القسم",
        };
      case "approved_by_direct":
        return {
          status: "approved_by_section",
          label: "موافقة رئيس القسم",
          description: "اعتماد قسمي ونقل الطلب للموارد البشرية",
        };
      case "approved_by_section":
        return {
          status: "approved_by_hr",
          label: "موافقة الموارد البشرية",
          description: "اعتماد إدارة الموارد البشرية ونقل الطلب للاعتماد النهائي",
        };
      case "approved_by_hr":
        return {
          status: "approved",
          label: "الاعتماد النهائي وخصم الرصيد",
          description: "الاعتماد النهائي للطلب وخصم أيام الإجازة من رصيد الموظف تلقائياً",
        };
      default:
        return null;
    }
  };

  const canUserApprove = (item: LeaveRequest) => {
    if (!user) return false;
    const isTerminal = item.status === "approved" || item.status === "rejected" || item.status === "cancelled";
    if (isTerminal) return false;

    // Requester cannot approve their own request
    if (item.employeeId === user.id && user.role !== "admin") return false;

    if (user.role === "admin") return true;

    if (user.role === "officer") {
      const requester = employeeMap.get(item.employeeId);
      // Same department officer can approve direct and section stages
      if (requester && user.departmentId && requester.departmentId === user.departmentId) {
        return item.status === "pending" || item.status === "approved_by_direct";
      }
    }

    return false;
  };

  const canUserReject = (item: LeaveRequest) => {
    return canUserApprove(item);
  };

  const canUserCancel = (item: LeaveRequest) => {
    if (!user) return false;
    if (item.status !== "pending") return false;
    return item.employeeId === user.id || user.role === "admin";
  };

  const getStepStatus = (stepKey: string, currentStatus: string) => {
    const stepOrder = ["pending", "approved_by_direct", "approved_by_section", "approved_by_hr", "approved"];
    const currentIndex = stepOrder.indexOf(currentStatus);
    const stepIndex = stepOrder.indexOf(stepKey);

    if (currentStatus === "rejected") {
      return "rejected";
    }
    if (currentStatus === "cancelled") {
      return "cancelled";
    }
    if (currentIndex >= stepIndex) {
      return "completed";
    }
    if (currentIndex + 1 === stepIndex) {
      return "current";
    }
    return "upcoming";
  };

  return (
    <div className="p-6 space-y-6" dir="rtl">
      {/* Header & Balance Banner */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-leave-title">
            طلبات الإجازات الإدارية
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            دورة عمل متكاملة للاعتماد والتنسيق وخصم الرصيد الفعلي
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-card border shadow-xs">
            <Wallet className="w-4 h-4 text-primary" />
            <div className="text-right">
              <div className="text-xs text-muted-foreground">رصيدك المتاح</div>
              <div className="text-sm font-bold text-foreground">
                {currentUserBalance} <span className="text-xs font-normal text-muted-foreground">يوم</span>
              </div>
            </div>
          </div>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-leave" className="gap-2">
                <Plus className="w-4 h-4" />
                تقديم طلب إجازة
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg" dir="rtl">
              <DialogHeader>
                <DialogTitle>تقديم طلب إجازة جديد</DialogTitle>
                <DialogDescription>
                  سيتم توجيه طلبك تلقائياً عبر سلسلة الموافقات الإدارية حتى الاعتماد النهائي
                </DialogDescription>
              </DialogHeader>

              <div className="p-3 rounded-lg bg-muted/60 border text-sm flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-primary" />
                  <span className="text-muted-foreground">رصيد الإجازات الحالي:</span>
                </div>
                <span className="font-bold text-foreground">{currentUserBalance} يوم</span>
              </div>

              <Form {...form}>
                <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="leaveType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>نوع الإجازة</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-leave-type">
                              <SelectValue placeholder="اختر النوع" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(leaveTypeLabels).map(([key, label]) => (
                              <SelectItem key={key} value={key}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="startDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>تاريخ البداية</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} data-testid="input-leave-start" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="endDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>تاريخ النهاية</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} data-testid="input-leave-end" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {requestedDays > 0 && (
                    <div
                      className={`p-3 rounded-lg text-sm flex items-center justify-between border ${
                        isBalanceExceeded
                          ? "bg-destructive/10 border-destructive/30 text-destructive"
                          : "bg-primary/5 border-primary/20 text-foreground"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {isBalanceExceeded ? (
                          <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
                        ) : (
                          <CalendarDays className="w-4 h-4 text-primary shrink-0" />
                        )}
                        <span>
                          {isBalanceExceeded
                            ? `الرصيد المتاح (${currentUserBalance} يوم) غير كافٍ لتغطية ${requestedDays} يوم مطلوبة`
                            : `المدة المطلوبة: ${requestedDays} يوم`}
                        </span>
                      </div>
                      {!isBalanceExceeded && (
                        <span className="text-xs text-muted-foreground">
                          المتبقي بعد الخصم: {currentUserBalance - requestedDays} يوم
                        </span>
                      )}
                    </div>
                  )}

                  <FormField
                    control={form.control}
                    name="reason"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>سبب الإجازة</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            value={field.value || ""}
                            placeholder="اكتب سبب طلب الإجازة..."
                            rows={3}
                            data-testid="input-leave-reason"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={createMutation.isPending || isBalanceExceeded}
                    data-testid="button-submit-leave"
                  >
                    {createMutation.isPending && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
                    {isBalanceExceeded ? "الرصيد غير كافٍ لإرسال الطلب" : "تقديم الطلب للاعتماد"}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[240px] max-w-sm">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="بحث بالنوع، السبب، اسم الموظف..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pr-10"
            data-testid="input-search-leave"
          />
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <Button
            size="sm"
            variant={statusFilter === "all" ? "default" : "outline"}
            onClick={() => setStatusFilter("all")}
          >
            الكل
          </Button>
          <Button
            size="sm"
            variant={statusFilter === "pending_all" ? "default" : "outline"}
            onClick={() => setStatusFilter("pending_all")}
          >
            قيد المعالجة
          </Button>
          <Button
            size="sm"
            variant={statusFilter === "approved" ? "default" : "outline"}
            onClick={() => setStatusFilter("approved")}
          >
            معتمد نهائياً
          </Button>
          <Button
            size="sm"
            variant={statusFilter === "rejected" ? "default" : "outline"}
            onClick={() => setStatusFilter("rejected")}
          >
            مرفوض
          </Button>
        </div>
      </div>

      {/* Leave Requests Cards */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      ) : filteredItems && filteredItems.length > 0 ? (
        <div className="space-y-4">
          {filteredItems.map((item) => {
            const requester = employeeMap.get(item.employeeId);
            const dept = requester?.departmentId ? departmentMap.get(requester.departmentId) : null;
            const nextStep = getNextApprovalStep(item.status || "pending");
            const canApprove = canUserApprove(item);
            const canReject = canUserReject(item);
            const canCancel = canUserCancel(item);

            return (
              <Card
                key={item.id}
                className="p-5 border shadow-xs hover:border-primary/30 transition-all duration-150"
                data-testid={`card-leave-${item.id}`}
              >
                <div className="space-y-4">
                  {/* Top Bar: Info + Badges */}
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          leaveTypeColors[item.leaveType] || "bg-primary/10 text-primary"
                        }`}
                      >
                        <CalendarDays className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-base text-foreground">
                            {leaveTypeLabels[item.leaveType]}
                          </h3>
                          <Badge variant="outline" className={`text-xs font-medium ${statusColors[item.status || "pending"]}`}>
                            {statusLabels[item.status || "pending"]}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                          {requester && (
                            <span className="flex items-center gap-1 font-medium text-foreground">
                              <UserCheck className="w-3.5 h-3.5 text-muted-foreground" />
                              {requester.fullName}
                              {requester.jobTitle && <span className="text-muted-foreground">({requester.jobTitle})</span>}
                            </span>
                          )}
                          {dept && (
                            <span className="flex items-center gap-1">
                              <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                              {dept.name}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                            {item.createdAt ? new Date(item.createdAt).toLocaleDateString("ar-SA") : ""}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Date & Days Badge */}
                    <div className="text-left bg-muted/40 px-3.5 py-1.5 rounded-lg border">
                      <div className="text-xs text-muted-foreground">فترة الإجازة</div>
                      <div className="text-sm font-semibold text-foreground">
                        {item.startDate ? new Date(item.startDate).toLocaleDateString("ar-SA") : ""} ←{" "}
                        {item.endDate ? new Date(item.endDate).toLocaleDateString("ar-SA") : ""}
                        <span className="mr-1.5 text-primary font-bold">({item.daysCount} يوم)</span>
                      </div>
                    </div>
                  </div>

                  {/* Reason & Notes */}
                  {item.reason && (
                    <div className="p-3 bg-muted/30 rounded-lg text-xs text-foreground flex items-start gap-2 border">
                      <FileText className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <span className="font-medium text-muted-foreground">السبب: </span>
                        {item.reason}
                      </div>
                    </div>
                  )}

                  {item.notes && (
                    <div className="p-2.5 bg-amber-500/5 rounded-lg text-xs text-amber-800 dark:text-amber-300 border border-amber-500/15 flex items-start gap-2">
                      <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-medium">ملاحظات الاعتماد: </span>
                        {item.notes}
                      </div>
                    </div>
                  )}

                  {/* Visual Workflow Stepper */}
                  <div className="pt-2 border-t">
                    <div className="text-xs font-medium text-muted-foreground mb-2">مراحل الاعتماد:</div>
                    <div className="grid grid-cols-5 gap-1.5 text-center">
                      {workflowSteps.map((st, idx) => {
                        const stepState = getStepStatus(st.key, item.status || "pending");
                        return (
                          <div
                            key={st.key}
                            className={`p-2 rounded-lg text-xs border transition-colors flex flex-col items-center justify-center gap-1 ${
                              stepState === "completed"
                                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                                : stepState === "current"
                                ? "bg-primary/10 border-primary text-primary font-bold shadow-xs animate-pulse"
                                : stepState === "rejected"
                                ? "bg-destructive/10 border-destructive/30 text-destructive"
                                : stepState === "cancelled"
                                ? "bg-muted border-border text-muted-foreground"
                                : "bg-muted/30 border-border/50 text-muted-foreground"
                            }`}
                          >
                            <div className="flex items-center gap-1">
                              {stepState === "completed" ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              ) : stepState === "rejected" ? (
                                <XCircle className="w-3.5 h-3.5 text-destructive" />
                              ) : stepState === "cancelled" ? (
                                <Ban className="w-3.5 h-3.5 text-muted-foreground" />
                              ) : (
                                <span className="w-3.5 h-3.5 rounded-full border text-[10px] flex items-center justify-center">
                                  {idx + 1}
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] leading-tight line-clamp-1">{st.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Actions Section */}
                  {(canApprove || canReject || canCancel) && (
                    <div className="flex items-center justify-end gap-2 pt-2 border-t flex-wrap">
                      {canCancel && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-muted-foreground hover:text-destructive gap-1.5 text-xs"
                          onClick={() =>
                            setSelectedAction({
                              request: item,
                              nextStatus: "cancelled",
                              actionType: "cancel",
                              title: "إلغاء طلب الإجازة",
                              description: "هل أنت متأكد من رغبتك في إلغاء طلب الإجازة المقدم؟",
                            })
                          }
                        >
                          <X className="w-3.5 h-3.5" />
                          إلغاء الطلب
                        </Button>
                      )}

                      {canReject && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-destructive/30 text-destructive hover:bg-destructive/10 gap-1.5 text-xs"
                          onClick={() =>
                            setSelectedAction({
                              request: item,
                              nextStatus: "rejected",
                              actionType: "reject",
                              title: "رفض طلب الإجازة",
                              description: `هل أنت متأكد من رفض طلب إجازة الموظف (${requester?.fullName || "الموظف"})؟`,
                            })
                          }
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          رفض الطلب
                        </Button>
                      )}

                      {canApprove && nextStep && (
                        <Button
                          size="sm"
                          className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                          onClick={() =>
                            setSelectedAction({
                              request: item,
                              nextStatus: nextStep.status,
                              actionType: "approve",
                              title: nextStep.label,
                              description: `${nextStep.description} للموظف (${requester?.fullName || "الموظف"})`,
                            })
                          }
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {nextStep.label}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="p-12">
          <div className="text-center text-muted-foreground">
            <CalendarRange className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">لا توجد طلبات إجازة تطابق البحث</p>
            <p className="text-sm mt-1">يمكنك تقديم طلب إجازة جديد عبر الزر بالأعلى</p>
          </div>
        </Card>
      )}

      {/* Approval/Rejection/Cancel Action Modal */}
      {selectedAction && (
        <Dialog open={!!selectedAction} onOpenChange={(v) => !v && setSelectedAction(null)}>
          <DialogContent className="max-w-md" dir="rtl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {selectedAction.actionType === "approve" ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                ) : selectedAction.actionType === "reject" ? (
                  <XCircle className="w-5 h-5 text-destructive" />
                ) : (
                  <Ban className="w-5 h-5 text-muted-foreground" />
                )}
                {selectedAction.title}
              </DialogTitle>
              <DialogDescription>{selectedAction.description}</DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <div className="p-3 bg-muted/50 rounded-lg text-xs space-y-1.5 border">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">الموظف:</span>
                  <span className="font-semibold">
                    {employeeMap.get(selectedAction.request.employeeId)?.fullName || "غير محدد"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">نوع الإجازة:</span>
                  <span className="font-semibold">{leaveTypeLabels[selectedAction.request.leaveType]}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">الأيام المطلوبة:</span>
                  <span className="font-semibold text-primary">{selectedAction.request.daysCount} يوم</span>
                </div>
                {selectedAction.nextStatus === "approved" && (
                  <div className="pt-1.5 border-t border-border/60 text-emerald-700 dark:text-emerald-400 font-medium">
                    ⚠️ هذا هو الاعتماد النهائي. سيتم خصم ({selectedAction.request.daysCount} يوم) مباشرة من رصيد
                    الموظف في قاعدة البيانات.
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium">
                  {selectedAction.actionType === "reject" ? "سبب الرفض (اختياري)" : "ملاحظات الاعتماد (اختياري)"}
                </label>
                <Textarea
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  placeholder="اكتب ملاحظات إدارية هنا..."
                  rows={3}
                  className="text-xs"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setSelectedAction(null)}>
                إلغاء
              </Button>
              <Button
                variant={
                  selectedAction.actionType === "reject"
                    ? "destructive"
                    : selectedAction.actionType === "cancel"
                    ? "secondary"
                    : "default"
                }
                className={selectedAction.actionType === "approve" ? "bg-emerald-600 hover:bg-emerald-700" : ""}
                disabled={updateStatusMutation.isPending}
                onClick={() =>
                  updateStatusMutation.mutate({
                    id: selectedAction.request.id,
                    status: selectedAction.nextStatus,
                    notes: actionNotes || undefined,
                  })
                }
              >
                {updateStatusMutation.isPending && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
                تأكيد الإجراء
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
