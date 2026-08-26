import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import type { Department } from "@shared/schema";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Loader2,
  GitBranch,
  Trash2,
  Users,
  ChevronDown,
  ChevronUp,
  ArrowDown,
  ArrowLeft,
  Power,
  Pencil,
  Building2,
  FileText,
  CalendarDays,
  Briefcase,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

const correspondenceTypeLabels: Record<string, string> = {
  internal_outgoing: "صادر داخلي",
  external_outgoing: "صادر خارجي",
  internal_incoming: "وارد داخلي",
  external_incoming: "وارد خارجي",
};

const levelLabels: Record<string, string> = {
  general_manager: "مدير عام",
  assistant: "معاون",
  directorate: "هيئة",
  section: "قسم",
  division: "شعبة",
  unit: "وحدة",
};

const allLevels = ["general_manager", "assistant", "directorate", "section", "division", "unit"];

export default function FlowTemplatesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [expandedTemplate, setExpandedTemplate] = useState<number | null>(null);
  const [showGroupDialog, setShowGroupDialog] = useState<{ templateId: number; editGroup?: any } | null>(null);
  const [deleteTemplateId, setDeleteTemplateId] = useState<number | null>(null);
  const [deleteGroupId, setDeleteGroupId] = useState<number | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterTemplate, setFilterTemplate] = useState<string>("all");
  const [editTemplate, setEditTemplate] = useState<any>(null);

  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("");
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);

  const { data: templates, isLoading } = useQuery<any[]>({
    queryKey: ["/api/flow-templates"],
  });

  const { data: allDepartments } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; correspondenceType: string; levels: string[] }) => {
      const res = await apiRequest("POST", "/api/flow-templates", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/flow-templates"] });
      setShowCreateDialog(false);
      setNewName("");
      setNewType("");
      setSelectedLevels([]);
      toast({ title: "تم", description: "تم إنشاء مسار التدفق بنجاح" });
    },
    onError: (err: any) => {
      toast({ title: "خطأ", description: err.message || "حدث خطأ", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/flow-templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/flow-templates"] });
      setDeleteTemplateId(null);
      toast({ title: "تم", description: "تم حذف مسار التدفق" });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const res = await apiRequest("PATCH", `/api/flow-templates/${id}`, { isActive });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/flow-templates"] });
    },
  });

  const editTemplateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: { name: string; correspondenceType: string; levels: string[] } }) => {
      const res = await apiRequest("PATCH", `/api/flow-templates/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/flow-templates"] });
      setEditTemplate(null);
      toast({ title: "تم", description: "تم تعديل مسار التدفق بنجاح" });
    },
    onError: (err: any) => {
      toast({ title: "خطأ", description: err.message || "حدث خطأ", variant: "destructive" });
    },
  });

  const saveGroupMutation = useMutation({
    mutationFn: async ({ templateId, accounts, groupId }: { templateId: number; accounts: number[]; groupId?: number }) => {
      if (groupId) {
        const res = await apiRequest("PATCH", `/api/flow-template-groups/${groupId}`, { accounts });
        return res.json();
      }
      const res = await apiRequest("POST", `/api/flow-templates/${templateId}/groups`, { accounts });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/flow-templates"] });
      setShowGroupDialog(null);
      toast({ title: "تم", description: "تم حفظ مجموعة التشكيلات" });
    },
    onError: (err: any) => {
      toast({ title: "خطأ", description: err.message || "حدث خطأ", variant: "destructive" });
    },
  });

  const deleteGroupMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/flow-template-groups/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/flow-templates"] });
      setDeleteGroupId(null);
      toast({ title: "تم", description: "تم حذف المجموعة" });
    },
  });

  const toggleLevel = (level: string) => {
    setSelectedLevels(prev =>
      prev.includes(level) ? prev.filter(l => l !== level) : [...prev, level]
    );
  };

  const moveLevel = (index: number, direction: "up" | "down") => {
    const newLevels = [...selectedLevels];
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= newLevels.length) return;
    [newLevels[index], newLevels[swapIndex]] = [newLevels[swapIndex], newLevels[index]];
    setSelectedLevels(newLevels);
  };

  const getTopLevelDeptName = (group: any, levels: string[]) => {
    if (!group.accountDetails?.length || !levels?.length) return null;
    const topDept = group.accountDetails[group.accountDetails.length - 1];
    return topDept?.name || null;
  };

  const groupsByTopDept = (groups: any[], levels: string[]) => {
    const map: Record<string, any[]> = {};
    for (const g of groups) {
      const topName = getTopLevelDeptName(g, levels) || "غير محدد";
      if (!map[topName]) map[topName] = [];
      map[topName].push(g);
    }
    return map;
  };

  const filteredTemplates = useMemo(() => {
    if (!templates) return [];
    let result = templates;
    if (filterType !== "all") {
      result = result.filter((t: any) => t.correspondenceType === filterType);
    }
    if (filterTemplate !== "all") {
      result = result.filter((t: any) => t.id.toString() === filterTemplate);
    }
    return result;
  }, [templates, filterType, filterTemplate]);

  if (!user || user.role !== "admin") {
    return (
      <div className="p-6 text-center text-muted-foreground" dir="rtl" data-testid="text-no-access">
        هذه الصفحة متاحة لمدير النظام فقط
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
          <GitBranch className="w-6 h-6 text-primary" />
          مسارات التدفق
        </h1>
        <p className="text-muted-foreground text-sm mt-1">إدارة مسارات التدفق لجميع أقسام النظام</p>
      </div>

      <Tabs defaultValue="correspondence" dir="rtl">
        <TabsList className="w-full justify-start gap-1 flex-wrap" data-testid="tabs-flow-categories">
          <TabsTrigger value="correspondence" className="gap-1.5" data-testid="tab-correspondence">
            <FileText className="w-4 h-4" />
            مسارات تدفق المراسلات
          </TabsTrigger>
          <TabsTrigger value="leave-requests" className="gap-1.5" data-testid="tab-leave-requests">
            <CalendarDays className="w-4 h-4" />
            مسارات تدفق الإجازات والطلبات
          </TabsTrigger>
          <TabsTrigger value="service-requests" className="gap-1.5" data-testid="tab-service-requests">
            <Briefcase className="w-4 h-4" />
            مسارات تدفق طلبات العمل
          </TabsTrigger>
        </TabsList>

        <TabsContent value="correspondence" className="space-y-4 mt-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3 flex-wrap">
              <p className="text-sm text-muted-foreground">إدارة مسارات التدفق ومجموعات التشكيلات لكل نوع مراسلة</p>
              <Select value={filterType} onValueChange={(v) => { setFilterType(v); setFilterTemplate("all"); }}>
                <SelectTrigger className="w-[160px] h-8 text-xs" data-testid="select-filter-type">
                  <SelectValue placeholder="جميع الأنواع" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الأنواع</SelectItem>
                  <SelectItem value="internal_outgoing">صادر داخلي</SelectItem>
                  <SelectItem value="external_outgoing">صادر خارجي</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterTemplate} onValueChange={setFilterTemplate}>
                <SelectTrigger className="w-[250px] h-8 text-xs" data-testid="select-filter-template">
                  <SelectValue placeholder="جميع المسارات" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع المسارات</SelectItem>
                  {(templates || [])
                    .filter((t: any) => filterType === "all" || t.correspondenceType === filterType)
                    .map((t: any) => (
                      <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => setShowCreateDialog(true)} data-testid="button-create-template">
              <Plus className="w-4 h-4 ml-2" />
              إنشاء مسار جديد
            </Button>
          </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : !filteredTemplates?.length ? (
        <Card className="p-12 text-center">
          <GitBranch className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-lg font-semibold" data-testid="text-no-templates">
            {filterType !== "all" ? "لا توجد مسارات تدفق لهذا النوع" : "لا توجد مسارات تدفق"}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">ابدأ بإنشاء مسار تدفق لنوع المراسلة المطلوب</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredTemplates.map((template: any) => {
            const isExpanded = expandedTemplate === template.id;
            const grouped = groupsByTopDept(template.groups || [], template.levels || []);

            return (
              <Card key={template.id} className="overflow-hidden" data-testid={`card-template-${template.id}`}>
                <div
                  className="p-4 flex items-center gap-3 cursor-pointer hover:bg-accent/30 transition-colors"
                  onClick={() => setExpandedTemplate(isExpanded ? null : template.id)}
                  data-testid={`button-expand-template-${template.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{template.name}</h3>
                      <Badge variant="secondary" className="text-xs" data-testid={`badge-type-${template.id}`}>
                        {correspondenceTypeLabels[template.correspondenceType] || template.correspondenceType}
                      </Badge>
                      {!template.isActive && (
                        <Badge variant="destructive" className="text-xs">معطل</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                      <span>المستويات:</span>
                      {template.levels?.map((l: string, i: number) => (
                        <span key={i}>
                          {levelLabels[l] || l}
                          {i < template.levels.length - 1 && <ArrowDown className="w-3 h-3 inline mx-0.5" />}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      <Users className="w-3 h-3 ml-1" />
                      {template.groups?.length || 0} مجموعة
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={(e) => { e.stopPropagation(); setEditTemplate(template); }}
                      data-testid={`button-edit-template-${template.id}`}
                    >
                      <Pencil className="w-4 h-4 text-primary" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleActiveMutation.mutate({ id: template.id, isActive: !template.isActive });
                      }}
                      data-testid={`button-toggle-active-${template.id}`}
                    >
                      <Power className={`w-4 h-4 ${template.isActive ? "text-green-600" : "text-red-500"}`} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                      onClick={(e) => { e.stopPropagation(); setDeleteTemplateId(template.id); }}
                      data-testid={`button-delete-template-${template.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t p-4 space-y-4 bg-muted/20">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-sm">مجموعات التشكيلات</h4>
                      <Button
                        size="sm"
                        onClick={() => setShowGroupDialog({ templateId: template.id })}
                        data-testid={`button-add-group-${template.id}`}
                      >
                        <Plus className="w-3 h-3 ml-1" />
                        إضافة مجموعة
                      </Button>
                    </div>

                    {!template.groups?.length ? (
                      <div className="text-center text-sm text-muted-foreground py-6 border border-dashed rounded-lg" data-testid="text-no-groups">
                        لا توجد مجموعات تشكيلات. أضف مجموعة لتفعيل المسار.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {Object.entries(grouped).map(([topDeptName, groups]) => (
                          <div key={topDeptName}>
                            <div className="flex items-center gap-2 mb-2">
                              <Building2 className="w-4 h-4 text-primary" />
                              <span className="text-sm font-medium text-primary">{topDeptName}</span>
                              <Badge variant="outline" className="text-[10px]">{(groups as any[]).length} مسار</Badge>
                            </div>
                            <div className="space-y-2 mr-4">
                              {(groups as any[]).map((group: any) => (
                                <div key={group.id} className="border rounded-lg p-3 bg-background" data-testid={`card-group-${group.id}`}>
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      {group.accountDetails?.slice().reverse().map((dept: any, i: number) => (
                                        <span key={i} className="flex items-center gap-1 text-xs">
                                          {i > 0 && <ArrowLeft className="w-3 h-3 text-muted-foreground" />}
                                          <Badge variant="outline" className="text-[10px] h-5 px-1.5">{levelLabels[dept.level] || dept.level}</Badge>
                                          <span className="font-medium">{dept.name}</span>
                                        </span>
                                      ))}
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 p-0"
                                        onClick={() => setShowGroupDialog({ templateId: template.id, editGroup: group })}
                                        data-testid={`button-edit-group-${group.id}`}
                                      >
                                        <Pencil className="w-3 h-3" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                                        onClick={() => setDeleteGroupId(group.id)}
                                        data-testid={`button-delete-group-${group.id}`}
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
        </TabsContent>

        <TabsContent value="leave-requests" className="mt-4">
          <Card className="p-12 text-center" data-testid="card-leave-requests-placeholder">
            <CalendarDays className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-semibold" data-testid="text-leave-placeholder-title">مسارات تدفق الإجازات والطلبات</h3>
            <p className="text-sm text-muted-foreground mt-2" data-testid="text-leave-placeholder-message">سيتم إعداد هذه المسارات لاحقاً</p>
          </Card>
        </TabsContent>

        <TabsContent value="service-requests" className="mt-4">
          <Card className="p-12 text-center" data-testid="card-service-requests-placeholder">
            <Briefcase className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-semibold" data-testid="text-service-placeholder-title">مسارات تدفق طلبات العمل</h3>
            <p className="text-sm text-muted-foreground mt-2" data-testid="text-service-placeholder-message">سيتم إعداد هذه المسارات لاحقاً</p>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>إنشاء مسار تدفق جديد</DialogTitle>
            <DialogDescription>حدد اسم المسار ونوع المراسلة وترتيب المستويات</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>اسم المسار</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="مثال: مسار الصادر الداخلي الرئيسي"
                data-testid="input-template-name"
              />
            </div>
            <div className="space-y-2">
              <Label>نوع المراسلة</Label>
              <Select value={newType} onValueChange={setNewType}>
                <SelectTrigger data-testid="select-correspondence-type">
                  <SelectValue placeholder="اختر نوع المراسلة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="internal_outgoing">صادر داخلي</SelectItem>
                  <SelectItem value="external_outgoing">صادر خارجي</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>المستويات (اختر وحدد الترتيب)</Label>
              <div className="grid grid-cols-3 gap-2">
                {allLevels.map(level => (
                  <Button
                    key={level}
                    type="button"
                    variant={selectedLevels.includes(level) ? "default" : "outline"}
                    size="sm"
                    className="text-xs"
                    onClick={() => toggleLevel(level)}
                    data-testid={`button-level-${level}`}
                  >
                    {levelLabels[level]}
                  </Button>
                ))}
              </div>
              {selectedLevels.length > 0 && (
                <div className="mt-3 space-y-1 border rounded-lg p-2">
                  <Label className="text-xs text-muted-foreground">ترتيب المستويات (من الأدنى للأعلى):</Label>
                  {selectedLevels.map((level, index) => (
                    <div key={level} className="flex items-center gap-2 p-1.5 rounded bg-muted/50">
                      <span className="text-xs font-mono text-muted-foreground w-5">{index + 1}</span>
                      <span className="text-sm flex-1">{levelLabels[level]}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        disabled={index === 0}
                        onClick={() => moveLevel(index, "up")}
                      >
                        <ChevronUp className="w-3 h-3" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        disabled={index === selectedLevels.length - 1}
                        onClick={() => moveLevel(index, "down")}
                      >
                        <ChevronDown className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <Button
              className="w-full"
              disabled={!newName || !newType || selectedLevels.length === 0 || createMutation.isPending}
              onClick={() => createMutation.mutate({ name: newName, correspondenceType: newType, levels: selectedLevels })}
              data-testid="button-submit-template"
            >
              {createMutation.isPending && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
              إنشاء المسار
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {editTemplate && (
        <EditTemplateDialog
          template={editTemplate}
          onClose={() => setEditTemplate(null)}
          onSubmit={(data) => editTemplateMutation.mutate({ id: editTemplate.id, data })}
          isPending={editTemplateMutation.isPending}
        />
      )}

      {showGroupDialog !== null && (
        <GroupDialog
          templateId={showGroupDialog.templateId}
          template={templates?.find((t: any) => t.id === showGroupDialog.templateId)}
          editGroup={showGroupDialog.editGroup}
          departments={allDepartments || []}
          onClose={() => setShowGroupDialog(null)}
          onSubmit={(deptIds, groupId) => saveGroupMutation.mutate({ templateId: showGroupDialog.templateId, accounts: deptIds, groupId })}
          isPending={saveGroupMutation.isPending}
        />
      )}

      <AlertDialog open={deleteTemplateId !== null} onOpenChange={() => setDeleteTemplateId(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف مسار التدفق</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف المسار وجميع مجموعات التشكيلات المرتبطة به. هل أنت متأكد؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTemplateId && deleteMutation.mutate(deleteTemplateId)}
              data-testid="button-confirm-delete-template"
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteGroupId !== null} onOpenChange={() => setDeleteGroupId(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف مجموعة التشكيلات</AlertDialogTitle>
            <AlertDialogDescription>هل أنت متأكد من حذف هذه المجموعة؟</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteGroupId && deleteGroupMutation.mutate(deleteGroupId)}
              data-testid="button-confirm-delete-group"
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function GroupDialog({ templateId, template, editGroup, departments, onClose, onSubmit, isPending }: {
  templateId: number;
  template: any;
  editGroup?: any;
  departments: Department[];
  onClose: () => void;
  onSubmit: (deptIds: number[], groupId?: number) => void;
  isPending: boolean;
}) {
  const levels: string[] = template?.levels || [];
  const reversedLevels = useMemo(() => {
    const sorted = [...levels].sort((a, b) => allLevels.indexOf(a) - allLevels.indexOf(b));
    return sorted;
  }, [levels]);

  const [selectedDepts, setSelectedDepts] = useState<(number | null)[]>(() => {
    if (editGroup?.accountDetails) {
      const deptMap = new Map(editGroup.accountDetails.map((d: any) => [d.level, d.id]));
      const sortedLevels = [...levels].sort((a, b) => allLevels.indexOf(a) - allLevels.indexOf(b));
      return sortedLevels.map(level => deptMap.get(level) || null);
    }
    if (editGroup?.accounts) {
      const reversed = [...editGroup.accounts].reverse();
      return reversed;
    }
    return reversedLevels.map(() => null);
  });

  const activeDepartments = departments.filter(d => d.isActive);

  const getDeptsForReversedIndex = (reversedIndex: number): Department[] => {
    const level = reversedLevels[reversedIndex];
    const deptsOfLevel = activeDepartments.filter(d => d.level === level);

    if (reversedIndex === 0) return deptsOfLevel;

    const parentDeptId = selectedDepts[reversedIndex - 1];
    if (!parentDeptId) return [];

    return deptsOfLevel.filter(d => d.parentId === parentDeptId);
  };

  const handleDeptChange = (reversedIndex: number, deptId: number | null) => {
    const newDepts = [...selectedDepts];
    newDepts[reversedIndex] = deptId;

    for (let i = reversedIndex + 1; i < reversedLevels.length; i++) {
      newDepts[i] = null;
    }

    setSelectedDepts(newDepts);
  };

  const handleSubmit = () => {
    const allSelected = selectedDepts.every(d => d !== null);
    if (!allSelected) return;
    const deptIds = [...selectedDepts].filter((d): d is number => d !== null).reverse();
    onSubmit(deptIds, editGroup?.id);
  };

  const isEditing = !!editGroup;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>{isEditing ? "تعديل مجموعة تشكيلات" : "إضافة مجموعة تشكيلات"}</DialogTitle>
          <DialogDescription>
            اختر التشكيل لكل مستوى. التشكيلات تُفلتر حسب الأبناء المباشرين.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {reversedLevels.map((level, reversedIndex) => {
            const availableDepts = getDeptsForReversedIndex(reversedIndex);
            const isDisabled = reversedIndex > 0 && !selectedDepts[reversedIndex - 1];
            const selectedDept = departments.find(d => d.id === selectedDepts[reversedIndex]);

            return (
              <div key={reversedIndex} className="rounded-lg border p-3 space-y-1.5">
                <div className="flex items-center gap-2">
                  <Badge className="text-[10px] h-5 px-1.5">{levelLabels[level] || level}</Badge>
                  {reversedIndex > 0 && (
                    <span className="text-[10px] text-muted-foreground">
                      (تابع لـ {departments.find(d => d.id === selectedDepts[reversedIndex - 1])?.name || "..."})
                    </span>
                  )}
                </div>
                <Select
                  value={selectedDepts[reversedIndex]?.toString() || ""}
                  onValueChange={(val) => handleDeptChange(reversedIndex, parseInt(val))}
                  disabled={isDisabled}
                >
                  <SelectTrigger className="h-9 text-xs" data-testid={`select-dept-level-${reversedIndex}`}>
                    <SelectValue placeholder={isDisabled ? "اختر المستوى الأعلى أولاً" : `اختر ${levelLabels[level]}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableDepts.map(dept => (
                      <SelectItem key={dept.id} value={dept.id.toString()}>
                        {dept.name}
                      </SelectItem>
                    ))}
                    {availableDepts.length === 0 && !isDisabled && (
                      <div className="p-2 text-xs text-muted-foreground text-center">
                        لا توجد تشكيلات في هذا المستوى
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>
            );
          })}

          <Button
            className="w-full"
            disabled={selectedDepts.some(d => d === null) || isPending}
            onClick={handleSubmit}
            data-testid="button-submit-group"
          >
            {isPending && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
            {isEditing ? "حفظ التغييرات" : "إضافة المجموعة"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditTemplateDialog({ template, onClose, onSubmit, isPending }: {
  template: any;
  onClose: () => void;
  onSubmit: (data: { name: string; correspondenceType: string; levels: string[] }) => void;
  isPending: boolean;
}) {
  const [editName, setEditName] = useState(template.name || "");
  const [editType, setEditType] = useState(template.correspondenceType || "");
  const [editLevels, setEditLevels] = useState<string[]>(template.levels || []);

  const toggleLevel = (level: string) => {
    setEditLevels(prev =>
      prev.includes(level) ? prev.filter(l => l !== level) : [...prev, level]
    );
  };

  const moveLevel = (index: number, direction: "up" | "down") => {
    const newLevels = [...editLevels];
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= newLevels.length) return;
    [newLevels[index], newLevels[swapIndex]] = [newLevels[swapIndex], newLevels[index]];
    setEditLevels(newLevels);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>تعديل مسار التدفق</DialogTitle>
          <DialogDescription>تعديل اسم المسار ونوع المراسلة والمستويات</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>اسم المسار</Label>
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              data-testid="input-edit-template-name"
            />
          </div>
          <div className="space-y-2">
            <Label>نوع المراسلة</Label>
            <Select value={editType} onValueChange={setEditType}>
              <SelectTrigger data-testid="select-edit-correspondence-type">
                <SelectValue placeholder="اختر نوع المراسلة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="internal_outgoing">صادر داخلي</SelectItem>
                <SelectItem value="external_outgoing">صادر خارجي</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>المستويات (اختر وحدد الترتيب)</Label>
            <div className="grid grid-cols-3 gap-2">
              {allLevels.map(level => (
                <Button
                  key={level}
                  type="button"
                  variant={editLevels.includes(level) ? "default" : "outline"}
                  size="sm"
                  className="text-xs"
                  onClick={() => toggleLevel(level)}
                  data-testid={`button-edit-level-${level}`}
                >
                  {levelLabels[level]}
                </Button>
              ))}
            </div>
            {editLevels.length > 0 && (
              <div className="mt-3 space-y-1 border rounded-lg p-2">
                <Label className="text-xs text-muted-foreground">ترتيب المستويات (من الأدنى للأعلى):</Label>
                {editLevels.map((level, index) => (
                  <div key={level} className="flex items-center gap-2 p-1.5 rounded bg-muted/50">
                    <span className="text-xs font-mono text-muted-foreground w-5">{index + 1}</span>
                    <span className="text-sm flex-1">{levelLabels[level]}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      disabled={index === 0}
                      onClick={() => moveLevel(index, "up")}
                    >
                      <ChevronUp className="w-3 h-3" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      disabled={index === editLevels.length - 1}
                      onClick={() => moveLevel(index, "down")}
                    >
                      <ChevronDown className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <Button
            className="w-full"
            disabled={!editName || !editType || editLevels.length === 0 || isPending}
            onClick={() => onSubmit({ name: editName, correspondenceType: editType, levels: editLevels })}
            data-testid="button-submit-edit-template"
          >
            {isPending && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
            حفظ التغييرات
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
