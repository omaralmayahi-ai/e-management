import { useState, useRef, useEffect, useMemo } from "react";
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
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { insertCorrespondenceSchema } from "@shared/schema";
import { AttachmentViewer, canPreviewInApp } from "@/components/attachment-viewer";
import type { Correspondence, Department, Employee, WorkflowEvent, ExternalEntity, FlowTemplate } from "@shared/schema";
import RichTextEditor from "@/components/rich-text-editor";
import {
  Mail,
  ArrowDownRight,
  ArrowUpLeft,
  Search,
  Clock,
  Loader2,
  Shield,
  ArrowRight,
  CheckCircle2,
  RotateCcw,
  PenLine,
  Send,
  Inbox,
  FileCheck2,
  ArrowDown,
  MessageSquarePlus,
  ChevronRight,
  X,
  FileEdit,
  Archive,
  Eye,
  ArrowLeft,
  Paperclip,
  Trash2,
  Upload,
  Plus,
  FileText,
  Building2,
  EyeOff,
  Globe,
  Ban,
  Bell,
  Reply,
  ClipboardList,
  Pencil,
  CalendarDays,
  Circle,
  Timer,
  User,
  Users,
  CheckCircle,
  MailOpen,
  RotateCw,
  Filter,
  Printer,
} from "lucide-react";
import { z } from "zod";
import { isUnauthorizedError } from "@/lib/auth-utils";
import DOMPurify from "dompurify";

const formSchema = insertCorrespondenceSchema.extend({
  subject: z.string().min(1, "الموضوع مطلوب"),
  content: z.string().min(1, "المحتوى مطلوب").refine(val => val !== "<p><br></p>" && val.replace(/<[^>]*>/g, "").trim().length > 0, "المحتوى مطلوب"),
  type: z.enum(["internal_outgoing", "external_outgoing", "internal_incoming", "external_incoming"]),
});

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
  cancelled: "ملغاة",
};

const priorityLabels: Record<string, string> = {
  low: "منخفض",
  medium: "متوسط",
  high: "مرتفع",
  urgent: "عاجل",
};

const confidentialityLabels: Record<string, string> = {
  normal: "عادي",
  confidential: "سري",
  top_secret: "سري للغاية",
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
  cancelled: "bg-destructive/10 text-destructive",
};

const priorityColors: Record<string, string> = {
  low: "bg-chart-3/10 text-chart-3",
  medium: "bg-chart-1/10 text-chart-1",
  high: "bg-chart-5/10 text-chart-5",
  urgent: "bg-destructive/10 text-destructive",
};

const confidentialityColors: Record<string, string> = {
  normal: "bg-muted text-muted-foreground",
  confidential: "bg-chart-5/10 text-chart-5",
  top_secret: "bg-destructive/10 text-destructive",
};

const typeColors: Record<string, string> = {
  internal_outgoing: "bg-chart-1/10 text-chart-1",
  external_outgoing: "bg-chart-2/10 text-chart-2",
  internal_incoming: "bg-chart-3/10 text-chart-3",
  external_incoming: "bg-chart-4/10 text-chart-4",
};

const actionLabels: Record<string, string> = {
  create_draft: "إنشاء مسودة",
  sign_and_forward: "توقيع وإحالة",
  return_for_modification: "إعادة للتعديل",
  approve_and_forward: "موافقة وإحالة",
  final_approve_and_issue: "موافقة نهائية وإصدار",
  receive_incoming: "استلام وارد",
  auto_received: "استلام تلقائي",
  route_to_subordinate: "إحالة لجهة تابعة",
  add_margin_note: "إضافة هامش",
  prepare_response: "إعداد إجابة",
  cancel_correspondence: "إلغاء المراسلة",
  admin_delete: "حذف بواسطة المدير",
  elevate: "رفع للمسؤول المباشر",
  assign_down: "إسناد للمستوى الأدنى",
  final_sign: "توقيع نهائي وإطلاق",
  close: "إغلاق المراسلة",
  reopen: "إعادة فتح المراسلة",
  return_to_central_mail: "إعادة للبريد المركزي",
  reply_and_archive: "رد وحفظ",
  submit_contribution: "تقديم مساهمة",
  decline_contribution: "اعتذار عن المساهمة",
  request_modification_from_contributor: "طلب تعديل من مساهم",
};

function buildPrintHtml(opts: {
  detail: any;
  wfEvents: any[];
  attachments: any[];
  departments: Department[];
  employees: Employee[];
  finalSigner: { employee: Employee; event: any } | null;
  orgName: string;
  logoUrl: string;
  senderName: string;
  isReceiverView: boolean;
}): string {
  const { detail, wfEvents, attachments, departments, employees, finalSigner, orgName, logoUrl, senderName, isReceiverView } = opts;
  const esc = (s: any) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
  const fmtDate = (d: any) => d ? new Date(d).toLocaleDateString("ar-IQ", { day: "numeric", month: "long", year: "numeric" }) : "-";
  const fmtDateTime = (d: any) => d ? new Date(d).toLocaleString("ar-IQ", { day: "numeric", month: "numeric", year: "numeric", hour: "numeric", minute: "numeric" }) : "-";
  const sanitizedContent = DOMPurify.sanitize(detail.content || "", SANITIZE_CONFIG);

  const receiverDept = departments.find(d => d.id === detail.receiverDepartmentId);
  const senderDept = departments.find(d => d.id === detail.senderDepartmentId);
  const typeLabel = (() => {
    if (isReceiverView) {
      if (detail.type === "internal_outgoing") return "وارد داخلي";
      if (detail.type === "external_outgoing") return "وارد خارجي";
    }
    return typeLabels[detail.type] || detail.type;
  })();
  const statusLabel = statusLabels[detail.status || "draft"] || detail.status;
  const priorityLabel = priorityLabels[detail.priority || "medium"] || "";
  const confLabel = detail.confidentiality && detail.confidentiality !== "normal" ? (confidentialityLabels[detail.confidentiality] || "") : "";

  const visibleCcs = (detail.ccs || []).filter((c: any) => !c.isHidden);
  const externalCcs = detail.externalCcs || [];

  const metaRow = (label: string, value: string) => value
    ? `<tr><td class="meta-k">${esc(label)}</td><td class="meta-v">${value}</td></tr>` : "";

  const refNumber = detail.referenceNumber || detail.externalRefNumber || "-";
  const refDate = detail.issuedAt || detail.externalDate || detail.createdAt;

  const metaHtml = `
    <table class="meta">
      ${metaRow("الرقم المرجعي", esc(refNumber))}
      ${metaRow("التاريخ", esc(fmtDate(refDate)))}
      ${metaRow("نوع المراسلة", esc(typeLabel))}
      ${metaRow("الموضوع", `<strong>${esc(detail.subject || "-")}</strong>`)}
      ${detail.type === "external_incoming" || detail.type === "external_outgoing"
        ? metaRow("الجهة الخارجية", esc(detail.externalEntity || "-"))
        : ""}
      ${senderDept ? metaRow("الجهة المرسلة", esc(senderName || senderDept.name)) : ""}
      ${receiverDept ? metaRow("الجهة المستلمة", esc(receiverDept.name)) : ""}
      ${metaRow("الأولوية", esc(priorityLabel))}
      ${confLabel ? metaRow("السرية", esc(confLabel)) : ""}
    </table>
  `;

  const contentHtml = sanitizedContent && detail.type !== "external_incoming"
    ? `<section class="block"><h3>المحتوى</h3><div class="content rte-content" dir="rtl">${sanitizedContent}</div></section>`
    : "";

  const signerHtml = finalSigner ? `
    <section class="block signature-block">
      <h3>${isReceiverView ? "توقيع الجهة المرسلة" : "التوقيع الإلكتروني"}</h3>
      <div class="signer">
        ${finalSigner.employee.signatureUrl ? `<img src="${esc(finalSigner.employee.signatureUrl)}" class="sig-img" alt="التوقيع" />` : ""}
        <div class="signer-info">
          <div class="signer-name">${esc(finalSigner.employee.fullName)}</div>
          ${finalSigner.employee.jobTitle ? `<div class="signer-title">${esc(finalSigner.employee.jobTitle)}</div>` : ""}
          <div class="signer-date">${esc(fmtDate(finalSigner.event.createdAt))}</div>
        </div>
      </div>
    </section>` : "";

  const ccsHtml = (visibleCcs.length > 0 || externalCcs.length > 0) ? `
    <section class="block">
      <h3>نسخة إلى</h3>
      <ul class="cc-list">
        ${visibleCcs.map((cc: any) => {
          const dept = departments.find(d => d.id === cc.departmentId);
          return `<li><strong>${esc(dept?.name || `قسم ${cc.departmentId}`)}</strong>${cc.reason ? ` — ${esc(cc.reason)}` : ""}</li>`;
        }).join("")}
        ${externalCcs.map((ecc: any) => `<li><strong>${esc(ecc.entityName || ecc.externalEntity?.name || "جهة خارجية")}</strong>${ecc.reason ? ` — ${esc(ecc.reason)}` : ""}</li>`).join("")}
      </ul>
    </section>` : "";

  const timelineEvents = (wfEvents || []).slice(2);
  const timelineHtml = timelineEvents.length > 0 ? `
    <section class="block">
      <h3>سلسلة الإجراءات</h3>
      <ol class="timeline">
        ${timelineEvents.map((evt: any) => {
          const performer = employees.find(e => e.id === evt.performedById);
          const fromD = departments.find(d => d.id === evt.fromDepartmentId);
          const toD = departments.find(d => d.id === evt.toDepartmentId);
          const lbl = actionLabels[evt.action] || evt.action;
          return `
            <li>
              <div class="tl-head">
                <span class="tl-action">${esc(lbl)}</span>
                <span class="tl-date">${esc(fmtDateTime(evt.createdAt))}</span>
              </div>
              <div class="tl-meta">
                ${performer ? `<span>المنفّذ: <strong>${esc(performer.fullName)}</strong>${performer.jobTitle ? ` (${esc(performer.jobTitle)})` : ""}</span>` : ""}
                ${fromD ? `<span>من: ${esc(fromD.name)}</span>` : ""}
                ${toD ? `<span>إلى: ${esc(toD.name)}</span>` : ""}
              </div>
              ${evt.marginNote ? `<div class="tl-note">${esc(evt.marginNote)}</div>` : ""}
              ${evt.signature !== false && performer?.signatureUrl ? `<img src="${esc(performer.signatureUrl)}" class="tl-sig" alt="توقيع" />` : ""}
            </li>`;
        }).join("")}
      </ol>
    </section>` : "";

  const attachmentsHtml = (attachments && attachments.length > 0) ? attachments.map((att: any, idx: number) => {
    const isImage = (att.mimeType || "").startsWith("image/");
    const isPdf = (att.mimeType || "") === "application/pdf";
    return `
      <section class="attachment-page">
        <div class="att-header">
          <div class="att-title">المرفق ${idx + 1} من ${attachments.length}</div>
          <div class="att-name">${esc(att.originalName || att.fileName || "مرفق")}</div>
          ${att.description ? `<div class="att-desc">${esc(att.description)}</div>` : ""}
        </div>
        ${isImage ? `<img src="/api/attachments/${att.id}/preview" class="att-img" alt="${esc(att.originalName || "")}" />`
          : isPdf ? `<iframe src="/api/attachments/${att.id}/preview" class="att-pdf"></iframe>`
          : `<div class="att-placeholder">
              <div>تعذّر معاينة هذا المرفق ضمن نموذج الطباعة.</div>
              <div class="att-meta">النوع: ${esc(att.mimeType || "غير معروف")} • الحجم: ${Math.round((att.fileSize || 0) / 1024)} كيلوبايت</div>
            </div>`}
      </section>`;
  }).join("") : "";

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <title>طباعة المراسلة — ${esc(detail.subject || "")}</title>
  <style>
    @page { size: A4; margin: 18mm 16mm; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; font-family: "Cairo", "Tahoma", "Arial", sans-serif; color: #111; background: #fff; }
    body { font-size: 12.5pt; line-height: 1.7; direction: rtl; }
    .doc-header { display: flex; align-items: center; gap: 18px; padding-bottom: 14px; border-bottom: 2px solid #1f2937; margin-bottom: 18px; }
    .doc-logo { height: 70px; width: auto; object-fit: contain; }
    .doc-org { flex: 1; text-align: center; }
    .doc-org-name { font-size: 18pt; font-weight: 700; margin: 0; }
    .doc-org-sub { font-size: 11pt; color: #4b5563; margin-top: 4px; }
    .doc-title { text-align: center; margin: 14px 0 18px; font-size: 16pt; font-weight: 700; letter-spacing: 0.5px; }
    .block { margin-bottom: 16px; page-break-inside: avoid; }
    .block h3 { font-size: 12pt; font-weight: 700; margin: 0 0 8px; padding: 6px 10px; background: #f3f4f6; border-right: 4px solid #1f2937; }
    table.meta { width: 100%; border-collapse: collapse; }
    table.meta td { padding: 6px 8px; vertical-align: top; border-bottom: 1px solid #e5e7eb; }
    table.meta td.meta-k { width: 30%; color: #4b5563; font-weight: 600; background: #fafafa; }
    table.meta td.meta-v { color: #111; }
    .content { padding: 8px 4px; min-height: 80px; }
    .content p { margin: 0 0 8px; }
    .content table { border-collapse: collapse; }
    .content table td, .content table th { border: 1px solid #d1d5db; padding: 4px 6px; }
    .signature-block .signer { display: flex; gap: 16px; align-items: center; padding: 8px; }
    .sig-img { max-height: 70px; max-width: 200px; object-fit: contain; border: 1px dashed #9ca3af; padding: 4px; background: #fafafa; }
    .signer-name { font-weight: 700; }
    .signer-title, .signer-date { font-size: 10pt; color: #4b5563; }
    .cc-list { margin: 0; padding: 0 18px; }
    .cc-list li { padding: 3px 0; }
    .timeline { margin: 0; padding: 0 18px; }
    .timeline li { padding: 8px 6px; border-bottom: 1px dashed #d1d5db; page-break-inside: avoid; }
    .timeline li:last-child { border-bottom: 0; }
    .tl-head { display: flex; justify-content: space-between; gap: 12px; font-weight: 600; }
    .tl-action { color: #111; }
    .tl-date { color: #6b7280; font-size: 10pt; }
    .tl-meta { font-size: 10pt; color: #4b5563; margin-top: 3px; display: flex; flex-wrap: wrap; gap: 10px; }
    .tl-note { margin-top: 6px; padding: 6px 10px; background: #fef3c7; border-right: 3px solid #f59e0b; font-size: 11pt; }
    .tl-sig { max-height: 40px; margin-top: 6px; display: block; }
    .attachment-page { page-break-before: always; padding-top: 8px; }
    .att-header { border-bottom: 1px solid #d1d5db; padding-bottom: 8px; margin-bottom: 12px; }
    .att-title { color: #6b7280; font-size: 10pt; }
    .att-name { font-size: 13pt; font-weight: 700; margin-top: 4px; }
    .att-desc { color: #4b5563; font-size: 11pt; margin-top: 4px; }
    .att-img { display: block; max-width: 100%; max-height: 250mm; margin: 0 auto; object-fit: contain; }
    .att-pdf { width: 100%; height: 250mm; border: 1px solid #d1d5db; }
    .att-placeholder { padding: 40px; border: 2px dashed #9ca3af; text-align: center; color: #4b5563; border-radius: 6px; }
    .att-placeholder .att-meta { margin-top: 10px; font-size: 10pt; color: #6b7280; }
    .footer-bar { margin-top: 24px; padding-top: 8px; border-top: 1px solid #e5e7eb; font-size: 9pt; color: #6b7280; text-align: center; }
    @media print {
      .no-print { display: none !important; }
    }
    .toolbar { position: fixed; top: 10px; left: 10px; z-index: 1000; display: flex; gap: 8px; }
    .toolbar button { padding: 8px 14px; font-size: 11pt; font-family: inherit; cursor: pointer; border: 1px solid #1f2937; background: #1f2937; color: #fff; border-radius: 4px; }
    .toolbar button.secondary { background: #fff; color: #1f2937; }
  </style>
</head>
<body>
  <div class="toolbar no-print">
    <button onclick="window.print()">طباعة</button>
    <button class="secondary" onclick="window.close()">إغلاق</button>
  </div>

  <header class="doc-header">
    ${logoUrl ? `<img src="${esc(logoUrl)}" class="doc-logo" alt="شعار" />` : ""}
    <div class="doc-org">
      <div class="doc-org-name">${esc(orgName || "")}</div>
      <div class="doc-org-sub">نظام إدارة المعاملات الإلكتروني</div>
    </div>
    ${logoUrl ? `<div style="width:70px;"></div>` : ""}
  </header>

  <div class="doc-title">${esc(typeLabel)}</div>

  <section class="block">
    <h3>بيانات المراسلة</h3>
    ${metaHtml}
  </section>

  ${contentHtml}

  ${signerHtml}

  ${ccsHtml}

  ${timelineHtml}

  <div class="footer-bar">
    تم إعداد هذه النسخة بتاريخ ${esc(fmtDateTime(new Date()))} عبر نظام إدارة المعاملات الإلكتروني — ${esc(orgName || "")}
  </div>

  ${attachmentsHtml}

  <script>
    (function(){
      var imgs = Array.prototype.slice.call(document.images || []);
      var remaining = imgs.length;
      function done(){ if (--remaining <= 0) { /* user prints manually */ } }
      if (remaining === 0) return;
      imgs.forEach(function(img){ if (img.complete) done(); else { img.addEventListener('load', done); img.addEventListener('error', done); } });
    })();
  </script>
</body>
</html>`;
}

function openPrintWindow(html: string) {
  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) {
    alert("تعذّر فتح نافذة الطباعة. يرجى السماح بالنوافذ المنبثقة لهذا الموقع.");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

const actionIcons: Record<string, any> = {
  create_draft: PenLine,
  sign_and_forward: ArrowRight,
  return_for_modification: RotateCcw,
  approve_and_forward: CheckCircle2,
  final_approve_and_issue: FileCheck2,
  receive_incoming: ArrowDown,
  auto_received: CheckCircle2,
  route_to_subordinate: ArrowDownRight,
  add_margin_note: MessageSquarePlus,
  prepare_response: Send,
  cancel_correspondence: Ban,
  admin_delete: Trash2,
  elevate: ArrowUpLeft,
  assign_down: ArrowDownRight,
  final_sign: FileCheck2,
  close: Archive,
  reopen: RotateCcw,
  return_to_central_mail: RotateCw,
  reply_and_archive: Reply,
};

function WorkflowTimeline({ corrId, departments, employees, isInSenderChain, userDepartmentId, flowGroupAccounts }: {
  corrId: number;
  departments: Department[];
  employees: Employee[];
  isInSenderChain?: boolean;
  userDepartmentId?: number;
  flowGroupAccounts?: number[];
}) {
  const { data: events, isLoading } = useQuery<WorkflowEvent[]>({
    queryKey: ["/api/correspondence", corrId, "workflow"],
    queryFn: async () => {
      const res = await fetch(`/api/correspondence/${corrId}/workflow`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  if (isLoading) return <Skeleton className="h-20" />;
  if (!events || events.length === 0) return <p className="text-sm text-muted-foreground text-center py-4">لا توجد إجراءات بعد</p>;

  const senderActions = ["create_draft", "elevate", "sign_and_forward", "approve_and_forward", "return_for_modification", "final_sign", "final_approve_and_issue", "auto_elevate"];
  const receiverActions = ["receive_incoming", "route_to_subordinate", "add_margin_note", "prepare_response", "close", "reopen", "archive_incoming", "return_to_central_mail", "reply_and_archive"];

  const getDescendantDeptIds = (deptId: number): Set<number> => {
    const ids = new Set<number>([deptId]);
    const queue = [deptId];
    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const d of departments) {
        if (d.parentId === current && !ids.has(d.id)) {
          ids.add(d.id);
          queue.push(d.id);
        }
      }
    }
    return ids;
  };

  const myDeptTree = userDepartmentId ? getDescendantDeptIds(userDepartmentId) : new Set<number>();

  const filteredEvents = events.filter(event => {
    if (isInSenderChain === true) {
      return senderActions.includes(event.action);
    }
    if (isInSenderChain === false) {
      if (!receiverActions.includes(event.action)) return false;
      if (!userDepartmentId) return true;
      const performer = employees.find(e => e.id === event.performedById);
      const performerDeptId = performer?.departmentId;
      const isInMyTree = performerDeptId ? myDeptTree.has(performerDeptId) : false;
      const isFromMyTree = event.fromDepartmentId ? myDeptTree.has(event.fromDepartmentId) : false;
      const isToMyTree = event.toDepartmentId ? myDeptTree.has(event.toDepartmentId) : false;
      return isInMyTree || isFromMyTree || isToMyTree;
    }
    return true;
  });

  if (filteredEvents.length === 0) return <p className="text-sm text-muted-foreground text-center py-4">لا توجد إجراءات بعد</p>;

  return (
    <div className="relative pb-2" dir="rtl">
      <div className="absolute right-[17px] top-3 bottom-3 w-px bg-border" aria-hidden />
      <ol className="space-y-3">
        {filteredEvents.map((event, idx) => {
          const IconComp = actionIcons[event.action] || ArrowRight;
          const performer = employees.find(e => e.id === event.performedById);
          const isCentralMailPerformer = performer?.role === "central_mail";
          const fromDept = departments.find(d => d.id === event.fromDepartmentId);
          const toDept = departments.find(d => d.id === event.toDepartmentId);
          const fromLabel = isCentralMailPerformer ? "البريد المركزي" : fromDept?.name;
          const toLabel = toDept?.name;
          return (
            <li key={event.id} className="relative pr-12" data-testid={`workflow-event-${event.id}`}>
              <div className="absolute right-0 top-0 w-9 h-9 rounded-full bg-primary/10 border-2 border-background ring-1 ring-primary/20 flex items-center justify-center shrink-0 z-10">
                <IconComp className="w-4 h-4 text-primary" />
              </div>
              <div className="rounded-md border border-border bg-card/50 p-3 space-y-1.5 hover-elevate">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold leading-tight" data-testid={`text-workflow-action-${event.id}`}>
                    {actionLabels[event.action] || event.action}
                  </p>
                  <span className="text-[10px] text-muted-foreground shrink-0 bg-muted px-1.5 py-0.5 rounded">
                    الخطوة {idx + 1}
                  </span>
                </div>
                {performer && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <User className="w-3 h-3 shrink-0" />
                    <span>{isCentralMailPerformer ? "البريد المركزي" : performer.fullName}</span>
                  </p>
                )}
                {fromLabel && toLabel && (
                  <div className="flex items-center gap-2 text-xs flex-wrap" data-testid={`text-workflow-route-${event.id}`}>
                    <Badge variant="secondary" className="text-[10px] font-normal max-w-[45%] truncate">
                      {fromLabel}
                    </Badge>
                    <ArrowLeft className="w-3.5 h-3.5 text-muted-foreground shrink-0" aria-label="إلى" />
                    <Badge variant="outline" className="text-[10px] font-normal border-primary/40 text-primary max-w-[45%] truncate">
                      {toLabel}
                    </Badge>
                  </div>
                )}
                {event.marginNote && (
                  <p className="bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 px-2 py-1 rounded border border-amber-200 dark:border-amber-800 text-xs text-right">
                    {event.marginNote}
                  </p>
                )}
                <div className="flex items-center justify-between gap-2 pt-0.5">
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" />
                    {event.createdAt ? new Date(event.createdAt).toLocaleString("ar-SA") : ""}
                  </p>
                  {event.signature !== false && performer?.signatureUrl && (
                    <div className="px-2 py-1 rounded border border-dashed border-primary/40 bg-primary/5 flex flex-col items-center gap-0.5">
                      <img
                        src={performer.signatureUrl}
                        alt={`توقيع ${performer.fullName}`}
                        className="max-h-16 max-w-[160px] object-contain"
                        data-testid={`img-workflow-signature-${event.id}`}
                      />
                      <span className="text-[10px] text-primary/80">التوقيع</span>
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function ReplyComposeForm({ corr, departments, onDone }: {
  corr: Correspondence;
  departments: Department[];
  onDone: () => void;
}) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [replySubject, setReplySubject] = useState(`رد: ${corr.subject}`);
  const [replyContent, setReplyContent] = useState("");
  const [replyReceiver, setReplyReceiver] = useState(
    corr.senderDepartmentId ? corr.senderDepartmentId.toString() : ""
  );
  const [replyPriority, setReplyPriority] = useState(corr.priority || "medium");

  const { data: allFlowTemplates } = useQuery<any[]>({
    queryKey: ["/api/flow-templates"],
    queryFn: async () => {
      const res = await fetch("/api/flow-templates", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const myFlowTemplate = useMemo(() => {
    if (!allFlowTemplates || !user?.departmentId) return null;
    for (const tmpl of allFlowTemplates) {
      if (!tmpl.isActive || tmpl.correspondenceType !== "internal_outgoing") continue;
      for (const grp of (tmpl.groups || [])) {
        if (grp.isActive && grp.accounts?.includes(user.departmentId)) {
          return { templateId: tmpl.id, groupId: grp.id, templateName: tmpl.name };
        }
      }
    }
    return null;
  }, [allFlowTemplates, user]);

  const replyMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `/api/correspondence/${corr.id}/reply`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/correspondence"] });
      toast({ title: "تم إنشاء الرد بنجاح", description: "المراسلة الجديدة في قسم بانتظار التوقيع" });
      onDone();
    },
    onError: (error: Error) => {
      toast({ title: "حدث خطأ", description: error.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-3 rounded-lg border border-chart-1/30 bg-chart-1/5 p-4">
      <h4 className="text-sm font-medium flex items-center gap-2">
        <Reply className="w-4 h-4" />
        إعداد رد على المراسلة
      </h4>
      <div className="space-y-2">
        <Label className="text-xs">الموضوع</Label>
        <Input
          value={replySubject}
          onChange={e => setReplySubject(e.target.value)}
          data-testid="input-reply-subject"
        />
      </div>
      <div className="space-y-2">
        <Label className="text-xs">الجهة المستلمة</Label>
        <Select value={replyReceiver} onValueChange={setReplyReceiver}>
          <SelectTrigger data-testid="select-reply-receiver">
            <SelectValue placeholder="اختر الجهة المستلمة" />
          </SelectTrigger>
          <SelectContent>
            {departments.filter(d => d.isActive).map(d => (
              <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label className="text-xs">الأولوية</Label>
        <Select value={replyPriority} onValueChange={(val: any) => setReplyPriority(val)}>
          <SelectTrigger data-testid="select-reply-priority">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="low">منخفضة</SelectItem>
            <SelectItem value="medium">متوسطة</SelectItem>
            <SelectItem value="high">عالية</SelectItem>
            <SelectItem value="urgent">عاجلة</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label className="text-xs">المحتوى</Label>
        <Textarea
          value={replyContent}
          onChange={e => setReplyContent(e.target.value)}
          placeholder="أدخل محتوى الرد..."
          rows={4}
          data-testid="input-reply-content"
        />
      </div>
      {myFlowTemplate && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="text-xs">{myFlowTemplate.templateName}</Badge>
          <span>سيتم استخدام مسار التدفق الخاص بك</span>
        </div>
      )}
      {!myFlowTemplate && (
        <div className="text-xs text-amber-600 dark:text-amber-400">
          تنبيه: لا يوجد مسار تدفق مرتبط بحسابك. سيتم إنشاء المراسلة كمسودة بدون مسار تدفق.
        </div>
      )}
      <div className="flex gap-2">
        <Button
          className="flex-1"
          disabled={!replySubject || !replyReceiver || !replyContent || replyMutation.isPending}
          onClick={() => {
            replyMutation.mutate({
              subject: replySubject,
              content: `<p>${replyContent.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`,
              receiverDepartmentId: parseInt(replyReceiver),
              senderDepartmentId: user?.departmentId || null,
              priority: replyPriority,
              confidentiality: corr.confidentiality || "normal",
              flowTemplateId: myFlowTemplate?.templateId || null,
              flowTemplateGroupId: myFlowTemplate?.groupId || null,
            });
          }}
          data-testid="button-submit-reply"
        >
          {replyMutation.isPending && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
          إنشاء الرد
        </Button>
        <Button variant="outline" onClick={onDone} data-testid="button-cancel-reply">
          إلغاء
        </Button>
      </div>
    </div>
  );
}

function ContributionAttachmentsList({ attachments }: { attachments: any[] }) {
  if (!attachments || attachments.length === 0) return <p className="text-xs text-muted-foreground mt-1">لا توجد مرفقات</p>;
  return (
    <ul className="space-y-1 mt-1" data-testid="contribution-attachments-list">
      {attachments.map((a: any) => (
        <li key={a.id} className="flex items-center gap-2 text-xs">
          <Paperclip className="w-3 h-3" />
          <a
            href={`/api/attachments/${a.id}/preview`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline text-primary"
            data-testid={`link-contrib-attachment-${a.id}`}
          >{a.originalName}</a>
          {a.description && <span className="text-muted-foreground">— {a.description}</span>}
        </li>
      ))}
    </ul>
  );
}

function ContributorsBlock({ corr, departments }: { corr: any; departments: Department[] }) {
  const contribDeptIds: number[] = (corr.contributingDepartmentIds as number[] | null) || [];

  const { data: parentContributions } = useQuery<any[]>({
    queryKey: ["/api/correspondence", corr.parentCorrespondenceId, "contributions"],
    queryFn: async () => {
      const res = await fetch(`/api/correspondence/${corr.parentCorrespondenceId}/contributions`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!corr.parentCorrespondenceId && contribDeptIds.length > 0,
  });

  if (contribDeptIds.length === 0) return null;

  const batchContribs = (parentContributions || []).filter((c: any) =>
    c.routingBatchId === corr.contributionRoutingBatchId);

  return (
    <div className="rounded-lg border-2 border-blue-200 dark:border-blue-900 bg-blue-50/30 dark:bg-blue-950/10 p-4 space-y-3" data-testid="contributors-block">
      <h4 className="text-sm font-semibold flex items-center gap-2">
        <Users className="w-4 h-4 text-blue-600" />
        أعدّ هذا الرد بمشاركة التشكيلات التالية
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {contribDeptIds.map(deptId => {
          const dept = departments.find(d => d.id === deptId);
          const contrib = batchContribs.find((c: any) => c.contributingDepartmentId === deptId);
          const isLead = contrib?.isLead;
          const status = contrib?.status;
          const submitter = contrib?.submittedBy;
          return (
            <div key={deptId} className="rounded-md border bg-background p-3 text-sm" data-testid={`contributor-${deptId}`}>
              <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{dept?.name || `#${deptId}`}</span>
                  {isLead && <Badge variant="default" className="text-xs">القائد</Badge>}
                </div>
                {status === "submitted" || status === "lead" ? (
                  <Badge variant="outline" className="bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300 text-xs">
                    <CheckCircle2 className="w-3 h-3 ml-1" /> ساهم
                  </Badge>
                ) : status === "declined" ? (
                  <Badge variant="outline" className="bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 text-xs">
                    <Ban className="w-3 h-3 ml-1" /> اعتذر
                  </Badge>
                ) : null}
              </div>
              {submitter && (
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-xs text-muted-foreground flex-1">{submitter.fullName}</p>
                  {submitter.signatureUrl && (
                    <img src={submitter.signatureUrl} alt="توقيع" className="max-h-10 object-contain border rounded bg-white px-1" data-testid={`signature-contributor-${deptId}`} />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ContributionsSection({ corrId, corr, departments }: { corrId: number; corr: Correspondence; departments: Department[] }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [contributionContent, setContributionContent] = useState("");
  const [showDecline, setShowDecline] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [isEditingMine, setIsEditingMine] = useState(false);
  const [uploadingFor, setUploadingFor] = useState<number | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadDesc, setUploadDesc] = useState("");

  const { data: contributions, isLoading } = useQuery<any[]>({
    queryKey: ["/api/correspondence", corrId, "contributions"],
    queryFn: async () => {
      const res = await fetch(`/api/correspondence/${corrId}/contributions`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", `/api/correspondence/${corrId}/contributions`, { content });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/correspondence", corrId, "contributions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/correspondence", corrId, "workflow"] });
      queryClient.invalidateQueries({ queryKey: ["/api/correspondence"] });
      toast({ title: "تم إرسال المساهمة بنجاح" });
      setContributionContent("");
    },
    onError: (e: Error) => toast({ title: "حدث خطأ", description: e.message, variant: "destructive" }),
  });

  const declineMutation = useMutation({
    mutationFn: async (reason: string) => {
      const res = await apiRequest("POST", `/api/correspondence/${corrId}/contributions/decline`, { reason });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/correspondence", corrId, "contributions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/correspondence", corrId, "workflow"] });
      queryClient.invalidateQueries({ queryKey: ["/api/correspondence"] });
      toast({ title: "تم تسجيل الاعتذار" });
      setShowDecline(false);
      setDeclineReason("");
    },
    onError: (e: Error) => toast({ title: "حدث خطأ", description: e.message, variant: "destructive" }),
  });

  if (isLoading || !contributions || contributions.length === 0) return null;

  const activeBatch = contributions.filter((c: any) => {
    return contributions.some((x: any) => x.routingBatchId === c.routingBatchId);
  });
  const latestBatchId = contributions[0]?.routingBatchId;
  const batchContribs = contributions.filter((c: any) => c.routingBatchId === latestBatchId);

  const myContrib = batchContribs.find((c: any) => c.contributingDepartmentId === user?.departmentId && !c.isLead);
  const isLead = batchContribs.some((c: any) => c.contributingDepartmentId === user?.departmentId && c.isLead);
  const isCorrLocked = corr.status && ["archived", "completed", "cancelled", "issued"].includes(corr.status as any);
  const myPending = myContrib && myContrib.status === "pending" && !isCorrLocked;
  const canResubmit = myContrib && !isCorrLocked && (myContrib.status === "submitted" || myContrib.status === "declined");
  const leadDept = departments.find(d => d.id === batchContribs[0]?.leadDepartmentId);

  const uploadContribAttachment = async (cid: number) => {
    if (!uploadFile || !uploadDesc.trim()) return;
    const fd = new FormData();
    fd.append("file", uploadFile);
    fd.append("description", uploadDesc);
    fd.append("contributionId", String(cid));
    const res = await fetch(`/api/correspondence/${corrId}/attachments`, { method: "POST", credentials: "include", body: fd });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast({ title: "تعذر رفع المرفق", description: err.message || "", variant: "destructive" });
      return;
    }
    setUploadFile(null);
    setUploadDesc("");
    setUploadingFor(null);
    queryClient.invalidateQueries({ queryKey: ["/api/correspondence", corrId, "contributions"] });
    toast({ title: "تم رفع المرفق" });
  };

  const submittedCount = batchContribs.filter((c: any) => !c.isLead && c.status === "submitted").length;
  const declinedCount = batchContribs.filter((c: any) => !c.isLead && c.status === "declined").length;
  const pendingCount = batchContribs.filter((c: any) => !c.isLead && c.status === "pending").length;
  const totalContribs = batchContribs.filter((c: any) => !c.isLead).length;

  return (
    <div className="rounded-lg border-2 border-blue-200 dark:border-blue-900 bg-blue-50/30 dark:bg-blue-950/10 p-4 space-y-4" data-testid="contributions-section">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <Send className="w-4 h-4 text-blue-600" />
          رد جماعي — الجهة الرئيسية: <strong>{leadDept?.name || "—"}</strong>
        </h4>
        <div className="flex gap-2 text-xs">
          <Badge variant="outline" className="bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300">مُرسلة: {submittedCount}</Badge>
          {declinedCount > 0 && <Badge variant="outline" className="bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300">اعتذار: {declinedCount}</Badge>}
          {pendingCount > 0 && <Badge variant="outline" className="bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300">بانتظار: {pendingCount}</Badge>}
          <Badge variant="secondary">المجموع: {totalContribs}</Badge>
        </div>
      </div>

      {(myPending || isEditingMine) && !showDecline && (
        <div className="space-y-2 rounded-md bg-background border p-3" data-testid="my-contribution-editor">
          <Label className="text-xs font-medium">{isEditingMine ? "تعديل مساهمتكم" : "مساهمتكم (مطلوبة)"}</Label>
          <RichTextEditor value={contributionContent} onChange={setContributionContent} placeholder="اكتب مساهمتك هنا..." />
          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              disabled={!contributionContent.trim() || submitMutation.isPending}
              onClick={() => submitMutation.mutate(contributionContent)}
              data-testid="button-submit-contribution"
            >
              {submitMutation.isPending && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
              <Send className="w-4 h-4 ml-2" /> {isEditingMine ? "حفظ التعديل" : "إرسال المساهمة للجهة الرئيسية"}
            </Button>
            {!isEditingMine && (
              <Button size="sm" variant="outline" onClick={() => setShowDecline(true)} data-testid="button-show-decline">
                لا توجد إجابة (اعتذار)
              </Button>
            )}
            {isEditingMine && (
              <Button size="sm" variant="ghost" onClick={() => { setIsEditingMine(false); setContributionContent(""); }} data-testid="button-cancel-edit-contribution">إلغاء</Button>
            )}
          </div>
          {myContrib && (
            <div className="pt-2 border-t mt-2">
              <Label className="text-xs font-medium">مرفقات هذه المساهمة</Label>
              <ContributionAttachmentsList attachments={myContrib.attachments || []} />
              {uploadingFor === myContrib.id ? (
                <div className="space-y-2 mt-2 p-2 border rounded bg-muted/30">
                  <Input type="file" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} data-testid="input-contrib-attachment-file" />
                  <Input placeholder="وصف المرفق" value={uploadDesc} onChange={(e) => setUploadDesc(e.target.value)} data-testid="input-contrib-attachment-desc" />
                  <div className="flex gap-2">
                    <Button size="sm" disabled={!uploadFile || !uploadDesc.trim()} onClick={() => uploadContribAttachment(myContrib.id)} data-testid="button-upload-contrib-attachment">رفع</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setUploadingFor(null); setUploadFile(null); setUploadDesc(""); }}>إلغاء</Button>
                  </div>
                </div>
              ) : (
                <Button size="sm" variant="outline" className="mt-2" onClick={() => setUploadingFor(myContrib.id)} data-testid="button-add-contrib-attachment">
                  <Paperclip className="w-3 h-3 ml-1" /> إضافة مرفق
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {myPending && showDecline && (
        <div className="space-y-2 rounded-md bg-background border border-orange-300 p-3" data-testid="decline-form">
          <Label className="text-xs font-medium">سبب الاعتذار (مطلوب)</Label>
          <Textarea
            value={declineReason}
            onChange={e => setDeclineReason(e.target.value)}
            rows={3}
            placeholder="اشرح سبب عدم تقديم مساهمة..."
            data-testid="input-decline-reason"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="destructive"
              disabled={!declineReason.trim() || declineMutation.isPending}
              onClick={() => declineMutation.mutate(declineReason)}
              data-testid="button-confirm-decline"
            >
              {declineMutation.isPending && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
              تأكيد الاعتذار
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setShowDecline(false); setDeclineReason(""); }} data-testid="button-cancel-decline">
              إلغاء
            </Button>
          </div>
        </div>
      )}

      {myContrib && !isEditingMine && (myContrib.status === "submitted" || myContrib.status === "declined") && (
        <div className="rounded-md border bg-background p-3 text-sm" data-testid="my-contribution-done">
          <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
            <div className="flex items-center gap-2">
              {myContrib.status === "submitted" ? (
                <><CheckCircle2 className="w-4 h-4 text-green-600" /><span className="text-green-700 dark:text-green-300">تم إرسال مساهمتكم</span></>
              ) : (
                <><Ban className="w-4 h-4 text-orange-600" /><span className="text-orange-700 dark:text-orange-300">اعتذرتم عن المساهمة</span></>
              )}
            </div>
            {canResubmit && (
              <Button size="sm" variant="outline" onClick={() => {
                setContributionContent(myContrib.content || "");
                setIsEditingMine(true);
                setShowDecline(false);
              }} data-testid="button-edit-my-contribution">
                <Pencil className="w-3 h-3 ml-1" /> تعديل
              </Button>
            )}
          </div>
          {myContrib.status === "submitted" && myContrib.content && (
            <div className="prose prose-sm max-w-none dark:prose-invert text-sm" dangerouslySetInnerHTML={{ __html: myContrib.content }} />
          )}
          {myContrib.status === "declined" && myContrib.declineReason && (
            <p className="text-xs text-muted-foreground">السبب: {myContrib.declineReason}</p>
          )}
          {myContrib.attachments && myContrib.attachments.length > 0 && (
            <div className="mt-2 pt-2 border-t">
              <Label className="text-xs">المرفقات</Label>
              <ContributionAttachmentsList attachments={myContrib.attachments} />
            </div>
          )}
        </div>
      )}

      {(isLead || user?.role === "admin") && (
        <div className="space-y-2">
          <Label className="text-xs font-medium">المساهمات الواردة</Label>
          {batchContribs.filter((c: any) => !c.isLead).map((c: any) => (
            <div key={c.id} className="rounded-md border bg-background p-3 text-sm" data-testid={`contribution-${c.id}`}>
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <span className="font-medium">{c.contributingDepartment?.name || `#${c.contributingDepartmentId}`}</span>
                {c.status === "submitted" && (
                  <Badge variant="outline" className="bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300 text-xs">
                    <CheckCircle2 className="w-3 h-3 ml-1" /> مُرسلة
                    {c.submittedBy && <span className="mr-1">— {c.submittedBy.fullName}</span>}
                  </Badge>
                )}
                {c.status === "declined" && (
                  <Badge variant="outline" className="bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 text-xs">
                    <Ban className="w-3 h-3 ml-1" /> اعتذار
                  </Badge>
                )}
                {c.status === "pending" && (
                  <Badge variant="outline" className="bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 text-xs">بانتظار</Badge>
                )}
              </div>
              {c.status === "submitted" && c.content && (
                <div className="prose prose-sm max-w-none dark:prose-invert text-sm border-t pt-2" dangerouslySetInnerHTML={{ __html: c.content }} />
              )}
              {c.status === "declined" && c.declineReason && (
                <p className="text-xs text-muted-foreground border-t pt-2">السبب: {c.declineReason}</p>
              )}
              {c.attachments && c.attachments.length > 0 && (
                <div className="mt-2 pt-2 border-t">
                  <Label className="text-xs">المرفقات</Label>
                  <ContributionAttachmentsList attachments={c.attachments} />
                </div>
              )}
            </div>
          ))}
          {pendingCount > 0 && (
            <p className="text-xs text-amber-700 dark:text-amber-300 flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              بانتظار {pendingCount} مساهمة قبل أن تتمكنوا من إعداد الإجابة النهائية
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function WorkflowActionPanel({ corr, departments, employees, workflowEvents, onReply }: {
  corr: Correspondence;
  departments: Department[];
  employees: Employee[];
  workflowEvents: any[];
  onReply?: (ctx: ReplyContext) => void;
}) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [action, setAction] = useState("");
  const [marginNote, setMarginNote] = useState("");
  const [toDeptId, setToDeptId] = useState("");
  const [notes, setNotes] = useState("");
  const [showChangeFlow, setShowChangeFlow] = useState(false);
  const [selectedNewFlow, setSelectedNewFlow] = useState<string>("");
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [isFollowUp, setIsFollowUp] = useState(false);
  const [responseDeadline, setResponseDeadline] = useState("");
  const [routeFollowUpDays, setRouteFollowUpDays] = useState("");
  const [selectedSubDepts, setSelectedSubDepts] = useState<number[]>([]);
  const [leadSubDept, setLeadSubDept] = useState<number | null>(null);

  const { data: panelContributions } = useQuery<any[]>({
    queryKey: ["/api/correspondence", corr.id, "contributions"],
    queryFn: async () => {
      const res = await fetch(`/api/correspondence/${corr.id}/contributions`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const myActiveBatchPending = useMemo(() => {
    if (!panelContributions || !user?.departmentId) return false;
    const mine = panelContributions.find((c: any) =>
      c.contributingDepartmentId === user.departmentId && c.isLead);
    if (!mine) return false;
    const batchId = mine.routingBatchId;
    const nonLead = panelContributions.filter((c: any) => c.routingBatchId === batchId && !c.isLead);
    if (nonLead.length === 0) return false;
    return nonLead.some((c: any) => c.status !== "submitted" && c.status !== "declined");
  }, [panelContributions, user]);

  const isCentralMailUser = user?.role === "central_mail";
  const isInSenderChain = (corr as any)._isInSenderChain !== false;
  const isOutgoing = isInSenderChain && (corr.type === "internal_outgoing" || corr.type === "external_outgoing");
  const userDept = departments.find(d => d.id === user?.departmentId);
  const currentDept = departments.find(d => d.id === corr.currentDepartmentId);
  const isCentral = isInSenderChain ? (currentDept?.isCentral ?? false) : (userDept?.isCentral ?? false);

  const { data: allFlowTemplates } = useQuery<any[]>({
    queryKey: ["/api/flow-templates"],
    queryFn: async () => {
      const res = await fetch(`/api/flow-templates`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!(corr as any).flowTemplateId,
  });

  const flowTemplateData = useMemo(() => {
    if (!allFlowTemplates || !(corr as any).flowTemplateId) return null;
    return allFlowTemplates.find((t: any) => t.id === (corr as any).flowTemplateId) || null;
  }, [allFlowTemplates, corr]);

  const flowGroup = useMemo(() => {
    if (!flowTemplateData || !(corr as any).flowTemplateGroupId) return null;
    return flowTemplateData.groups?.find((g: any) => g.id === (corr as any).flowTemplateGroupId) || null;
  }, [flowTemplateData, corr]);

  const currentUserPositionInFlow = useMemo(() => {
    if (!flowGroup || !user?.departmentId) return -1;
    return flowGroup.accounts?.indexOf(user.departmentId) ?? -1;
  }, [flowGroup, user]);

  const isLastInFlow = useMemo(() => {
    if (!flowGroup || currentUserPositionInFlow < 0) return false;
    return currentUserPositionInFlow === (flowGroup.accounts?.length ?? 0) - 1;
  }, [flowGroup, currentUserPositionInFlow]);

  const nextDeptInFlow = useMemo(() => {
    if (!flowGroup || currentUserPositionInFlow < 0) return null;
    const nextIdx = currentUserPositionInFlow + 1;
    if (nextIdx >= (flowGroup.accounts?.length ?? 0)) return null;
    const nextDeptId = flowGroup.accounts[nextIdx];
    return departments.find(d => d.id === nextDeptId) || null;
  }, [flowGroup, currentUserPositionInFlow, departments]);

  const prevDeptInFlow = useMemo(() => {
    if (!flowGroup || currentUserPositionInFlow <= 0) return null;
    const prevIdx = currentUserPositionInFlow - 1;
    const prevDeptId = flowGroup.accounts[prevIdx];
    return departments.find(d => d.id === prevDeptId) || null;
  }, [flowGroup, currentUserPositionInFlow, departments]);

  const hasAlreadyActed = useMemo(() => {
    if (!workflowEvents || !user?.departmentId) return false;
    if (corr.status === "draft" && corr.createdById === user?.id) return false;
    const myActions = workflowEvents.filter((evt: any) =>
      evt.fromDepartmentId === user.departmentId &&
      ["elevate", "return_for_modification", "final_sign", "sign_and_forward", "approve_and_forward", "final_approve_and_issue"].includes(evt.action)
    );
    if (myActions.length === 0) return false;
    const lastIncomingToMe = workflowEvents
      .filter((evt: any) => evt.toDepartmentId === user.departmentId &&
        (evt.action === "return_for_modification" || evt.action === "elevate" || evt.action === "sign_and_forward" || evt.action === "approve_and_forward"))
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    const lastMyAction = myActions.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    if (lastIncomingToMe && new Date(lastIncomingToMe.createdAt) > new Date(lastMyAction.createdAt)) {
      return false;
    }
    return true;
  }, [workflowEvents, user, corr]);

  const receiverActionState = useMemo<{ locked: boolean; type: "archived" | "routed" | "replied" | null; details?: string }>(() => {
    if (isOutgoing || !user?.departmentId || !workflowEvents) return { locked: false, type: null };

    if (corr.status === "archived") {
      return { locked: true, type: "archived" };
    }

    const replies = (corr as any).replies;
    if (replies && replies.length > 0) {
      return { locked: true, type: "replied", details: replies[0]?.subject };
    }

    const routeEvents = workflowEvents
      .filter((evt: any) => evt.action === "route_to_subordinate" && evt.fromDepartmentId === user.departmentId)
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    if (routeEvents.length > 0) {
      const lastRouteTime = new Date(routeEvents[0].createdAt).getTime();
      const hasReopenAfterRoute = workflowEvents.some((evt: any) =>
        evt.action === "reopen" && evt.fromDepartmentId === user.departmentId &&
        new Date(evt.createdAt).getTime() > lastRouteTime
      );
      if (!hasReopenAfterRoute) {
        return { locked: true, type: "routed" };
      }
    }

    return { locked: false, type: null };
  }, [isOutgoing, workflowEvents, user, corr]);

  const canChangeFlow = useMemo(() => {
    if (!flowGroup || currentUserPositionInFlow <= 0) return false;
    if (!isOutgoing) return false;
    const st = corr.status;
    if (st === "issued" || st === "archived" || st === "cancelled") return false;
    return true;
  }, [flowGroup, currentUserPositionInFlow, isOutgoing, corr.status]);

  const eligibleFlowChanges = useMemo(() => {
    if (!canChangeFlow || !allFlowTemplates || !flowGroup) return [];
    const chainAccounts = flowGroup.accounts?.slice(0, currentUserPositionInFlow + 1) || [];
    const results: { templateId: number; templateName: string; groupId: number; levels: string[]; accounts: number[] }[] = [];
    const levelNames: Record<string, string> = { unit: "وحدة", division: "شعبة", section: "قسم", directorate: "هيئة", assistant: "معاون", general_manager: "مدير عام" };

    for (const tmpl of allFlowTemplates) {
      if (!tmpl.isActive || tmpl.correspondenceType !== corr.type) continue;
      if (tmpl.id === (corr as any).flowTemplateId) continue;
      for (const grp of (tmpl.groups || [])) {
        if (!grp.isActive || !grp.accounts) continue;
        let valid = true;
        for (let i = 0; i < chainAccounts.length; i++) {
          if (!grp.accounts.includes(chainAccounts[i])) { valid = false; break; }
          if (i > 0) {
            const prevPos = grp.accounts.indexOf(chainAccounts[i - 1]);
            const curPos = grp.accounts.indexOf(chainAccounts[i]);
            if (curPos <= prevPos) { valid = false; break; }
          }
        }
        if (valid) {
          results.push({
            templateId: tmpl.id,
            templateName: `${tmpl.name} (${tmpl.levels?.map((l: string) => levelNames[l] || l).join(" → ")})`,
            groupId: grp.id,
            levels: tmpl.levels,
            accounts: grp.accounts,
          });
        }
      }
    }
    return results;
  }, [canChangeFlow, allFlowTemplates, flowGroup, currentUserPositionInFlow, corr]);

  const changeFlowMutation = useMutation({
    mutationFn: async (data: { newFlowTemplateId: number; newFlowTemplateGroupId: number }) => {
      const res = await apiRequest("PATCH", `/api/correspondence/${corr.id}/change-flow`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/correspondence"] });
      queryClient.invalidateQueries({ queryKey: ["/api/correspondence", corr.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/correspondence", corr.id, "workflow"] });
      queryClient.invalidateQueries({ queryKey: ["/api/flow-templates"] });
      toast({ title: "تم تغيير مسار التدفق بنجاح" });
      setShowChangeFlow(false);
      setSelectedNewFlow("");
    },
    onError: (error: Error) => {
      toast({ title: "حدث خطأ", description: error.message, variant: "destructive" });
    },
  });

  const outgoingActions: { value: string; label: string; toStatus: string | null }[] = [];
  
  if (flowGroup && currentUserPositionInFlow >= 0) {
    if (nextDeptInFlow) {
      outgoingActions.push({ value: "elevate", label: `رفع إلى: ${nextDeptInFlow.name}`, toStatus: "under_review" });
    }
    if (prevDeptInFlow) {
      const prevDeptDidRaiseToMe = (workflowEvents || []).some((evt: any) =>
        evt.fromDepartmentId === prevDeptInFlow.id &&
        evt.toDepartmentId === user?.departmentId &&
        ["elevate", "sign_and_forward", "approve_and_forward"].includes(evt.action)
      );
      if (prevDeptDidRaiseToMe) {
        outgoingActions.push({ value: "return_for_modification", label: `إعادة إلى: ${prevDeptInFlow.name}`, toStatus: "draft" });
      }
    }
    if (isLastInFlow) {
      outgoingActions.push({ value: "final_sign", label: "توقيع نهائي وإطلاق", toStatus: "issued" });
    }
  } else {
    outgoingActions.push(
      { value: "elevate", label: "رفع للمسؤول المباشر", toStatus: "under_review" },
      { value: "return_for_modification", label: "إعادة للتعديل", toStatus: "draft" },
      { value: "final_sign", label: "توقيع نهائي وإطلاق", toStatus: "issued" },
    );
    if (isCentral) {
      outgoingActions.push({ value: "final_approve_and_issue", label: "موافقة نهائية وإصدار (مركزي)", toStatus: "issued" });
    }
  }

  const isExternalIncoming = corr.type === "external_incoming";
  const isAssignedToMe = isExternalIncoming && corr.assignedToId === user?.id;
  const [showReturnToCentralMail, setShowReturnToCentralMail] = useState(false);
  const [returnComment, setReturnComment] = useState("");

  const returnToCentralMailMutation = useMutation({
    mutationFn: async (comment: string) => {
      const res = await apiRequest("POST", `/api/correspondence/${corr.id}/return-to-central-mail`, { comment });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/correspondence"] });
      queryClient.invalidateQueries({ queryKey: ["/api/correspondence", corr.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/correspondence", corr.id, "workflow"] });
      toast({ title: "تم إعادة المراسلة للبريد المركزي بنجاح" });
      setShowReturnToCentralMail(false);
      setReturnComment("");
    },
    onError: (error: Error) => {
      toast({ title: "حدث خطأ", description: error.message, variant: "destructive" });
    },
  });

  const incomingActions: { value: string; label: string; toStatus: string | null }[] = [];
  incomingActions.push(
    { value: "archive_incoming", label: "حفظ", toStatus: "archived" },
  );
  const childDepts = departments.filter(d => d.parentId === (user?.departmentId || 0));
  if (childDepts.length > 0) {
    incomingActions.push(
      { value: "route_to_subordinate", label: "إحالة لجهة تابعة", toStatus: "in_progress" },
    );
  }
  incomingActions.push(
    { value: "prepare_response", label: "إعداد إجابة / رد", toStatus: null },
  );

  const availableActions = isOutgoing ? outgoingActions : incomingActions;

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      if (data.action === "archive_incoming") {
        const res = await apiRequest("POST", `/api/correspondence/${corr.id}/close`, {
          notes: data.notes || "تم حفظ المراسلة الواردة",
        });
        return res.json();
      }
      const res = await apiRequest("POST", `/api/correspondence/${corr.id}/workflow`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/correspondence"] });
      queryClient.invalidateQueries({ queryKey: ["/api/correspondence", corr.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/correspondence", corr.id, "workflow"] });
      queryClient.invalidateQueries({ queryKey: ["/api/correspondence/my-followups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/correspondence/deadline-alerts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/correspondence/overdue-reminders"] });
      toast({ title: "تم تنفيذ الإجراء بنجاح" });
      setAction("");
      setMarginNote("");
      setToDeptId("");
      setNotes("");
      setIsFollowUp(false);
      setSelectedSubDepts([]);
      setLeadSubDept(null);
      setResponseDeadline("");
      setRouteFollowUpDays("");
    },
    onError: (error: Error) => {
      toast({ title: "حدث خطأ", description: error.message, variant: "destructive" });
    },
  });

  const reopenMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/correspondence/${corr.id}/reopen`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/correspondence"] });
      queryClient.invalidateQueries({ queryKey: ["/api/correspondence", corr.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/correspondence", corr.id, "workflow"] });
      toast({ title: "تم إعادة فتح المراسلة بنجاح" });
    },
    onError: (error: Error) => {
      toast({ title: "حدث خطأ", description: error.message, variant: "destructive" });
    },
  });

  const selectedAction = availableActions.find(a => a.value === action);
  
  const hasFlowTarget = flowGroup && currentUserPositionInFlow >= 0 && (action === "elevate" || action === "assign_down" || action === "return_for_modification");
  const needsDept = !hasFlowTarget && (action === "route_to_subordinate" || action === "sign_and_forward" || action === "approve_and_forward" || action === "assign_down");

  const getDeptOptions = () => {
    if (action === "route_to_subordinate") {
      return departments.filter(d => d.parentId === (user?.departmentId || 0));
    }
    if (action === "assign_down" && !hasFlowTarget) {
      return departments.filter(d => d.parentId === (user?.departmentId || 0));
    }
    if (action === "sign_and_forward" || action === "approve_and_forward") {
      if (currentDept?.parentId) {
        const ancestors: Department[] = [];
        let parentId: number | null = currentDept.parentId;
        while (parentId) {
          const parent = departments.find(d => d.id === parentId);
          if (parent) {
            ancestors.push(parent);
            parentId = parent.parentId;
          } else break;
        }
        return ancestors;
      }
      return departments.filter(d => d.id !== corr.currentDepartmentId);
    }
    return departments;
  };

  const getFlowTargetDeptId = () => {
    if (!flowGroup || currentUserPositionInFlow < 0) return null;
    if (action === "elevate" || action === "assign_down") {
      return nextDeptInFlow?.id || null;
    }
    if (action === "return_for_modification") {
      return prevDeptInFlow?.id || null;
    }
    return null;
  };

  if (isCentralMailUser && corr.type === "external_incoming" && corr.centralMailAssignedById === user?.id) {
    const isAssigned = !!corr.assignedToId;
    const assignee = employees.find(e => e.id === corr.assignedToId);
    return (
      <div className="space-y-3 rounded-lg border p-4">
        <h4 className="text-sm font-medium">حالة المراسلة</h4>
        {isAssigned ? (
          <div className="flex items-center gap-2 px-3 py-2 bg-green-50/50 dark:bg-green-950/20 rounded-md border border-green-200 dark:border-green-800 text-sm" data-testid="text-cm-assigned">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <span>مُسندة إلى: <strong>{assignee?.fullName || "—"}</strong> — لا يمكن إجراء تعديلات حتى يتم إعادتها</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-2 bg-amber-50/50 dark:bg-amber-950/20 rounded-md border border-amber-200 dark:border-amber-800 text-sm" data-testid="text-cm-returned">
            <RotateCw className="w-4 h-4 text-amber-600" />
            <span>تم إعادة المراسلة — يمكنك إعادة إسنادها لحساب مخوّل آخر من قائمة المراسلات المُسندة</span>
          </div>
        )}
      </div>
    );
  }

  if (isOutgoing && (corr.status === "issued" || corr.status === "archived" || corr.status === "cancelled")) {
    return (
      <div className="space-y-3 rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium">تنفيذ إجراء</h4>
          {flowTemplateData && (
            <Badge variant="outline" className="text-xs">{flowTemplateData.name}</Badge>
          )}
        </div>
        <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-md border text-sm" data-testid="text-action-issued">
          <CheckCircle2 className="w-4 h-4 text-green-600" />
          <span className="text-muted-foreground">
            {corr.status === "issued" ? "تم إصدار المراسلة برقم وتاريخ. لا يمكن إجراء تعديلات." : "المراسلة مغلقة."}
          </span>
        </div>
      </div>
    );
  }

  if (isOutgoing && hasAlreadyActed) {
    return (
      <div className="space-y-3 rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium">تنفيذ إجراء</h4>
          {flowTemplateData && (
            <Badge variant="outline" className="text-xs">{flowTemplateData.name}</Badge>
          )}
        </div>
        <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-md border text-sm" data-testid="text-action-locked">
          <CheckCircle2 className="w-4 h-4 text-green-600" />
          <span className="text-muted-foreground">تم تنفيذ الإجراء. بانتظار رد من المستوى التالي.</span>
        </div>
      </div>
    );
  }

  if (!isOutgoing && receiverActionState.locked) {
    return (
      <div className="space-y-3 rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium">تنفيذ إجراء</h4>
        </div>
        {receiverActionState.type === "archived" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-md border text-sm" data-testid="text-receiver-archived">
              <Archive className="w-4 h-4 text-blue-600" />
              <span className="text-muted-foreground">تم حفظ المراسلة الواردة.</span>
            </div>
            {(user?.role === "admin" || (corr as any).closedById === user?.id) && (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                disabled={reopenMutation.isPending}
                onClick={() => reopenMutation.mutate()}
                data-testid="button-change-action"
              >
                {reopenMutation.isPending && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
                <RotateCcw className="w-4 h-4 ml-2" />
                تغيير الإجراء
              </Button>
            )}
          </div>
        )}
        {receiverActionState.type === "routed" && (
          <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-md border text-sm" data-testid="text-receiver-routed">
            <Send className="w-4 h-4 text-amber-600" />
            <span className="text-muted-foreground">تم إحالة المراسلة لجهة تابعة. بانتظار الرد من الجهة المُحالة.</span>
          </div>
        )}
        {receiverActionState.type === "replied" && (
          <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-md border text-sm" data-testid="text-receiver-replied">
            <Reply className="w-4 h-4 text-green-600" />
            <span className="text-muted-foreground">تم إعداد إجابة على المراسلة الواردة.</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">تنفيذ إجراء</h4>
        {isOutgoing && (
          <div className="flex items-center gap-2">
            {flowTemplateData && (
              <Badge variant="outline" className="text-xs">
                {flowTemplateData.name}
              </Badge>
            )}
            {isCentral && (
              <Badge variant="secondary" className="text-xs bg-chart-5/10 text-chart-5">جهة مركزية</Badge>
            )}
          </div>
        )}
      </div>
      <Select value={action} onValueChange={(v) => {
        if (v === "prepare_response" && onReply) {
          if (myActiveBatchPending) {
            toast({
              title: "لا يمكن إعداد الإجابة",
              description: "بانتظار مساهمات الجهات الأخرى قبل أن تتمكن من إعداد الإجابة النهائية",
              variant: "destructive",
            });
            return;
          }
          onReply({
            parentCorrespondenceId: corr.id,
            parentSubject: corr.subject,
            parentType: corr.type,
            senderDepartmentId: corr.senderDepartmentId,
            receiverDepartmentId: corr.receiverDepartmentId,
            priority: corr.priority || "medium",
            confidentiality: corr.confidentiality || "normal",
            externalEntity: corr.externalEntity || undefined,
          });
          return;
        }
        setAction(v); setToDeptId(""); setIsFollowUp(false); setSelectedSubDepts([]); setResponseDeadline("");
      }}>
        <SelectTrigger data-testid="select-workflow-action"><SelectValue placeholder="اختر الإجراء" /></SelectTrigger>
        <SelectContent>
          {availableActions.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
        </SelectContent>
      </Select>
      {hasFlowTarget && (
        <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-md border text-sm">
          <ArrowRight className="w-4 h-4 text-chart-1" />
          <span>
            {action === "return_for_modification" ? "إعادة إلى" : "إلى"}: <strong>{action === "return_for_modification" ? prevDeptInFlow?.name : nextDeptInFlow?.name}</strong>
          </span>
          <Badge variant="outline" className="mr-auto text-xs">حسب المسار</Badge>
        </div>
      )}
      {action === "route_to_subordinate" && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">اختر الجهات التابعة (يمكن اختيار أكثر من جهة)</p>
          <div className="border rounded-md p-3 space-y-2 max-h-48 overflow-y-auto">
            {childDepts.map(d => (
              <label key={d.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 p-1.5 rounded" data-testid={`label-sub-dept-${d.id}`}>
                <input
                  type="checkbox"
                  checked={selectedSubDepts.includes(d.id)}
                  onChange={e => {
                    if (e.target.checked) {
                      setSelectedSubDepts(prev => [...prev, d.id]);
                    } else {
                      setSelectedSubDepts(prev => prev.filter(id => id !== d.id));
                    }
                  }}
                  className="rounded border-input"
                  data-testid={`checkbox-sub-dept-${d.id}`}
                />
                <span>{d.name}</span>
              </label>
            ))}
          </div>
          {selectedSubDepts.length > 0 && (
            <p className="text-xs text-muted-foreground">تم اختيار {selectedSubDepts.length} جهة</p>
          )}
          {selectedSubDepts.length > 1 && (
            <div className="space-y-2 rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/10 p-3">
              <p className="text-xs font-medium text-amber-800 dark:text-amber-200">
                هذه إحالة جماعية — اختر الجهة الرئيسية المسؤولة عن إعداد الرد النهائي
              </p>
              <div className="space-y-1">
                {selectedSubDepts.map(deptId => {
                  const d = departments.find(x => x.id === deptId);
                  return (
                    <label key={deptId} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-amber-100/50 dark:hover:bg-amber-900/20 p-1.5 rounded" data-testid={`label-lead-dept-${deptId}`}>
                      <input
                        type="radio"
                        name="lead-dept"
                        checked={leadSubDept === deptId}
                        onChange={() => setLeadSubDept(deptId)}
                        data-testid={`radio-lead-dept-${deptId}`}
                      />
                      <span>{d?.name || `#${deptId}`}</span>
                    </label>
                  );
                })}
              </div>
              {!leadSubDept && (
                <p className="text-xs text-amber-700 dark:text-amber-300">سيتم اعتبار أول جهة كرئيسية إن لم تختر</p>
              )}
            </div>
          )}
          <label className="flex items-center gap-2 text-sm cursor-pointer" data-testid="label-follow-up">
            <input
              type="checkbox"
              checked={isFollowUp}
              onChange={e => setIsFollowUp(e.target.checked)}
              className="rounded border-input"
              data-testid="checkbox-follow-up"
            />
            <span>تعيين كمتابعة</span>
          </label>
          {isFollowUp && (
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1">
                <CalendarDays className="w-3 h-3" />
                مدة المتابعة (بالأيام)
              </Label>
              <Input
                type="number"
                min="1"
                value={routeFollowUpDays}
                onChange={e => setRouteFollowUpDays(e.target.value)}
                placeholder="عدد الأيام"
                className="text-sm"
                data-testid="input-follow-up-days-route"
              />
            </div>
          )}
        </div>
      )}
      {needsDept && action !== "route_to_subordinate" && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">اختر الجهة الأعلى</p>
          <Select value={toDeptId} onValueChange={setToDeptId}>
            <SelectTrigger data-testid="select-workflow-dept"><SelectValue placeholder="اختر الجهة" /></SelectTrigger>
            <SelectContent>
              {getDeptOptions().map(d => <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}
      {action !== "prepare_response" && (
        <>
          <Textarea
            placeholder="الهامش / التعليق (اختياري)..."
            value={marginNote}
            onChange={e => setMarginNote(e.target.value)}
            rows={2}
            data-testid="input-margin-note"
          />
          <Button
            className="w-full"
            disabled={!action || mutation.isPending || (action === "route_to_subordinate" && selectedSubDepts.length === 0) || (needsDept && action !== "route_to_subordinate" && !toDeptId)}
            onClick={() => {
              const targetDeptId = getFlowTargetDeptId();
              if (action === "route_to_subordinate") {
                const lead = selectedSubDepts.length > 1
                  ? (leadSubDept && selectedSubDepts.includes(leadSubDept) ? leadSubDept : selectedSubDepts[0])
                  : selectedSubDepts[0];
                mutation.mutate({
                  action,
                  toStatus: selectedAction?.toStatus || corr.status,
                  fromDepartmentId: user?.departmentId || null,
                  toDepartmentIds: selectedSubDepts,
                  leadDepartmentId: selectedSubDepts.length > 1 ? lead : undefined,
                  marginNote: marginNote || null,
                  notes: notes || null,
                  isFollowUp,
                  followUpDays: routeFollowUpDays ? parseInt(routeFollowUpDays) : undefined,
                  responseDeadline: responseDeadline || undefined,
                });
              } else {
                mutation.mutate({
                  action,
                  toStatus: selectedAction?.toStatus || corr.status,
                  fromDepartmentId: user?.departmentId || null,
                  toDepartmentId: toDeptId ? parseInt(toDeptId) : (targetDeptId || null),
                  marginNote: marginNote || null,
                  notes: notes || null,
                });
              }
            }}
            data-testid="button-execute-workflow"
          >
            {mutation.isPending && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
            تنفيذ الإجراء
          </Button>
        </>
      )}

      {isAssignedToMe && !receiverActionState.locked && (
        <div className="border-t pt-3 mt-3">
          <Button
            variant="outline"
            size="sm"
            className="w-full text-amber-600 border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/20"
            onClick={() => setShowReturnToCentralMail(true)}
            data-testid="button-return-to-central-mail"
          >
            <RotateCw className="w-4 h-4 ml-2" />
            إعادة للبريد المركزي
          </Button>
          {showReturnToCentralMail && (
            <div className="mt-3 space-y-3 p-3 bg-amber-50/50 dark:bg-amber-950/10 rounded-lg border border-amber-200 dark:border-amber-800">
              <p className="text-xs text-muted-foreground">اكتب سبب إعادة المراسلة للبريد المركزي (مطلوب)</p>
              <textarea
                className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="سبب الإعادة..."
                value={returnComment}
                onChange={(e) => setReturnComment(e.target.value)}
                data-testid="textarea-return-comment"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="destructive"
                  className="flex-1"
                  disabled={!returnComment.trim() || returnToCentralMailMutation.isPending}
                  onClick={() => returnToCentralMailMutation.mutate(returnComment)}
                  data-testid="button-confirm-return"
                >
                  {returnToCentralMailMutation.isPending && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
                  تأكيد الإعادة
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setShowReturnToCentralMail(false); setReturnComment(""); }} data-testid="button-cancel-return">
                  إلغاء
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {canChangeFlow && eligibleFlowChanges.length > 0 && (
        <>
          <div className="border-t pt-3 mt-3">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setShowChangeFlow(!showChangeFlow)}
              data-testid="button-change-flow"
            >
              <RotateCcw className="w-4 h-4 ml-2" />
              تغيير مسار التدفق
            </Button>
          </div>
          {showChangeFlow && (
            <div className="space-y-3 p-3 bg-muted/30 rounded-lg border">
              <p className="text-xs text-muted-foreground">
                اختر مسار تدفق بديل - يجب أن يحتوي على نفس الحسابات في سلسلة المصادقة الحالية
              </p>
              <Select value={selectedNewFlow} onValueChange={setSelectedNewFlow}>
                <SelectTrigger data-testid="select-new-flow">
                  <SelectValue placeholder="اختر المسار الجديد" />
                </SelectTrigger>
                <SelectContent>
                  {eligibleFlowChanges.map((ef, idx) => (
                    <SelectItem key={`${ef.templateId}-${ef.groupId}`} value={`${ef.templateId}:${ef.groupId}`}>
                      {ef.templateName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedNewFlow && (() => {
                const [tId, gId] = selectedNewFlow.split(":").map(Number);
                const selected = eligibleFlowChanges.find(ef => ef.templateId === tId && ef.groupId === gId);
                if (!selected) return null;
                return (
                  <div className="text-xs space-y-1">
                    <p className="font-medium">سلسلة التشكيلات في المسار الجديد:</p>
                    <div className="flex flex-wrap gap-1">
                      {selected.accounts.map((accId: number, i: number) => {
                        const dept = departments.find(d => d.id === accId);
                        const isInChain = flowGroup?.accounts?.slice(0, currentUserPositionInFlow + 1).includes(accId);
                        return (
                          <Badge key={i} variant={isInChain ? "default" : "outline"} className="text-xs">
                            {dept?.name || `#${accId}`}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
              <Button
                size="sm"
                className="w-full"
                disabled={!selectedNewFlow || changeFlowMutation.isPending}
                onClick={() => {
                  const [tId, gId] = selectedNewFlow.split(":").map(Number);
                  changeFlowMutation.mutate({ newFlowTemplateId: tId, newFlowTemplateGroupId: gId });
                }}
                data-testid="button-confirm-change-flow"
              >
                {changeFlowMutation.isPending && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
                تأكيد تغيير المسار
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function canPreviewFile(mimeType: string, name = ""): boolean {
  return canPreviewInApp(mimeType, name);
}

function AttachmentPreviewDialog({ attachment, onClose }: { attachment: any; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-5xl max-h-[92vh] flex flex-col p-0 gap-0" dir="rtl">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Eye className="w-4 h-4" />
            معاينة: {attachment.originalName}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-hidden min-h-0 mx-4 rounded-md border bg-muted/20">
          <AttachmentViewer attachment={attachment} height="72vh" />
        </div>
        <div className="flex items-center justify-between p-4 border-t mt-2">
          <p className="text-xs text-muted-foreground">
            {attachment.description ? `${attachment.description} - ` : ""}
            {((attachment.fileSize || 0) / 1024).toFixed(1)} KB
          </p>
          <Button variant="outline" size="sm" asChild data-testid="button-preview-download">
            <a href={`/api/attachments/${attachment.id}/download`} download>
              <ArrowDown className="w-4 h-4 ml-1" />
              تنزيل
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CorrespondenceAttachmentsView({ corrId, isScannedDocument }: { corrId: number; isScannedDocument?: boolean }) {
  const [previewAttachment, setPreviewAttachment] = useState<any>(null);
  const { data: attachments } = useQuery<any[]>({
    queryKey: ["/api/correspondence", corrId, "attachments"],
    queryFn: async () => {
      const res = await fetch(`/api/correspondence/${corrId}/attachments`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  if (!attachments || attachments.length === 0) return null;

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith("image/")) return "🖼️";
    if (mimeType.includes("pdf")) return "📄";
    if (mimeType.includes("word") || mimeType.includes("document")) return "📝";
    if (mimeType.includes("excel") || mimeType.includes("spreadsheet")) return "📊";
    if (mimeType.includes("powerpoint") || mimeType.includes("presentation")) return "📊";
    if (mimeType.startsWith("video/")) return "🎥";
    if (mimeType.startsWith("audio/")) return "🎵";
    return "📎";
  };

  return (
    <>
      <div className="rounded-lg border p-4">
        <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
          <Paperclip className="w-4 h-4" />
          {isScannedDocument ? `صورة المراسلة الورقية (${attachments.length} ${attachments.length === 1 ? 'صفحة' : 'صفحات'})` : `المرفقات (${attachments.length})`}
        </h4>
        {isScannedDocument ? (
          <div className="space-y-2">
            {attachments.map((att: any, idx: number) => (
              <div key={att.id} data-testid={`attachment-row-${att.id}`}>
                {attachments.length > 1 && (
                  <div className="text-xs text-muted-foreground py-1 text-center">صفحة {idx + 1} من {attachments.length}</div>
                )}
                {att.mimeType.startsWith("image/") ? (
                  <div className="flex justify-center cursor-pointer bg-muted/10 rounded-md overflow-hidden" onClick={() => setPreviewAttachment(att)}>
                    <img src={`/api/attachments/${att.id}/preview`} alt={`صفحة ${idx + 1}`} className="w-full object-contain" />
                  </div>
                ) : canPreviewFile(att.mimeType, att.originalName) ? (
                  <div className="bg-muted/10 rounded-md overflow-hidden border">
                    <AttachmentViewer attachment={att} height="700px" />
                  </div>
                ) : (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>{att.originalName}</p>
                  </div>
                )}
              </div>
            ))}
            <div className="flex justify-center pt-2">
              {attachments.map((att: any, idx: number) => (
                <Button
                  key={att.id}
                  variant="outline"
                  size="sm"
                  className="gap-1 text-xs mx-1"
                  data-testid={`button-download-attachment-${att.id}`}
                  onClick={async () => {
                    const res = await fetch(`/api/attachments/${att.id}/download`);
                    const blob = await res.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = att.originalName || `attachment-${att.id}`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(url);
                  }}
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                  {attachments.length > 1 ? `تنزيل صفحة ${idx + 1}` : "تنزيل المراسلة"}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <div className="divide-y rounded-md border overflow-hidden">
            {attachments.map((att: any) => (
              <div key={att.id} className="flex items-center gap-3 p-3 bg-background hover:bg-muted/30 transition-colors" data-testid={`attachment-row-${att.id}`}>
                <span className="text-xl shrink-0">{getFileIcon(att.mimeType)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{att.originalName}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-muted-foreground">{(att.fileSize / 1024).toFixed(1)} KB</span>
                    {att.description && (
                      <>
                        <span className="text-xs text-muted-foreground">|</span>
                        <span className="text-xs text-muted-foreground">{att.description}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {canPreviewFile(att.mimeType) && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1 text-xs"
                      onClick={() => setPreviewAttachment(att)}
                      title="معاينة"
                      data-testid={`button-preview-attachment-${att.id}`}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      معاينة
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1 text-xs"
                    title="تنزيل"
                    data-testid={`button-download-attachment-${att.id}`}
                    onClick={async () => {
                      const res = await fetch(`/api/attachments/${att.id}/download`);
                      const blob = await res.blob();
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = att.originalName || `attachment-${att.id}`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      window.URL.revokeObjectURL(url);
                    }}
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                    تنزيل
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {previewAttachment && (
        <AttachmentPreviewDialog
          attachment={previewAttachment}
          onClose={() => setPreviewAttachment(null)}
        />
      )}
    </>
  );
}

function CorrespondenceDetail({ corrId, departments, employees, onClose, orgName, onReply, onViewCorrespondence }: {
  corrId: number;
  departments: Department[];
  employees: Employee[];
  onClose: () => void;
  orgName?: string;
  onReply?: (ctx: ReplyContext) => void;
  onViewCorrespondence?: (id: number) => void;
}) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editSubject, setEditSubject] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editPriority, setEditPriority] = useState("medium");
  const [editConfidentiality, setEditConfidentiality] = useState("normal");
  const [editReceiverDeptId, setEditReceiverDeptId] = useState<number | undefined>(undefined);
  const [editExternalEntity, setEditExternalEntity] = useState("");
  const [editFollowUpDays, setEditFollowUpDays] = useState("");
  const [editReminderDate, setEditReminderDate] = useState("");
  const [editCcList, setEditCcList] = useState<{departmentId: number; reason: string}[]>([]);
  const [editExternalCcList, setEditExternalCcList] = useState<{entityName: string; reason: string}[]>([]);
  const [editHiddenCcList, setEditHiddenCcList] = useState<{departmentId: number; reason: string}[]>([]);
  const [editNotes, setEditNotes] = useState("");
  const [editAttachments, setEditAttachments] = useState<{file: File; description: string}[]>([]);
  const [isUploadingEdit, setIsUploadingEdit] = useState(false);
  const editFileInputRef = useRef<HTMLInputElement>(null);
  const [showAddFollowup, setShowAddFollowup] = useState(false);
  const [addFollowupDays, setAddFollowupDays] = useState("");

  const { data: detail, isLoading } = useQuery<any>({
    queryKey: ["/api/correspondence", corrId],
    queryFn: async () => {
      const res = await fetch(`/api/correspondence/${corrId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data: wfEvents } = useQuery<any[]>({
    queryKey: ["/api/correspondence", corrId, "workflow"],
    queryFn: async () => {
      const res = await fetch(`/api/correspondence/${corrId}/workflow`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!detail,
  });

  const { data: existingAttachments } = useQuery<any[]>({
    queryKey: ["/api/correspondence", corrId, "attachments"],
    queryFn: async () => {
      const res = await fetch(`/api/correspondence/${corrId}/attachments`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: detailPublicSettings } = useQuery<any>({
    queryKey: ["/api/settings/public"],
  });

  const editMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PATCH", `/api/correspondence/${corrId}`, data);
      const result = await res.json();
      if (editAttachments.length > 0) {
        setIsUploadingEdit(true);
        for (const att of editAttachments) {
          try {
            const formData = new FormData();
            formData.append("file", att.file);
            formData.append("description", att.description);
            await fetch(`/api/correspondence/${corrId}/attachments`, {
              method: "POST",
              body: formData,
              credentials: "include",
            });
          } catch (e) {}
        }
        setIsUploadingEdit(false);
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/correspondence"] });
      queryClient.invalidateQueries({ queryKey: ["/api/correspondence", corrId] });
      queryClient.invalidateQueries({ queryKey: ["/api/correspondence", corrId, "attachments"] });
      toast({ title: "تم تحديث المراسلة بنجاح" });
      setIsEditing(false);
      setEditAttachments([]);
    },
    onError: (error: Error) => {
      toast({ title: "حدث خطأ", description: error.message, variant: "destructive" });
    },
  });

  const addFollowupMutation = useMutation({
    mutationFn: async (data: { days: number }) => {
      const res = await apiRequest("POST", `/api/correspondence/${corrId}/add-followup`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/correspondence/my-followups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/correspondence/deadline-alerts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/correspondence/overdue-reminders"] });
      toast({ title: "تم تعيين المتابعة بنجاح" });
      setShowAddFollowup(false);
      setAddFollowupDays("");
    },
    onError: (error: Error) => {
      toast({ title: "حدث خطأ", description: error.message, variant: "destructive" });
    },
  });

  const wasReturned = useMemo(() => {
    if (!wfEvents || wfEvents.length === 0) return false;
    return wfEvents.some((evt: any) => evt.action === "return_for_modification");
  }, [wfEvents]);

  const { data: allFlowTemplatesForDetail } = useQuery<any[]>({
    queryKey: ["/api/flow-templates"],
    queryFn: async () => {
      const res = await fetch(`/api/flow-templates`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const derivedSenderName = useMemo(() => {
    if (!detail) return null;
    return deriveSenderName(detail, departments, orgName, allFlowTemplatesForDetail) || null;
  }, [detail, departments, allFlowTemplatesForDetail, orgName]);

  const isReceiverView = detail ? detail._isInSenderChain === false : false;

  const finalSigner = useMemo(() => {
    if (!wfEvents) return null;
    const finalEvent = [...wfEvents].reverse().find((e: any) =>
      e.action === "final_sign" || e.action === "final_approve_and_issue"
    );
    if (!finalEvent) return null;
    const signer = employees.find(e => e.id === finalEvent.performedById);
    return signer ? { employee: signer, event: finalEvent } : null;
  }, [wfEvents, employees]);

  const handlePrint = () => {
    if (!detail) return;
    const html = buildPrintHtml({
      detail,
      wfEvents: wfEvents || [],
      attachments: existingAttachments || [],
      departments,
      employees,
      finalSigner,
      orgName: detailPublicSettings?.orgName || orgName || "",
      logoUrl: detailPublicSettings?.logoUrl || "",
      senderName: derivedSenderName || "",
      isReceiverView,
    });
    openPrintWindow(html);
  };

  if (isLoading) return <div className="p-4"><Skeleton className="h-40" /></div>;
  if (!detail) return null;

  const isExtOutgoing = detail.type === "external_outgoing";
  const receiverDept = departments.find(d => d.id === detail.receiverDepartmentId);
  const currentDept = departments.find(d => d.id === detail.currentDepartmentId);

  const canEdit = detail.status === "draft" && wasReturned && (detail.currentDepartmentId === user?.departmentId || user?.role === "admin");

  const centralDepartments = departments.filter(d => d.isCentral && d.isActive);

  const startEditing = () => {
    setEditSubject(detail.subject || "");
    setEditContent(detail.content || "");
    setEditPriority(detail.priority || "medium");
    setEditConfidentiality(detail.confidentiality || "normal");
    setEditReceiverDeptId(detail.receiverDepartmentId || undefined);
    setEditExternalEntity(detail.externalEntity || "");
    setEditNotes(detail.notes || "");
    setEditFollowUpDays("");
    setEditReminderDate(detail.reminderDate ? new Date(detail.reminderDate).toISOString().split("T")[0] : "");
    const regularCCs = (detail.ccs || []).filter((c: any) => !c.isHidden).map((c: any) => ({ departmentId: c.departmentId, reason: c.reason || "" }));
    const hiddenCCs = (detail.ccs || []).filter((c: any) => c.isHidden).map((c: any) => ({ departmentId: c.departmentId, reason: c.reason || "" }));
    const extCCs = (detail.externalCcs || []).map((c: any) => ({ entityName: c.externalEntity?.name || c.entityName || "", reason: c.reason || "" }));
    setEditCcList(regularCCs);
    setEditHiddenCcList(hiddenCCs);
    setEditExternalCcList(extCCs);
    setEditAttachments([]);
    setIsEditing(true);
  };

  const handleEditAttachment = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const blockedExts = ['.exe', '.msi', '.bat', '.cmd', '.com', '.scr', '.dll', '.sys', '.vbs', '.ps1', '.sh', '.jar', '.hta', '.inf', '.reg', '.iso', '.bin', '.lib', '.a', '.so', '.dylib'];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      if (blockedExts.includes(ext)) {
        toast({ title: "ملف غير مسموح", description: `الملف "${file.name}" من نوع غير مسموح به`, variant: "destructive" });
        continue;
      }
      if (file.size > 25 * 1024 * 1024) {
        toast({ title: "حجم الملف كبير", description: `الملف "${file.name}" يتجاوز 25 ميغابايت`, variant: "destructive" });
        continue;
      }
      setEditAttachments(prev => [...prev, { file, description: "" }]);
    }
    if (editFileInputRef.current) editFileInputRef.current.value = "";
  };

  const deleteExistingAttachment = async (attId: number) => {
    try {
      await apiRequest("DELETE", `/api/attachments/${attId}`);
      queryClient.invalidateQueries({ queryKey: ["/api/correspondence", corrId] });
      queryClient.invalidateQueries({ queryKey: ["/api/correspondence", corrId, "attachments"] });
      toast({ title: "تم حذف المرفق" });
    } catch (e) {
      toast({ title: "حدث خطأ في حذف المرفق", variant: "destructive" });
    }
  };

  const displayType = (() => {
    if (!isReceiverView) return { label: typeLabels[detail.type], color: typeColors[detail.type] };
    if (detail.type === "internal_outgoing") return { label: "وارد داخلي", color: typeColors["internal_incoming"] };
    if (detail.type === "external_outgoing") return { label: "وارد خارجي", color: typeColors["external_incoming"] };
    return { label: typeLabels[detail.type], color: typeColors[detail.type] };
  })();

  const displayStatus = (() => {
    const isOutgoingType = detail.type === "internal_outgoing" || detail.type === "external_outgoing";
    const isIncomingType = !isOutgoingType;
    if (isReceiverView) {
      if (detail.status === "in_progress") return { label: "مستلمة", color: "bg-chart-3/10 text-chart-3" };
      if (detail.status === "archived" && isIncomingType) return { label: "حفظ", color: statusColors["archived"] };
      return { label: statusLabels[detail.status || "draft"], color: statusColors[detail.status || "draft"] };
    }
    if (isIncomingType && detail.status === "archived") return { label: "حفظ", color: statusColors["archived"] };
    if (isOutgoingType && (detail.issuedAt || detail.referenceNumber)) return { label: "صدر", color: statusColors["issued"] };
    if (isOutgoingType && !detail.issuedAt && !detail.referenceNumber && detail.status === "archived") return { label: "مسودة مؤرشفة", color: statusColors["archived"] };
    return { label: statusLabels[detail.status || "draft"], color: statusColors[detail.status || "draft"] };
  })();

  const showCurrentDept = currentDept && !(detail.issuedAt || detail.referenceNumber);

  if (detail.type === "external_incoming" && isReceiverView) {
    return (
      <div className="space-y-5">
        <div className="flex justify-end">
          <Button size="sm" variant="outline" onClick={handlePrint} data-testid="button-print-correspondence">
            <Printer className="w-4 h-4 ml-2" />
            طباعة المراسلة
          </Button>
        </div>
        <div className="rounded-lg border p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-6 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground shrink-0">عدد الكتاب:</span>
              <span className="font-medium font-mono" data-testid="text-corr-ref">{detail.externalRefNumber || "-"}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground shrink-0">تاريخ الكتاب:</span>
              <span className="font-medium">{detail.externalDate ? new Date(detail.externalDate).toLocaleDateString("ar-IQ") : "-"}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground shrink-0">الجهة المرسلة:</span>
              <span className="font-medium">{detail.externalEntity || "-"}</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-muted-foreground shrink-0">الموضوع:</span>
              <span className="font-bold" data-testid="text-corr-detail-subject">{detail.subject}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground shrink-0">الأولوية:</span>
              <Badge variant="secondary" className={`text-xs ${priorityColors[detail.priority || "medium"]}`}>
                {priorityLabels[detail.priority || "medium"]}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground shrink-0">نوع المراسلة:</span>
              <Badge variant="secondary" className={`text-xs ${displayType.color}`}>
                {displayType.label}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground shrink-0">الحالة:</span>
              <Badge variant="secondary" className={`text-xs ${displayStatus.color}`}>
                {displayStatus.label}
              </Badge>
              {detail.confidentiality && detail.confidentiality !== "normal" && (
                <Badge variant="secondary" className={`text-xs ${confidentialityColors[detail.confidentiality]}`}>
                  <Shield className="w-3 h-3 ml-1" />
                  {confidentialityLabels[detail.confidentiality]}
                </Badge>
              )}
            </div>
          </div>
        </div>

        <CorrespondenceAttachmentsView corrId={corrId} isScannedDocument={true} />

        <div className="rounded-lg border p-4">
          <h4 className="text-sm font-medium mb-3">مسار الإجراءات</h4>
          <WorkflowTimeline corrId={corrId} departments={departments} employees={employees} isInSenderChain={detail._isInSenderChain} userDepartmentId={user?.departmentId} />
        </div>

        <ContributorsBlock corr={detail} departments={departments} />

        <ContributionsSection corrId={corrId} corr={detail} departments={departments} />

        <WorkflowActionPanel corr={detail} departments={departments} employees={employees} workflowEvents={wfEvents || []} onReply={onReply} />

        {detail.ccs && detail.ccs.filter((cc: any) => !cc.isHidden).length > 0 && (
          <div className="rounded-lg border p-4">
            <h4 className="text-sm font-medium mb-3">نسخة إلى</h4>
            <div className="space-y-2">
              {detail.ccs.filter((cc: any) => !cc.isHidden).map((cc: any) => {
                const dept = departments.find(d => d.id === cc.departmentId);
                return (
                  <div key={cc.id} className="flex items-center gap-3 p-2 bg-muted/30 rounded-md text-sm" data-testid={`cc-item-${cc.id}`}>
                    <Badge variant="outline" className="text-xs shrink-0">{dept?.name || `قسم ${cc.departmentId}`}</Badge>
                    <div className="flex-1 min-w-0 text-xs text-muted-foreground border-r pr-3">
                      {cc.reason ? cc.reason : <span className="italic">بدون سبب</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {detail.parentCorrespondenceId && (
          <div className="flex items-center gap-2 p-3 rounded-lg border border-chart-3/30 bg-chart-3/5">
            <Reply className="w-4 h-4 text-chart-3" />
            <span className="text-sm text-muted-foreground">رد على مراسلة سابقة</span>
            <Button
              variant="link"
              size="sm"
              className="text-chart-3 p-0 h-auto text-sm"
              onClick={() => onViewCorrespondence?.(detail.parentCorrespondenceId!)}
              data-testid="button-view-parent-corr"
            >
              عرض المراسلة الأصلية
              <ArrowLeft className="w-3 h-3 mr-1" />
            </Button>
          </div>
        )}

        {detail.replies && detail.replies.length > 0 && (
          <div className="space-y-2">
            {detail.replies.map((reply: any) => (
              <div key={reply.id} className="flex items-center gap-2 p-3 rounded-lg border border-green-300/30 bg-green-50/50 dark:border-green-800/30 dark:bg-green-950/20">
                <Send className="w-4 h-4 text-green-600" />
                <span className="text-sm text-muted-foreground">مراسلة مرتبطة (رد): {reply.subject}</span>
                <Button
                  variant="link"
                  size="sm"
                  className="text-green-600 p-0 h-auto text-sm mr-auto"
                  onClick={() => onViewCorrespondence?.(reply.id)}
                  data-testid={`button-view-reply-${reply.id}`}
                >
                  عرض الرد
                  <ArrowLeft className="w-3 h-3 mr-1" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {!detail.closedAt && detail.status !== "cancelled" && detail.status !== "draft" && user?.role !== "central_mail" && (
          <CloseCorrespondenceButton corrId={corrId} corr={detail} />
        )}

        {detail.closedAt && (
          <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20 p-4 text-center">
            <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs">
              تم إغلاق المراسلة بتاريخ {new Date(detail.closedAt).toLocaleDateString("ar-SA")}
            </Badge>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">

      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={handlePrint} data-testid="button-print-correspondence">
          <Printer className="w-4 h-4 ml-2" />
          طباعة المراسلة
        </Button>
      </div>

      {detail.parentCorrespondenceId && (
        <div className="flex items-center gap-2 p-3 rounded-lg border border-chart-3/30 bg-chart-3/5">
          <Reply className="w-4 h-4 text-chart-3" />
          <span className="text-sm text-muted-foreground">رد على مراسلة سابقة</span>
          <Button
            variant="link"
            size="sm"
            className="text-chart-3 p-0 h-auto text-sm"
            onClick={() => onViewCorrespondence?.(detail.parentCorrespondenceId!)}
            data-testid="button-view-parent-corr"
          >
            عرض المراسلة الأصلية
            <ArrowLeft className="w-3 h-3 mr-1" />
          </Button>
        </div>
      )}

      {detail.replies && detail.replies.length > 0 && (
        <div className="space-y-2">
          {detail.replies.map((reply: any) => (
            <div key={reply.id} className="flex items-center gap-2 p-3 rounded-lg border border-green-300/30 bg-green-50/50 dark:border-green-800/30 dark:bg-green-950/20">
              <Send className="w-4 h-4 text-green-600" />
              <span className="text-sm text-muted-foreground">مراسلة مرتبطة (رد): {reply.subject}</span>
              <Button
                variant="link"
                size="sm"
                className="text-green-600 p-0 h-auto text-sm mr-auto"
                onClick={() => onViewCorrespondence?.(reply.id)}
                data-testid={`button-view-reply-${reply.id}`}
              >
                عرض الرد
                <ArrowLeft className="w-3 h-3 mr-1" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {canEdit && (
        <div className="flex items-center gap-2 p-2 rounded-lg border border-amber-300 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20">
          <RotateCcw className="w-4 h-4 text-amber-600" />
          <span className="text-sm text-amber-700 dark:text-amber-300">أعيدت للتعديل</span>
          {!isEditing && (
            <Button variant="outline" size="sm" onClick={startEditing} data-testid="button-edit-correspondence" className="mr-auto">
              <Pencil className="w-4 h-4 ml-1" />
              تعديل
            </Button>
          )}
        </div>
      )}

      <div className="rounded-lg border p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-6 text-sm">
          {detail.type === "external_incoming" ? (
            <>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground shrink-0">الجهة المرسلة:</span>
                <span className="font-medium">{detail.externalEntity || "-"}</span>
              </div>
              {detail.externalRefNumber && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground shrink-0">عدد الكتاب:</span>
                  <span className="font-medium font-mono" data-testid="text-corr-ref">{detail.externalRefNumber}</span>
                </div>
              )}
              {detail.externalDate && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground shrink-0">تاريخ الكتاب:</span>
                  <span className="font-medium">{new Date(detail.externalDate).toLocaleDateString("ar-IQ")}</span>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground shrink-0">الجهة المرسلة:</span>
                <span className="font-medium">{derivedSenderName || "-"}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground shrink-0">الجهة المستلمة:</span>
                <span className="font-medium">{receiverDept?.name || detail.externalEntity || "-"}</span>
              </div>
              {detail.referenceNumber && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground shrink-0">العدد:</span>
                  <span className="font-medium" data-testid="text-corr-ref">{detail.referenceNumber}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground shrink-0">التاريخ:</span>
                <span className="font-medium">
                  {detail.issuedAt
                    ? new Date(detail.issuedAt).toLocaleDateString("ar-IQ", { day: "numeric", month: "numeric", year: "numeric" })
                    : new Date(detail.createdAt).toLocaleDateString("ar-IQ", { day: "numeric", month: "numeric", year: "numeric" })}
                </span>
              </div>
            </>
          )}
          {isEditing ? (
            <div className="sm:col-span-2 flex items-center gap-2">
              <span className="text-muted-foreground shrink-0">الموضوع:</span>
              <Input
                value={editSubject}
                onChange={e => setEditSubject(e.target.value)}
                className="font-bold"
                data-testid="input-edit-subject"
              />
            </div>
          ) : (
            <div className="sm:col-span-2 flex items-start gap-2">
              <span className="text-muted-foreground shrink-0">الموضوع:</span>
              <span className="font-bold" data-testid="text-corr-detail-subject">{detail.subject}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground shrink-0">الأولوية:</span>
            <Badge variant="secondary" className={`text-xs ${priorityColors[detail.priority || "medium"]}`}>
              {priorityLabels[detail.priority || "medium"]}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground shrink-0">نوع المراسلة:</span>
            <Badge variant="secondary" className={`text-xs ${displayType.color}`}>
              {displayType.label}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground shrink-0">الحالة:</span>
            <Badge variant="secondary" className={`text-xs ${displayStatus.color}`}>
              {displayStatus.label}
            </Badge>
            {detail.confidentiality && detail.confidentiality !== "normal" && (
              <Badge variant="secondary" className={`text-xs ${confidentialityColors[detail.confidentiality]}`}>
                <Shield className="w-3 h-3 ml-1" />
                {confidentialityLabels[detail.confidentiality]}
              </Badge>
            )}
          </div>
          {showCurrentDept && !isReceiverView && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground shrink-0">الجهة الحالية:</span>
              <Badge variant="outline" className="text-xs">{currentDept!.name}</Badge>
            </div>
          )}
          {detail.externalEntity && (isExtOutgoing || detail.type === "external_incoming") && !(detail.type === "external_incoming" && isReceiverView) && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground shrink-0">{detail.type === "external_incoming" ? "الجهة المرسلة:" : "الجهة الخارجية:"}</span>
              <span className="font-medium">{detail.externalEntity}</span>
            </div>
          )}
          {detail.type === "external_incoming" && detail.externalRefNumber && !isReceiverView && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground shrink-0">عدد الكتاب الخارجي:</span>
              <span className="font-medium font-mono">{detail.externalRefNumber}</span>
            </div>
          )}
          {detail.type === "external_incoming" && detail.externalDate && !isReceiverView && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground shrink-0">تاريخ الكتاب الخارجي:</span>
              <span className="font-medium">{new Date(detail.externalDate).toLocaleDateString("ar-IQ")}</span>
            </div>
          )}
        </div>
      </div>

      {!isReceiverView && (detail.type === "internal_outgoing" || detail.type === "external_outgoing") && detail.status !== "draft" && (
        <div className="flex items-center gap-2">
          {!showAddFollowup ? (
            <Button
              variant="outline"
              size="sm"
              className="text-amber-600 border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/20"
              onClick={() => setShowAddFollowup(true)}
              data-testid="button-add-followup"
            >
              <CalendarDays className="w-4 h-4 ml-1" />
              تعيين متابعة
            </Button>
          ) : (
            <div className="flex items-center gap-2 p-2 bg-amber-50/50 dark:bg-amber-950/10 rounded-lg border border-amber-200 dark:border-amber-800">
              <Input
                type="number"
                min="1"
                value={addFollowupDays}
                onChange={e => setAddFollowupDays(e.target.value)}
                placeholder="عدد الأيام"
                className="w-24 h-8 text-sm"
                data-testid="input-add-followup-days"
              />
              <Button
                size="sm"
                className="h-8"
                disabled={!addFollowupDays || addFollowupMutation.isPending}
                onClick={() => addFollowupMutation.mutate({ days: parseInt(addFollowupDays) })}
                data-testid="button-confirm-add-followup"
              >
                {addFollowupMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "تأكيد"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8"
                onClick={() => { setShowAddFollowup(false); setAddFollowupDays(""); }}
                data-testid="button-cancel-add-followup"
              >
                إلغاء
              </Button>
            </div>
          )}
        </div>
      )}

      {detail.sendToAll && (
        <div className="flex items-center gap-2 text-sm">
          <Badge variant="secondary" className="text-xs bg-chart-2/10 text-chart-2">تعميم لجميع الجهات</Badge>
        </div>
      )}

      {isEditing ? (
        <div className="space-y-4 rounded-lg border p-4">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Pencil className="w-4 h-4" />
            تعديل المراسلة (أعيدت للتعديل)
          </h4>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">الأولوية</Label>
              <Select value={editPriority} onValueChange={setEditPriority}>
                <SelectTrigger data-testid="select-edit-priority"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">منخفض</SelectItem>
                  <SelectItem value="medium">متوسط</SelectItem>
                  <SelectItem value="high">مرتفع</SelectItem>
                  <SelectItem value="urgent">عاجل</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">السرية</Label>
              <Select value={editConfidentiality} onValueChange={setEditConfidentiality}>
                <SelectTrigger data-testid="select-edit-confidentiality"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">عادي</SelectItem>
                  <SelectItem value="confidential">سري</SelectItem>
                  <SelectItem value="top_secret">سري للغاية</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {detail.type === "internal_outgoing" && (
            <div className="space-y-1">
              <Label className="text-xs">الجهة المستلمة</Label>
              <Select value={editReceiverDeptId?.toString() || ""} onValueChange={v => setEditReceiverDeptId(parseInt(v))}>
                <SelectTrigger data-testid="select-edit-receiver"><SelectValue placeholder="اختر الجهة المستلمة" /></SelectTrigger>
                <SelectContent>
                  {centralDepartments.filter(d => d.id !== detail.senderDepartmentId).map(d => (
                    <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {detail.type === "external_outgoing" && (
            <div className="space-y-1">
              <Label className="text-xs">الجهة الخارجية</Label>
              <Input
                value={editExternalEntity}
                onChange={e => setEditExternalEntity(e.target.value)}
                placeholder="اسم الجهة الخارجية"
                data-testid="input-edit-external-entity"
              />
            </div>
          )}

          <div className="space-y-1">
            <Label className="text-xs">المحتوى</Label>
            <RichTextEditor
              value={editContent}
              onChange={setEditContent}
              minHeight="160px"
              testId="input-edit-content"
            />
          </div>

          {detail.type === "internal_outgoing" && (
            <div className="space-y-3 p-3 rounded-lg border bg-muted/30">
              <div className="flex items-center justify-between">
                <span className="font-medium text-xs">نسخة إلى (اختياري)</span>
                <Button type="button" variant="outline" size="sm" onClick={() => setEditCcList(prev => [...prev, { departmentId: 0, reason: "" }])} data-testid="button-edit-add-cc">
                  <Plus className="w-3 h-3 ml-1" />
                  إضافة
                </Button>
              </div>
              {editCcList.map((cc, idx) => (
                <div key={idx} className="flex items-start gap-2 p-2 bg-background rounded-md border">
                  <div className="flex-1 space-y-1">
                    <Select value={cc.departmentId ? cc.departmentId.toString() : ""} onValueChange={v => setEditCcList(prev => prev.map((c, i) => i === idx ? { ...c, departmentId: parseInt(v) } : c))}>
                      <SelectTrigger data-testid={`select-edit-cc-dept-${idx}`}><SelectValue placeholder="اختر الجهة" /></SelectTrigger>
                      <SelectContent>
                        {centralDepartments.filter(d => d.id !== detail.senderDepartmentId && d.id !== editReceiverDeptId && !editCcList.some((c, ci) => ci !== idx && c.departmentId === d.id)).map(d => (
                          <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder="سبب إرسال النسخة (إلزامي)"
                      value={cc.reason}
                      onChange={e => setEditCcList(prev => prev.map((c, i) => i === idx ? { ...c, reason: e.target.value } : c))}
                      className={cc.departmentId && !cc.reason.trim() ? "border-destructive text-xs" : "text-xs"}
                      data-testid={`input-edit-cc-reason-${idx}`}
                    />
                  </div>
                  <Button type="button" variant="ghost" size="icon" className="shrink-0" onClick={() => setEditCcList(prev => prev.filter((_, i) => i !== idx))} data-testid={`button-edit-remove-cc-${idx}`}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {detail.type === "external_outgoing" && (
            <div className="space-y-3 p-3 rounded-lg border bg-muted/30">
              <div className="flex items-center justify-between">
                <span className="font-medium text-xs">نسخة عنه (خارجي)</span>
                <Button type="button" variant="outline" size="sm" onClick={() => setEditExternalCcList(prev => [...prev, { entityName: "", reason: "" }])} data-testid="button-edit-add-ext-cc">
                  <Plus className="w-3 h-3 ml-1" />
                  إضافة
                </Button>
              </div>
              {editExternalCcList.map((ecc, idx) => (
                <div key={idx} className="flex items-start gap-2 p-2 bg-background rounded-md border">
                  <div className="flex-1 space-y-1">
                    <Input
                      value={ecc.entityName}
                      onChange={e => setEditExternalCcList(prev => prev.map((c, i) => i === idx ? { ...c, entityName: e.target.value } : c))}
                      placeholder="اسم الجهة الخارجية"
                      data-testid={`input-edit-ext-cc-entity-${idx}`}
                    />
                    <Input
                      placeholder="سبب إرسال النسخة (إلزامي)"
                      value={ecc.reason}
                      onChange={e => setEditExternalCcList(prev => prev.map((c, i) => i === idx ? { ...c, reason: e.target.value } : c))}
                      className={(ecc.entityName || "").trim() && !(ecc.reason || "").trim() ? "border-destructive text-xs" : "text-xs"}
                      data-testid={`input-edit-ext-cc-reason-${idx}`}
                    />
                  </div>
                  <Button type="button" variant="ghost" size="icon" className="shrink-0" onClick={() => setEditExternalCcList(prev => prev.filter((_, i) => i !== idx))} data-testid={`button-edit-remove-ext-cc-${idx}`}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {detail.type === "external_outgoing" && (
            <div className="space-y-3 p-3 rounded-lg border bg-muted/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <EyeOff className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium text-xs">نسخة مخفية عنه (اختياري)</span>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => setEditHiddenCcList(prev => [...prev, { departmentId: 0, reason: "" }])} data-testid="button-edit-add-hidden-cc">
                  <Plus className="w-3 h-3 ml-1" />
                  إضافة
                </Button>
              </div>
              {editHiddenCcList.map((hcc, idx) => (
                <div key={idx} className="flex items-start gap-2 p-2 bg-background rounded-md border">
                  <div className="flex-1 space-y-1">
                    <Select value={hcc.departmentId ? hcc.departmentId.toString() : ""} onValueChange={v => setEditHiddenCcList(prev => prev.map((c, i) => i === idx ? { ...c, departmentId: parseInt(v) } : c))}>
                      <SelectTrigger data-testid={`select-edit-hidden-cc-dept-${idx}`}><SelectValue placeholder="اختر القسم" /></SelectTrigger>
                      <SelectContent>
                        {centralDepartments.filter(d => d.id !== detail.senderDepartmentId && d.id !== editReceiverDeptId && !editHiddenCcList.some((c, ci) => ci !== idx && c.departmentId === d.id)).map(d => (
                          <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder="سبب إرسال النسخة (إلزامي)"
                      value={hcc.reason}
                      onChange={e => setEditHiddenCcList(prev => prev.map((c, i) => i === idx ? { ...c, reason: e.target.value } : c))}
                      className={hcc.departmentId && !hcc.reason.trim() ? "border-destructive text-xs" : "text-xs"}
                      data-testid={`input-edit-hidden-cc-reason-${idx}`}
                    />
                  </div>
                  <Button type="button" variant="ghost" size="icon" className="shrink-0" onClick={() => setEditHiddenCcList(prev => prev.filter((_, i) => i !== idx))} data-testid={`button-edit-remove-hidden-cc-${idx}`}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-1">
            <Label className="text-xs">ملاحظات (اختياري)</Label>
            <Textarea
              value={editNotes}
              onChange={e => setEditNotes(e.target.value)}
              placeholder="ملاحظات إضافية"
              className="min-h-[60px] text-sm"
              data-testid="input-edit-notes"
            />
          </div>

          <div className="space-y-3 p-3 rounded-lg border bg-muted/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium text-xs">المرفقات</span>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => editFileInputRef.current?.click()} data-testid="button-edit-add-attachment">
                <Upload className="w-3 h-3 ml-1" />
                إضافة مرفق
              </Button>
              <input type="file" ref={editFileInputRef} className="hidden" onChange={handleEditAttachment} multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.rtf,.mp4,.mpeg,.webm,.avi,.mov,.mp3,.wav,.ogg,.zip,.rar,.7z" />
            </div>
            {(existingAttachments || []).map((att: any) => (
              <div key={att.id} className="flex items-center gap-2 p-2 bg-background rounded-md border">
                <Paperclip className="w-3 h-3 text-muted-foreground shrink-0" />
                <span className="text-xs truncate flex-1">{att.originalName || att.fileName}</span>
                <span className="text-xs text-muted-foreground">{att.description}</span>
                <Button type="button" variant="ghost" size="icon" className="shrink-0 h-6 w-6" onClick={() => deleteExistingAttachment(att.id)} data-testid={`button-edit-remove-existing-att-${att.id}`}>
                  <Trash2 className="w-3 h-3 text-destructive" />
                </Button>
              </div>
            ))}
            {editAttachments.map((att, idx) => (
              <div key={`new-${idx}`} className="flex items-start gap-2 p-2 bg-background rounded-md border border-green-200">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">جديد</Badge>
                    <span className="text-xs truncate">{att.file.name}</span>
                    <span className="text-xs text-muted-foreground">({(att.file.size / 1024).toFixed(1)} KB)</span>
                  </div>
                  <Input
                    placeholder="وصف المرفق (إلزامي)"
                    value={att.description}
                    onChange={e => setEditAttachments(prev => prev.map((a, i) => i === idx ? { ...a, description: e.target.value } : a))}
                    className={!att.description.trim() ? "border-destructive text-xs" : "text-xs"}
                    data-testid={`input-edit-new-att-desc-${idx}`}
                  />
                </div>
                <Button type="button" variant="ghost" size="icon" className="shrink-0" onClick={() => setEditAttachments(prev => prev.filter((_, i) => i !== idx))} data-testid={`button-edit-remove-new-att-${idx}`}>
                  <Trash2 className="w-3 h-3 text-destructive" />
                </Button>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              disabled={editMutation.isPending || isUploadingEdit || !editSubject.trim() || editAttachments.some(a => !a.description.trim())}
              onClick={() => {
                const payload: any = {
                  subject: editSubject,
                  content: editContent,
                  priority: editPriority,
                  confidentiality: editConfidentiality,
                  notes: editNotes,
                  reminderDate: editReminderDate ? new Date(editReminderDate).toISOString() : null,
                };
                if (detail.type === "internal_outgoing") {
                  if (editReceiverDeptId) payload.receiverDepartmentId = editReceiverDeptId;
                  payload.ccList = editCcList.filter(c => c.departmentId > 0);
                }
                if (detail.type === "external_outgoing") {
                  if (editExternalEntity.trim()) payload.externalEntity = editExternalEntity;
                  payload.externalCcList = editExternalCcList.filter(c => (c.entityName || "").trim());
                  payload.hiddenCcList = editHiddenCcList.filter(c => c.departmentId > 0);
                }
                editMutation.mutate(payload);
              }}
              data-testid="button-save-edit"
            >
              {(editMutation.isPending || isUploadingEdit) && <Loader2 className="w-4 h-4 ml-1 animate-spin" />}
              {isUploadingEdit ? "جاري رفع المرفقات..." : "حفظ التعديلات"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setIsEditing(false); setEditAttachments([]); }} data-testid="button-cancel-edit">
              إلغاء
            </Button>
          </div>
        </div>
      ) : detail.content && detail.type !== "external_incoming" ? (
        <div className="rounded-lg border p-4">
          <h4 className="text-sm font-medium mb-2">المحتوى</h4>
          <div className="min-h-[120px] rounded-md border bg-muted/20 p-4">
            <div className="text-sm prose prose-sm max-w-none rte-content" dir="rtl" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(detail.content, SANITIZE_CONFIG) }} />
          </div>
        </div>
      ) : null}

      <CorrespondenceAttachmentsView corrId={corrId} isScannedDocument={detail.type === "external_incoming"} />

      {finalSigner ? (
        <div className="rounded-lg border p-4">
          <h4 className="text-sm font-medium mb-3">{isReceiverView ? "توقيع الجهة المرسلة" : "التوقيع الإلكتروني"}</h4>
          <div className="flex items-center gap-4">
            {finalSigner.employee.signatureUrl && (
              <div className="p-2 rounded border border-dashed border-primary/30 bg-primary/5">
                <img src={finalSigner.employee.signatureUrl} alt="التوقيع" className="max-h-16 object-contain" data-testid="img-sender-signature" />
              </div>
            )}
            <div className="text-sm space-y-1">
              <p className="font-medium">{finalSigner.employee.fullName}</p>
              {finalSigner.employee.jobTitle && (
                <p className="text-xs text-muted-foreground">{finalSigner.employee.jobTitle}</p>
              )}
              <p className="text-xs text-muted-foreground">
                {new Date(finalSigner.event.createdAt).toLocaleDateString("ar-IQ", { day: "numeric", month: "numeric", year: "numeric" })}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {detail.ccs && detail.ccs.filter((cc: any) => !cc.isHidden).length > 0 && (
        <div className="rounded-lg border p-4">
          <h4 className="text-sm font-medium mb-3">نسخة إلى</h4>
          <div className="space-y-2">
            {detail.ccs.filter((cc: any) => !cc.isHidden).map((cc: any) => {
              const dept = departments.find(d => d.id === cc.departmentId);
              return (
                <div key={cc.id} className="flex items-center gap-3 p-2 bg-muted/30 rounded-md text-sm" data-testid={`cc-item-${cc.id}`}>
                  <Badge variant="outline" className="text-xs shrink-0">{dept?.name || `قسم ${cc.departmentId}`}</Badge>
                  <div className="flex-1 min-w-0 text-xs text-muted-foreground border-r pr-3">
                    {cc.reason ? cc.reason : <span className="italic">بدون سبب</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {detail._isInSenderChain && detail.ccs && detail.ccs.filter((cc: any) => cc.isHidden).length > 0 && (
        <div className="rounded-lg border p-4">
          <h4 className="text-sm font-medium mb-3">نسخة مخفية</h4>
          <div className="space-y-2">
            {detail.ccs.filter((cc: any) => cc.isHidden).map((cc: any) => {
              const dept = departments.find(d => d.id === cc.departmentId);
              return (
                <div key={cc.id} className="flex items-center gap-3 p-2 bg-muted/30 rounded-md text-sm" data-testid={`hidden-cc-item-${cc.id}`}>
                  <Badge variant="outline" className="text-xs shrink-0">{dept?.name || `قسم ${cc.departmentId}`}</Badge>
                  <div className="flex-1 min-w-0 text-xs text-muted-foreground border-r pr-3">
                    {cc.reason ? cc.reason : <span className="italic">بدون سبب</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {detail.externalCcs && detail.externalCcs.length > 0 && (
        <div className="rounded-lg border p-4">
          <h4 className="text-sm font-medium mb-3">نسخة إلى (جهات خارجية)</h4>
          <div className="space-y-2">
            {detail.externalCcs.map((ecc: any) => (
              <div key={ecc.id} className="flex items-center gap-3 p-2 bg-muted/30 rounded-md text-sm" data-testid={`ext-cc-item-${ecc.id}`}>
                <Globe className="w-4 h-4 text-muted-foreground shrink-0" />
                <Badge variant="outline" className="text-xs shrink-0">{ecc.entityName || "جهة خارجية"}</Badge>
                <div className="flex-1 min-w-0 text-xs text-muted-foreground border-r pr-3">
                  {ecc.reason ? ecc.reason : <span className="italic">بدون سبب</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-lg border p-4">
        <h4 className="text-sm font-medium mb-3">{isReceiverView ? "مسار الإجراءات" : "سلسلة الإجراءات"}</h4>
        <WorkflowTimeline corrId={corrId} departments={departments} employees={employees} isInSenderChain={detail._isInSenderChain} userDepartmentId={user?.departmentId} />
      </div>

      <ContributorsBlock corr={detail} departments={departments} />

      <ContributionsSection corrId={corrId} corr={detail} departments={departments} />

      <WorkflowActionPanel corr={detail} departments={departments} employees={employees} workflowEvents={wfEvents || []} onReply={onReply} />

      {(detail.type === "internal_outgoing" || detail.type === "external_outgoing") &&
        detail.status !== "cancelled" && detail.status !== "archived" &&
        (detail.currentDepartmentId === user?.departmentId || user?.role === "admin") &&
        !isReceiverView && (
        <CancelCorrespondenceButton corrId={corrId} corr={detail} />
      )}

      

      {!detail.closedAt && detail.status !== "cancelled" && detail.status !== "draft" && user?.role !== "central_mail" && (() => {
        const isOutgoing = detail.type === "internal_outgoing" || detail.type === "external_outgoing";
        if (isOutgoing) {
          if (detail.issuedAt || detail.referenceNumber) return false;
          return detail.currentDepartmentId === user?.departmentId || user?.role === "admin";
        }
        return true;
      })() && (
        <CloseCorrespondenceButton corrId={corrId} corr={detail} />
      )}

      {detail.closedAt && (
        <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20 p-4 text-center">
          <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs">
            تم إغلاق المراسلة بتاريخ {new Date(detail.closedAt).toLocaleDateString("ar-SA")}
          </Badge>
        </div>
      )}

      {detail.status === "archived" && !detail.issuedAt && !detail.referenceNumber &&
       (detail.type === "internal_outgoing" || detail.type === "external_outgoing") &&
       detail.closedById === user?.id && (
        <DeleteArchivedDraftButton corrId={corrId} subject={detail.subject} onDeleted={onClose} />
      )}
    </div>
  );
}

function DeleteArchivedDraftButton({ corrId, subject, onDeleted }: { corrId: number; subject: string; onDeleted: () => void }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", `/api/correspondence/${corrId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/correspondence"] });
      toast({ title: "تم الحذف", description: "تم حذف المسودة المؤرشفة نهائياً" });
      setOpen(false);
      onDeleted();
    },
    onError: (err: any) => {
      toast({ title: "خطأ", description: err.message || "حدث خطأ في الحذف", variant: "destructive" });
    },
  });

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm" className="w-full" data-testid="button-delete-archived-draft">
          <Trash2 className="w-4 h-4 ml-2" />
          حذف نهائي
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>حذف المسودة المؤرشفة نهائياً</AlertDialogTitle>
          <AlertDialogDescription>
            هل أنت متأكد من حذف المراسلة "{subject}" نهائياً؟ لا يمكن التراجع عن هذا الإجراء.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex gap-2">
          <AlertDialogCancel>إلغاء</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={(e) => { e.preventDefault(); deleteMutation.mutate(); }}
            disabled={deleteMutation.isPending}
            data-testid="button-confirm-delete-draft"
          >
            {deleteMutation.isPending ? "جاري الحذف..." : "حذف نهائي"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function CancelCorrespondenceButton({ corrId, corr }: { corrId: number; corr: any }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [deleteRequestOpen, setDeleteRequestOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const { toast } = useToast();

  const isIssuedWithRef = corr.referenceNumber && corr.issuedAt;

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/correspondence/${corrId}/cancel`, { reason });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "تم إلغاء المراسلة بنجاح" });
      queryClient.invalidateQueries({ queryKey: ["/api/correspondence"] });
      queryClient.invalidateQueries({ queryKey: ["/api/correspondence", corrId] });
      setOpen(false);
      setReason("");
    },
    onError: (error: any) => {
      toast({ title: error.message || "حدث خطأ في إلغاء المراسلة", variant: "destructive" });
    },
  });

  const deleteRequestMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/correspondence/${corrId}/request-deletion`, { reason: deleteReason });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "تم إرسال طلب الحذف إلى مدير النظام بنجاح" });
      setDeleteRequestOpen(false);
      setDeleteReason("");
    },
    onError: (error: any) => {
      const msg = error.message?.match(/\{.*\}/);
      const parsed = msg ? JSON.parse(msg[0]).message : error.message;
      toast({ title: parsed || "حدث خطأ في إرسال طلب الحذف", variant: "destructive" });
    },
  });

  return (
    <>
      <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
        <h4 className="text-sm font-medium mb-2 text-destructive">إلغاء المراسلة</h4>
        {isIssuedWithRef ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              لا يمكن إلغاء هذه المراسلة لأنها حصلت على توقيع نهائي. يمكنك إرسال طلب حذف إلى مدير النظام.
            </p>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setDeleteRequestOpen(true)}
              data-testid="button-request-deletion"
            >
              <Trash2 className="w-4 h-4 ml-2" />
              طلب حذف المراسلة
            </Button>
          </div>
        ) : (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setOpen(true)}
            data-testid="button-cancel-correspondence"
          >
            <Ban className="w-4 h-4 ml-2" />
            إلغاء المراسلة
          </Button>
        )}
      </div>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد إلغاء المراسلة</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من إلغاء هذه المراسلة؟ لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="my-2">
            <Label className="text-sm">سبب الإلغاء (اختياري)</Label>
            <Textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="أدخل سبب الإلغاء..."
              className="mt-1"
              data-testid="input-cancel-reason"
            />
          </div>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>تراجع</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cancelMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={cancelMutation.isPending}
              data-testid="button-confirm-cancel"
            >
              {cancelMutation.isPending ? "جارٍ الإلغاء..." : "تأكيد الإلغاء"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={deleteRequestOpen} onOpenChange={setDeleteRequestOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>طلب حذف المراسلة</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم إرسال طلب حذف إلى مدير النظام للموافقة عليه. يرجى ذكر سبب الحذف.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="my-2">
            <Label className="text-sm">سبب الحذف (مطلوب)</Label>
            <Textarea
              value={deleteReason}
              onChange={e => setDeleteReason(e.target.value)}
              placeholder="أدخل سبب طلب الحذف..."
              className="mt-1"
              data-testid="input-deletion-request-reason"
            />
          </div>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>تراجع</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteRequestMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteRequestMutation.isPending || !deleteReason.trim()}
              data-testid="button-confirm-deletion-request"
            >
              {deleteRequestMutation.isPending ? "جارٍ الإرسال..." : "إرسال طلب الحذف"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function CloseCorrespondenceButton({ corrId, corr }: { corrId: number; corr: any }) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const { toast } = useToast();
  const { user } = useAuth();

  const closeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/correspondence/${corrId}/close`, { notes });
      return res.json();
    },
    onSuccess: () => {
      const isInc = corr.type === "external_incoming" || corr.type === "internal_incoming";
      toast({ title: isInc ? "تم حفظ المراسلة بنجاح" : "تم إغلاق المراسلة بنجاح" });
      queryClient.invalidateQueries({ queryKey: ["/api/correspondence"] });
      queryClient.invalidateQueries({ queryKey: ["/api/correspondence", corrId] });
      queryClient.invalidateQueries({ queryKey: ["/api/correspondence", corrId, "workflow"] });
      setOpen(false);
      setNotes("");
    },
    onError: (error: any) => {
      toast({ title: error.message || "حدث خطأ", variant: "destructive" });
    },
  });

  const isCreator = user?.id === corr.createdById;
  const isAdmin = user?.role === "admin";
  const isIncoming = corr.type === "external_incoming" || corr.type === "internal_incoming";
  const isReceiverDept = corr.receiverDepartmentId === user?.departmentId;
  const isCurrentDept = corr.currentDepartmentId === user?.departmentId;
  const isAssignedDept = corr.assignments?.some((a: any) => a.departmentId === user?.departmentId);
  const canClose = isCreator || isAdmin || (isIncoming && (isReceiverDept || isCurrentDept || isAssignedDept));
  if (!canClose) return null;

  const closeLabel = isIncoming ? "حفظ المراسلة الواردة" : "إغلاق المراسلة وأرشفتها";
  const closeDescription = isIncoming
    ? "عند الحفظ، تنتقل المراسلة للأرشيف ولا يمكن تعديلها."
    : "عند الإغلاق، تنتقل المراسلة للأرشيف ولا يمكن تعديلها.";
  const closeButtonLabel = isIncoming ? "حفظ" : "إغلاق وأرشفة";

  return (
    <>
      <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20 p-4">
        <h4 className="text-sm font-medium mb-2 text-green-700 dark:text-green-300">{closeLabel}</h4>
        <p className="text-xs text-muted-foreground mb-2">{closeDescription}</p>
        <Button
          variant="outline"
          size="sm"
          className="border-green-300 text-green-700 hover:bg-green-100"
          onClick={() => setOpen(true)}
          data-testid="button-close-correspondence"
        >
          <Archive className="w-4 h-4 ml-2" />
          {closeButtonLabel}
        </Button>
      </div>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>{isIncoming ? "تأكيد حفظ المراسلة" : "تأكيد إغلاق المراسلة"}</AlertDialogTitle>
            <AlertDialogDescription>
              {isIncoming ? "سيتم حفظ المراسلة الواردة ونقلها للأرشيف. هل أنت متأكد؟" : "سيتم إغلاق المراسلة ونقلها للأرشيف. هل أنت متأكد؟"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="my-2">
            <Label className="text-sm">{isIncoming ? "ملاحظات الحفظ (اختياري)" : "ملاحظات الإغلاق (اختياري)"}</Label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder={isIncoming ? "أدخل ملاحظات الحفظ..." : "أدخل ملاحظات الإغلاق..."}
              className="mt-1"
              data-testid="input-close-notes"
            />
          </div>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>تراجع</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => closeMutation.mutate()}
              disabled={closeMutation.isPending}
              data-testid="button-confirm-close"
            >
              {closeMutation.isPending ? (isIncoming ? "جارٍ الحفظ..." : "جارٍ الإغلاق...") : (isIncoming ? "تأكيد الحفظ" : "تأكيد الإغلاق")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function deriveSenderName(item: any, departments: Department[], orgName?: string, allFlowTemplates?: any[]): string {
  const isExtOutgoing = item.type === "external_outgoing";
  if (isExtOutgoing) return orgName || "";
  if (item.senderDepartmentId) {
    const dept = departments.find(d => d.id === item.senderDepartmentId);
    if (dept) return dept.name;
  }
  if (item.flowTemplateId && item.flowTemplateGroupId && allFlowTemplates) {
    const tmpl = allFlowTemplates.find((t: any) => t.id === item.flowTemplateId);
    if (tmpl) {
      const grp = tmpl.groups?.find((g: any) => g.id === item.flowTemplateGroupId);
      if (grp && grp.accounts && grp.accounts.length > 0) {
        const topDeptId = grp.accounts[grp.accounts.length - 1];
        const topDept = departments.find(d => d.id === topDeptId);
        if (topDept?.isCentral) return topDept.name;
      }
    }
  }
  return "";
}

function CorrespondenceCard({ item, selected, onClick, departments, orgName, isUnread, allFlowTemplates, isInboxView }: {
  item: Correspondence;
  selected: boolean;
  onClick: () => void;
  departments: Department[];
  orgName?: string;
  isUnread?: boolean;
  allFlowTemplates?: any[];
  isInboxView?: boolean;
}) {
  const senderName = deriveSenderName(item, departments, orgName, allFlowTemplates);
  const receiverDept = departments.find(d => d.id === item.receiverDepartmentId);
  const isExtOutgoing = item.type === "external_outgoing";

  const cardTypeLabel = isInboxView
    ? (item.type === "internal_outgoing" ? "وارد داخلي" : item.type === "external_outgoing" ? "وارد خارجي" : typeLabels[item.type])
    : typeLabels[item.type];
  const cardTypeColor = isInboxView
    ? (item.type === "internal_outgoing" ? typeColors["internal_incoming"] : item.type === "external_outgoing" ? typeColors["external_incoming"] : typeColors[item.type])
    : typeColors[item.type];
  const isOutgoing = item.type === "internal_outgoing" || item.type === "external_outgoing";
  const isIncoming = !isOutgoing;
  const cardStatusLabel = isInboxView && item.status === "in_progress" ? "مستلمة" : (() => {
    if (!isInboxView && isOutgoing && ((item as any).issuedAt || item.referenceNumber)) return "صدر";
    if (!isInboxView && isOutgoing && !((item as any).issuedAt) && !item.referenceNumber && item.status === "archived") return "مسودة مؤرشفة";
    if (isIncoming && item.status === "archived") return "حفظ";
    if (isInboxView && item.status === "archived") return "حفظ";
    return statusLabels[item.status || "draft"];
  })();
  const cardStatusColor = (() => {
    if (isInboxView && item.status === "in_progress") return "bg-chart-3/10 text-chart-3";
    if (!isInboxView && isOutgoing && ((item as any).issuedAt || item.referenceNumber)) return statusColors["issued"];
    if (!isInboxView && isOutgoing && !((item as any).issuedAt) && !item.referenceNumber && item.status === "archived") return statusColors["archived"];
    return statusColors[item.status || "draft"];
  })();

  return (
    <Card
      className={`p-4 hover-elevate transition-all duration-150 cursor-pointer ${selected ? 'ring-2 ring-primary' : ''} ${isUnread ? 'border-r-4 border-r-primary bg-primary/5' : ''}`}
      onClick={onClick}
      data-testid={`card-correspondence-${item.id}`}
    >
      <div className="flex items-start gap-4">
        <div className="relative">
          <div className={`w-10 h-10 rounded-md flex items-center justify-center shrink-0 ${cardTypeColor}`}>
            {isInboxView ? <ArrowDownRight className="w-5 h-5" /> : (item.type?.includes("incoming") ? <ArrowDownRight className="w-5 h-5" /> : <ArrowUpLeft className="w-5 h-5" />)}
          </div>
          {isUnread && (
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full animate-pulse" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <h3 className={`text-sm ${isUnread ? 'font-bold' : 'font-medium'}`}>{item.subject}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {item.referenceNumber || "بدون عدد"} - {cardTypeLabel}
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {isUnread && (
                <Badge className="text-xs bg-primary text-primary-foreground">
                  جديد
                </Badge>
              )}
              {item.confidentiality && item.confidentiality !== "normal" && (
                <Badge variant="secondary" className={`text-xs ${confidentialityColors[item.confidentiality]}`}>
                  <Shield className="w-3 h-3 ml-1" />
                  {confidentialityLabels[item.confidentiality]}
                </Badge>
              )}
              <Badge variant="secondary" className={`text-xs ${priorityColors[item.priority || "medium"]}`}>
                {priorityLabels[item.priority || "medium"]}
              </Badge>
              <Badge variant="secondary" className={`text-xs ${cardStatusColor}`}>
                {cardStatusLabel}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
            {senderName && <span>من: {senderName}</span>}
            {receiverDept && <span>إلى: {receiverDept.name}</span>}
            {item.externalEntity && <span className="font-medium">الجهة: {item.externalEntity}</span>}
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {item.createdAt ? new Date(item.createdAt).toLocaleDateString("ar-SA") : ""}
            </span>
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0 mt-2" />
      </div>
    </Card>
  );
}

function CorrespondenceList({ items, selectedId, onSelect, departments, emptyMessage, orgName, readMap, allFlowTemplates, isInboxView }: {
  items: Correspondence[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  departments: Department[];
  emptyMessage: string;
  orgName?: string;
  readMap?: Record<number, string>;
  allFlowTemplates?: any[];
  isInboxView?: boolean;
}) {
  if (items.length === 0) {
    return (
      <Card className="p-12">
        <div className="text-center text-muted-foreground">
          <Mail className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">{emptyMessage}</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {items.map(item => (
        <CorrespondenceCard
          key={item.id}
          item={item}
          selected={selectedId === item.id}
          onClick={() => onSelect(item.id)}
          departments={departments}
          orgName={orgName}
          isUnread={readMap ? !readMap[item.id] : undefined}
          allFlowTemplates={allFlowTemplates}
          isInboxView={isInboxView}
        />
      ))}
    </div>
  );
}

const SAFE_CSS_PROPS = new Set([
  "color", "background-color", "background",
  "border", "border-top", "border-right", "border-bottom", "border-left",
  "border-color", "border-width", "border-style", "border-collapse", "border-spacing",
  "padding", "padding-top", "padding-right", "padding-bottom", "padding-left",
  "margin", "margin-top", "margin-right", "margin-bottom", "margin-left",
  "text-align", "text-decoration", "text-indent", "text-transform",
  "font-weight", "font-size", "font-family", "font-style",
  "line-height", "letter-spacing", "white-space", "word-wrap", "word-break",
  "width", "height", "min-width", "max-width", "min-height", "max-height",
  "vertical-align", "table-layout",
  "display", "list-style", "list-style-type",
]);

const SAFE_DISPLAY_VALUES = new Set(["inline", "inline-block", "block", "table", "table-row", "table-cell", "list-item", "none"]);

function sanitizeStyle(style: string): string {
  return style
    .split(";")
    .map(rule => rule.trim())
    .filter(Boolean)
    .map(rule => {
      const idx = rule.indexOf(":");
      if (idx < 0) return null;
      const prop = rule.slice(0, idx).trim().toLowerCase();
      const val = rule.slice(idx + 1).trim();
      if (!SAFE_CSS_PROPS.has(prop)) return null;
      if (/url\s*\(|expression\s*\(|javascript:|@import|behavior\s*:|position\s*:/i.test(val)) return null;
      if (prop === "display" && !SAFE_DISPLAY_VALUES.has(val.toLowerCase())) return null;
      return `${prop}: ${val}`;
    })
    .filter(Boolean)
    .join("; ");
}

let domPurifyHookInstalled = false;
function ensureDomPurifyHook() {
  if (domPurifyHookInstalled) return;
  domPurifyHookInstalled = true;
  DOMPurify.addHook("uponSanitizeAttribute", (_node, data) => {
    if (data.attrName === "style") {
      data.attrValue = sanitizeStyle(data.attrValue || "");
      if (!data.attrValue) data.keepAttr = false;
    }
  });
}
ensureDomPurifyHook();

const SANITIZE_CONFIG: any = {
  ADD_TAGS: ["table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "colgroup", "col", "hr", "svg", "rect", "circle", "ellipse", "line", "polyline", "polygon", "path", "g", "text", "defs", "marker", "use"],
  ADD_ATTR: ["style", "target", "rel", "colspan", "rowspan", "align", "valign", "width", "height", "cellpadding", "cellspacing", "border", "viewBox", "fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "stroke-dasharray", "x", "y", "x1", "y1", "x2", "y2", "cx", "cy", "r", "rx", "ry", "d", "points", "transform", "preserveAspectRatio"],
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|data:image\/(?:png|jpe?g|gif|webp|svg\+xml));|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
};

interface CCEntry {
  departmentId: number;
  reason: string;
}

interface ExternalCCEntry {
  entityName: string;
  reason: string;
}

interface AttachmentEntry {
  file: File;
  description: string;
}

function ComposeSection({ departments, onCreated, replyContext, onClearReply, onViewParent }: {
  departments: Department[];
  onCreated: () => void;
  replyContext?: ReplyContext | null;
  onClearReply?: () => void;
  onViewParent?: (id: number) => void;
}) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [composeType, setComposeType] = useState<"internal_outgoing" | "external_outgoing" | "external_incoming" | null>(null);
  const [selectedFlowTemplateId, setSelectedFlowTemplateId] = useState<number | null>(null);
  const [receiverMode, setReceiverMode] = useState<"single" | "all">("single");
  const [ccList, setCcList] = useState<CCEntry[]>([]);
  const [externalCcList, setExternalCcList] = useState<ExternalCCEntry[]>([]);
  const [hiddenCcList, setHiddenCcList] = useState<CCEntry[]>([]);
  const [attachments, setAttachments] = useState<AttachmentEntry[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [followUpDays, setFollowUpDays] = useState("");
  const [reminderDate, setReminderDate] = useState("");
  const [autoElevate, setAutoElevate] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [entitySearch, setEntitySearch] = useState("");
  const [showEntityDropdown, setShowEntityDropdown] = useState(false);
  const [extCcSearch, setExtCcSearch] = useState<Record<number, string>>({});
  const [showExtCcDropdown, setShowExtCcDropdown] = useState<Record<number, boolean>>({});
  const [replyInitialized, setReplyInitialized] = useState(false);

  const { data: myFlowTemplates } = useQuery<any[]>({
    queryKey: ["/api/employees", user?.id, "flow-templates"],
    queryFn: async () => {
      if (!user?.id) return [];
      const res = await fetch(`/api/employees/${user.id}/flow-templates`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!user?.id && user?.role !== "admin",
  });

  const isCentralMail = user?.role === "central_mail";
  const canInternal = !isCentralMail && (user?.role === "admin" || (myFlowTemplates || []).some((ft: any) => ft.correspondenceType === "internal_outgoing"));
  const canExternal = !isCentralMail && (user?.role === "admin" || (myFlowTemplates || []).some((ft: any) => ft.correspondenceType === "external_outgoing"));
  const canExternalIncoming = isCentralMail || user?.role === "admin";

  const { data: authorizedReceivers } = useQuery<any[]>({
    queryKey: ["/api/employees/authorized-receivers"],
    enabled: canExternalIncoming,
  });
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<number | null>(null);

  const availableFlowTemplates = useMemo(() => {
    if (!myFlowTemplates || !composeType) return [];
    return myFlowTemplates.filter((ft: any) => ft.correspondenceType === composeType);
  }, [myFlowTemplates, composeType]);

  const { data: centralParent } = useQuery<Department>({
    queryKey: ["/api/departments", user?.departmentId, "central-parent"],
    queryFn: async () => {
      if (!user?.departmentId) return null;
      const res = await fetch(`/api/departments/${user.departmentId}/central-parent`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!user?.departmentId,
  });

  const { data: externalEntitiesData } = useQuery<ExternalEntity[]>({
    queryKey: ["/api/external-entities"],
  });

  const { data: publicSettings } = useQuery<any>({
    queryKey: ["/api/settings/public"],
  });

  const orgName = publicSettings?.orgName || "";

  const centralDepartments = useMemo(() => {
    return departments.filter(d => d.isCentral && d.isActive);
  }, [departments]);

  const userDept = useMemo(() => departments.find(d => d.id === user?.departmentId), [departments, user?.departmentId]);
  const isCentralUser = userDept?.isCentral === true;
  const canFinalSignOnCreate = isCentralUser && (composeType === "internal_outgoing" || composeType === "external_outgoing");

  const availableReceiverDepts = useMemo(() => {
    return centralDepartments.filter(d => d.id !== centralParent?.id);
  }, [centralDepartments, centralParent]);

  const form = useForm<any>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      subject: "",
      content: "",
      type: "internal_outgoing",
      priority: "medium",
      status: "draft",
      confidentiality: "normal",
      referenceNumber: "",
      externalEntity: "",
      notes: "",
      senderDepartmentId: undefined,
      receiverDepartmentId: undefined,
    },
  });

  useEffect(() => {
    if (centralParent?.id) {
      form.setValue("senderDepartmentId", centralParent.id);
    }
  }, [centralParent, form]);

  useEffect(() => {
    if (composeType === "external_outgoing" && centralParent?.id) {
      setHiddenCcList(prev => {
        if (prev.length > 0 && prev[0].departmentId === centralParent.id) return prev;
        return [{ departmentId: centralParent.id, reason: "للعلم و المتابعة" }, ...prev.filter(c => c.departmentId !== centralParent.id)];
      });
    }
  }, [composeType, centralParent]);

  useEffect(() => {
    setReplyInitialized(false);
  }, [replyContext?.parentCorrespondenceId]);

  const handleReplyTypeChange = (newType: "internal_outgoing" | "external_outgoing") => {
    setComposeType(newType);
    form.setValue("type", newType);
    setSelectedFlowTemplateId(null);
    if (myFlowTemplates) {
      const flowsForType = myFlowTemplates.filter((ft: any) => ft.correspondenceType === newType);
      if (flowsForType.length === 1) setSelectedFlowTemplateId(flowsForType[0].id);
    }
    if (newType === "internal_outgoing" && replyContext?.senderDepartmentId) {
      form.setValue("receiverDepartmentId", replyContext.senderDepartmentId);
    } else {
      form.setValue("receiverDepartmentId", null);
    }
    if (newType === "external_outgoing" && replyContext?.externalEntity) {
      form.setValue("externalEntity", replyContext.externalEntity);
    }
  };

  useEffect(() => {
    if (replyContext && !replyInitialized) {
      let defaultType: "internal_outgoing" | "external_outgoing";
      if (replyContext.parentType === "external_incoming" && canExternal) {
        defaultType = "external_outgoing";
      } else if (replyContext.parentType === "internal_outgoing" && canInternal) {
        defaultType = "internal_outgoing";
      } else {
        defaultType = canInternal ? "internal_outgoing" : (canExternal ? "external_outgoing" : "internal_outgoing");
      }
      setComposeType(defaultType);
      form.setValue("type", defaultType);
      form.setValue("subject", `رد: ${replyContext.parentSubject}`);
      form.setValue("priority", replyContext.priority as any);
      form.setValue("confidentiality", replyContext.confidentiality as any);
      if (defaultType === "internal_outgoing" && replyContext.senderDepartmentId) {
        form.setValue("receiverDepartmentId", replyContext.senderDepartmentId);
      }
      if (defaultType === "external_outgoing" && replyContext.externalEntity) {
        form.setValue("externalEntity", replyContext.externalEntity);
      }
      if (myFlowTemplates) {
        const flowsForType = myFlowTemplates.filter((ft: any) => ft.correspondenceType === defaultType);
        if (flowsForType.length === 1) setSelectedFlowTemplateId(flowsForType[0].id);
      }
      setReplyInitialized(true);
    }
  }, [replyContext, replyInitialized, form, myFlowTemplates, canInternal, canExternal]);

  const selectedReceiverId = form.watch("receiverDepartmentId");

  const availableCcDepts = useMemo(() => {
    const selectedIds = new Set(ccList.map(c => c.departmentId));
    return availableReceiverDepts.filter(d =>
      d.id !== selectedReceiverId && !selectedIds.has(d.id)
    );
  }, [availableReceiverDepts, selectedReceiverId, ccList]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const isExt = data.type === "external_outgoing";
      const payload: any = {
        ...data,
        sendToAll: receiverMode === "all",
        ccList: !isExt && receiverMode === "single" ? ccList : [],
        externalCcList: isExt ? externalCcList.filter(e => (e.entityName || "").trim()) : [],
        hiddenCcList: isExt ? hiddenCcList.filter(h => h.departmentId > 0) : [],
        reminderDate: reminderDate ? new Date(reminderDate).toISOString() : null,
        flowTemplateId: selectedFlowTemplateId,
        parentCorrespondenceId: replyContext?.parentCorrespondenceId || null,
      };
      if (!isExt && receiverMode === "all") {
        delete payload.receiverDepartmentId;
      }
      const res = await apiRequest("POST", "/api/correspondence", payload);
      return res.json();
    },
    onSuccess: async (newCorr: any) => {
      let failedUploads = 0;
      if (attachments.length > 0) {
        setIsUploading(true);
        for (const att of attachments) {
          try {
            const formData = new FormData();
            formData.append("file", att.file);
            formData.append("description", att.description);
            const uploadRes = await fetch(`/api/correspondence/${newCorr.id}/attachments`, {
              method: "POST",
              body: formData,
              credentials: "include",
            });
            if (!uploadRes.ok) failedUploads++;
          } catch (e) {
            failedUploads++;
          }
        }
        setIsUploading(false);
      }

      let followupFailed = false;
      if (followUpDays && parseInt(followUpDays) > 0) {
        try {
          await apiRequest("POST", `/api/correspondence/${newCorr.id}/add-followup`, { days: parseInt(followUpDays) });
        } catch (e: any) {
          followupFailed = true;
          console.error("Failed to add followup:", e);
          toast({ title: "تعذر تعيين المتابعة", description: e?.message || "يرجى تعيينها لاحقاً من قسم بانتظار التوقيع", variant: "destructive" });
        }
      }

      if (autoElevate && newCorr.flowTemplateGroupId && newCorr.status === "draft") {
        try {
          const ftRes = await fetch(`/api/flow-templates`, { credentials: "include" });
          if (ftRes.ok) {
            const allFts = await ftRes.json();
            const ft = allFts.find((t: any) => t.id === newCorr.flowTemplateId);
            const grp = ft?.groups?.find((g: any) => g.id === newCorr.flowTemplateGroupId);
            if (grp?.accounts?.length > 1) {
              const creatorDeptId = user?.departmentId;
              const creatorPos = grp.accounts.indexOf(creatorDeptId);
              if (creatorPos >= 0 && creatorPos < grp.accounts.length - 1) {
                const nextDeptId = grp.accounts[creatorPos + 1];
                await apiRequest("POST", `/api/correspondence/${newCorr.id}/workflow`, {
                  action: "elevate",
                  toStatus: "under_review",
                  fromDepartmentId: creatorDeptId,
                  toDepartmentId: nextDeptId,
                  marginNote: null,
                  notes: null,
                });
              }
            }
          }
        } catch (e) {
          console.error("Auto-elevate failed:", e);
        }
      }

      queryClient.invalidateQueries({ queryKey: ["/api/correspondence"] });
      queryClient.invalidateQueries({ queryKey: ["/api/external-entities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/correspondence/my-followups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/correspondence/deadline-alerts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/correspondence/overdue-reminders"] });
      if (replyContext?.parentCorrespondenceId) {
        queryClient.invalidateQueries({ queryKey: ["/api/correspondence", replyContext.parentCorrespondenceId] });
        queryClient.invalidateQueries({ queryKey: ["/api/correspondence", replyContext.parentCorrespondenceId, "workflow"] });
      }
      if (failedUploads > 0) {
        toast({ title: "تم إنشاء المراسلة", description: `فشل رفع ${failedUploads} مرفق(ات)`, variant: "destructive" });
      } else if (!followupFailed) {
        const replyMsg = replyContext ? "تم إنشاء الرد وحفظ المراسلة الواردة تلقائياً" : "";
        const wasSignedOnCreate = newCorr.status === "issued" || (newCorr.status === "in_progress" && newCorr.referenceNumber);
        toast({ title: wasSignedOnCreate ? `تم إنشاء المراسلة وتوقيعها نهائياً (${newCorr.referenceNumber || ""})` : (autoElevate && newCorr.flowTemplateGroupId ? "تم إنشاء المراسلة ورفعها تلقائياً" : (replyContext ? replyMsg : "تم إنشاء المراسلة بنجاح")) });
      }
      setComposeType(null);
      setReceiverMode("single");
      setCcList([]);
      setExternalCcList([]);
      setHiddenCcList([]);
      setAttachments([]);
      setEntitySearch("");
      setAutoElevate(true);
      setReplyInitialized(false);
      setFollowUpDays("");
      setReminderDate("");
      form.reset();
      onClearReply?.();
      onCreated();
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "غير مصرح", variant: "destructive" });
        return;
      }
      toast({ title: "حدث خطأ", description: error.message, variant: "destructive" });
    },
  });

  const handleAddAttachment = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const blockedExts = ['.exe', '.msi', '.bat', '.cmd', '.com', '.scr', '.dll', '.sys', '.vbs', '.ps1', '.sh', '.jar', '.hta', '.inf', '.reg', '.iso', '.bin', '.lib', '.a', '.so', '.dylib'];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      if (blockedExts.includes(ext)) {
        toast({ title: "ملف غير مسموح", description: `الملف "${file.name}" من نوع غير مسموح به لأسباب أمنية`, variant: "destructive" });
        continue;
      }
      if (file.size > 25 * 1024 * 1024) {
        toast({ title: "حجم الملف كبير", description: `الملف "${file.name}" يتجاوز الحد الأقصى (25 ميغابايت)`, variant: "destructive" });
        continue;
      }
      setAttachments(prev => [...prev, { file, description: "" }]);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  useEffect(() => {
    if (isCentralMail && !composeType) {
      setComposeType("external_incoming");
      form.setValue("type", "external_incoming");
    }
  }, [isCentralMail, composeType, form]);

  const createExternalIncomingMutation = useMutation({
    mutationFn: async (data: any) => {
      const payload = {
        ...data,
        type: "external_incoming",
        assignToEmployeeId: selectedAssigneeId,
      };
      const res = await apiRequest("POST", "/api/correspondence", payload);
      return res.json();
    },
    onSuccess: async (newCorr: any) => {
      let failedUploads = 0;
      if (attachments.length > 0) {
        setIsUploading(true);
        for (let i = 0; i < attachments.length; i++) {
          const att = attachments[i];
          try {
            const formData = new FormData();
            formData.append("file", att.file);
            formData.append("description", `صفحة ${i + 1}`);
            const uploadRes = await fetch(`/api/correspondence/${newCorr.id}/attachments`, {
              method: "POST",
              body: formData,
              credentials: "include",
            });
            if (!uploadRes.ok) failedUploads++;
          } catch (e) {
            failedUploads++;
          }
        }
        setIsUploading(false);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/correspondence"] });
      queryClient.invalidateQueries({ queryKey: ["/api/external-entities"] });
      if (failedUploads > 0) {
        toast({ title: "تم إدخال الوارد الخارجي", description: `فشل رفع ${failedUploads} مرفق(ات)`, variant: "destructive" });
      } else {
        toast({ title: "تم إدخال وإسناد الوارد الخارجي بنجاح" });
      }
      setSelectedAssigneeId(null);
      setAttachments([]);
      setEntitySearch("");
      form.reset();
      form.setValue("type", "external_incoming");
      onCreated();
    },
    onError: (error: Error) => {
      toast({ title: "حدث خطأ", description: error.message, variant: "destructive" });
    },
  });

  if (user?.role !== "admin" && !isCentralMail && (!myFlowTemplates || myFlowTemplates.length === 0)) {
    return (
      <Card className="p-12">
        <div className="text-center text-muted-foreground">
          <Shield className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">لا يوجد مسار تدفق مرتبط بتشكيلك</p>
          <p className="text-sm mt-1">تواصل مع مدير النظام لإعداد مسار تدفق لقسمك</p>
        </div>
      </Card>
    );
  }

  if (!composeType) {
    if (isCentralMail) {
      return null;
    } else if (!canInternal && !canExternal && !canExternalIncoming) {
      return (
        <Card className="p-12">
          <div className="text-center text-muted-foreground">
            <Shield className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">لا يوجد مسار تدفق مرتبط بتشكيلك</p>
            <p className="text-sm mt-1">تواصل مع مدير النظام لإعداد مسار تدفق لقسمك</p>
          </div>
        </Card>
      );
    } else {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {canInternal && (
            <Card
              className="p-6 hover-elevate transition-all duration-150 cursor-pointer text-center"
              onClick={() => {
                setComposeType("internal_outgoing");
                form.setValue("type", "internal_outgoing");
                setSelectedFlowTemplateId(null);
                const internalFlows = (myFlowTemplates || []).filter((ft: any) => ft.correspondenceType === "internal_outgoing");
                if (internalFlows.length === 1) setSelectedFlowTemplateId(internalFlows[0].id);
              }}
              data-testid="card-compose-internal"
            >
              <div className="w-14 h-14 rounded-xl bg-chart-1/10 flex items-center justify-center mx-auto mb-3">
                <ArrowUpLeft className="w-7 h-7 text-chart-1" />
              </div>
              <h3 className="font-semibold text-sm">مراسلة صادرة داخلية</h3>
              <p className="text-xs text-muted-foreground mt-1">إنشاء مراسلة صادرة بين الأقسام الداخلية</p>
            </Card>
          )}
          {canExternal && (
            <Card
              className="p-6 hover-elevate transition-all duration-150 cursor-pointer text-center"
              onClick={() => {
                setComposeType("external_outgoing");
                form.setValue("type", "external_outgoing");
                setSelectedFlowTemplateId(null);
                const externalFlows = (myFlowTemplates || []).filter((ft: any) => ft.correspondenceType === "external_outgoing");
                if (externalFlows.length === 1) setSelectedFlowTemplateId(externalFlows[0].id);
              }}
              data-testid="card-compose-external"
            >
              <div className="w-14 h-14 rounded-xl bg-chart-2/10 flex items-center justify-center mx-auto mb-3">
                <Send className="w-7 h-7 text-chart-2" />
              </div>
              <h3 className="font-semibold text-sm">مراسلة صادرة خارجية</h3>
              <p className="text-xs text-muted-foreground mt-1">إنشاء مراسلة صادرة لجهة خارجية</p>
            </Card>
          )}
          {canExternalIncoming && !isCentralMail && (
            <Card
              className="p-6 hover-elevate transition-all duration-150 cursor-pointer text-center"
              onClick={() => {
                setComposeType("external_incoming");
                form.setValue("type", "external_incoming");
                setSelectedFlowTemplateId(null);
              }}
              data-testid="card-compose-external-incoming"
            >
              <div className="w-14 h-14 rounded-xl bg-chart-3/10 flex items-center justify-center mx-auto mb-3">
                <ArrowDown className="w-7 h-7 text-chart-3" />
              </div>
              <h3 className="font-semibold text-sm">إدخال وارد خارجي</h3>
              <p className="text-xs text-muted-foreground mt-1">إدخال مراسلة واردة من جهة خارجية</p>
            </Card>
          )}
        </div>
      );
    }
  }

  const isExternal = composeType === "external_outgoing";
  const isExternalIncoming = composeType === "external_incoming";

  const hasInvalidAttachments = attachments.some(a => !a.description.trim());
  const hasInvalidCcReasons = ccList.some(c => c.departmentId && !c.reason.trim());
  const hasInvalidExtCcReasons = externalCcList.some(c => (c.entityName || "").trim() && !(c.reason || "").trim());
  const hasInvalidHiddenCcReasons = hiddenCcList.some(c => c.departmentId && !c.reason.trim());

  if (isExternalIncoming) {
    const selectedAssignee = authorizedReceivers?.find((r: any) => r.id === selectedAssigneeId);
    const extIncomingEntitySearch = entitySearch;
    const filteredEntities = (externalEntitiesData || []).filter(e => e.name.includes(extIncomingEntitySearch));

    return (
      <div>
        <div className="flex items-center gap-3 mb-4">
          {!isCentralMail && (
            <Button variant="ghost" size="sm" onClick={() => { setComposeType(null); form.reset(); setAttachments([]); setEntitySearch(""); setSelectedAssigneeId(null); }} data-testid="button-back-compose">
              <ArrowLeft className="w-4 h-4 ml-1" />
              رجوع
            </Button>
          )}
          <h3 className="font-semibold text-sm">إدخال وارد خارجي</h3>
        </div>

        <Card className="p-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const values = form.getValues();
              if (!values.externalEntity?.trim() && !entitySearch.trim()) {
                toast({ title: "الجهة الخارجية المرسلة مطلوبة", variant: "destructive" });
                return;
              }
              if (!(values as any).externalRefNumber?.trim()) {
                toast({ title: "عدد الكتاب الخارجي مطلوب", variant: "destructive" });
                return;
              }
              if (!(values as any).externalDate) {
                toast({ title: "تاريخ الكتاب الخارجي مطلوب", variant: "destructive" });
                return;
              }
              if (!values.subject.trim()) {
                toast({ title: "الموضوع مطلوب", variant: "destructive" });
                return;
              }
              if (attachments.length === 0) {
                toast({ title: "يجب رفع صورة المراسلة الورقية (صفحة واحدة على الأقل)", variant: "destructive" });
                return;
              }
              if (!selectedAssigneeId) {
                toast({ title: "يجب تحديد الحساب المخوّل لاستلام المراسلة", variant: "destructive" });
                return;
              }
              createExternalIncomingMutation.mutate({
                subject: values.subject,
                content: "",
                externalEntity: values.externalEntity || entitySearch,
                externalRefNumber: (values as any).externalRefNumber || "",
                externalDate: (values as any).externalDate || null,
                priority: values.priority || "medium",
                confidentiality: values.confidentiality || "normal",
                notes: values.notes || "",
              });
            }}
            className="space-y-5"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">الجهة الخارجية المرسلة <span className="text-destructive">*</span></Label>
                <div className="relative">
                  <Input
                    placeholder="اكتب اسم الجهة الخارجية..."
                    value={entitySearch}
                    onChange={(e) => {
                      setEntitySearch(e.target.value);
                      form.setValue("externalEntity", e.target.value);
                      setShowEntityDropdown(true);
                    }}
                    onFocus={() => setShowEntityDropdown(true)}
                    onBlur={() => setTimeout(() => setShowEntityDropdown(false), 200)}
                    data-testid="input-external-entity-incoming"
                  />
                  {showEntityDropdown && filteredEntities.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-50 bg-popover border rounded-md mt-1 max-h-40 overflow-y-auto shadow-lg">
                      {filteredEntities.map((ent) => (
                        <div
                          key={ent.id}
                          className="px-3 py-2 text-sm hover:bg-accent cursor-pointer"
                          onClick={() => {
                            setEntitySearch(ent.name);
                            form.setValue("externalEntity", ent.name);
                            setShowEntityDropdown(false);
                          }}
                        >
                          {ent.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">عدد الكتاب الخارجي <span className="text-destructive">*</span></Label>
                <Input
                  placeholder="مثال: MOO/2024/1234"
                  {...form.register("externalRefNumber" as any)}
                  data-testid="input-external-ref-number"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">تاريخ الكتاب الخارجي <span className="text-destructive">*</span></Label>
                <Input
                  type="date"
                  {...form.register("externalDate" as any)}
                  data-testid="input-external-date"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">الموضوع <span className="text-destructive">*</span></Label>
                <Input
                  placeholder="موضوع الكتاب الوارد..."
                  {...form.register("subject")}
                  data-testid="input-subject-incoming"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">الأولوية</Label>
                <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...form.register("priority")} data-testid="select-priority-incoming">
                  <option value="low">منخفضة</option>
                  <option value="medium">متوسطة</option>
                  <option value="high">عالية</option>
                  <option value="urgent">عاجلة</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">السرية</Label>
                <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...form.register("confidentiality")} data-testid="select-confidentiality-incoming">
                  <option value="normal">عادي</option>
                  <option value="confidential">سري</option>
                  <option value="top_secret">سري للغاية</option>
                </select>
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-medium">صورة المراسلة الورقية <span className="text-destructive">*</span></Label>
              <p className="text-xs text-muted-foreground">قم برفع صور صفحات المراسلة الورقية (يمكن رفع أكثر من صفحة)</p>
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors hover:border-primary/50 hover:bg-primary/5 ${attachments.length === 0 ? 'border-destructive/50 bg-destructive/5' : 'border-border'}`}
                onClick={() => fileInputRef.current?.click()}
                data-testid="dropzone-scanned-pages"
              >
                <FileText className="w-10 h-10 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm font-medium">اضغط لرفع صور المراسلة</p>
                <p className="text-xs text-muted-foreground mt-1">PDF, صور، أو مستندات ممسوحة ضوئياً</p>
              </div>
              <input ref={fileInputRef} type="file" multiple accept="image/*,.pdf" className="hidden" onChange={handleAddAttachment} />
              {attachments.length > 0 && (
                <div className="space-y-2">
                  {attachments.map((att, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                      <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="text-xs text-muted-foreground shrink-0">صفحة {idx + 1}</span>
                      <span className="text-sm truncate flex-1">{att.file.name}</span>
                      <Button type="button" variant="ghost" size="sm" onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))} className="h-8 w-8 p-0">
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">إسناد إلى <span className="text-destructive">*</span></Label>
              {(!authorizedReceivers || authorizedReceivers.length === 0) ? (
                <div className="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                  <p className="text-sm text-amber-700 dark:text-amber-400">لا يوجد حسابات مخوّلة لاستلام الوارد الخارجي. يرجى التواصل مع مدير النظام.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {authorizedReceivers.map((recv: any) => {
                    const dept = departments.find(d => d.id === recv.departmentId);
                    const isSelected = selectedAssigneeId === recv.id;
                    return (
                      <Card
                        key={recv.id}
                        className={`p-3 cursor-pointer transition-all duration-150 hover-elevate ${isSelected ? 'ring-2 ring-primary bg-primary/5' : ''}`}
                        onClick={() => setSelectedAssigneeId(recv.id)}
                        data-testid={`card-assignee-${recv.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                            <User className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{recv.fullName}</p>
                            <p className="text-xs text-muted-foreground truncate">{dept?.name || ""}</p>
                          </div>
                          {isSelected && <CheckCircle className="w-5 h-5 text-primary shrink-0 mr-auto" />}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">ملاحظات</Label>
              <Input
                placeholder="ملاحظات إضافية (اختياري)..."
                {...form.register("notes")}
                data-testid="input-notes-incoming"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="submit"
                disabled={createExternalIncomingMutation.isPending || isUploading}
                className="flex-1"
                data-testid="button-submit-external-incoming"
              >
                {(createExternalIncomingMutation.isPending || isUploading) ? (
                  <Loader2 className="w-4 h-4 animate-spin ml-2" />
                ) : (
                  <Send className="w-4 h-4 ml-2" />
                )}
                إدخال وإسناد الوارد الخارجي
              </Button>
            </div>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <Button variant="ghost" size="sm" onClick={() => { setComposeType(null); setSelectedFlowTemplateId(null); form.reset(); setReceiverMode("single"); setCcList([]); setExternalCcList([]); setHiddenCcList([]); setAttachments([]); setEntitySearch(""); onClearReply?.(); setReplyInitialized(false); }} data-testid="button-back-compose">
          <ArrowLeft className="w-4 h-4 ml-1" />
          رجوع
        </Button>
        <h3 className="font-semibold text-sm">
          {replyContext ? "إنشاء رد على مراسلة" : isExternal ? "إنشاء مراسلة صادرة خارجية" : "إنشاء مراسلة صادرة داخلية"}
        </h3>
      </div>

      {replyContext && (
        <Card className="p-4 mb-4 border-chart-3/30 bg-chart-3/5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-chart-3/10 flex items-center justify-center shrink-0">
                <Reply className="w-5 h-5 text-chart-3" />
              </div>
              <div>
                <p className="text-sm font-medium">رد على: {replyContext.parentSubject}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {typeLabels[replyContext.parentType]} - المراسلة مرتبطة تلقائياً
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onViewParent?.(replyContext.parentCorrespondenceId)}
              data-testid="button-view-parent-from-compose"
            >
              <Eye className="w-4 h-4 ml-1" />
              عرض الأصلية
            </Button>
          </div>
          {(canInternal || canExternal) && (
            <div className="flex items-center gap-2 pt-3 border-t border-chart-3/20">
              <span className="text-xs text-muted-foreground shrink-0">نوع الرد:</span>
              <div className="flex gap-2">
                {canInternal && (
                  <Button
                    type="button"
                    variant={composeType === "internal_outgoing" ? "default" : "outline"}
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => handleReplyTypeChange("internal_outgoing")}
                    data-testid="button-reply-type-internal"
                  >
                    صادر داخلي
                  </Button>
                )}
                {canExternal && (
                  <Button
                    type="button"
                    variant={composeType === "external_outgoing" ? "default" : "outline"}
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => handleReplyTypeChange("external_outgoing")}
                    data-testid="button-reply-type-external"
                  >
                    صادر خارجي
                  </Button>
                )}
              </div>
            </div>
          )}
        </Card>
      )}
      <Card className="p-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => {
            if (hasInvalidAttachments) {
              toast({ title: "يرجى إدخال وصف لجميع المرفقات", variant: "destructive" });
              return;
            }
            if (hasInvalidCcReasons || hasInvalidExtCcReasons || hasInvalidHiddenCcReasons) {
              toast({ title: "يرجى إدخال سبب إرسال النسخة لجميع الجهات المختارة", variant: "destructive" });
              return;
            }
            createMutation.mutate(data);
          })} className="space-y-5">

            {user?.role !== "admin" && availableFlowTemplates.length === 0 && myFlowTemplates !== undefined && (
              <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 rounded-lg">
                <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
                  <Shield className="w-4 h-4" />
                  <p className="text-sm font-medium">لا يوجد مسار تدفق لهذا النوع من المراسلات</p>
                </div>
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">تواصل مع مدير النظام لإضافة حسابك إلى مسار تدفق مناسب</p>
              </div>
            )}
            {user?.role !== "admin" && availableFlowTemplates.length > 0 && (
              <div className="p-4 bg-muted/30 rounded-lg border space-y-3">
                <div className="flex items-center gap-2">
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  <span className="font-semibold text-sm">مسار التدفق <span className="text-destructive">*</span></span>
                </div>
                {availableFlowTemplates.length === 1 ? (
                  <div className="flex items-center gap-2 px-3 py-2 bg-background rounded-md border">
                    <ChevronRight className="w-4 h-4 text-chart-1" />
                    <span className="text-sm font-medium">{availableFlowTemplates[0].name}</span>
                    <Badge variant="outline" className="mr-auto text-xs">تلقائي</Badge>
                  </div>
                ) : (
                  <Select
                    value={selectedFlowTemplateId?.toString() || ""}
                    onValueChange={(v) => setSelectedFlowTemplateId(parseInt(v))}
                  >
                    <SelectTrigger data-testid="select-flow-template">
                      <SelectValue placeholder="اختر مسار التدفق" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableFlowTemplates.map((ft: any) => (
                        <SelectItem key={ft.id} value={ft.id.toString()}>
                          {ft.name} ({ft.levels?.map((l: string) => {
                            const levelNames: Record<string, string> = { unit: "وحدة", division: "شعبة", section: "قسم", directorate: "هيئة", assistant: "معاون", general_manager: "مدير عام" };
                            return levelNames[l] || l;
                          }).join(" → ")})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <p className="text-xs text-muted-foreground">المسار يحدد سلسلة الرفع والموافقة على المراسلة</p>
              </div>
            )}

            <FormField control={form.control} name="subject" render={({ field }) => (
              <FormItem>
                <FormLabel>الموضوع <span className="text-destructive">*</span></FormLabel>
                <FormControl><Input {...field} value={field.value || ""} placeholder="موضوع المراسلة" data-testid="input-corr-subject" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="content" render={({ field }) => (
              <FormItem>
                <FormLabel>المحتوى <span className="text-destructive">*</span></FormLabel>
                <FormControl>
                  <div dir="rtl">
                    <RichTextEditor
                      value={field.value || ""}
                      onChange={field.onChange}
                      placeholder="اكتب محتوى المراسلة هنا..."
                      minHeight="240px"
                      testId="input-corr-content"
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="priority" render={({ field }) => (
              <FormItem>
                <FormLabel>الأولوية</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || "medium"}>
                  <FormControl><SelectTrigger data-testid="select-corr-priority"><SelectValue /></SelectTrigger></FormControl>
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

            <div className="flex items-center gap-4 p-3 rounded-lg border bg-muted/30 flex-wrap">
              <label className="flex items-center gap-2 cursor-pointer text-sm" data-testid="label-follow-up">
                <input
                  type="checkbox"
                  checked={!!followUpDays}
                  onChange={e => { if (!e.target.checked) setFollowUpDays(""); else setFollowUpDays("7"); }}
                  className="rounded border-gray-300"
                  data-testid="checkbox-follow-up"
                />
                تعيين كمتابعة
              </label>
              {!!followUpDays && (
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">المدة (بالأيام):</Label>
                  <Input
                    type="number"
                    min="1"
                    value={followUpDays}
                    onChange={e => setFollowUpDays(e.target.value)}
                    placeholder="عدد الأيام"
                    className="w-28 h-8 text-xs"
                    data-testid="input-follow-up-days"
                  />
                </div>
              )}
            </div>

            <div className="p-4 bg-muted/30 rounded-lg border space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="w-4 h-4 text-muted-foreground" />
                <span className="font-semibold text-sm">الجهة المرسلة</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 bg-background rounded-md border">
                <Building2 className="w-4 h-4 text-chart-1" />
                <span className="text-sm font-medium">{isExternal ? (orgName || "جاري التحديد...") : (centralParent?.name || "جاري التحديد...")}</span>
                <Badge variant="outline" className="mr-auto text-xs">تلقائي</Badge>
              </div>
            </div>

            {!isExternal ? (
              <div className="p-4 bg-muted/30 rounded-lg border space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <ArrowDown className="w-4 h-4 text-muted-foreground" />
                  <span className="font-semibold text-sm">الجهة المستلمة <span className="text-destructive">*</span></span>
                </div>

                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant={receiverMode === "single" ? "default" : "outline"}
                    size="sm"
                    onClick={() => { setReceiverMode("single"); form.setValue("receiverDepartmentId", undefined); }}
                    data-testid="button-receiver-single"
                  >
                    جهة محددة
                  </Button>
                  <Button
                    type="button"
                    variant={receiverMode === "all" ? "default" : "outline"}
                    size="sm"
                    onClick={() => { setReceiverMode("all"); form.setValue("receiverDepartmentId", undefined); setCcList([]); }}
                    data-testid="button-receiver-all"
                  >
                    جميع الجهات
                  </Button>
                </div>

                {receiverMode === "single" && (
                  <FormField control={form.control} name="receiverDepartmentId" render={({ field }) => (
                    <FormItem>
                      <Select onValueChange={(v) => { field.onChange(parseInt(v)); setCcList(prev => prev.filter(c => c.departmentId !== parseInt(v))); }} value={field.value?.toString() || ""}>
                        <FormControl><SelectTrigger data-testid="select-receiver-dept"><SelectValue placeholder="اختر الجهة المستلمة" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {availableReceiverDepts.map(d => <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                )}

                {receiverMode === "all" && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-background rounded-md border">
                    <Mail className="w-4 h-4 text-chart-2" />
                    <span className="text-sm text-muted-foreground">سيتم إرسال المراسلة إلى جميع الجهات المركزية ({availableReceiverDepts.length} جهة)</span>
                  </div>
                )}

                {receiverMode === "single" && selectedReceiverId && (
                  <div className="space-y-3 mt-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium text-sm">نسخة إلى (اختياري)</span>
                      </div>
                      {availableCcDepts.length > 0 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setCcList(prev => [...prev, { departmentId: 0, reason: "" }])}
                          data-testid="button-add-cc"
                        >
                          <Plus className="w-3 h-3 ml-1" />
                          إضافة
                        </Button>
                      )}
                    </div>

                    {ccList.map((cc, idx) => (
                      <div key={idx} className="flex items-start gap-3 p-3 bg-background rounded-md border">
                        <div className="flex-1 space-y-2">
                          <Select
                            value={cc.departmentId ? cc.departmentId.toString() : ""}
                            onValueChange={(v) => {
                              setCcList(prev => prev.map((c, i) => i === idx ? { ...c, departmentId: parseInt(v) } : c));
                            }}
                          >
                            <SelectTrigger data-testid={`select-cc-dept-${idx}`}><SelectValue placeholder="اختر الجهة" /></SelectTrigger>
                            <SelectContent>
                              {availableReceiverDepts.filter(d =>
                                d.id !== selectedReceiverId && !ccList.some((c, ci) => ci !== idx && c.departmentId === d.id)
                              ).map(d => <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <Input
                            placeholder="سبب إرسال النسخة (إلزامي)"
                            value={cc.reason}
                            onChange={(e) => setCcList(prev => prev.map((c, i) => i === idx ? { ...c, reason: e.target.value } : c))}
                            className={cc.departmentId && !cc.reason.trim() ? "border-destructive" : ""}
                            data-testid={`input-cc-reason-${idx}`}
                          />
                          {cc.departmentId > 0 && !cc.reason.trim() && (
                            <p className="text-xs text-destructive">سبب إرسال النسخة مطلوب</p>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="shrink-0 mt-1"
                          onClick={() => setCcList(prev => prev.filter((_, i) => i !== idx))}
                          data-testid={`button-remove-cc-${idx}`}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="p-4 bg-muted/30 rounded-lg border space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Globe className="w-4 h-4 text-muted-foreground" />
                    <span className="font-semibold text-sm">الجهة الخارجية <span className="text-destructive">*</span></span>
                  </div>
                  <FormField control={form.control} name="externalEntity" render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <div className="relative">
                          <Input
                            value={entitySearch || field.value || ""}
                            onChange={(e) => {
                              setEntitySearch(e.target.value);
                              field.onChange(e.target.value);
                              setShowEntityDropdown(true);
                            }}
                            onFocus={() => setShowEntityDropdown(true)}
                            onBlur={() => setTimeout(() => setShowEntityDropdown(false), 200)}
                            placeholder="ابحث أو أدخل اسم الجهة الخارجية..."
                            data-testid="input-corr-external-entity"
                            autoComplete="off"
                          />
                          {showEntityDropdown && (entitySearch || "").trim().length > 0 && (
                            <div className="absolute z-50 w-full mt-1 max-h-48 overflow-y-auto bg-popover border rounded-md shadow-lg">
                              {(externalEntitiesData || [])
                                .filter(e => e.name.toLowerCase().includes((entitySearch || "").toLowerCase()))
                                .filter(e => e.name !== form.getValues("externalEntity"))
                                .map(entity => (
                                  <button
                                    key={entity.id}
                                    type="button"
                                    className="w-full text-right px-3 py-2 text-sm hover:bg-accent transition-colors"
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      field.onChange(entity.name);
                                      setEntitySearch(entity.name);
                                      setShowEntityDropdown(false);
                                    }}
                                    data-testid={`entity-option-${entity.id}`}
                                  >
                                    <Globe className="w-3 h-3 inline ml-2 text-muted-foreground" />
                                    {entity.name}
                                  </button>
                                ))}
                              {!(externalEntitiesData || []).some(e => e.name === (entitySearch || "").trim()) && (entitySearch || "").trim().length > 0 && (
                                <div className="px-3 py-2 text-xs text-muted-foreground border-t">
                                  <Plus className="w-3 h-3 inline ml-1" />
                                  سيتم حفظ "{(entitySearch || "").trim()}" كجهة خارجية جديدة
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <div className="p-4 bg-muted/30 rounded-lg border space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      <span className="font-semibold text-sm">نسخة عنه (اختياري)</span>
                      {externalCcList.length > 0 && <Badge variant="secondary" className="text-xs">{externalCcList.length}</Badge>}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setExternalCcList(prev => [...prev, { entityName: "", reason: "" }])}
                      data-testid="button-add-ext-cc"
                    >
                      <Plus className="w-3 h-3 ml-1" />
                      إضافة
                    </Button>
                  </div>

                  {externalCcList.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-2">لا توجد نسخ - يمكنك إضافة جهات خارجية لإرسال نسخة</p>
                  )}

                  {externalCcList.map((ecc, idx) => (
                    <div key={idx} className="flex items-start gap-3 p-3 bg-background rounded-md border">
                      <div className="flex-1 space-y-2">
                        <div className="relative">
                          <Input
                            value={extCcSearch[idx] !== undefined ? extCcSearch[idx] : ecc.entityName}
                            onChange={(e) => {
                              setExtCcSearch(prev => ({ ...prev, [idx]: e.target.value }));
                              setExternalCcList(prev => prev.map((c, i) => i === idx ? { ...c, entityName: e.target.value } : c));
                              setShowExtCcDropdown(prev => ({ ...prev, [idx]: true }));
                            }}
                            onFocus={() => setShowExtCcDropdown(prev => ({ ...prev, [idx]: true }))}
                            onBlur={() => setTimeout(() => setShowExtCcDropdown(prev => ({ ...prev, [idx]: false })), 200)}
                            placeholder="ابحث أو أدخل اسم الجهة الخارجية..."
                            data-testid={`input-ext-cc-entity-${idx}`}
                            autoComplete="off"
                          />
                          {showExtCcDropdown[idx] && ((extCcSearch[idx] || ecc.entityName) || "").trim().length > 0 && (
                            <div className="absolute z-50 w-full mt-1 max-h-40 overflow-y-auto bg-popover border rounded-md shadow-lg">
                              {(externalEntitiesData || [])
                                .filter(e => e.name.toLowerCase().includes(((extCcSearch[idx] || ecc.entityName) || "").toLowerCase()))
                                .filter(e => e.name !== form.getValues("externalEntity"))
                                .filter(e => !externalCcList.some((c, ci) => ci !== idx && c.entityName === e.name))
                                .map(entity => (
                                  <button
                                    key={entity.id}
                                    type="button"
                                    className="w-full text-right px-3 py-2 text-sm hover:bg-accent transition-colors"
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      setExternalCcList(prev => prev.map((c, i) => i === idx ? { ...c, entityName: entity.name } : c));
                                      setExtCcSearch(prev => ({ ...prev, [idx]: entity.name }));
                                      setShowExtCcDropdown(prev => ({ ...prev, [idx]: false }));
                                    }}
                                    data-testid={`ext-cc-option-${idx}-${entity.id}`}
                                  >
                                    <Globe className="w-3 h-3 inline ml-2 text-muted-foreground" />
                                    {entity.name}
                                  </button>
                                ))}
                            </div>
                          )}
                        </div>
                        {(ecc.entityName || "").trim() && ecc.entityName === form.getValues("externalEntity") && (
                          <p className="text-xs text-destructive">لا يمكن تكرار الجهة الرئيسية المستلمة</p>
                        )}
                        <Input
                          placeholder="سبب إرسال النسخة (إلزامي)"
                          value={ecc.reason}
                          onChange={(e) => setExternalCcList(prev => prev.map((c, i) => i === idx ? { ...c, reason: e.target.value } : c))}
                          className={(ecc.entityName || "").trim() && !(ecc.reason || "").trim() ? "border-destructive" : ""}
                          data-testid={`input-ext-cc-reason-${idx}`}
                        />
                        {(ecc.entityName || "").trim() && !(ecc.reason || "").trim() && (
                          <p className="text-xs text-destructive">سبب إرسال النسخة مطلوب</p>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="shrink-0 mt-1"
                        onClick={() => {
                          setExternalCcList(prev => prev.filter((_, i) => i !== idx));
                          setExtCcSearch(prev => { const n = { ...prev }; delete n[idx]; return n; });
                        }}
                        data-testid={`button-remove-ext-cc-${idx}`}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="p-4 bg-muted/30 rounded-lg border space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <EyeOff className="w-4 h-4 text-muted-foreground" />
                      <span className="font-semibold text-sm">نسخة مخفية عنه</span>
                      {hiddenCcList.length > 0 && <Badge variant="secondary" className="text-xs">{hiddenCcList.length}</Badge>}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setHiddenCcList(prev => [...prev, { departmentId: 0, reason: "" }])}
                      data-testid="button-add-hidden-cc"
                    >
                      <Plus className="w-3 h-3 ml-1" />
                      إضافة
                    </Button>
                  </div>

                  {hiddenCcList.map((hcc, idx) => {
                    const isFixed = idx === 0 && centralParent?.id === hcc.departmentId;
                    const fixedDeptName = isFixed ? centralDepartments.find(d => d.id === hcc.departmentId)?.name : null;
                    return (<div key={idx} className={`flex items-start gap-3 p-3 rounded-md border ${isFixed ? 'bg-primary/5 border-primary/20' : 'bg-background'}`}>
                      <div className="flex-1 space-y-2">
                        {isFixed ? (<>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="text-xs">{fixedDeptName}</Badge>
                              <span className="text-xs text-muted-foreground">(تلقائي - الارتباط الأعلى المركزي)</span>
                            </div>
                            <Input
                              value={hcc.reason}
                              disabled
                              className="bg-muted/50"
                              data-testid={`input-hidden-cc-reason-${idx}`}
                            />
                          </>) : (<>
                            <Select
                              value={hcc.departmentId ? hcc.departmentId.toString() : ""}
                              onValueChange={(v) => {
                                setHiddenCcList(prev => prev.map((c, i) => i === idx ? { ...c, departmentId: parseInt(v) } : c));
                              }}
                            >
                              <SelectTrigger data-testid={`select-hidden-cc-dept-${idx}`}><SelectValue placeholder="اختر القسم الداخلي" /></SelectTrigger>
                              <SelectContent>
                                {centralDepartments
                                  .filter(d => d.id !== centralParent?.id && !hiddenCcList.some((c, ci) => ci !== idx && c.departmentId === d.id))
                                  .map(d => <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <Input
                              placeholder="سبب إرسال النسخة المخفية (إلزامي)"
                              value={hcc.reason}
                              onChange={(e) => setHiddenCcList(prev => prev.map((c, i) => i === idx ? { ...c, reason: e.target.value } : c))}
                              className={hcc.departmentId && !hcc.reason.trim() ? "border-destructive" : ""}
                              data-testid={`input-hidden-cc-reason-${idx}`}
                            />
                            {hcc.departmentId > 0 && !hcc.reason.trim() && (
                              <p className="text-xs text-destructive">سبب إرسال النسخة المخفية مطلوب</p>
                            )}
                          </>)}
                      </div>
                      {!isFixed && (<Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="shrink-0 mt-1"
                        onClick={() => setHiddenCcList(prev => prev.filter((_, i) => i !== idx))}
                        data-testid={`button-remove-hidden-cc-${idx}`}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>)}
                    </div>);
                  })}
                </div>
              </>
            )}

            <div className="p-4 bg-muted/30 rounded-lg border space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Paperclip className="w-4 h-4 text-muted-foreground" />
                  <span className="font-semibold text-sm">المرفقات</span>
                  {attachments.length > 0 && (
                    <Badge variant="secondary" className="text-xs">{attachments.length}</Badge>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  data-testid="button-add-attachment"
                >
                  <Upload className="w-3 h-3 ml-1" />
                  إضافة مرفق
                </Button>
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  onChange={handleAddAttachment}
                  multiple
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.rtf,.mp4,.mpeg,.webm,.avi,.mov,.mp3,.wav,.ogg,.zip,.rar,.7z"
                />
              </div>

              {attachments.length === 0 && (
                <div className="text-center py-4 text-muted-foreground text-sm">
                  لا توجد مرفقات - يمكنك إضافة صور، ملفات وورد، اكسل، PDF، فيديو، وغيرها
                </div>
              )}

              {attachments.map((att, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 bg-background rounded-md border">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Paperclip className="w-3 h-3 text-muted-foreground" />
                      <span className="text-sm font-medium truncate">{att.file.name}</span>
                      <span className="text-xs text-muted-foreground">({(att.file.size / 1024).toFixed(1)} KB)</span>
                    </div>
                    <Input
                      placeholder="وصف المرفق (إلزامي)"
                      value={att.description}
                      onChange={(e) => setAttachments(prev => prev.map((a, i) => i === idx ? { ...a, description: e.target.value } : a))}
                      className={!att.description.trim() ? "border-destructive" : ""}
                      data-testid={`input-attachment-desc-${idx}`}
                    />
                    {!att.description.trim() && (
                      <p className="text-xs text-destructive">وصف المرفق مطلوب</p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0 mt-1"
                    onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}
                    data-testid={`button-remove-attachment-${idx}`}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              {selectedFlowTemplateId && !canFinalSignOnCreate && (
                <label className="flex items-center gap-2 text-sm cursor-pointer p-3 rounded-lg border bg-muted/30" data-testid="label-auto-elevate">
                  <input
                    type="checkbox"
                    checked={autoElevate}
                    onChange={e => setAutoElevate(e.target.checked)}
                    className="rounded border-input"
                    data-testid="checkbox-auto-elevate"
                  />
                  <span>رفع تلقائي بعد الإنشاء</span>
                  <span className="text-xs text-muted-foreground mr-auto">ترسل المراسلة مباشرة للمستوى التالي في مسار التدفق</span>
                </label>
              )}
              {canFinalSignOnCreate ? (
                <Button
                  type="button"
                  className="w-full"
                  disabled={createMutation.isPending || isUploading || hasInvalidAttachments || hasInvalidCcReasons || hasInvalidExtCcReasons || hasInvalidHiddenCcReasons}
                  onClick={form.handleSubmit((data) => createMutation.mutate({ ...data, signOnCreate: true } as any))}
                  data-testid="button-final-sign-on-create"
                >
                  {(createMutation.isPending || isUploading) && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
                  {isUploading ? "جاري رفع المرفقات..." : "إنشاء و توقيع نهائي"}
                </Button>
              ) : (
                <Button type="submit" className="w-full" disabled={createMutation.isPending || isUploading || hasInvalidAttachments || hasInvalidCcReasons || hasInvalidExtCcReasons || hasInvalidHiddenCcReasons} data-testid="button-submit-correspondence">
                  {(createMutation.isPending || isUploading) && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
                  {isUploading ? "جاري رفع المرفقات..." : autoElevate && selectedFlowTemplateId ? "إنشاء ورفع المراسلة" : "إنشاء المراسلة"}
                </Button>
              )}
              <Button type="button" variant="outline" className="w-full" onClick={() => setShowPreview(true)} data-testid="button-preview-correspondence">
                <Eye className="w-4 h-4 ml-2" />
                معاينة المراسلة
              </Button>
              <Button type="button" variant="ghost" className="w-full text-destructive hover:text-destructive" onClick={() => {
                form.reset();
                setReceiverMode("single");
                setCcList([]);
                setExternalCcList([]);
                setHiddenCcList([]);
                setAttachments([]);
                setEntitySearch("");
                setComposeType(null);
              }} data-testid="button-cancel-correspondence">
                <X className="w-4 h-4 ml-2" />
                إلغاء
              </Button>
            </div>
          </form>
        </Form>
      </Card>

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>معاينة المراسلة</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-bold" data-testid="text-preview-subject">{form.getValues("subject") || "بدون موضوع"}</h2>
              <div className="flex items-center gap-2 flex-wrap mt-2">
                <Badge variant="secondary" className={`text-xs ${typeColors[form.getValues("type")]}`}>
                  {typeLabels[form.getValues("type")]}
                </Badge>
                <Badge variant="secondary" className={`text-xs ${priorityColors[form.getValues("priority") || "medium"]}`}>
                  {priorityLabels[form.getValues("priority") || "medium"]}
                </Badge>
                {form.getValues("confidentiality") && form.getValues("confidentiality") !== "normal" && (
                  <Badge variant="secondary" className={`text-xs ${confidentialityColors[form.getValues("confidentiality") || "normal"]}`}>
                    <Shield className="w-3 h-3 ml-1" />
                    {confidentialityLabels[form.getValues("confidentiality") || "normal"]}
                  </Badge>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">الجهة المرسلة:</span>
                <span className="font-medium mr-2">{isExternal ? orgName : centralParent?.name}</span>
              </div>
              {!isExternal && receiverMode === "single" && selectedReceiverId && (
                <div>
                  <span className="text-muted-foreground">الجهة المستلمة:</span>
                  <span className="font-medium mr-2">{availableReceiverDepts.find(d => d.id === selectedReceiverId)?.name}</span>
                </div>
              )}
              {!isExternal && receiverMode === "all" && (
                <div className="col-span-2">
                  <Badge variant="secondary" className="text-xs bg-chart-2/10 text-chart-2">تعميم لجميع الجهات</Badge>
                </div>
              )}
              {isExternal && form.getValues("externalEntity") && (
                <div>
                  <span className="text-muted-foreground">الجهة الخارجية:</span>
                  <span className="font-medium mr-2">{form.getValues("externalEntity")}</span>
                </div>
              )}
            </div>

            {form.getValues("content") && (
              <div className="rounded-lg border p-4">
                <h4 className="text-sm font-medium mb-2">المحتوى</h4>
                <div className="text-sm text-muted-foreground prose prose-sm max-w-none rte-content" dir="rtl" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(form.getValues("content") || "", SANITIZE_CONFIG) }} />
              </div>
            )}

            {ccList.length > 0 && ccList.some(c => c.departmentId > 0) && (
              <div className="rounded-lg border p-4">
                <h4 className="text-sm font-medium mb-2">نسخة إلى</h4>
                <div className="space-y-2">
                  {ccList.filter(c => c.departmentId > 0).map((cc, idx) => {
                    const dept = departments.find(d => d.id === cc.departmentId);
                    return (
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        <Badge variant="outline" className="text-xs">{dept?.name || `قسم ${cc.departmentId}`}</Badge>
                        {cc.reason && <span className="text-xs text-muted-foreground">- {cc.reason}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {externalCcList.length > 0 && externalCcList.some(c => (c.entityName || "").trim()) && (
              <div className="rounded-lg border p-4">
                <h4 className="text-sm font-medium mb-2">نسخة عنه (جهات خارجية)</h4>
                <div className="space-y-2">
                  {externalCcList.filter(c => (c.entityName || "").trim()).map((ecc, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm">
                      <Globe className="w-3 h-3 text-muted-foreground" />
                      <Badge variant="outline" className="text-xs">{ecc.entityName}</Badge>
                      {ecc.reason && <span className="text-xs text-muted-foreground">- {ecc.reason}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {hiddenCcList.length > 0 && hiddenCcList.some(c => c.departmentId > 0) && (
              <div className="rounded-lg border p-4">
                <h4 className="text-sm font-medium mb-2">نسخة مخفية عنه (أقسام داخلية)</h4>
                <div className="space-y-2">
                  {hiddenCcList.filter(c => c.departmentId > 0).map((hcc, idx) => {
                    const dept = departments.find(d => d.id === hcc.departmentId);
                    return (
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        <EyeOff className="w-3 h-3 text-muted-foreground" />
                        <Badge variant="outline" className="text-xs">{dept?.name || `قسم ${hcc.departmentId}`}</Badge>
                        {hcc.reason && <span className="text-xs text-muted-foreground">- {hcc.reason}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {attachments.length > 0 && (
              <div className="rounded-lg border p-4">
                <h4 className="text-sm font-medium mb-2">المرفقات ({attachments.length})</h4>
                <div className="space-y-2">
                  {attachments.map((att, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm">
                      <Paperclip className="w-3 h-3 text-muted-foreground" />
                      <span>{att.file.name}</span>
                      {att.description && <span className="text-xs text-muted-foreground">- {att.description}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {form.getValues("notes") && (
              <div className="rounded-lg border p-4">
                <h4 className="text-sm font-medium mb-2">ملاحظات</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{form.getValues("notes")}</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InboxSection({ items, selectedId, onSelect, departments, orgName, readMap, allFlowTemplates, defaultTab }: {
  items: Correspondence[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  departments: Department[];
  orgName?: string;
  readMap?: Record<number, string>;
  allFlowTemplates?: any[];
  defaultTab?: string | null;
}) {
  const [inboxTab, setInboxTab] = useState(defaultTab || "internal");

  const internalItems = items.filter(item => {
    return item.type === "internal_outgoing" || item.type === "internal_incoming";
  });
  const externalItems = items.filter(item => {
    return item.type === "external_outgoing" || item.type === "external_incoming";
  });

  const unreadInternalCount = readMap ? internalItems.filter(i => !readMap[i.id]).length : 0;
  const unreadExternalCount = readMap ? externalItems.filter(i => !readMap[i.id]).length : 0;

  const filtered = inboxTab === "internal" ? internalItems : externalItems;

  return (
    <div className="space-y-4">
      <Tabs value={inboxTab} onValueChange={setInboxTab}>
        <TabsList className="inline-flex flex-wrap h-auto gap-1.5 p-1.5 bg-muted/50 rounded-xl border">
          <TabsTrigger value="internal" data-testid="tab-inbox-internal" className="gap-2 px-4 py-2 rounded-lg text-sm font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-primary transition-all">
            <ArrowDownRight className="w-4 h-4" />
            وارد داخلي
            <span className="inline-flex items-center justify-center h-5 min-w-[24px] rounded-full text-[11px] font-semibold px-1.5 bg-muted text-muted-foreground">
              {internalItems.length}
            </span>
            {unreadInternalCount > 0 && (
              <span className="inline-flex items-center justify-center h-5 min-w-[22px] rounded-full text-[11px] font-bold px-1.5 bg-destructive text-destructive-foreground shadow-sm">
                {unreadInternalCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="external" data-testid="tab-inbox-external" className="gap-2 px-4 py-2 rounded-lg text-sm font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-primary transition-all">
            <ArrowDown className="w-4 h-4" />
            وارد خارجي
            <span className="inline-flex items-center justify-center h-5 min-w-[24px] rounded-full text-[11px] font-semibold px-1.5 bg-muted text-muted-foreground">
              {externalItems.length}
            </span>
            {unreadExternalCount > 0 && (
              <span className="inline-flex items-center justify-center h-5 min-w-[22px] rounded-full text-[11px] font-bold px-1.5 bg-destructive text-destructive-foreground shadow-sm">
                {unreadExternalCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <CorrespondenceList
        items={filtered}
        selectedId={selectedId}
        onSelect={onSelect}
        departments={departments}
        emptyMessage={inboxTab === "internal" ? "لا يوجد بريد وارد داخلي" : "لا يوجد بريد وارد خارجي"}
        orgName={orgName}
        readMap={readMap}
        allFlowTemplates={allFlowTemplates}
        isInboxView={true}
      />
    </div>
  );
}

function FollowUpSection({ items, selectedId, onSelect, departments, orgName, allFlowTemplates }: {
  items: Correspondence[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  departments: Department[];
  orgName?: string;
  allFlowTemplates?: any[];
}) {
  const { user } = useAuth();
  const myDeptId = user?.departmentId;
  const [followTab, setFollowTab] = useState("out_internal");

  const activeItems = items.filter(i => {
    if ((i as any)._actedAccessOnly) return false;
    const status = i.status || "draft";
    const isInSenderChain = (i as any)._isInSenderChain;
    if (!isInSenderChain) return false;
    if (i.issuedAt || i.referenceNumber) return false;
    if (!["draft", "under_review", "pending_approval", "approved", "in_progress"].includes(status)) return false;
    if (myDeptId && i.currentDepartmentId !== myDeptId) return false;
    return true;
  });

  const outInternal = activeItems.filter(i => i.type === "internal_outgoing");
  const outExternal = activeItems.filter(i => i.type === "external_outgoing");

  const tabMap: Record<string, { items: any[]; empty: string }> = {
    out_internal: { items: outInternal, empty: "لا توجد مراسلات صادرة داخلية قيد المتابعة" },
    out_external: { items: outExternal, empty: "لا توجد مراسلات صادرة خارجية قيد المتابعة" },
  };

  const current = tabMap[followTab] || tabMap["out_internal"];

  const { data: overdueItems } = useQuery<any[]>({
    queryKey: ["/api/correspondence/overdue-reminders"],
    queryFn: async () => {
      const res = await fetch("/api/correspondence/overdue-reminders", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  return (
    <div className="space-y-4">
      {overdueItems && overdueItems.length > 0 && (
        <div className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-3">
          <div className="flex items-center gap-2 mb-2">
            <Bell className="w-4 h-4 text-amber-600" />
            <h4 className="text-sm font-medium text-amber-800 dark:text-amber-200">تذكيرات بالرد ({overdueItems.length})</h4>
          </div>
          <div className="space-y-1">
            {overdueItems.slice(0, 5).map((item: any) => (
              <div
                key={item.id}
                className="text-xs text-amber-700 dark:text-amber-300 cursor-pointer hover:underline"
                onClick={() => onSelect(item.id)}
                data-testid={`reminder-item-${item.id}`}
              >
                {item.subject} - تجاوز تاريخ التذكير
              </div>
            ))}
          </div>
        </div>
      )}
      <Tabs value={followTab} onValueChange={setFollowTab}>
        <TabsList className="inline-flex flex-wrap h-auto gap-1.5 p-1.5 bg-muted/50 rounded-xl border">
          <TabsTrigger value="out_internal" data-testid="tab-follow-out-internal" className="gap-2 px-4 py-2 rounded-lg text-sm font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-primary transition-all">
            <ArrowUpLeft className="w-4 h-4" />
            صادر داخلي
            <span className="inline-flex items-center justify-center h-5 min-w-[24px] rounded-full text-[11px] font-semibold px-1.5 bg-muted text-muted-foreground">
              {outInternal.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="out_external" data-testid="tab-follow-out-external" className="gap-2 px-4 py-2 rounded-lg text-sm font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-primary transition-all">
            <ArrowUpLeft className="w-4 h-4" />
            صادر خارجي
            <span className="inline-flex items-center justify-center h-5 min-w-[24px] rounded-full text-[11px] font-semibold px-1.5 bg-muted text-muted-foreground">
              {outExternal.length}
            </span>
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <CorrespondenceList
        items={current.items}
        selectedId={selectedId}
        onSelect={onSelect}
        departments={departments}
        emptyMessage={current.empty}
        orgName={orgName}
        allFlowTemplates={allFlowTemplates}
      />
    </div>
  );
}

function CompletedByMeSection({ items, selectedId, onSelect, departments, orgName, allFlowTemplates }: {
  items: Correspondence[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  departments: Department[];
  orgName?: string;
  allFlowTemplates?: any[];
}) {
  const { user } = useAuth();
  const myDeptId = user?.departmentId;
  const [tab, setTab] = useState("out_internal");

  const completedItems = items.filter(i => {
    if (!(i as any)._actedByMe) return false;
    const status = i.status || "";
    if (["archived", "completed", "cancelled"].includes(status)) return false;
    const isOutgoing = i.type === "internal_outgoing" || i.type === "external_outgoing";
    if (isOutgoing && ((i as any).issuedAt || i.referenceNumber || status === "issued")) return false;
    if (!isOutgoing && (i as any)._hasReplies) return false;
    if (myDeptId && i.currentDepartmentId === myDeptId) return false;
    return true;
  });

  const outInternal = completedItems.filter(i => i.type === "internal_outgoing");
  const outExternal = completedItems.filter(i => i.type === "external_outgoing");
  const inInternal = completedItems.filter(i => i.type === "internal_incoming");
  const inExternal = completedItems.filter(i => i.type === "external_incoming");

  const tabMap: Record<string, { items: Correspondence[]; empty: string; isInbox?: boolean }> = {
    out_internal: { items: outInternal, empty: "لا توجد مراسلات صادرة داخلية أنجزتها بانتظار الإكمال" },
    out_external: { items: outExternal, empty: "لا توجد مراسلات صادرة خارجية أنجزتها بانتظار الإكمال" },
    in_internal: { items: inInternal, empty: "لا توجد مراسلات واردة داخلية أنجزتها بانتظار الإكمال", isInbox: true },
    in_external: { items: inExternal, empty: "لا توجد مراسلات واردة خارجية أنجزتها بانتظار الإكمال", isInbox: true },
  };

  const current = tabMap[tab] || tabMap["out_internal"];

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 p-3">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <p className="text-xs text-emerald-800 dark:text-emerald-200">
            مراسلات قمت بإنجاز دورك فيها (رفع، توقيع، إحالة، أو إعداد إجابة) ولا تزال في طور الإكمال قبل أن تنتقل إلى الأرشيف.
          </p>
        </div>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="inline-flex flex-wrap h-auto gap-1.5 p-1.5 bg-muted/50 rounded-xl border">
          <TabsTrigger value="out_internal" data-testid="tab-completed-out-internal" className="gap-2 px-4 py-2 rounded-lg text-sm font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-primary transition-all">
            <ArrowUpLeft className="w-4 h-4" />
            صادر داخلي
            <span className="inline-flex items-center justify-center h-5 min-w-[24px] rounded-full text-[11px] font-semibold px-1.5 bg-muted text-muted-foreground">
              {outInternal.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="out_external" data-testid="tab-completed-out-external" className="gap-2 px-4 py-2 rounded-lg text-sm font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-primary transition-all">
            <ArrowUpLeft className="w-4 h-4" />
            صادر خارجي
            <span className="inline-flex items-center justify-center h-5 min-w-[24px] rounded-full text-[11px] font-semibold px-1.5 bg-muted text-muted-foreground">
              {outExternal.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="in_internal" data-testid="tab-completed-in-internal" className="gap-2 px-4 py-2 rounded-lg text-sm font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-primary transition-all">
            <ArrowDownRight className="w-4 h-4" />
            وارد داخلي
            <span className="inline-flex items-center justify-center h-5 min-w-[24px] rounded-full text-[11px] font-semibold px-1.5 bg-muted text-muted-foreground">
              {inInternal.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="in_external" data-testid="tab-completed-in-external" className="gap-2 px-4 py-2 rounded-lg text-sm font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-primary transition-all">
            <ArrowDownRight className="w-4 h-4" />
            وارد خارجي
            <span className="inline-flex items-center justify-center h-5 min-w-[24px] rounded-full text-[11px] font-semibold px-1.5 bg-muted text-muted-foreground">
              {inExternal.length}
            </span>
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <CorrespondenceList
        items={current.items}
        selectedId={selectedId}
        onSelect={onSelect}
        departments={departments}
        emptyMessage={current.empty}
        orgName={orgName}
        allFlowTemplates={allFlowTemplates}
        isInboxView={current.isInbox}
      />
    </div>
  );
}

function ArchiveSection({ items, selectedId, onSelect, departments, orgName, allFlowTemplates }: {
  items: Correspondence[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  departments: Department[];
  orgName?: string;
  allFlowTemplates?: any[];
}) {
  const [archiveTab, setArchiveTab] = useState("out_internal");
  const [searchSubject, setSearchSubject] = useState("");
  const [searchRef, setSearchRef] = useState("");
  const [searchPriority, setSearchPriority] = useState("all");
  const [searchDateFrom, setSearchDateFrom] = useState("");
  const [searchDateTo, setSearchDateTo] = useState("");

  const archivedItems = items.filter(i => {
    if ((i as any)._actedAccessOnly) return false;
    const status = i.status || "";
    if (["completed", "archived"].includes(status)) return true;
    const isInSenderChain = (i as any)._isInSenderChain;
    const isOutgoing = i.type === "internal_outgoing" || i.type === "external_outgoing";
    if (isInSenderChain && isOutgoing && (status === "issued" || i.issuedAt || i.referenceNumber)) return true;
    return false;
  });

  const outInternal = archivedItems.filter(i => (i as any)._isInSenderChain !== false && i.type === "internal_outgoing");
  const outExternal = archivedItems.filter(i => (i as any)._isInSenderChain !== false && i.type === "external_outgoing");
  const inInternal = archivedItems.filter(i => (i as any)._isInSenderChain === false && i.type === "internal_outgoing");
  const inExternal = archivedItems.filter(i => (i as any)._isInSenderChain === false && (i.type === "external_outgoing" || i.type === "external_incoming"));

  const archiveTabMap: Record<string, { items: Correspondence[]; empty: string; isInbox?: boolean }> = {
    out_internal: { items: outInternal, empty: "لا توجد مراسلات صادرة داخلية في الأرشيف" },
    out_external: { items: outExternal, empty: "لا توجد مراسلات صادرة خارجية في الأرشيف" },
    in_internal: { items: inInternal, empty: "لا توجد مراسلات واردة داخلية في الأرشيف", isInbox: true },
    in_external: { items: inExternal, empty: "لا توجد مراسلات واردة خارجية في الأرشيف", isInbox: true },
  };

  const currentArchive = archiveTabMap[archiveTab] || archiveTabMap["out_internal"];

  const filtered = currentArchive.items.filter(item => {
    if (searchSubject && !item.subject.includes(searchSubject)) return false;
    if (searchRef && !item.referenceNumber?.includes(searchRef)) return false;
    if (searchPriority !== "all" && item.priority !== searchPriority) return false;
    if (searchDateFrom) {
      const dateVal = item.issuedAt || item.createdAt;
      const itemDate = dateVal ? new Date(dateVal) : new Date(0);
      if (itemDate < new Date(searchDateFrom)) return false;
    }
    if (searchDateTo) {
      const dateVal = item.issuedAt || item.createdAt;
      const itemDate = dateVal ? new Date(dateVal) : new Date(0);
      const toDate = new Date(searchDateTo);
      toDate.setHours(23, 59, 59, 999);
      if (itemDate > toDate) return false;
    }
    return true;
  });

  return (
    <div className="space-y-4">
      <Tabs value={archiveTab} onValueChange={setArchiveTab}>
        <TabsList className="inline-flex flex-wrap h-auto gap-1.5 p-1.5 bg-muted/50 rounded-xl border">
          <TabsTrigger value="out_internal" data-testid="tab-archive-out-internal" className="gap-2 px-4 py-2 rounded-lg text-sm font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-primary transition-all">
            <ArrowUpLeft className="w-4 h-4" />
            صادر داخلي
            <span className="inline-flex items-center justify-center h-5 min-w-[24px] rounded-full text-[11px] font-semibold px-1.5 bg-muted text-muted-foreground">
              {outInternal.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="out_external" data-testid="tab-archive-out-external" className="gap-2 px-4 py-2 rounded-lg text-sm font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-primary transition-all">
            <ArrowUpLeft className="w-4 h-4" />
            صادر خارجي
            <span className="inline-flex items-center justify-center h-5 min-w-[24px] rounded-full text-[11px] font-semibold px-1.5 bg-muted text-muted-foreground">
              {outExternal.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="in_internal" data-testid="tab-archive-in-internal" className="gap-2 px-4 py-2 rounded-lg text-sm font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-primary transition-all">
            <ArrowDownRight className="w-4 h-4" />
            وارد داخلي
            <span className="inline-flex items-center justify-center h-5 min-w-[24px] rounded-full text-[11px] font-semibold px-1.5 bg-muted text-muted-foreground">
              {inInternal.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="in_external" data-testid="tab-archive-in-external" className="gap-2 px-4 py-2 rounded-lg text-sm font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-primary transition-all">
            <ArrowDown className="w-4 h-4" />
            وارد خارجي
            <span className="inline-flex items-center justify-center h-5 min-w-[24px] rounded-full text-[11px] font-semibold px-1.5 bg-muted text-muted-foreground">
              {inExternal.length}
            </span>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="بحث بالموضوع..."
              value={searchSubject}
              onChange={e => setSearchSubject(e.target.value)}
              className="pr-10"
              data-testid="input-archive-search-subject"
            />
          </div>
          <Input
            placeholder="بحث بالعدد..."
            value={searchRef}
            onChange={e => setSearchRef(e.target.value)}
            data-testid="input-archive-search-ref"
          />
          <Select value={searchPriority} onValueChange={setSearchPriority}>
            <SelectTrigger data-testid="select-archive-priority"><SelectValue placeholder="الأولوية" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">الكل</SelectItem>
              <SelectItem value="low">منخفض</SelectItem>
              <SelectItem value="medium">متوسط</SelectItem>
              <SelectItem value="high">مرتفع</SelectItem>
              <SelectItem value="urgent">عاجل</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">من تاريخ</label>
            <Input
              type="date"
              value={searchDateFrom}
              onChange={e => setSearchDateFrom(e.target.value)}
              data-testid="input-archive-date-from"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">إلى تاريخ</label>
            <Input
              type="date"
              value={searchDateTo}
              onChange={e => setSearchDateTo(e.target.value)}
              data-testid="input-archive-date-to"
            />
          </div>
        </div>
      </Card>

      <CorrespondenceList
        items={filtered}
        selectedId={selectedId}
        onSelect={onSelect}
        departments={departments}
        emptyMessage={currentArchive.empty}
        orgName={orgName}
        allFlowTemplates={allFlowTemplates}
        isInboxView={currentArchive.isInbox}
      />
    </div>
  );
}

function MyFollowUpsSection({ selectedId, onSelect, departments, orgName, allFlowTemplates }: {
  selectedId: number | null;
  onSelect: (id: number) => void;
  departments: Department[];
  orgName?: string;
  allFlowTemplates?: any[];
}) {
  const { toast } = useToast();
  const [followTab, setFollowTab] = useState("outgoing_internal");
  const [extendDialog, setExtendDialog] = useState<{ id: number; source: string; currentDays: number } | null>(null);
  const [extendDays, setExtendDays] = useState("");

  const { data: followUpData, isLoading } = useQuery<any>({
    queryKey: ["/api/correspondence/my-followups"],
    queryFn: async () => {
      const res = await fetch("/api/correspondence/my-followups", { credentials: "include" });
      if (!res.ok) return { incomingFollowUps: [], outgoingFollowUps: [] };
      return res.json();
    },
  });

  const removeFollowUpMutation = useMutation({
    mutationFn: async ({ id, source }: { id: number; source: string }) => {
      if (source === "incoming") {
        const res = await apiRequest("PATCH", `/api/assignments/${id}/remove-followup`);
        return res.json();
      } else {
        const res = await apiRequest("DELETE", `/api/followups/${id}`);
        return res.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/correspondence/my-followups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/correspondence/deadline-alerts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/correspondence/overdue-reminders"] });
      toast({ title: "تم إزالة المتابعة" });
    },
    onError: () => toast({ title: "خطأ", variant: "destructive" }),
  });

  const extendFollowUpMutation = useMutation({
    mutationFn: async ({ id, source, days }: { id: number; source: string; days: number }) => {
      if (source === "incoming") {
        const res = await apiRequest("PATCH", `/api/assignments/${id}/extend-followup`, { days });
        return res.json();
      } else {
        const res = await apiRequest("PATCH", `/api/followups/${id}/edit`, { days });
        return res.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/correspondence/my-followups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/correspondence/deadline-alerts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/correspondence/overdue-reminders"] });
      setExtendDialog(null);
      setExtendDays("");
      toast({ title: "تم تعديل مدة المتابعة" });
    },
    onError: () => toast({ title: "خطأ", variant: "destructive" }),
  });

  if (isLoading) {
    return <div className="space-y-3">{[1, 2].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}</div>;
  }

  const incoming = followUpData?.incomingFollowUps || [];
  const outgoing = followUpData?.outgoingFollowUps || [];
  const allItems = [...incoming, ...outgoing];

  const outInternal = outgoing.filter((i: any) => i.type === "internal_outgoing");
  const outExternal = outgoing.filter((i: any) => i.type === "external_outgoing");
  const inInternal = incoming.filter((i: any) => i.type === "internal_outgoing" || i.type === "internal_incoming");
  const inExternal = incoming.filter((i: any) => i.type === "external_outgoing" || i.type === "external_incoming");

  const tabs = [
    { key: "outgoing_internal", label: "صادرة داخلية", items: outInternal },
    { key: "outgoing_external", label: "صادرة خارجية", items: outExternal },
    { key: "incoming_internal", label: "واردة داخلية", items: inInternal },
    { key: "incoming_external", label: "واردة خارجية", items: inExternal },
  ];
  const currentTab = tabs.find(t => t.key === followTab) || tabs[0];

  if (allItems.length === 0) {
    return (
      <Card className="p-12">
        <div className="text-center text-muted-foreground">
          <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">لا توجد متابعات حالية</p>
          <p className="text-sm mt-1">عند تعيين متابعة على مراسلة صادرة أو واردة، ستظهر هنا</p>
        </div>
      </Card>
    );
  }

  const isOutgoingTab = followTab === "outgoing_internal" || followTab === "outgoing_external";

  const getRowColor = (item: any) => {
    if (item.daysRemaining === null || item.daysRemaining === undefined) return "";
    if (item.daysRemaining < 0) return "bg-red-100/70 dark:bg-red-950/30 border-r-4 border-r-red-500";
    if (item.daysRemaining <= 3) return "bg-orange-100/70 dark:bg-orange-950/30 border-r-4 border-r-orange-500";
    return "bg-green-100/50 dark:bg-green-950/20 border-r-4 border-r-green-500";
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    return d.toLocaleDateString("ar-IQ", { year: "numeric", month: "2-digit", day: "2-digit" });
  };

  const renderTable = (items: any[]) => {
    if (items.length === 0) {
      return (
        <Card className="p-8">
          <div className="text-center text-muted-foreground">
            <ClipboardList className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">لا توجد متابعات في هذا القسم</p>
          </div>
        </Card>
      );
    }
    return (
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 text-right">
              <th className="px-3 py-2 font-medium">العدد</th>
              <th className="px-3 py-2 font-medium">التاريخ</th>
              <th className="px-3 py-2 font-medium">الموضوع</th>
              <th className="px-3 py-2 font-medium">{isOutgoingTab ? "الجهة المستلمة" : "الجهة المرسلة"}</th>
              <th className="px-3 py-2 font-medium">الجهة الحالية</th>
              <th className="px-3 py-2 font-medium">الحالة</th>
              <th className="px-3 py-2 font-medium">المدة</th>
              <th className="px-3 py-2 font-medium">المتبقي</th>
              <th className="px-3 py-2 font-medium w-[120px]">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((item: any) => {
              const isOverdue = item.isOverdue;
              const rowColor = getRowColor(item);
              return (
                <tr
                  key={`${item.source}-${item.id}`}
                  className={`cursor-pointer hover:bg-muted/30 transition-colors ${rowColor} ${selectedId === item.correspondenceId ? 'ring-2 ring-inset ring-primary' : ''}`}
                  onClick={() => onSelect(item.correspondenceId)}
                  data-testid={`followup-row-${item.id}`}
                >
                  <td className="px-3 py-2.5 text-muted-foreground text-xs">{item.referenceNumber || "—"}</td>
                  <td className="px-3 py-2.5 text-muted-foreground text-xs whitespace-nowrap">{formatDate(item.issuedAt || item.createdAt)}</td>
                  <td className="px-3 py-2.5">
                    <p className="font-medium truncate max-w-[180px]">{item.subject}</p>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground text-xs">{isOutgoingTab ? (item.receiverDepartmentName || "") : (item.senderDepartmentName || "")}</td>
                  <td className="px-3 py-2.5 text-muted-foreground text-xs">{item.currentDepartmentName || "—"}</td>
                  <td className="px-3 py-2.5">
                    <Badge variant="secondary" className={`text-xs ${statusColors[item.status || "draft"]}`}>
                      {statusLabels[item.status || "draft"]}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge variant="secondary" className="text-xs">
                      {item.followUpDays ? `${item.followUpDays} يوم` : "—"}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5">
                    {item.daysRemaining !== null ? (
                      <span className={`text-xs font-medium flex items-center gap-1 ${isOverdue ? 'text-destructive font-bold' : item.daysRemaining <= 3 ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400'}`}>
                        <Timer className="w-3 h-3" />
                        {isOverdue ? `متأخر ${Math.abs(item.daysRemaining)} يوم` : `${item.daysRemaining} يوم`}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => {
                          setExtendDialog({ id: item.id, source: item.source, currentDays: item.followUpDays || 0 });
                          setExtendDays("");
                        }}
                        data-testid={`btn-extend-${item.id}`}
                      >
                        <CalendarDays className="w-3 h-3 ml-1" />
                        تعديل
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                        onClick={() => removeFollowUpMutation.mutate({ id: item.id, source: item.source })}
                        data-testid={`btn-remove-followup-${item.id}`}
                      >
                        <X className="w-3 h-3 ml-1" />
                        إزالة
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <Tabs value={followTab} onValueChange={setFollowTab}>
        <TabsList className="inline-flex flex-wrap h-auto gap-1.5 p-1.5 bg-muted/50 rounded-xl border">
          {tabs.map(t => (
            <TabsTrigger key={t.key} value={t.key} data-testid={`tab-followup-${t.key}`} className="gap-2 px-4 py-2 rounded-lg text-sm font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-primary transition-all">
              {t.label}
              <span className="inline-flex items-center justify-center h-5 min-w-[24px] rounded-full text-[11px] font-semibold px-1.5 bg-muted text-muted-foreground">
                {t.items.length}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {renderTable(currentTab.items)}

      <Dialog open={!!extendDialog} onOpenChange={o => { if (!o) setExtendDialog(null); }}>
        <DialogContent className="sm:max-w-[360px]" aria-describedby="extend-dialog-desc">
          <DialogHeader>
            <DialogTitle>تعديل مدة المتابعة</DialogTitle>
          </DialogHeader>
          <p id="extend-dialog-desc" className="text-sm text-muted-foreground">
            المدة الحالية: {extendDialog?.currentDays || 0} يوم
          </p>
          <div className="space-y-3">
            <div>
              <Label className="text-sm">المدة الجديدة (بالأيام)</Label>
              <Input
                type="number"
                min="1"
                value={extendDays}
                onChange={e => setExtendDays(e.target.value)}
                placeholder="عدد الأيام"
                className="mt-1"
                data-testid="input-extend-days"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setExtendDialog(null)}>إلغاء</Button>
              <Button
                size="sm"
                disabled={!extendDays || parseInt(extendDays) <= 0 || extendFollowUpMutation.isPending}
                onClick={() => {
                  if (extendDialog && extendDays) {
                    extendFollowUpMutation.mutate({ id: extendDialog.id, source: extendDialog.source, days: parseInt(extendDays) });
                  }
                }}
                data-testid="btn-confirm-extend"
              >
                تعديل
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface ReplyContext {
  parentCorrespondenceId: number;
  parentSubject: string;
  parentType: string;
  senderDepartmentId: number | null;
  receiverDepartmentId: number | null;
  priority: string;
  confidentiality: string;
  externalEntity?: string;
}

function CentralMailAssignedSection({ items, departments, employees, selectedId, onSelect }: {
  items: Correspondence[];
  departments: Department[];
  employees: Employee[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterAssignee, setFilterAssignee] = useState<string>("all");
  const [searchText, setSearchText] = useState("");
  const [reassignCorrId, setReassignCorrId] = useState<number | null>(null);
  const [newAssigneeId, setNewAssigneeId] = useState<number | null>(null);

  const { data: authorizedReceivers } = useQuery<any[]>({
    queryKey: ["/api/employees/authorized-receivers"],
  });

  const reassignMutation = useMutation({
    mutationFn: async ({ corrId, assignToEmployeeId }: { corrId: number; assignToEmployeeId: number }) => {
      const res = await apiRequest("POST", `/api/correspondence/${corrId}/reassign-external-incoming`, { assignToEmployeeId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/correspondence"] });
      toast({ title: "تم إعادة إسناد المراسلة بنجاح" });
      setReassignCorrId(null);
      setNewAssigneeId(null);
    },
    onError: (error: Error) => {
      toast({ title: "حدث خطأ", description: error.message, variant: "destructive" });
    },
  });

  const myItems = items.filter(i => i.type === "external_incoming" && i.centralMailAssignedById === user?.id);

  const filtered = myItems.filter(i => {
    if (filterStatus === "assigned" && (i.assignedToId === null || i.status === "archived")) return false;
    if (filterStatus === "returned" && i.assignedToId !== null) return false;
    if (filterStatus === "archived" && i.status !== "archived") return false;
    if (filterAssignee !== "all" && i.assignedToId !== parseInt(filterAssignee)) return false;
    if (searchText.trim() && !i.subject.includes(searchText.trim()) && !(i.externalEntity || "").includes(searchText.trim())) return false;
    return true;
  });

  const statusLabel = (item: Correspondence) => {
    if (item.status === "archived") return { label: "مؤرشفة", color: "bg-muted text-muted-foreground" };
    if (!item.assignedToId) return { label: "مُعادة", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" };
    return { label: "مُسندة", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" };
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pr-9"
            placeholder="بحث بالموضوع أو الجهة..."
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            data-testid="input-search-assigned"
          />
        </div>
        <select
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          data-testid="select-filter-status"
        >
          <option value="all">جميع الحالات</option>
          <option value="assigned">مُسندة</option>
          <option value="returned">مُعادة</option>
          <option value="archived">مؤرشفة</option>
        </select>
        {authorizedReceivers && authorizedReceivers.length > 0 && (
          <select
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={filterAssignee}
            onChange={e => setFilterAssignee(e.target.value)}
            data-testid="select-filter-assignee"
          >
            <option value="all">جميع المخوّلين</option>
            {authorizedReceivers.map(r => (
              <option key={r.id} value={r.id.toString()}>{r.fullName}</option>
            ))}
          </select>
        )}
      </div>

      {filtered.length === 0 ? (
        <Card className="p-12">
          <div className="text-center text-muted-foreground">
            <MailOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">لا توجد مراسلات واردة خارجية</p>
            <p className="text-sm mt-1">ستظهر هنا المراسلات التي قمت بإدخالها وإسنادها</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(item => {
            const assignee = employees.find(e => e.id === item.assignedToId);
            const assigneeDept = departments.find(d => d.id === assignee?.departmentId);
            const st = statusLabel(item);
            const isReturned = !item.assignedToId && item.status !== "archived";

            return (
              <Card
                key={item.id}
                className={`p-4 cursor-pointer transition-all duration-150 hover-elevate ${selectedId === item.id ? "ring-2 ring-primary" : ""} ${isReturned ? "border-amber-300 dark:border-amber-700" : ""}`}
                onClick={() => onSelect(item.id)}
                data-testid={`card-assigned-${item.id}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={`text-xs ${st.color}`}>{st.label}</Badge>
                      {item.referenceNumber && (
                        <span className="text-xs text-muted-foreground font-mono">{item.referenceNumber}</span>
                      )}
                    </div>
                    <p className="font-medium text-sm truncate">{item.subject}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      {item.externalEntity && (
                        <span className="flex items-center gap-1">
                          <Globe className="w-3 h-3" />
                          {item.externalEntity}
                        </span>
                      )}
                      {assignee && (
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {assignee.fullName} {assigneeDept ? `(${assigneeDept.name})` : ""}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(item.createdAt!).toLocaleDateString("ar-IQ")}
                      </span>
                    </div>
                  </div>

                  {isReturned && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0 text-amber-600 border-amber-300"
                      onClick={(e) => {
                        e.stopPropagation();
                        setReassignCorrId(item.id);
                        setNewAssigneeId(null);
                      }}
                      data-testid={`button-reassign-${item.id}`}
                    >
                      <RotateCw className="w-4 h-4 ml-1" />
                      إعادة إسناد
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!reassignCorrId} onOpenChange={(o) => { if (!o) { setReassignCorrId(null); setNewAssigneeId(null); } }}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>إعادة إسناد الوارد الخارجي</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">اختر الحساب المخوّل الجديد لاستلام المراسلة</p>
            {authorizedReceivers && authorizedReceivers.length > 0 ? (
              <div className="grid grid-cols-1 gap-2">
                {authorizedReceivers.map((recv: any) => {
                  const dept = departments.find(d => d.id === recv.departmentId);
                  const isSelected = newAssigneeId === recv.id;
                  return (
                    <Card
                      key={recv.id}
                      className={`p-3 cursor-pointer transition-all duration-150 hover-elevate ${isSelected ? 'ring-2 ring-primary bg-primary/5' : ''}`}
                      onClick={() => setNewAssigneeId(recv.id)}
                      data-testid={`card-reassign-${recv.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                          <User className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{recv.fullName}</p>
                          <p className="text-xs text-muted-foreground">{dept?.name || ""}</p>
                        </div>
                        {isSelected && <CheckCircle className="w-5 h-5 text-primary shrink-0 mr-auto" />}
                      </div>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-amber-600">لا يوجد حسابات مخوّلة</p>
            )}
            <div className="flex gap-2">
              <Button
                className="flex-1"
                disabled={!newAssigneeId || reassignMutation.isPending}
                onClick={() => {
                  if (reassignCorrId && newAssigneeId) {
                    reassignMutation.mutate({ corrId: reassignCorrId, assignToEmployeeId: newAssigneeId });
                  }
                }}
                data-testid="button-confirm-reassign"
              >
                {reassignMutation.isPending && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
                تأكيد الإسناد
              </Button>
              <Button variant="ghost" onClick={() => { setReassignCorrId(null); setNewAssigneeId(null); }}>
                إلغاء
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function CorrespondencePage() {
  const { user } = useAuth();
  const isCentralMail = user?.role === "central_mail";

  const validSections = ["compose", "inbox", "pending_signature", "completed_by_me", "followup", "archive", "assigned"];
  const initialTabFromUrl = (() => {
    if (typeof window === "undefined") return null;
    const p = new URLSearchParams(window.location.search).get("tab");
    return p && validSections.includes(p) ? p : null;
  })();

  const [activeSection, setActiveSection] = useState(initialTabFromUrl || (isCentralMail ? "compose" : "pending_signature"));
  const [selectedCorrId, setSelectedCorrId] = useState<number | null>(null);
  const [replyContext, setReplyContext] = useState<ReplyContext | null>(null);
  const [initialInboxTab, setInitialInboxTab] = useState<string | null>(null);

  useEffect(() => {
    const onPop = () => {
      const p = new URLSearchParams(window.location.search).get("tab");
      if (p && validSections.includes(p)) setActiveSection(p);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail.tab === "incoming") {
        setActiveSection("inbox");
        setInitialInboxTab(detail.subTab === "in_external" ? "external" : detail.subTab === "in_internal" ? "internal" : null);
      }
      if (detail.openId) {
        setSelectedCorrId(parseInt(detail.openId));
      }
    };
    window.addEventListener("notif-nav", handler);
    return () => window.removeEventListener("notif-nav", handler);
  }, []);

  useEffect(() => {
    fetch("/api/correspondence/check-followup-expiry", { method: "POST", credentials: "include" }).catch(() => {});
  }, []);

  const { data: items, isLoading } = useQuery<Correspondence[]>({
    queryKey: ["/api/correspondence"],
  });
  const { data: departments } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
  });
  const { data: employees } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
  });
  const { data: publicSettings } = useQuery<any>({
    queryKey: ["/api/settings/public"],
  });
  const { data: readMap } = useQuery<Record<number, string>>({
    queryKey: ["/api/correspondence/read-status"],
    queryFn: async () => {
      const res = await fetch("/api/correspondence/read-status", { credentials: "include" });
      if (!res.ok) return {};
      return res.json();
    },
  });
  const { data: deadlineAlerts } = useQuery<any[]>({
    queryKey: ["/api/correspondence/deadline-alerts"],
    queryFn: async () => {
      const res = await fetch("/api/correspondence/deadline-alerts", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });
  const { data: myFollowupsForBadge } = useQuery<any>({
    queryKey: ["/api/correspondence/my-followups"],
    queryFn: async () => {
      const res = await fetch("/api/correspondence/my-followups", { credentials: "include" });
      if (!res.ok) return { incomingFollowUps: [], outgoingFollowUps: [] };
      return res.json();
    },
  });
  const followUpAllItems = [
    ...(Array.isArray(myFollowupsForBadge?.incomingFollowUps) ? myFollowupsForBadge.incomingFollowUps : []),
    ...(Array.isArray(myFollowupsForBadge?.outgoingFollowUps) ? myFollowupsForBadge.outgoingFollowUps : []),
  ];
  const followUpAlertCount = followUpAllItems.filter((it: any) => it && it.daysRemaining !== null && it.daysRemaining !== undefined && it.daysRemaining <= 3).length + (deadlineAlerts?.length || 0);
  const { data: allFlowTemplatesPage } = useQuery<any[]>({
    queryKey: ["/api/flow-templates"],
    queryFn: async () => {
      const res = await fetch("/api/flow-templates", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const markReadMutation = useMutation({
    mutationFn: async (corrId: number) => {
      const res = await apiRequest("POST", `/api/correspondence/${corrId}/mark-read`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/correspondence/read-status"] });
    },
  });

  const pageOrgName = publicSettings?.orgName || "";
  const canAccessCorr = user?.canAccessCorrespondence || user?.role === "admin" || isCentralMail;
  const canOutgoing = canAccessCorr && !isCentralMail;
  const canIncoming = canAccessCorr && !isCentralMail;

  const permittedItems = items || [];

  const myDeptId = user?.departmentId;

  const incomingItems = permittedItems.filter(i => {
    if ((i as any)._actedAccessOnly) return false;
    const isInSenderChain = (i as any)._isInSenderChain;
    if (isInSenderChain) return false;
    const isCcRecipient = (i as any)._isCcRecipient;
    if (!isCcRecipient && myDeptId && i.currentDepartmentId && i.currentDepartmentId !== myDeptId) return false;
    const isOutgoing = i.type === "internal_outgoing" || i.type === "external_outgoing";
    if (isOutgoing && (i.status === "issued" || i.status === "in_progress")) return true;
    if (!isOutgoing && (i.status === "issued" || i.status === "in_progress")) return true;
    return false;
  });
  const followUpCount = permittedItems.filter(i => {
    if ((i as any)._actedAccessOnly) return false;
    const status = i.status || "draft";
    const isInSenderChain = (i as any)._isInSenderChain;
    if (!isInSenderChain) return false;
    if (i.issuedAt || i.referenceNumber) return false;
    if (!["draft", "under_review", "pending_approval", "approved", "in_progress"].includes(status)) return false;
    if (myDeptId && i.currentDepartmentId !== myDeptId) return false;
    return true;
  }).length;
  const archiveCount = permittedItems.filter(i => {
    if ((i as any)._actedAccessOnly) return false;
    const status = i.status || "";
    if (["completed", "archived"].includes(status)) return true;
    const isInSenderChain = (i as any)._isInSenderChain;
    const isOutgoing = i.type === "internal_outgoing" || i.type === "external_outgoing";
    if (isInSenderChain && isOutgoing && (status === "issued" || i.issuedAt || i.referenceNumber)) return true;
    return false;
  }).length;

  const completedByMeCount = permittedItems.filter(i => {
    if (!(i as any)._actedByMe) return false;
    const status = i.status || "";
    if (["archived", "completed", "cancelled"].includes(status)) return false;
    const isOutgoing = i.type === "internal_outgoing" || i.type === "external_outgoing";
    if (isOutgoing && (i.issuedAt || i.referenceNumber || status === "issued")) return false;
    if (!isOutgoing && (i as any)._hasReplies) return false;
    if (myDeptId && i.currentDepartmentId === myDeptId) return false;
    return true;
  }).length;

  const centralMailAssignedCount = isCentralMail ? permittedItems.filter(i => i.type === "external_incoming" && i.centralMailAssignedById === user?.id).length : 0;
  const centralMailReturnedCount = isCentralMail ? permittedItems.filter(i => i.type === "external_incoming" && i.centralMailAssignedById === user?.id && !i.assignedToId && i.status !== "archived").length : 0;

  const unreadInboxCount = readMap ? incomingItems.filter(i => !readMap[i.id]).length : 0;

  const sections = isCentralMail ? [
    { key: "compose", label: "إدخال وارد خارجي", icon: MailOpen, color: "text-chart-1", bgColor: "bg-chart-1/10" },
    { key: "assigned", label: "المراسلات المُسندة", icon: Send, color: "text-chart-3", bgColor: "bg-chart-3/10", count: centralMailAssignedCount, badge: centralMailReturnedCount },
  ] as { key: string; label: string; icon: any; color: string; bgColor: string; count?: number; badge?: number }[] : [
    ...(canOutgoing ? [{ key: "compose", label: "إعداد مراسلة", icon: FileEdit, color: "text-chart-1", bgColor: "bg-chart-1/10" }] : []),
    ...(canIncoming ? [{ key: "inbox", label: "البريد الوارد", icon: Inbox, color: "text-chart-3", bgColor: "bg-chart-3/10", count: incomingItems.length, badge: unreadInboxCount }] : []),
    { key: "pending_signature", label: "بانتظار التوقيع", icon: Eye, color: "text-chart-5", bgColor: "bg-chart-5/10", count: followUpCount, badge: followUpCount },
    { key: "completed_by_me", label: "مهامي المنجزة", icon: CheckCircle, color: "text-emerald-600 dark:text-emerald-400", bgColor: "bg-emerald-500/10", count: completedByMeCount },
    { key: "followup", label: "المتابعة", icon: ClipboardList, color: "text-chart-2", bgColor: "bg-chart-2/10", badge: followUpAlertCount },
    { key: "archive", label: "الأرشيف", icon: Archive, color: "text-chart-4", bgColor: "bg-chart-4/10", count: archiveCount },
  ] as { key: string; label: string; icon: any; color: string; bgColor: string; count?: number; badge?: number }[];

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-correspondence-title">المراسلات</h1>
        <p className="text-muted-foreground text-sm mt-1">البريد الصادر و الوارد</p>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {sections.map(s => {
          const IconComp = s.icon;
          const isActive = activeSection === s.key;
          return (
            <Card
              key={s.key}
              className={`p-4 cursor-pointer transition-all duration-150 hover-elevate ${isActive ? 'ring-2 ring-primary' : ''} relative`}
              onClick={() => setActiveSection(s.key)}
              data-testid={`card-section-${s.key}`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${s.bgColor}`}>
                  <IconComp className={`w-5 h-5 ${s.color}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{s.label}</p>
                  {s.count !== undefined && (
                    <p className={`text-lg font-bold ${s.color}`}>{s.count}</p>
                  )}
                </div>
              </div>
              {s.badge && s.badge > 0 ? (
                <span className="absolute -top-1.5 -left-1.5 flex items-center justify-center" data-testid={`badge-${s.key}`}>
                  <span className="absolute inline-flex w-3.5 h-3.5 rounded-full bg-destructive/50 animate-ping"></span>
                  <span className="relative inline-flex w-3 h-3 rounded-full bg-destructive shadow-md ring-2 ring-background"></span>
                </span>
              ) : null}
            </Card>
          );
        })}
      </div>


      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
      ) : (
        <>
          {activeSection === "compose" && (
            <ComposeSection
              departments={departments || []}
              onCreated={() => { setActiveSection(isCentralMail ? "assigned" : "pending_signature"); setReplyContext(null); }}
              replyContext={replyContext}
              onClearReply={() => setReplyContext(null)}
              onViewParent={(id) => { setSelectedCorrId(id); }}
            />
          )}

          {activeSection === "assigned" && isCentralMail && (
            <CentralMailAssignedSection
              items={permittedItems}
              departments={departments || []}
              employees={employees || []}
              selectedId={selectedCorrId}
              onSelect={setSelectedCorrId}
            />
          )}

          {activeSection === "inbox" && (
            <InboxSection
              items={incomingItems}
              selectedId={selectedCorrId}
              onSelect={(id) => { setSelectedCorrId(id); markReadMutation.mutate(id); }}
              departments={departments || []}
              orgName={pageOrgName}
              readMap={readMap}
              allFlowTemplates={allFlowTemplatesPage}
              defaultTab={initialInboxTab}
            />
          )}

          {activeSection === "pending_signature" && (
            <FollowUpSection
              items={items || []}
              selectedId={selectedCorrId}
              onSelect={setSelectedCorrId}
              departments={departments || []}
              orgName={pageOrgName}
              allFlowTemplates={allFlowTemplatesPage}
            />
          )}

          {activeSection === "completed_by_me" && (
            <CompletedByMeSection
              items={items || []}
              selectedId={selectedCorrId}
              onSelect={setSelectedCorrId}
              departments={departments || []}
              orgName={pageOrgName}
              allFlowTemplates={allFlowTemplatesPage}
            />
          )}

          {activeSection === "followup" && (
            <MyFollowUpsSection
              selectedId={selectedCorrId}
              onSelect={setSelectedCorrId}
              departments={departments || []}
              orgName={pageOrgName}
              allFlowTemplates={allFlowTemplatesPage}
            />
          )}

          {activeSection === "archive" && (
            <ArchiveSection
              items={items || []}
              selectedId={selectedCorrId}
              onSelect={setSelectedCorrId}
              departments={departments || []}
              orgName={pageOrgName}
              allFlowTemplates={allFlowTemplatesPage}
            />
          )}
        </>
      )}

      <Dialog open={!!selectedCorrId} onOpenChange={(o) => { if (!o) setSelectedCorrId(null); }}>
        <DialogContent className="max-w-[95vw] max-h-[92vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>تفاصيل المراسلة</DialogTitle>
          </DialogHeader>
          {selectedCorrId && (
            <CorrespondenceDetail
              corrId={selectedCorrId}
              departments={departments || []}
              employees={employees || []}
              onClose={() => setSelectedCorrId(null)}
              orgName={pageOrgName}
              onReply={(ctx) => {
                setReplyContext(ctx);
                setSelectedCorrId(null);
                setActiveSection("compose");
              }}
              onViewCorrespondence={(id) => setSelectedCorrId(id)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
