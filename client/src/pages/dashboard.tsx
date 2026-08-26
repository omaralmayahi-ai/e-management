import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Link } from "wouter";
import {
  Mail,
  CalendarDays,
  ArrowUpLeft,
  ArrowDownRight,
  Send,
  Inbox,
  MailOpen,
  RotateCw,
  Archive,
  User,
  Clock,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  PenTool,
  Bell,
  PlusCircle,
  Activity,
  Building2,
  FileSignature,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import type { Correspondence, LeaveRequest } from "@shared/schema";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";

function StatCard({ icon: Icon, title, value, subtitle, color, testId, accent }: {
  icon: any; title: string; value: string | number; subtitle: string; color: string; testId: string; accent?: string;
}) {
  return (
    <Card className={`p-5 hover-elevate transition-all duration-200 relative overflow-hidden ${accent || ""}`} data-testid={testId}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground mb-1 truncate">{title}</p>
          <p className="text-3xl font-bold" data-testid={`${testId}-value`}>{value}</p>
          <p className="text-xs text-muted-foreground mt-1 truncate">{subtitle}</p>
        </div>
        <div className={`w-10 h-10 rounded-md flex items-center justify-center shrink-0 ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </Card>
  );
}

function ActionTile({ icon: Icon, label, value, color, href, testId }: {
  icon: any; label: string; value: number; color: string; href: string; testId: string;
}) {
  return (
    <Link
      href={href}
      className={`block rounded-lg border p-4 hover-elevate transition-all duration-150 cursor-pointer ${value > 0 ? "" : "opacity-70"}`}
      data-testid={testId}
    >
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-md flex items-center justify-center shrink-0 ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold leading-tight">{value}</p>
        </div>
      </div>
    </Link>
  );
}

function RecentItem({ icon: Icon, title, subtitle, status, statusColor, testId }: {
  icon: any; title: string; subtitle: string; status: string; statusColor: string; testId?: string;
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border bg-background hover-elevate transition-all duration-150" data-testid={testId}>
      <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{title}</p>
        <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
      </div>
      <Badge variant="secondary" className={`shrink-0 text-xs ${statusColor}`}>
        {status}
      </Badge>
    </div>
  );
}

const typeLabels: Record<string, string> = {
  internal_outgoing: "صادر داخلي",
  external_outgoing: "صادر خارجي",
  internal_incoming: "وارد داخلي",
  external_incoming: "وارد خارجي",
};

const statusLabels: Record<string, string> = {
  draft: "مسودة",
  under_review: "قيد المراجعة",
  pending_approval: "بانتظار الموافقة",
  approved: "تمت الموافقة",
  issued: "صدر",
  in_progress: "قيد التنفيذ",
  completed: "مكتمل",
  archived: "مؤرشف",
  pending: "قيد الانتظار",
  rejected: "مرفوض",
  cancelled: "ملغي",
};

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  under_review: "bg-chart-5/10 text-chart-5",
  pending_approval: "bg-chart-1/10 text-chart-1",
  approved: "bg-chart-4/10 text-chart-4",
  issued: "bg-chart-2/10 text-chart-2",
  in_progress: "bg-chart-1/10 text-chart-1",
  completed: "bg-chart-3/10 text-chart-3",
  archived: "bg-muted text-muted-foreground",
  pending: "bg-chart-5/10 text-chart-5",
  rejected: "bg-destructive/10 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
};

const priorityLabels: Record<string, string> = {
  low: "منخفضة",
  medium: "متوسطة",
  high: "عالية",
  urgent: "عاجلة",
};

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

const ARABIC_MONTHS = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function buildMonthlyTrend(corrs: Correspondence[]) {
  const now = new Date();
  const buckets: { key: string; label: string; outgoing: number; incoming: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({ key: monthKey(d), label: ARABIC_MONTHS[d.getMonth()], outgoing: 0, incoming: 0 });
  }
  const idx = new Map(buckets.map((b, i) => [b.key, i]));
  for (const c of corrs) {
    if (!c.createdAt) continue;
    const k = monthKey(new Date(c.createdAt as any));
    const i = idx.get(k);
    if (i == null) continue;
    if (c.type?.includes("outgoing")) buckets[i].outgoing++;
    else buckets[i].incoming++;
  }
  return buckets;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border rounded-md p-2 shadow-md text-xs" dir="rtl">
      {label && <p className="font-medium mb-1">{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color || p.fill }}>{p.name}: {p.value}</p>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { user: me } = useAuth();
  const isAdmin = me?.role === "admin";
  const isCentralMail = me?.role === "central_mail";
  const showCorrespondence = isAdmin || isCentralMail || me?.canAccessCorrespondence;
  const showLeave = !isCentralMail && (isAdmin || me?.canAccessLeaveRequests);

  const { data: correspondence, isLoading: loadingCorr } = useQuery<Correspondence[]>({
    queryKey: ["/api/correspondence"],
    enabled: showCorrespondence,
  });
  const { data: leaveRequests, isLoading: loadingLeave } = useQuery<LeaveRequest[]>({
    queryKey: ["/api/leave-requests"],
    enabled: showLeave,
  });
  const { data: authorizedReceivers } = useQuery<any[]>({
    queryKey: ["/api/employees/authorized-receivers"],
    enabled: isCentralMail,
  });

  const isLoading = (showCorrespondence && loadingCorr) || (showLeave && loadingLeave);

  const corrs = correspondence || [];

  const stats = useMemo(() => {
    const internal_outgoing = corrs.filter(c => c.type === "internal_outgoing").length;
    const external_outgoing = corrs.filter(c => c.type === "external_outgoing").length;
    const internal_incoming = corrs.filter(c => c.type === "internal_incoming").length;
    const external_incoming = corrs.filter(c => c.type === "external_incoming").length;

    const byStatus: Record<string, number> = {};
    const byPriority: Record<string, number> = { low: 0, medium: 0, high: 0, urgent: 0 };
    for (const c of corrs) {
      const s = c.status || "draft";
      byStatus[s] = (byStatus[s] || 0) + 1;
      const p = (c as any).priority || "medium";
      if (byPriority[p] != null) byPriority[p]++;
    }

    const myDeptId = me?.departmentId;
    const finalStatuses = new Set(["archived", "completed", "cancelled", "issued"]);

    const pendingSignature = corrs.filter(c =>
      c.currentDepartmentId === myDeptId && !finalStatuses.has(c.status as any)
    ).length;

    const actedByMeInFlight = corrs.filter((c: any) =>
      c._actedByMe && c.currentDepartmentId !== myDeptId && !finalStatuses.has(c.status as any)
    ).length;

    const overdue = corrs.filter((c: any) => {
      if (finalStatuses.has(c.status)) return false;
      if (!c.reminderDate) return false;
      return new Date(c.reminderDate) < new Date();
    }).length;

    const followUps = corrs.filter((c: any) => c.isFollowUp || (c.assignments || []).some((a: any) => a.isFollowUp)).length;

    return {
      internal_outgoing, external_outgoing, internal_incoming, external_incoming,
      byStatus, byPriority, pendingSignature, actedByMeInFlight, overdue, followUps,
    };
  }, [corrs, me?.departmentId]);

  const pendingLeaves = leaveRequests?.filter(l => l.status === "pending").length || 0;
  const myLeaves = leaveRequests?.filter(l => (l as any).employeeId === me?.id).length || 0;

  const centralMailItems = isCentralMail ? corrs.filter(c => c.type === "external_incoming" && c.centralMailAssignedById === me?.id) : [];
  const cmTotalEntered = centralMailItems.length;
  const cmAssigned = centralMailItems.filter(c => c.assignedToId && c.status !== "archived").length;
  const cmReturned = centralMailItems.filter(c => !c.assignedToId && c.status !== "archived").length;
  const cmArchived = centralMailItems.filter(c => c.status === "archived").length;

  const monthlyTrend = useMemo(() => buildMonthlyTrend(corrs), [corrs]);
  const cmTrend = useMemo(() => buildMonthlyTrend(centralMailItems), [centralMailItems]);

  const statusChartData = useMemo(() =>
    Object.entries(stats.byStatus)
      .map(([k, v]) => ({ name: statusLabels[k] || k, value: v, key: k }))
      .filter(d => d.value > 0)
      .sort((a, b) => b.value - a.value),
  [stats.byStatus]);

  const typeChartData = [
    { name: typeLabels.internal_outgoing, value: stats.internal_outgoing, fill: CHART_COLORS[0] },
    { name: typeLabels.external_outgoing, value: stats.external_outgoing, fill: CHART_COLORS[1] },
    { name: typeLabels.internal_incoming, value: stats.internal_incoming, fill: CHART_COLORS[2] },
    { name: typeLabels.external_incoming, value: stats.external_incoming, fill: CHART_COLORS[3] },
  ];

  const priorityChartData = (["urgent", "high", "medium", "low"] as const).map((k, i) => ({
    name: priorityLabels[k],
    value: stats.byPriority[k] || 0,
    fill: CHART_COLORS[i],
  }));

  const today = new Date();
  const todayLabel = today.toLocaleDateString("ar-EG", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6" dir="rtl">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 rounded-lg" />)}
        </div>
        <div className="grid lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-72 rounded-lg" />)}
        </div>
      </div>
    );
  }

  if (isCentralMail) {
    const assigneeBreakdown = (authorizedReceivers || []).map(recv => {
      const count = centralMailItems.filter(c => c.assignedToId === recv.id).length;
      return { ...recv, count };
    }).filter(r => r.count > 0).sort((a, b) => b.count - a.count);

    const cmStatusData = [
      { name: "مُسندة", value: cmAssigned, fill: CHART_COLORS[2] },
      { name: "مُعادة", value: cmReturned, fill: CHART_COLORS[4] },
      { name: "مؤرشفة", value: cmArchived, fill: "hsl(var(--muted-foreground))" },
    ].filter(d => d.value > 0);

    return (
      <div className="p-6 space-y-6" dir="rtl">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-dashboard-title">
              {me?.fullName ? `مرحباً، ${me.fullName}` : "لوحة التحكم"}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              البريد المركزي — {todayLabel}
            </p>
          </div>
          <Link href="/correspondence">
            <Button size="sm" data-testid="button-quick-create-cm">
              <PlusCircle className="w-4 h-4 ml-2" /> إدخال وارد خارجي
            </Button>
          </Link>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={MailOpen} title="إجمالي المراسلات المُدخلة" value={cmTotalEntered} subtitle="وارد خارجي مُدخل" color="bg-chart-1/10 text-chart-1" testId="stat-cm-total" />
          <StatCard icon={Send} title="المُسندة" value={cmAssigned} subtitle="مسندة ونشطة" color="bg-chart-3/10 text-chart-3" testId="stat-cm-assigned" />
          <StatCard icon={RotateCw} title="المُعادة" value={cmReturned} subtitle="بانتظار إعادة إسناد" color="bg-amber-100/80 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" testId="stat-cm-returned" />
          <StatCard icon={Archive} title="المؤرشفة" value={cmArchived} subtitle="تم أرشفتها" color="bg-muted text-muted-foreground" testId="stat-cm-archived" />
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          {cmStatusData.length > 0 && (
            <Card className="p-5" data-testid="chart-cm-status">
              <h2 className="font-semibold flex items-center gap-2 mb-4">
                <Activity className="w-4 h-4 text-primary" /> توزيع المراسلات حسب الحالة
              </h2>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={cmStatusData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                    {cmStatusData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </Card>
          )}

          <Card className="p-5" data-testid="chart-cm-trend">
            <h2 className="font-semibold flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-primary" /> اتجاه الإدخال (آخر 6 أشهر)
            </h2>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={cmTrend}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="label" reversed tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="incoming" name="وارد خارجي" stroke={CHART_COLORS[0]} strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {assigneeBreakdown.length > 0 && (
          <Card className="p-5">
            <h2 className="font-semibold flex items-center gap-2 mb-4">
              <User className="w-4 h-4 text-primary" /> توزيع المراسلات حسب المخوّل
            </h2>
            <div className="space-y-2">
              {assigneeBreakdown.map(recv => {
                const pct = cmTotalEntered > 0 ? Math.round((recv.count / cmTotalEntered) * 100) : 0;
                return (
                  <div key={recv.id} className="space-y-1" data-testid={`stat-assignee-${recv.id}`}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium truncate">{recv.fullName}</span>
                      <span className="text-muted-foreground text-xs">{recv.count} ({pct}%)</span>
                    </div>
                    <Progress value={pct} className="h-2" />
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        <Card className="p-5">
          <div className="flex items-center justify-between gap-1 mb-4">
            <h2 className="font-semibold flex items-center gap-2">
              <Mail className="w-4 h-4 text-primary" /> آخر المراسلات المُدخلة
            </h2>
            <Badge variant="secondary" className="text-xs">{cmTotalEntered}</Badge>
          </div>
          <div className="space-y-2">
            {centralMailItems.slice(0, 5).map(c => (
              <RecentItem
                key={c.id}
                icon={ArrowDownRight}
                title={c.subject}
                subtitle={`${c.referenceNumber || ""} - ${c.externalEntity || "وارد خارجي"}`}
                status={!c.assignedToId && c.status !== "archived" ? "مُعادة" : c.status === "archived" ? "مؤرشفة" : "مُسندة"}
                statusColor={!c.assignedToId && c.status !== "archived" ? "bg-amber-100 text-amber-800" : c.status === "archived" ? statusColors.archived : "bg-green-100 text-green-800"}
                testId={`recent-cm-${c.id}`}
              />
            ))}
            {centralMailItems.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <MailOpen className="w-8 h-8 mx-auto mb-2 opacity-40" /> لا توجد مراسلات واردة خارجية بعد
              </div>
            )}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-dashboard-title">
            {me?.fullName ? `مرحباً، ${me.fullName}` : "لوحة التحكم"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {me?.department?.name ? `${me.department.name} — ` : ""}{todayLabel}
          </p>
        </div>
      </div>

      {showCorrespondence && (
        <Card className="p-5" data-testid="card-action-items">
          <h2 className="font-semibold flex items-center gap-2 mb-4">
            <FileSignature className="w-4 h-4 text-primary" /> ما يحتاج اهتمامك
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <ActionTile icon={PenTool} label="بانتظار التوقيع" value={stats.pendingSignature} color="bg-chart-1/10 text-chart-1" href="/correspondence?tab=pending_signature" testId="action-pending-signature" />
            <ActionTile icon={CheckCircle2} label="منجزة من قسمي" value={stats.actedByMeInFlight} color="bg-chart-3/10 text-chart-3" href="/correspondence?tab=completed_by_me" testId="action-acted-by-me" />
            <ActionTile icon={AlertTriangle} label="متجاوزة الموعد" value={stats.overdue} color="bg-destructive/10 text-destructive" href="/correspondence?tab=inbox" testId="action-overdue" />
            <ActionTile icon={Clock} label="متابعات" value={stats.followUps} color="bg-chart-5/10 text-chart-5" href="/correspondence?tab=followup" testId="action-followups" />
          </div>
        </Card>
      )}

      {showCorrespondence && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Send} title="صادر داخلي" value={stats.internal_outgoing} subtitle="معاملة صادرة داخلية" color="bg-chart-1/10 text-chart-1" testId="stat-internal-outgoing" />
          <StatCard icon={ArrowUpLeft} title="صادر خارجي" value={stats.external_outgoing} subtitle="معاملة صادرة خارجية" color="bg-chart-2/10 text-chart-2" testId="stat-external-outgoing" />
          <StatCard icon={Inbox} title="وارد داخلي" value={stats.internal_incoming} subtitle="معاملة واردة داخلية" color="bg-chart-3/10 text-chart-3" testId="stat-internal-incoming" />
          <StatCard icon={ArrowDownRight} title="وارد خارجي" value={stats.external_incoming} subtitle="معاملة واردة خارجية" color="bg-chart-4/10 text-chart-4" testId="stat-external-incoming" />
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        {showLeave && (
          <StatCard icon={CalendarDays} title="طلبات الإجازة" value={isAdmin ? pendingLeaves : myLeaves} subtitle={isAdmin ? "طلب قيد الانتظار" : "إجمالي طلباتي"} color="bg-chart-5/10 text-chart-5" testId="stat-leaves" />
        )}
      </div>

      {showCorrespondence && corrs.length > 0 && (
        <div className="grid lg:grid-cols-3 gap-4">
          <Card className="p-5" data-testid="chart-by-type">
            <h2 className="font-semibold flex items-center gap-2 mb-4">
              <Activity className="w-4 h-4 text-primary" /> توزيع المراسلات حسب النوع
            </h2>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={typeChartData} margin={{ right: 8, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }} />
                <Bar dataKey="value" name="عدد" radius={[6, 6, 0, 0]}>
                  {typeChartData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {statusChartData.length > 0 && (
            <Card className="p-5" data-testid="chart-by-status">
              <h2 className="font-semibold flex items-center gap-2 mb-4">
                <Activity className="w-4 h-4 text-primary" /> توزيع حسب الحالة
              </h2>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={statusChartData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                    {statusChartData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </Card>
          )}

          <Card className="p-5" data-testid="chart-trend">
            <h2 className="font-semibold flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-primary" /> اتجاه آخر 6 أشهر
            </h2>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="label" reversed tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="outgoing" name="صادر" stroke={CHART_COLORS[0]} strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="incoming" name="وارد" stroke={CHART_COLORS[2]} strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}

      {showCorrespondence && (stats.byPriority.urgent + stats.byPriority.high + stats.byPriority.medium + stats.byPriority.low) > 0 && (
        <Card className="p-5" data-testid="card-priority">
          <h2 className="font-semibold flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-primary" /> الأولويات
          </h2>
          <div className="grid sm:grid-cols-4 gap-3">
            {(["urgent", "high", "medium", "low"] as const).map((p, i) => {
              const total = corrs.length;
              const v = stats.byPriority[p] || 0;
              const pct = total > 0 ? Math.round((v / total) * 100) : 0;
              return (
                <div key={p} className="p-3 rounded-lg border bg-background" data-testid={`priority-${p}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">{priorityLabels[p]}</span>
                    <Badge variant="secondary" className="text-xs" style={{ backgroundColor: `${CHART_COLORS[i]}20`, color: CHART_COLORS[i] }}>
                      {v}
                    </Badge>
                  </div>
                  <Progress value={pct} className="h-2" />
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {isAdmin && (
        <AdminOrgSection corrs={corrs} />
      )}

      {showCorrespondence && (
        <Card className="p-5">
          <div className="flex items-center justify-between gap-1 mb-4">
            <h2 className="font-semibold flex items-center gap-2">
              <Mail className="w-4 h-4 text-primary" /> آخر المراسلات
            </h2>
            <Badge variant="secondary" className="text-xs">{corrs.length}</Badge>
          </div>
          <div className="space-y-2">
            {corrs.slice(0, 5).map(c => (
              <RecentItem
                key={c.id}
                icon={c.type?.includes("incoming") ? ArrowDownRight : ArrowUpLeft}
                title={c.subject}
                subtitle={`${c.referenceNumber || ""} - ${typeLabels[c.type] || c.type}`}
                status={statusLabels[c.status || "draft"]}
                statusColor={statusColors[c.status || "draft"]}
                testId={`recent-corr-${c.id}`}
              />
            ))}
            {corrs.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <Mail className="w-8 h-8 mx-auto mb-2 opacity-40" /> لا توجد مراسلات بعد
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

function AdminOrgSection({ corrs }: { corrs: Correspondence[] }) {
  const { data: departments } = useQuery<any[]>({ queryKey: ["/api/departments"] });

  const topDepts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const c of corrs) {
      if (c.senderDepartmentId) counts.set(c.senderDepartmentId, (counts.get(c.senderDepartmentId) || 0) + 1);
    }
    const list = Array.from(counts.entries())
      .map(([id, count]) => {
        const d = (departments || []).find((x: any) => x.id === id);
        return { id, name: d?.name || `قسم #${id}`, count };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
    return list;
  }, [corrs, departments]);

  if (topDepts.length === 0) return null;
  const max = topDepts[0]?.count || 1;

  return (
    <Card className="p-5" data-testid="card-top-departments">
      <h2 className="font-semibold flex items-center gap-2 mb-4">
        <Building2 className="w-4 h-4 text-primary" /> الأقسام الأكثر نشاطاً (كمُرسِل)
      </h2>
      <div className="space-y-2">
        {topDepts.map((d, i) => (
          <div key={d.id} className="space-y-1" data-testid={`top-dept-${d.id}`}>
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium truncate">{d.name}</span>
              <span className="text-muted-foreground text-xs">{d.count} مراسلة</span>
            </div>
            <Progress value={(d.count / max) * 100} className="h-2" />
          </div>
        ))}
      </div>
    </Card>
  );
}
