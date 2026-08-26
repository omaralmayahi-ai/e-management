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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertServiceRequestSchema } from "@shared/schema";
import type { ServiceRequest, Department, InsertServiceRequest } from "@shared/schema";
import {
  Plus,
  Wrench,
  Search,
  Clock,
  Loader2,
  Monitor,
  Paintbrush,
  Settings,
  HardDrive,
  Sparkles,
  BookOpen,
} from "lucide-react";
import { z } from "zod";
import { isUnauthorizedError } from "@/lib/auth-utils";

const formSchema = z.object({
  title: z.string().min(1, "العنوان مطلوب"),
  description: z.string().optional(),
  serviceType: z.enum(["maintenance", "technical", "administrative", "it_support", "cleaning", "stationery", "other"]),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  departmentId: z.number().optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
  status: z.string().default("pending"),
});

const serviceTypeLabels: Record<string, string> = {
  maintenance: "صيانة",
  technical: "خدمات فنية",
  administrative: "خدمات إدارية",
  it_support: "دعم تقني",
  cleaning: "نظافة",
  stationery: "قرطاسية",
  other: "أخرى",
};

const serviceTypeIcons: Record<string, any> = {
  maintenance: Wrench,
  technical: Settings,
  administrative: Monitor,
  it_support: HardDrive,
  cleaning: Sparkles,
  stationery: BookOpen,
  other: Paintbrush,
};

const serviceTypeColors: Record<string, string> = {
  maintenance: "bg-chart-5/10 text-chart-5",
  technical: "bg-chart-1/10 text-chart-1",
  administrative: "bg-chart-2/10 text-chart-2",
  it_support: "bg-chart-3/10 text-chart-3",
  cleaning: "bg-chart-4/10 text-chart-4",
  stationery: "bg-primary/10 text-primary",
  other: "bg-muted text-muted-foreground",
};

const statusLabels: Record<string, string> = {
  pending: "قيد الانتظار",
  in_progress: "قيد التنفيذ",
  approved: "موافق عليه",
  completed: "مكتمل",
  rejected: "مرفوض",
  cancelled: "ملغي",
  assigned: "تم التكليف",
  verified: "تم التحقق",
};

const statusColors: Record<string, string> = {
  pending: "bg-chart-5/10 text-chart-5",
  in_progress: "bg-chart-1/10 text-chart-1",
  approved: "bg-chart-4/10 text-chart-4",
  completed: "bg-chart-3/10 text-chart-3",
  rejected: "bg-destructive/10 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
  assigned: "bg-chart-2/10 text-chart-2",
  verified: "bg-chart-3/10 text-chart-3",
};

const priorityLabels: Record<string, string> = {
  low: "منخفض",
  medium: "متوسط",
  high: "مرتفع",
  urgent: "عاجل",
};

const priorityColors: Record<string, string> = {
  low: "bg-chart-3/10 text-chart-3",
  medium: "bg-chart-1/10 text-chart-1",
  high: "bg-chart-5/10 text-chart-5",
  urgent: "bg-destructive/10 text-destructive",
};

export default function ServiceRequestsPage() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  const { data: items, isLoading } = useQuery<ServiceRequest[]>({
    queryKey: ["/api/service-requests"],
  });
  const { data: departments } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
  });

  const form = useForm<any>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      serviceType: "maintenance",
      priority: "medium",
      status: "pending",
      requestNumber: "",
      location: "",
      notes: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertServiceRequest) => {
      const res = await apiRequest("POST", "/api/service-requests", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-requests"] });
      toast({ title: "تم إنشاء طلب الخدمة بنجاح" });
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
    const matchesSearch = !searchTerm ||
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.requestNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTab = activeTab === "all" || item.serviceType === activeTab;
    return matchesSearch && matchesTab;
  });

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-service-title">طلبات الخدمات</h1>
          <p className="text-muted-foreground text-sm mt-1">إدارة طلبات الصيانة والخدمات الفنية والإدارية</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-service">
              <Plus className="w-4 h-4 ml-2" />
              طلب خدمة جديد
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
            <DialogHeader>
              <DialogTitle>إنشاء طلب خدمة جديد</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
                <FormField control={form.control} name="serviceType" render={({ field }) => (
                  <FormItem>
                    <FormLabel>نوع الخدمة</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl><SelectTrigger data-testid="select-service-type"><SelectValue placeholder="اختر النوع" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {Object.entries(serviceTypeLabels).map(([key, label]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="title" render={({ field }) => (
                  <FormItem>
                    <FormLabel>العنوان</FormLabel>
                    <FormControl><Input {...field} value={field.value || ""} placeholder="عنوان الطلب" data-testid="input-service-title" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel>الوصف</FormLabel>
                    <FormControl><Textarea {...field} value={field.value || ""} placeholder="وصف تفصيلي للطلب" rows={3} data-testid="input-service-desc" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="priority" render={({ field }) => (
                    <FormItem>
                      <FormLabel>الأولوية</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || "medium"}>
                        <FormControl><SelectTrigger data-testid="select-service-priority"><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="low">منخفض</SelectItem>
                          <SelectItem value="medium">متوسط</SelectItem>
                          <SelectItem value="high">مرتفع</SelectItem>
                          <SelectItem value="urgent">عاجل</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="departmentId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>القسم</FormLabel>
                      <Select onValueChange={(v) => field.onChange(parseInt(v))} value={field.value?.toString() || ""}>
                        <FormControl><SelectTrigger><SelectValue placeholder="اختر القسم" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {departments?.map(d => <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="location" render={({ field }) => (
                  <FormItem>
                    <FormLabel>الموقع</FormLabel>
                    <FormControl><Input {...field} value={field.value || ""} placeholder="مثال: الطابق الثاني - الغرفة 203" data-testid="input-service-location" /></FormControl>
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
                <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-service">
                  {createMutation.isPending && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
                  إنشاء الطلب
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[240px] max-w-sm">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="بحث بالعنوان أو الرقم..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pr-10"
            data-testid="input-search-service"
          />
        </div>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex-wrap">
            <TabsTrigger value="all">الكل</TabsTrigger>
            <TabsTrigger value="maintenance">صيانة</TabsTrigger>
            <TabsTrigger value="technical">فنية</TabsTrigger>
            <TabsTrigger value="it_support">دعم تقني</TabsTrigger>
            <TabsTrigger value="administrative">إدارية</TabsTrigger>
            <TabsTrigger value="stationery">قرطاسية</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
      ) : filteredItems && filteredItems.length > 0 ? (
        <div className="space-y-3">
          {filteredItems.map(item => {
            const IconComp = serviceTypeIcons[item.serviceType] || Wrench;
            return (
              <Card key={item.id} className="p-4 hover-elevate transition-all duration-150" data-testid={`card-service-${item.id}`}>
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-md flex items-center justify-center shrink-0 ${serviceTypeColors[item.serviceType]}`}>
                    <IconComp className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div>
                        <h3 className="font-medium text-sm">{item.title}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {item.requestNumber} - {serviceTypeLabels[item.serviceType]}
                        </p>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <Badge variant="secondary" className={`text-xs ${priorityColors[item.priority || "medium"]}`}>
                          {priorityLabels[item.priority || "medium"]}
                        </Badge>
                        <Badge variant="secondary" className={`text-xs ${statusColors[item.status || "pending"]}`}>
                          {statusLabels[item.status || "pending"]}
                        </Badge>
                      </div>
                    </div>
                    {item.description && (
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{item.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {item.createdAt ? new Date(item.createdAt).toLocaleDateString("ar-SA") : ""}
                      </span>
                      {item.location && <span>الموقع: {item.location}</span>}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="p-12">
          <div className="text-center text-muted-foreground">
            <Wrench className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">لا توجد طلبات خدمات</p>
            <p className="text-sm mt-1">أنشئ طلب خدمة جديد</p>
          </div>
        </Card>
      )}
    </div>
  );
}
