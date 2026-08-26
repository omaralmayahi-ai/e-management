import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";
import { Bell, CheckCheck, Clock, Mail, MailOpen, Inbox, CalendarDays, X, Settings, FileText } from "lucide-react";

function NotificationItem({ notif, onMarkRead }: { notif: any; onMarkRead: (id: number) => void }) {
  return (
    <div
      className={`p-4 flex items-start gap-3 transition-colors cursor-pointer hover:bg-muted/50 ${!notif.isRead ? "bg-primary/5" : ""}`}
      onClick={() => {
        if (!notif.isRead) onMarkRead(notif.notificationId);
      }}
      data-testid={`notification-item-${notif.id}`}
    >
      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5">
        {notif.isRead ? (
          <MailOpen className="w-4 h-4 text-muted-foreground" />
        ) : (
          <Mail className="w-4 h-4 text-primary" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm leading-relaxed ${!notif.isRead ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
          {notif.message}
        </p>
        <div className="flex items-center gap-2 mt-2">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            {new Date(notif.sentAt || notif.createdAt).toLocaleDateString("ar-IQ")} {new Date(notif.sentAt || notif.createdAt).toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit" })}
          </div>
          {!notif.isRead && (
            <Badge variant="default" className="text-[10px] px-1.5 py-0">
              جديد
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ message, sub }: { message: string; sub: string }) {
  return (
    <div className="p-12 text-center text-muted-foreground">
      <Inbox className="w-12 h-12 mx-auto mb-3 opacity-20" />
      <p className="text-lg font-medium">{message}</p>
      <p className="text-sm mt-1">{sub}</p>
    </div>
  );
}

function NotificationList({ items, emptyMessage, emptySub, onMarkRead }: {
  items: any[];
  emptyMessage: string;
  emptySub: string;
  onMarkRead: (id: number) => void;
}) {
  const unread = items.filter((n: any) => !n.isRead);
  const read = items.filter((n: any) => n.isRead);
  const [subTab, setSubTab] = useState("unread");

  return (
    <Tabs value={subTab} onValueChange={setSubTab} dir="rtl">
      <TabsList className="grid grid-cols-2 w-full max-w-xs">
        <TabsTrigger value="unread" data-testid="tab-sub-unread" className="gap-1.5">
          غير مقروءة
          {unread.length > 0 && (
            <Badge variant="default" className="text-[10px] px-1.5 py-0 mr-1">{unread.length}</Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="read" data-testid="tab-sub-read" className="gap-1.5">
          مقروءة
          {read.length > 0 && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 mr-1">{read.length}</Badge>
          )}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="unread" className="mt-3">
        <Card className="overflow-hidden" data-testid="card-notifications-unread">
          {unread.length === 0 ? (
            <EmptyState message="لا توجد إشعارات غير مقروءة" sub="جميع الإشعارات تم قراءتها" />
          ) : (
            <div className="max-h-[calc(100vh-420px)] overflow-y-auto divide-y divide-border">
              {unread.map((notif: any) => (
                <NotificationItem key={notif.id} notif={notif} onMarkRead={onMarkRead} />
              ))}
            </div>
          )}
        </Card>
      </TabsContent>

      <TabsContent value="read" className="mt-3">
        <Card className="overflow-hidden" data-testid="card-notifications-read">
          {read.length === 0 ? (
            <EmptyState message="لا توجد إشعارات مقروءة" sub="الإشعارات المقروءة ستظهر هنا" />
          ) : (
            <div className="max-h-[calc(100vh-420px)] overflow-y-auto divide-y divide-border">
              {read.map((notif: any) => (
                <NotificationItem key={notif.id} notif={notif} onMarkRead={onMarkRead} />
              ))}
            </div>
          )}
        </Card>
      </TabsContent>
    </Tabs>
  );
}

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const [initialTab] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab") === "system" ? "system" : "correspondence";
    if (params.get("tab")) {
      window.history.replaceState({}, "", window.location.pathname);
    }
    return tab;
  });
  const [activeTab, setActiveTab] = useState(initialTab);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data: notifications, isLoading } = useQuery<any[]>({
    queryKey: ["/api/notifications"],
  });

  const { data: unreadCount } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
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

  const dateFilteredNotifications = useMemo(() => {
    if (!notifications) return [];
    return notifications.filter((n: any) => {
      const notifDate = new Date(n.sentAt || n.createdAt);
      if (dateFrom) {
        const from = new Date(dateFrom);
        from.setHours(0, 0, 0, 0);
        if (notifDate < from) return false;
      }
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        if (notifDate > to) return false;
      }
      return true;
    });
  }, [notifications, dateFrom, dateTo]);

  const systemNotifs = useMemo(() => {
    return dateFilteredNotifications.filter((n: any) => n.category === "system" || n.sentById !== null);
  }, [dateFilteredNotifications]);

  const correspondenceNotifs = useMemo(() => {
    return dateFilteredNotifications.filter((n: any) => n.category === "correspondence" || (n.category !== "system" && n.sentById === null));
  }, [dateFilteredNotifications]);

  const systemUnreadCount = systemNotifs.filter((n: any) => !n.isRead).length;
  const corrUnreadCount = correspondenceNotifs.filter((n: any) => !n.isRead).length;

  const hasDateFilter = dateFrom || dateTo;

  const handleMarkRead = (notifId: number) => {
    markReadMutation.mutate(notifId);
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4" dir="rtl">
        <Skeleton className="w-64 h-8" />
        <Skeleton className="w-full h-20" />
        <Skeleton className="w-full h-20" />
        <Skeleton className="w-full h-20" />
      </div>
    );
  }

  const unreadNum = unreadCount?.count || 0;

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Bell className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold" data-testid="text-notifications-title">الإشعارات</h1>
            <p className="text-sm text-muted-foreground">
              {unreadNum > 0
                ? `لديك ${unreadNum} إشعار غير مقروء`
                : "لا توجد إشعارات غير مقروءة"}
            </p>
          </div>
        </div>
        {unreadNum > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => markAllReadMutation.mutate()}
            disabled={markAllReadMutation.isPending}
            data-testid="button-mark-all-read"
          >
            <CheckCheck className="w-4 h-4 ml-2" />
            تعيين الكل كمقروء
          </Button>
        )}
      </div>

      <div className="flex items-end gap-3 flex-wrap">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground flex items-center gap-1">
            <CalendarDays className="w-3 h-3" />
            من تاريخ
          </Label>
          <Input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="w-[160px] h-8 text-xs"
            data-testid="input-date-from"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground flex items-center gap-1">
            <CalendarDays className="w-3 h-3" />
            إلى تاريخ
          </Label>
          <Input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="w-[160px] h-8 text-xs"
            data-testid="input-date-to"
          />
        </div>
        {hasDateFilter && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs gap-1"
            onClick={() => { setDateFrom(""); setDateTo(""); }}
            data-testid="button-clear-date-filter"
          >
            <X className="w-3 h-3" />
            مسح الفلتر
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} dir="rtl">
        <TabsList className="grid grid-cols-2 w-full max-w-md">
          <TabsTrigger value="correspondence" data-testid="tab-notif-correspondence" className="gap-1.5">
            <FileText className="w-4 h-4" />
            إشعارات المراسلات
            {corrUnreadCount > 0 && (
              <Badge variant="default" className="text-[10px] px-1.5 py-0 mr-1">{corrUnreadCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="system" data-testid="tab-notif-system" className="gap-1.5">
            <Settings className="w-4 h-4" />
            إشعارات النظام
            {systemUnreadCount > 0 && (
              <Badge variant="default" className="text-[10px] px-1.5 py-0 mr-1">{systemUnreadCount}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="correspondence" className="mt-4">
          {correspondenceNotifs.length === 0 && !hasDateFilter ? (
            <Card className="overflow-hidden">
              <EmptyState
                message="لا توجد إشعارات مراسلات"
                sub="ستظهر إشعارات المراسلات الواردة هنا عند وصولها"
              />
            </Card>
          ) : correspondenceNotifs.length === 0 && hasDateFilter ? (
            <Card className="overflow-hidden">
              <EmptyState
                message="لا توجد إشعارات مراسلات في هذه الفترة"
                sub="جرب تغيير نطاق التاريخ"
              />
            </Card>
          ) : (
            <NotificationList
              items={correspondenceNotifs}
              emptyMessage="لا توجد إشعارات مراسلات"
              emptySub="ستظهر إشعارات المراسلات الواردة هنا عند وصولها"
              onMarkRead={handleMarkRead}
            />
          )}
        </TabsContent>

        <TabsContent value="system" className="mt-4">
          {systemNotifs.length === 0 && !hasDateFilter ? (
            <Card className="overflow-hidden">
              <EmptyState
                message="لا توجد إشعارات نظام"
                sub="ستظهر الإشعارات المرسلة من مدير النظام هنا"
              />
            </Card>
          ) : systemNotifs.length === 0 && hasDateFilter ? (
            <Card className="overflow-hidden">
              <EmptyState
                message="لا توجد إشعارات نظام في هذه الفترة"
                sub="جرب تغيير نطاق التاريخ"
              />
            </Card>
          ) : (
            <NotificationList
              items={systemNotifs}
              emptyMessage="لا توجد إشعارات نظام"
              emptySub="ستظهر الإشعارات المرسلة من مدير النظام هنا"
              onMarkRead={handleMarkRead}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
