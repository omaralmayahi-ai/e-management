import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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
import type { LeaveRequest, InsertLeaveRequest } from "@shared/schema";
import {
  Plus,
  CalendarDays,
  Search,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  CalendarRange,
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
  approved_by_section: "موافقة القسم",
  approved_by_hr: "موافقة الموارد البشرية",
  approved: "موافق عليه",
  rejected: "مرفوض",
  cancelled: "ملغي",
};

const statusColors: Record<string, string> = {
  pending: "bg-chart-5/10 text-chart-5",
  approved_by_direct: "bg-chart-1/10 text-chart-1",
  approved_by_section: "bg-chart-2/10 text-chart-2",
  approved_by_hr: "bg-chart-3/10 text-chart-3",
  approved: "bg-chart-4/10 text-chart-4",
  rejected: "bg-destructive/10 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
};

export default function LeaveRequestsPage() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const { data: items, isLoading } = useQuery<LeaveRequest[]>({
    queryKey: ["/api/leave-requests"],
  });

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      leaveType: "annual" as const,
      startDate: "",
      endDate: "",
      reason: "",
      status: "pending" as const,
      notes: "",
      employeeId: 0,
    },
  });

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
      toast({ title: "تم تقديم طلب الإجازة بنجاح" });
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

  const filteredItems = items?.filter(item => {
    if (!searchTerm) return true;
    return (
      leaveTypeLabels[item.leaveType]?.includes(searchTerm) ||
      item.reason?.includes(searchTerm)
    );
  });

  const getDaysDiff = (start: string | Date, end: string | Date) => {
    const s = new Date(start);
    const e = new Date(end);
    return Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  };

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-leave-title">الطلبات الإدارية</h1>
          <p className="text-muted-foreground text-sm mt-1">إدارة الإجازات والطلبات الإدارية</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-leave">
              <Plus className="w-4 h-4 ml-2" />
              طلب إجازة جديد
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg" dir="rtl">
            <DialogHeader>
              <DialogTitle>تقديم طلب إجازة</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
                <FormField control={form.control} name="leaveType" render={({ field }) => (
                  <FormItem>
                    <FormLabel>نوع الإجازة</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger data-testid="select-leave-type"><SelectValue placeholder="اختر النوع" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {Object.entries(leaveTypeLabels).map(([key, label]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="startDate" render={({ field }) => (
                    <FormItem>
                      <FormLabel>تاريخ البداية</FormLabel>
                      <FormControl><Input type="date" {...field} data-testid="input-leave-start" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="endDate" render={({ field }) => (
                    <FormItem>
                      <FormLabel>تاريخ النهاية</FormLabel>
                      <FormControl><Input type="date" {...field} data-testid="input-leave-end" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="reason" render={({ field }) => (
                  <FormItem>
                    <FormLabel>السبب</FormLabel>
                    <FormControl><Textarea {...field} value={field.value || ""} placeholder="سبب الإجازة" rows={3} data-testid="input-leave-reason" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="notes" render={({ field }) => (
                  <FormItem>
                    <FormLabel>ملاحظات (اختياري)</FormLabel>
                    <FormControl><Textarea {...field} value={field.value || ""} placeholder="ملاحظات إضافية" rows={2} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-leave">
                  {createMutation.isPending && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
                  تقديم الطلب
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="بحث في الطلبات..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pr-10"
          data-testid="input-search-leave"
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
      ) : filteredItems && filteredItems.length > 0 ? (
        <div className="space-y-3">
          {filteredItems.map(item => (
            <Card key={item.id} className="p-4 hover-elevate transition-all duration-150" data-testid={`card-leave-${item.id}`}>
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-md flex items-center justify-center shrink-0 ${leaveTypeColors[item.leaveType]}`}>
                  <CalendarDays className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <h3 className="font-medium text-sm">{leaveTypeLabels[item.leaveType]}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {item.startDate ? new Date(item.startDate).toLocaleDateString("ar-SA") : ""} → {item.endDate ? new Date(item.endDate).toLocaleDateString("ar-SA") : ""}
                        {item.startDate && item.endDate && (
                          <span className="mr-2 font-medium">({getDaysDiff(item.startDate, item.endDate)} يوم)</span>
                        )}
                      </p>
                    </div>
                    <Badge variant="secondary" className={`text-xs ${statusColors[item.status || "pending"]}`}>
                      {statusLabels[item.status || "pending"]}
                    </Badge>
                  </div>
                  {item.reason && (
                    <p className="text-xs text-muted-foreground mt-2">{item.reason}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {item.createdAt ? new Date(item.createdAt).toLocaleDateString("ar-SA") : ""}
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-12">
          <div className="text-center text-muted-foreground">
            <CalendarRange className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">لا توجد طلبات إجازة</p>
            <p className="text-sm mt-1">قدم طلب إجازة جديد</p>
          </div>
        </Card>
      )}
    </div>
  );
}
