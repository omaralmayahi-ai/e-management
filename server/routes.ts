import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, registerAuthRoutes, isAuthenticated, requirePasswordChanged } from "./replit_integrations/auth";
import { sanitizeEmployee, sanitizeEmployees } from "./employeeSanitizer";
import { isUserOnline, getUserActivity } from "./userActivity";
import { seedDatabase } from "./seed";
import { sanitizeHtmlContent } from "./htmlSanitizer";
import { insertDepartmentSchema, insertCorrespondenceSchema, insertLeaveRequestSchema, insertWorkflowEventSchema, insertUserPermissionSchema } from "@shared/schema";
import { z } from "zod";
import bcrypt from "bcryptjs";
import multer from "multer";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";

async function generateReferenceNumber(corrType: string, senderDepartmentId: number | null): Promise<string> {
  const currentYear = new Date().getFullYear();

  if (corrType === "external_outgoing") {
    const startSetting = await storage.getSystemSetting("externalOutgoingStartNumber");
    const endSetting = await storage.getSystemSetting("externalOutgoingEndNumber");
    const startNumber = startSetting?.value ? parseInt(startSetting.value) || 1 : 1;
    const endNumber = endSetting?.value ? parseInt(endSetting.value) || 0 : 0;

    const seq = await storage.getNextSequenceNumber("external_outgoing", null, startNumber);

    if (endNumber > 0 && seq > endNumber) {
      throw new Error(`تم تجاوز الحد الأقصى للرقم التسلسلي للصادر الخارجي (${endNumber})`);
    }

    let deptCode = "EXT";
    if (senderDepartmentId) {
      const senderDept = await storage.getDepartment(senderDepartmentId);
      if (senderDept) {
        if (senderDept.isCentral && senderDept.code) {
          deptCode = senderDept.code;
        } else {
          const allDepts = await storage.getDepartments();
          const deptMap = new Map(allDepts.map(d => [d.id, d]));
          let current: any = senderDept;
          while (current) {
            if (current.isCentral && current.code) {
              deptCode = current.code;
              break;
            }
            current = current.parentId ? deptMap.get(current.parentId) || null : null;
          }
          if (deptCode === "EXT" && senderDept.code) {
            deptCode = senderDept.code;
          }
        }
      }
    }
    return `${deptCode}-${seq}`;
  }

  if (corrType === "internal_outgoing") {
    const seq = await storage.getNextSequenceNumber("internal_outgoing", senderDepartmentId, 1);

    const senderDept = senderDepartmentId ? await storage.getDepartment(senderDepartmentId) : null;
    let deptCode = "INT";
    if (senderDept) {
      if (senderDept.isCentral && senderDept.code) {
        deptCode = senderDept.code;
      } else {
        const allDepts = await storage.getDepartments();
        const deptMap = new Map(allDepts.map(d => [d.id, d]));
        let current: any = senderDept;
        while (current) {
          if (current.isCentral && current.code) {
            deptCode = current.code;
            break;
          }
          current = current.parentId ? deptMap.get(current.parentId) || null : null;
        }
        if (deptCode === "INT" && senderDept.code) {
          deptCode = senderDept.code;
        }
      }
    }
    return `${deptCode}-${seq}`;
  }

  const typePrefix = corrType === "external_incoming" ? "EIN" : "IIN";
  const seq = await storage.getNextSequenceNumber(corrType, null, 1);
  return `${typePrefix}/${seq}/${currentYear}`;
}

const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const attachmentsDir = path.join(process.cwd(), "uploads", "attachments");
if (!fs.existsSync(attachmentsDir)) fs.mkdirSync(attachmentsDir, { recursive: true });

const signaturesDir = path.join(process.cwd(), "uploads", "signatures");
if (!fs.existsSync(signaturesDir)) fs.mkdirSync(signaturesDir, { recursive: true });

const inlineImagesDir = path.join(process.cwd(), "uploads", "inline-images");
if (!fs.existsSync(inlineImagesDir)) fs.mkdirSync(inlineImagesDir, { recursive: true });

const BLOCKED_EXTENSIONS = [
  '.exe', '.msi', '.bat', '.cmd', '.com', '.scr', '.pif', '.vbs', '.vbe',
  '.js', '.jse', '.ws', '.wsf', '.wsc', '.wsh', '.ps1', '.ps1xml', '.ps2',
  '.ps2xml', '.psc1', '.psc2', '.msh', '.msh1', '.msh2', '.inf', '.reg',
  '.dll', '.sys', '.drv', '.ocx', '.cpl', '.hta', '.jar', '.sh', '.bash',
  '.app', '.action', '.command', '.workflow', '.gadget', '.mst', '.msp',
  '.iso', '.img', '.bin', '.cab', '.lib', '.a', '.so', '.dylib',
];

const ALLOWED_MIME_TYPES = [
  'image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/bmp', 'image/webp', 'image/svg+xml', 'image/tiff',
  'application/pdf',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain', 'text/csv', 'text/rtf', 'application/rtf',
  'video/mp4', 'video/mpeg', 'video/webm', 'video/x-msvideo', 'video/quicktime',
  'audio/mpeg', 'audio/wav', 'audio/ogg',
  'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed',
];

const attachmentUpload = multer({
  storage: multer.diskStorage({
    destination: attachmentsDir,
    filename: (_req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname);
      cb(null, uniqueSuffix + ext);
    },
  }),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (BLOCKED_EXTENSIONS.includes(ext)) {
      cb(new Error("نوع الملف غير مسموح به لأسباب أمنية"));
      return;
    }
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(new Error("نوع الملف غير مدعوم"));
      return;
    }
    cb(null, true);
  },
});

const logoUpload = multer({
  storage: multer.diskStorage({
    destination: uploadsDir,
    filename: (_req, _file, cb) => cb(null, "logo.png"),
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/png", "image/jpeg", "image/jpg", "image/svg+xml", "image/webp", "image/gif", "image/bmp", "image/x-icon"];
    if (allowed.includes(file.mimetype) || file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("نوع الملف غير مدعوم. يرجى رفع صورة (PNG, JPG, SVG, WebP, GIF)"));
    }
  },
});

const INLINE_IMAGE_MIME_TYPES = [
  'image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'image/bmp',
];

const inlineImageUpload = multer({
  storage: multer.diskStorage({
    destination: inlineImagesDir,
    filename: (_req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname).toLowerCase() || '.png';
      cb(null, `img-${uniqueSuffix}${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (INLINE_IMAGE_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("نوع الصورة غير مدعوم"));
    }
  },
});

const signatureUpload = multer({
  storage: multer.diskStorage({
    destination: signaturesDir,
    filename: (_req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname);
      cb(null, `sig-${uniqueSuffix}${ext}`);
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("نوع الملف غير مدعوم. يرجى رفع صورة (PNG, JPG, WebP, SVG)"));
    }
  },
});

interface NotificationMeta {
  category?: string;
  relatedEntityId?: number;
  relatedEntityType?: string;
}

async function notifyDepartmentEmployees(departmentId: number, message: string, excludeEmployeeId?: number, meta?: NotificationMeta) {
  try {
    const allEmployees = await storage.getEmployees();
    const deptEmployees = allEmployees.filter(e => e.isActive && e.departmentId === departmentId && e.id !== excludeEmployeeId);
    if (deptEmployees.length === 0) return;
    const notif = await storage.createNotification({
      message,
      targetType: "specific",
      sentById: null as any,
      category: meta?.category || "correspondence",
      relatedEntityId: meta?.relatedEntityId,
      relatedEntityType: meta?.relatedEntityType,
    });
    await storage.createNotificationRecipients(notif.id, deptEmployees.map(e => e.id));
  } catch (err) {
    console.error("Error sending department notification:", err);
  }
}

async function notifyEmployee(employeeId: number, message: string, meta?: NotificationMeta) {
  try {
    const notif = await storage.createNotification({
      message,
      targetType: "specific",
      sentById: null as any,
      category: meta?.category || "correspondence",
      relatedEntityId: meta?.relatedEntityId,
      relatedEntityType: meta?.relatedEntityType,
    });
    await storage.createNotificationRecipients(notif.id, [employeeId]);
  } catch (err) {
    console.error("Error sending employee notification:", err);
  }
}

const validCorrespondenceStatuses = ["draft", "under_review", "pending_approval", "approved", "issued", "in_progress", "completed", "archived"] as const;
const validLeaveStatuses = ["pending", "approved_by_direct", "approved_by_section", "approved_by_hr", "approved", "rejected", "cancelled"] as const;

const correspondenceUpdateSchema = z.object({
  status: z.enum(validCorrespondenceStatuses).optional(),
  subject: z.string().optional(),
  content: z.string().optional(),
  marginNotes: z.string().optional(),
  notes: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  confidentiality: z.enum(["normal", "confidential", "top_secret"]).optional(),
  receiverDepartmentId: z.number().optional(),
  assignedToId: z.number().optional(),
  externalEntity: z.string().optional(),
  requiresReply: z.boolean().optional(),
  reminderDate: z.string().nullable().optional(),
  followUpDays: z.number().int().min(1).nullable().optional(),
  sendToAll: z.boolean().optional(),
  ccList: z.array(z.object({ departmentId: z.number(), reason: z.string() })).optional(),
  externalCcList: z.array(z.object({ entityName: z.string(), reason: z.string() })).optional(),
  hiddenCcList: z.array(z.object({ departmentId: z.number(), reason: z.string() })).optional(),
});

const leaveStatusUpdateSchema = z.object({
  status: z.enum(validLeaveStatuses),
  notes: z.string().optional(),
});

async function migratePermissions() {
  try {
    try {
      const { db: database } = await import("./db");
      const { sql: sqlTag } = await import("drizzle-orm");
      const result = await database.execute(sqlTag`
        UPDATE workflow_events we
        SET from_department_id = e.department_id
        FROM employees e
        WHERE we.performed_by_id = e.id
          AND e.department_id IS NOT NULL
          AND (we.from_department_id IS NULL OR we.from_department_id != e.department_id)
          AND we.action IN ('elevate', 'return_for_modification', 'final_sign', 'sign_and_forward', 'approve_and_forward', 'final_approve_and_issue')
      `);
      console.log("[migration] Fixed fromDepartmentId in workflow events");
    } catch (fixErr) {
      console.error("[migration] Error fixing workflow events:", fixErr);
    }

    try {
      const { db: database } = await import("./db");
      const { sql: sqlTag } = await import("drizzle-orm");
      await database.execute(sqlTag`
        UPDATE correspondence c
        SET current_department_id = latest_event.to_department_id
        FROM (
          SELECT DISTINCT ON (correspondence_id) correspondence_id, to_department_id
          FROM workflow_events
          WHERE action IN ('elevate', 'return_for_modification', 'final_sign', 'sign_and_forward', 'approve_and_forward', 'final_approve_and_issue')
            AND to_department_id IS NOT NULL
          ORDER BY correspondence_id, created_at DESC
        ) latest_event
        WHERE c.id = latest_event.correspondence_id
          AND c.status NOT IN ('draft', 'issued', 'archived', 'cancelled')
          AND (c.current_department_id IS NULL OR c.current_department_id != latest_event.to_department_id)
      `);
      console.log("[migration] Fixed currentDepartmentId in correspondence based on latest workflow events");
    } catch (fixErr2) {
      console.error("[migration] Error fixing currentDepartmentId:", fixErr2);
    }

    try {
      const { db: database } = await import("./db");
      const { sql: sqlTag } = await import("drizzle-orm");
      await database.execute(sqlTag`
        UPDATE correspondence
        SET current_department_id = sender_department_id
        WHERE current_department_id IS NULL
          AND sender_department_id IS NOT NULL
          AND status NOT IN ('archived', 'completed', 'cancelled', 'issued')
      `);
      console.log("[migration] Backfilled currentDepartmentId from senderDepartmentId for items with no workflow events");
    } catch (fixErr3) {
      console.error("[migration] Error backfilling currentDepartmentId from sender:", fixErr3);
    }
  } catch (error) {
    console.error("[migration] Error migrating permissions:", error);
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await setupAuth(app);
  registerAuthRoutes(app);

  // Enforce password change on all protected API routes (excluding auth endpoints above)
  app.use(requirePasswordChanged);

  await seedDatabase();
  await migratePermissions();

  const pdfjsRoot = path.join(process.cwd(), "node_modules", "pdfjs-dist");
  app.use(
    "/pdfjs-assets/cmaps",
    (await import("express")).default.static(path.join(pdfjsRoot, "cmaps"), {
      maxAge: "30d",
      immutable: true,
      fallthrough: false,
    }),
  );
  app.use(
    "/pdfjs-assets/standard_fonts",
    (await import("express")).default.static(
      path.join(pdfjsRoot, "standard_fonts"),
      { maxAge: "30d", immutable: true, fallthrough: false },
    ),
  );

  app.get("/api/me", isAuthenticated, async (req: any, res) => {
    try {
      const employeeId = (req.session as any).employeeId;
      const employee = await storage.getEmployee(employeeId);
      if (!employee) {
        return res.status(404).json({ message: "لم يتم العثور على سجل الموظف" });
      }
      const dept = employee.departmentId ? await storage.getDepartment(employee.departmentId) : null;
      res.json({ ...sanitizeEmployee(employee), department: dept });
    } catch (error) {
      console.error("Error fetching current employee:", error);
      res.status(500).json({ message: "حدث خطأ" });
    }
  });

  app.get("/api/permissions/mine", isAuthenticated, async (req: any, res) => {
    try {
      const employeeId = (req.session as any).employeeId;
      const perms = await storage.getUserPermissions(employeeId);
      res.json(perms);
    } catch (error) {
      res.status(500).json({ message: "حدث خطأ" });
    }
  });

  app.get("/api/departments", isAuthenticated, async (_req, res) => {
    try {
      const items = await storage.getDepartments();
      res.json(items);
    } catch (error) {
      console.error("Error fetching departments:", error);
      res.status(500).json({ message: "حدث خطأ في جلب الأقسام" });
    }
  });

  app.get("/api/departments/:id/children", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id as string);
      const children = await storage.getDepartmentChildren(id);
      res.json(children);
    } catch (error) {
      res.status(500).json({ message: "حدث خطأ" });
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

  async function validateDepartmentHierarchy(level: string, parentId: number | null | undefined, excludeId?: number): Promise<string | null> {
    if (!parentId) return null;
    const allDepts = await storage.getDepartments();
    const parent = allDepts.find(d => d.id === parentId);
    if (!parent) return "الجهة الأم غير موجودة";
    const parentRank = levelRanks[parent.level] || 99;
    const childRank = levelRanks[level] || 99;
    if (childRank <= parentRank) {
      return "لا يمكن ربط تشكيل أعلى بتشكيل أدنى أو مساوٍ في المستوى";
    }
    if (excludeId && parentId === excludeId) {
      return "لا يمكن ربط الجهة بنفسها";
    }
    return null;
  }

  app.post("/api/departments", isAuthenticated, async (req: any, res) => {
    try {
      const currentUserId = (req.session as any).employeeId;
      const currentUser = await storage.getEmployee(currentUserId);
      if (!currentUser || currentUser.role !== "admin") {
        return res.status(403).json({ message: "غير مصرح بإنشاء الأقسام" });
      }

      const parsed = insertDepartmentSchema.parse(req.body) as any;
      if (parsed.isCentral && (!parsed.code || parsed.code.trim() === "")) {
        return res.status(400).json({ message: "رمز التشكيل مطلوب للأقسام المركزية" });
      }
      const hierarchyError = await validateDepartmentHierarchy(parsed.level, parsed.parentId);
      if (hierarchyError) {
        return res.status(400).json({ message: hierarchyError });
      }
      const item = await storage.createDepartment(parsed);
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "بيانات غير صحيحة", errors: error.errors });
      }
      console.error("Error creating department:", error);
      res.status(500).json({ message: "حدث خطأ في إنشاء القسم" });
    }
  });

  app.get("/api/employees", isAuthenticated, async (_req, res) => {
    try {
      const items = await storage.getEmployees();
      res.json(sanitizeEmployees(items));
    } catch (error) {
      res.status(500).json({ message: "حدث خطأ في جلب الموظفين" });
    }
  });

  app.get("/api/employees/authorized-receivers", isAuthenticated, async (_req: any, res) => {
    try {
      const items = await storage.getEmployees();
      const authorized = items
        .filter(e => e.isActive && e.canReceiveExternalIncoming)
        .map(e => ({ id: e.id, fullName: e.fullName, departmentId: e.departmentId, signatureUrl: e.signatureUrl, role: e.role }));
      res.json(authorized);
    } catch (error) {
      res.status(500).json({ message: "حدث خطأ في جلب الحسابات المخوّلة" });
    }
  });

  app.get("/api/employees/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id as string);
      const emp = await storage.getEmployee(id);
      if (!emp) return res.status(404).json({ message: "الموظف غير موجود" });
      res.json(sanitizeEmployee(emp));
    } catch (error) {
      res.status(500).json({ message: "حدث خطأ" });
    }
  });

  app.post("/api/employees", isAuthenticated, async (req: any, res) => {
    try {
      const currentUserId = (req.session as any).employeeId;
      const currentUser = await storage.getEmployee(currentUserId);
      if (!currentUser || currentUser.role !== "admin") {
        return res.status(403).json({ message: "غير مصرح بإنشاء الحسابات" });
      }

      const { permissionKeys, password, ...data } = req.body;

      if (!data.fullName || !data.username || !password) {
        return res.status(400).json({ message: "الاسم واسم المستخدم وكلمة المرور مطلوبة" });
      }
      if (!data.companyNumber) {
        return res.status(400).json({ message: "الرقم الوظيفي مطلوب" });
      }
      if (!data.landlinePhone) {
        return res.status(400).json({ message: "رقم الهاتف الأرضي مطلوب" });
      }
      if (!data.role || !["admin", "officer", "employee", "central_mail"].includes(data.role)) {
        return res.status(400).json({ message: "الدور مطلوب (موظف أو مسؤول أو بريد مركزي أو مدير نظام)" });
      }
      if ((data.role === "employee" || data.role === "officer") && !data.departmentId) {
        return res.status(400).json({ message: "الجهة مطلوبة" });
      }
      if (data.role === "admin" || data.role === "central_mail") {
        data.departmentId = null;
      }
      if (data.role === "central_mail") {
        data.canAccessCorrespondence = true;
        data.canAccessLeaveRequests = false;
      }
      if (data.role !== "officer" && data.role !== "admin") {
        data.canReceiveExternalIncoming = false;
      }

      const existing = await storage.getEmployeeByUsername(data.username);
      if (existing) {
        return res.status(400).json({ message: "اسم المستخدم مستخدم مسبقاً" });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const emp = await storage.createEmployee({
        ...data,
        passwordHash,
        mustChangePassword: true,
      });

      if (permissionKeys && Array.isArray(permissionKeys) && permissionKeys.length > 0) {
        await storage.batchUpdatePermissions(emp.id, permissionKeys, currentUserId);
      }

      await storage.createAuditLog({
        entityType: "employee",
        entityId: emp.id,
        action: "create",
        performedById: currentUserId,
        employeeId: currentUserId,
        module: "employees",
        details: `إنشاء حساب: ${emp.fullName}`,
      });

      res.status(201).json(sanitizeEmployee(emp));
    } catch (error) {
      console.error("Error creating employee:", error);
      res.status(500).json({ message: "حدث خطأ في إنشاء الحساب" });
    }
  });

  app.patch("/api/employees/:id", isAuthenticated, async (req: any, res) => {
    try {
      const currentUserId = (req.session as any).employeeId;
      const currentUser = await storage.getEmployee(currentUserId);
      if (!currentUser || currentUser.role !== "admin") {
        return res.status(403).json({ message: "غير مصرح بتعديل الحسابات" });
      }

      const id = parseInt(req.params.id);
      const { permissionKeys, password, ...data } = req.body;

      if ((data.role === "employee" || data.role === "officer") && !data.departmentId) {
        return res.status(400).json({ message: "الجهة مطلوبة" });
      }
      if (data.role === "admin" || data.role === "central_mail") {
        data.departmentId = null;
      }
      if (data.role === "central_mail") {
        data.canAccessCorrespondence = true;
        data.canAccessLeaveRequests = false;
      }
      if (data.role !== "officer" && data.role !== "admin") {
        data.canReceiveExternalIncoming = false;
      }

      if (password) {
        data.passwordHash = await bcrypt.hash(password, 10);
        data.mustChangePassword = true;
      }

      const emp = await storage.updateEmployee(id, data);
      if (!emp) return res.status(404).json({ message: "الموظف غير موجود" });

      if (permissionKeys && Array.isArray(permissionKeys)) {
        await storage.batchUpdatePermissions(id, permissionKeys, currentUserId);
      }

      await storage.createAuditLog({
        entityType: "employee",
        entityId: id,
        action: "update",
        performedById: currentUserId,
        employeeId: currentUserId,
        module: "employees",
        details: `تحديث حساب: ${emp.fullName}`,
      });

      res.json(sanitizeEmployee(emp));
    } catch (error) {
      console.error("Error updating employee:", error);
      res.status(500).json({ message: "حدث خطأ في تحديث الحساب" });
    }
  });

  app.post("/api/employees/:id/reset-password", isAuthenticated, async (req: any, res) => {
    try {
      const adminId = (req.session as any).employeeId;
      const admin = await storage.getEmployee(adminId);
      if (!admin || admin.role !== "admin") return res.status(403).json({ message: "غير مصرح" });

      const id = parseInt(req.params.id);
      const { newPassword } = req.body;
      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ message: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" });
      }

      const hash = await bcrypt.hash(newPassword, 10);
      await storage.updateEmployee(id, { passwordHash: hash, mustChangePassword: true });

      await storage.createAuditLog({
        entityType: "auth",
        entityId: id,
        action: "admin_reset_password",
        performedById: adminId,
        employeeId: adminId,
        module: "auth",
        details: `إعادة تعيين كلمة المرور للموظف ${id}`,
      });

      res.json({ message: "تم تغيير كلمة المرور بنجاح" });
    } catch (error) {
      res.status(500).json({ message: "حدث خطأ" });
    }
  });

  app.post("/api/employees/:id/signature", isAuthenticated, signatureUpload.single("signature"), async (req: any, res) => {
    try {
      const currentUserId = (req.session as any).employeeId;
      const currentUser = await storage.getEmployee(currentUserId);
      if (!currentUser) return res.status(401).json({ message: "غير مصرح" });

      const targetId = parseInt(req.params.id);
      const isAdmin = currentUser.role === "admin";
      const isSelf = currentUserId === targetId;
      if (!isAdmin && !isSelf) return res.status(403).json({ message: "غير مصرح" });

      if (!req.file) return res.status(400).json({ message: "صورة التوقيع مطلوبة" });

      const targetEmp = await storage.getEmployee(targetId);
      if (!targetEmp) return res.status(404).json({ message: "الموظف غير موجود" });

      if (targetEmp.signatureUrl) {
        const oldFile = path.join(signaturesDir, path.basename(targetEmp.signatureUrl));
        if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile);
      }

      const signatureUrl = `/api/uploads/signatures/${req.file.filename}`;
      await storage.updateEmployee(targetId, { signatureUrl });

      const actionDetail = isSelf ? `تغيير التوقيع الإلكتروني: ${targetEmp.fullName}` : `تحديث التوقيع الإلكتروني للموظف: ${targetEmp.fullName}`;
      await storage.createAuditLog({
        entityType: "employee",
        entityId: targetId,
        action: "update_signature",
        performedById: currentUserId,
        employeeId: targetId,
        module: "employees",
        details: actionDetail,
      });

      if (isSelf && !isAdmin) {
        const admins = (await storage.getEmployees()).filter(e => e.role === "admin" && e.isActive);
        if (admins.length > 0) {
          const notif = await storage.createNotification({
            message: `قام ${currentUser.fullName} بتغيير التوقيع الإلكتروني الخاص به`,
            targetType: "specific",
            sentById: currentUserId,
          });
          await storage.createNotificationRecipients(notif.id, admins.map(a => a.id));
        }
      }

      res.json({ signatureUrl });
    } catch (error) {
      console.error("Error uploading signature:", error);
      res.status(500).json({ message: "حدث خطأ في رفع التوقيع" });
    }
  });

  app.delete("/api/employees/:id/signature", isAuthenticated, async (req: any, res) => {
    try {
      const currentUserId = (req.session as any).employeeId;
      const currentUser = await storage.getEmployee(currentUserId);
      if (!currentUser) return res.status(401).json({ message: "غير مصرح" });

      const targetId = parseInt(req.params.id);
      const isAdmin = currentUser.role === "admin";
      const isSelf = currentUserId === targetId;
      if (!isAdmin && !isSelf) return res.status(403).json({ message: "غير مصرح" });

      const targetEmp = await storage.getEmployee(targetId);
      if (!targetEmp) return res.status(404).json({ message: "الموظف غير موجود" });

      if (targetEmp.signatureUrl) {
        const oldFile = path.join(signaturesDir, path.basename(targetEmp.signatureUrl));
        if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile);
      }

      await storage.updateEmployee(targetId, { signatureUrl: null });

      await storage.createAuditLog({
        entityType: "employee",
        entityId: targetId,
        action: "delete_signature",
        performedById: currentUserId,
        employeeId: targetId,
        module: "employees",
        details: `حذف التوقيع الإلكتروني: ${targetEmp.fullName}`,
      });

      if (isSelf && !isAdmin) {
        const admins = (await storage.getEmployees()).filter(e => e.role === "admin" && e.isActive);
        if (admins.length > 0) {
          const notif = await storage.createNotification({
            message: `قام ${currentUser.fullName} بحذف التوقيع الإلكتروني الخاص به`,
            targetType: "specific",
            sentById: currentUserId,
          });
          await storage.createNotificationRecipients(notif.id, admins.map(a => a.id));
        }
      }

      res.json({ message: "تم حذف التوقيع بنجاح" });
    } catch (error) {
      res.status(500).json({ message: "حدث خطأ" });
    }
  });

  app.patch("/api/employees/:id/toggle-active", isAuthenticated, async (req: any, res) => {
    try {
      const currentUserId = (req.session as any).employeeId;
      const currentUser = await storage.getEmployee(currentUserId);
      if (!currentUser || currentUser.role !== "admin") {
        return res.status(403).json({ message: "غير مصرح" });
      }

      const id = parseInt(req.params.id);
      if (id === currentUserId) return res.status(400).json({ message: "لا يمكنك إيقاف حسابك الخاص" });

      const target = await storage.getEmployee(id);
      if (!target) return res.status(404).json({ message: "الحساب غير موجود" });

      const newStatus = !target.isActive;
      await storage.updateEmployee(id, { isActive: newStatus });

      await storage.createAuditLog({
        entityType: "employee",
        entityId: id,
        action: newStatus ? "activate" : "deactivate",
        performedById: currentUserId,
        employeeId: currentUserId,
        module: "employees",
        details: `${newStatus ? "تنشيط" : "إيقاف تنشيط"} حساب ${target.fullName}`,
      });

      res.json({ message: newStatus ? "تم تنشيط الحساب" : "تم إيقاف تنشيط الحساب", isActive: newStatus });
    } catch (error) {
      res.status(500).json({ message: "حدث خطأ" });
    }
  });

  app.delete("/api/employees/:id", isAuthenticated, async (req: any, res) => {
    try {
      const currentUserId = (req.session as any).employeeId;
      const currentUser = await storage.getEmployee(currentUserId);
      if (!currentUser || currentUser.role !== "admin") {
        return res.status(403).json({ message: "غير مصرح" });
      }

      const id = parseInt(req.params.id);
      if (id === currentUserId) return res.status(400).json({ message: "لا يمكنك حذف حسابك الخاص" });

      const target = await storage.getEmployee(id);
      if (!target) return res.status(404).json({ message: "الحساب غير موجود" });

      await storage.deleteEmployee(id);

      await storage.createAuditLog({
        entityType: "employee",
        entityId: id,
        action: "delete",
        performedById: currentUserId,
        employeeId: currentUserId,
        module: "employees",
        details: `حذف حساب ${target.fullName} (${target.username})`,
      });

      res.json({ message: "تم حذف الحساب بنجاح" });
    } catch (error) {
      res.status(500).json({ message: "حدث خطأ في حذف الحساب" });
    }
  });

  app.get("/api/external-entities", isAuthenticated, async (_req, res) => {
    try {
      const entities = await storage.getExternalEntities();
      res.json(entities);
    } catch (error) {
      res.status(500).json({ message: "حدث خطأ" });
    }
  });

  app.post("/api/external-entities", isAuthenticated, async (req: any, res) => {
    try {
      const { name } = req.body;
      if (!name || !name.trim()) return res.status(400).json({ message: "اسم الجهة مطلوب" });
      const existing = await storage.getExternalEntityByName(name.trim());
      if (existing) return res.json(existing);
      const entity = await storage.createExternalEntity({ name: name.trim() });
      res.status(201).json(entity);
    } catch (error) {
      res.status(500).json({ message: "حدث خطأ" });
    }
  });

  app.get("/api/correspondence", isAuthenticated, async (req: any, res) => {
    try {
      const employeeId = (req.session as any).employeeId;
      const employee = await storage.getEmployee(employeeId);
      if (!employee) return res.status(401).json({ message: "Unauthorized" });

      const allItems = await storage.getCorrespondence();

      const ACTED_ACTIONS = [
        "elevate",
        "sign_and_forward",
        "approve_and_forward",
        "route_to_subordinate",
        "prepare_response",
        "return_for_modification",
      ];
      const actedOnIds = new Set<number>(await storage.getCorrespondenceIdsActedOnBy(employee.id, ACTED_ACTIONS));
      if (employee.departmentId) {
        for (const id of await storage.getCorrespondenceIdsActedOnByDept(employee.departmentId, ACTED_ACTIONS)) {
          actedOnIds.add(id);
        }
      }
      const repliedToIds = new Set(await storage.getCorrespondenceIdsWithReplies());

      if (employee.role === "admin") {
        return res.json(allItems.map(item => ({
          ...item,
          _isInSenderChain: true,
          _actedByMe: actedOnIds.has(item.id),
          _hasReplies: repliedToIds.has(item.id),
        })));
      }

      if (employee.role === "central_mail") {
        const myItems = allItems.filter(item =>
          item.createdById === employee.id ||
          (item as any).centralMailAssignedById === employee.id
        );
        return res.json(myItems.map(item => ({
          ...item,
          _isInSenderChain: false,
          _actedByMe: actedOnIds.has(item.id),
          _hasReplies: repliedToIds.has(item.id),
        })));
      }

      const empFlowTemplates = await storage.getFlowTemplatesForEmployee(employee.id);
      const flowGroupIds = empFlowTemplates.map((ft: any) => ft.groupId);

      const allFlowTemplates = await storage.getFlowTemplates();
      const employeeFlowGroupAccounts: Map<number, number[]> = new Map();
      const empDeptId = employee.departmentId;
      for (const ft of allFlowTemplates) {
        const groups = await storage.getFlowTemplateGroups(ft.id);
        for (const g of groups) {
          if (empDeptId && g.accounts && g.accounts.includes(empDeptId)) {
            employeeFlowGroupAccounts.set(g.id, g.accounts);
          }
        }
      }

      const filtered = [];
      const enrich = (item: any, extras: any) => ({
        ...item,
        ...extras,
        _actedByMe: actedOnIds.has(item.id),
        _hasReplies: repliedToIds.has(item.id),
      });
      for (const item of allItems) {
        const isOutgoing = item.type === "internal_outgoing" || item.type === "external_outgoing";

        let isCcForMe = false;
        if (empDeptId) {
          const issuedLike = item.status === "issued" || item.status === "in_progress" || item.status === "completed" || item.status === "archived";
          if (issuedLike) {
            const ccsForCheck = await storage.getCCsByCorrespondence(item.id);
            isCcForMe = ccsForCheck.some((cc: any) => cc.departmentId === empDeptId);
          }
        }
        const ccExtras = isCcForMe ? { _isCcRecipient: true } : {};

        let isInSenderChain = false;
        if (item.createdById === employee.id) {
          isInSenderChain = true;
        } else if (isOutgoing && (item as any).flowTemplateGroupId) {
          const groupAccounts = employeeFlowGroupAccounts.get((item as any).flowTemplateGroupId);
          if (empDeptId && groupAccounts && groupAccounts.includes(empDeptId)) {
            isInSenderChain = true;
          }
        }

        if (item.createdById === employee.id) {
          filtered.push(enrich(item, { _isInSenderChain: true, ...ccExtras }));
          continue;
        }

        if (isOutgoing && (item as any).flowTemplateGroupId) {
          const groupAccounts = employeeFlowGroupAccounts.get((item as any).flowTemplateGroupId);
          if (groupAccounts && empDeptId) {
            const myPos = groupAccounts.indexOf(empDeptId);
            if (myPos >= 0) {
              const events = await storage.getWorkflowEventsByCorrespondence(item.id);
              const hasBeenElevatedToMe = events.some((evt: any) => {
                const evtDeptId = evt.fromDepartmentId;
                if (evt.action === "elevate" || evt.action === "sign_and_forward" || evt.action === "approve_and_forward") {
                  const performerPos = evtDeptId ? groupAccounts.indexOf(evtDeptId) : -1;
                  return performerPos >= 0 && performerPos === myPos - 1;
                }
                if (evt.action === "return_for_modification") {
                  const performerPos = evtDeptId ? groupAccounts.indexOf(evtDeptId) : -1;
                  return performerPos >= 0 && performerPos === myPos + 1;
                }
                return false;
              });
              if (hasBeenElevatedToMe) {
                filtered.push(enrich(item, { _isInSenderChain: true, ...ccExtras }));
                continue;
              }
            }
          }
        }

        if (!isOutgoing) {
          if (item.receiverDepartmentId === employee.departmentId) {
            if (item.status !== "draft" && item.status !== "under_review" && item.status !== "pending_approval" && item.status !== "approved") {
              filtered.push(enrich(item, { _isInSenderChain: false, ...ccExtras }));
              continue;
            }
          }

          const assignments = await storage.getAssignmentsByCorrespondence(item.id);
          if (assignments.some((a: any) => a.departmentId === employee.departmentId)) {
            filtered.push(enrich(item, { _isInSenderChain: false, ...ccExtras }));
            continue;
          }

          if (isCcForMe) {
            filtered.push(enrich(item, { _isInSenderChain: false, _isCcRecipient: true }));
            continue;
          }
        }

        if (isOutgoing) {
          if (item.status === "issued" || item.status === "in_progress" || item.status === "completed" || item.status === "archived") {
            if (item.receiverDepartmentId === employee.departmentId) {
              filtered.push(enrich(item, { _isInSenderChain: false, ...ccExtras }));
              continue;
            }

            if (isCcForMe) {
              filtered.push(enrich(item, { _isInSenderChain: false, _isCcRecipient: true }));
              continue;
            }

            const assignments = await storage.getAssignmentsByCorrespondence(item.id);
            if (assignments.some((a: any) => a.departmentId === employee.departmentId)) {
              filtered.push(enrich(item, { _isInSenderChain: false, ...ccExtras }));
              continue;
            }
          }
        }

        if (actedOnIds.has(item.id)) {
          filtered.push(enrich(item, { _isInSenderChain: isInSenderChain, _actedAccessOnly: true, ...ccExtras }));
          continue;
        }
      }

      res.json(filtered);
    } catch (error) {
      console.error("Error fetching correspondence:", error);
      res.status(500).json({ message: "حدث خطأ في جلب المراسلات" });
    }
  });

  app.get("/api/correspondence/read-status", isAuthenticated, async (req: any, res) => {
    try {
      const employeeId = (req.session as any).employeeId;
      const statuses = await storage.getReadStatusesForEmployee(employeeId);
      const readMap: Record<number, string> = {};
      for (const s of statuses) {
        readMap[s.correspondenceId] = s.readAt?.toISOString() || new Date().toISOString();
      }
      res.json(readMap);
    } catch (error) {
      res.status(500).json({ message: "حدث خطأ في جلب حالة القراءة" });
    }
  });

  app.post("/api/correspondence/:id/mark-read", isAuthenticated, async (req: any, res) => {
    try {
      const employeeId = (req.session as any).employeeId;
      const corrId = parseInt(req.params.id);
      const corr = await storage.getCorrespondenceById(corrId);
      if (!corr) return res.status(404).json({ message: "لم يتم العثور على المراسلة" });
      const result = await storage.markCorrespondenceRead(corrId, employeeId);
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "حدث خطأ في تحديث حالة القراءة" });
    }
  });

  app.get("/api/correspondence/deadline-alerts", isAuthenticated, async (req: any, res) => {
    try {
      const employeeId = (req.session as any).employeeId;
      const alerts = await storage.getDeadlineAlerts(employeeId);
      res.json(alerts);
    } catch (error) {
      res.status(500).json({ message: "حدث خطأ في جلب تنبيهات المواعيد" });
    }
  });

  app.patch("/api/assignments/:id/complete", isAuthenticated, async (req: any, res) => {
    try {
      const employeeId = (req.session as any).employeeId;
      const assignmentId = parseInt(req.params.id);
      const assignments = await storage.getFollowUpAssignmentsByEmployee(employeeId);
      const assignment = assignments.find(a => a.id === assignmentId);
      if (!assignment) return res.status(403).json({ message: "غير مصرح بتحديث هذا التعيين" });
      const result = await storage.updateAssignment(assignmentId, { completedAt: new Date() });
      if (!result) return res.status(404).json({ message: "لم يتم العثور على التعيين" });
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "حدث خطأ في تحديث التعيين" });
    }
  });

  app.patch("/api/assignments/:id/uncomplete", isAuthenticated, async (req: any, res) => {
    try {
      const employeeId = (req.session as any).employeeId;
      const assignmentId = parseInt(req.params.id);
      const assignments = await storage.getFollowUpAssignmentsByEmployee(employeeId);
      const assignment = assignments.find(a => a.id === assignmentId);
      if (!assignment) return res.status(403).json({ message: "غير مصرح بتحديث هذا التعيين" });
      const result = await storage.updateAssignment(assignmentId, { completedAt: null });
      if (!result) return res.status(404).json({ message: "لم يتم العثور على التعيين" });
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "حدث خطأ في تحديث التعيين" });
    }
  });

  app.get("/api/correspondence/my-followups", isAuthenticated, async (req: any, res) => {
    try {
      const employeeId = (req.session as any).employeeId;
      const employee = await storage.getEmployee(employeeId);
      if (!employee) return res.status(401).json({ message: "Unauthorized" });

      const followUpAssignments = await storage.getFollowUpAssignmentsByEmployee(employeeId);
      const incomingFollowUps: any[] = [];
      for (const a of followUpAssignments) {
        const corr = await storage.getCorrespondenceById(a.correspondenceId);
        if (corr) {
          const now = new Date();
          let daysRemaining: number | null = null;
          let isOverdue = false;
          if (a.responseDeadline) {
            const deadline = new Date(a.responseDeadline);
            daysRemaining = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            isOverdue = daysRemaining < 0;
          }
          const senderDept = corr.senderDepartmentId ? await storage.getDepartment(corr.senderDepartmentId) : null;
          const currentDept = corr.currentDepartmentId ? await storage.getDepartment(corr.currentDepartmentId) : null;
          const incomingDisplayStatus = corr.closedAt ? "archived" : corr.status;
          incomingFollowUps.push({
            id: a.id,
            correspondenceId: corr.id,
            referenceNumber: corr.referenceNumber || "",
            issuedAt: corr.issuedAt,
            createdAt: corr.createdAt,
            subject: corr.subject,
            type: corr.type,
            status: incomingDisplayStatus,
            senderDepartmentName: senderDept?.name || corr.externalEntity || "",
            currentDepartmentName: currentDept?.name || "",
            followUpDays: a.followUpDays,
            responseDeadline: a.responseDeadline,
            daysRemaining,
            isOverdue,
            completedAt: a.completedAt,
            source: "incoming",
          });
        }
      }

      const userFollowups = await storage.getFollowupsByEmployee(employeeId);
      const outgoingFollowUps: any[] = [];
      for (const fu of userFollowups) {
        const corr = await storage.getCorrespondenceById(fu.correspondenceId);
        if (!corr) continue;
        const isOutgoing = corr.type === "internal_outgoing" || corr.type === "external_outgoing";
        if (!isOutgoing) continue;
        const startDate = fu.createdAt ? new Date(fu.createdAt) : new Date();
        const deadline = new Date(startDate);
        deadline.setDate(deadline.getDate() + fu.followUpDays);
        const now = new Date();
        const daysRemaining = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const receiverDept = corr.receiverDepartmentId ? await storage.getDepartment(corr.receiverDepartmentId) : null;
        const currentDept = corr.currentDepartmentId ? await storage.getDepartment(corr.currentDepartmentId) : null;
        const displayStatus = corr.issuedAt ? "issued" : corr.status;
        outgoingFollowUps.push({
          id: fu.id,
          correspondenceId: corr.id,
          referenceNumber: corr.referenceNumber || "",
          issuedAt: corr.issuedAt,
          createdAt: corr.createdAt,
          subject: corr.subject,
          type: corr.type,
          status: displayStatus,
          receiverDepartmentName: receiverDept?.name || corr.externalEntity || "",
          currentDepartmentName: currentDept?.name || "",
          followUpDays: fu.followUpDays,
          responseDeadline: deadline.toISOString(),
          daysRemaining,
          isOverdue: daysRemaining < 0,
          source: "outgoing",
        });
      }

      res.json({ incomingFollowUps, outgoingFollowUps });
    } catch (error) {
      console.error("Error fetching followups:", error);
      res.status(500).json({ message: "حدث خطأ في جلب المتابعات" });
    }
  });

  app.post("/api/correspondence/:id/add-followup", isAuthenticated, async (req: any, res) => {
    try {
      const employeeId = (req.session as any).employeeId;
      const corrId = parseInt(req.params.id);
      const { days } = req.body;
      if (!days || days <= 0) return res.status(400).json({ message: "يجب تحديد عدد أيام صحيح" });
      const corr = await storage.getCorrespondenceById(corrId);
      if (!corr) return res.status(404).json({ message: "المراسلة غير موجودة" });
      if (corr.status === "cancelled") return res.status(400).json({ message: "لا يمكن تعيين متابعة على مراسلة ملغاة" });
      const employee = await storage.getEmployee(employeeId);
      if (!employee) return res.status(401).json({ message: "غير مصرح" });
      const isCreator = corr.createdById === employeeId || corr.senderDepartmentId === employee.departmentId;
      if (!isCreator) {
        const wfEvents = await storage.getWorkflowEventsByCorrespondence(corrId);
        const isInChain = wfEvents.some((e: any) => e.performedById === employeeId || e.fromDepartmentId === employee.departmentId || e.toDepartmentId === employee.departmentId);
        if (!isInChain && employee.role !== "admin") return res.status(403).json({ message: "غير مصرح بتعيين متابعة على هذه المراسلة" });
      }
      const existing = await storage.getFollowupByEmployeeAndCorrespondence(employeeId, corrId);
      if (existing) {
        const updated = await storage.updateCorrespondenceFollowup(existing.id, { followUpDays: days });
        return res.json(updated);
      }
      const fu = await storage.createCorrespondenceFollowup({ correspondenceId: corrId, employeeId, followUpDays: days });
      res.json(fu);
    } catch (error) {
      res.status(500).json({ message: "حدث خطأ في إضافة المتابعة" });
    }
  });

  app.patch("/api/followups/:id/edit", isAuthenticated, async (req: any, res) => {
    try {
      const employeeId = (req.session as any).employeeId;
      const followupId = parseInt(req.params.id);
      const { days } = req.body;
      if (!days || days <= 0) return res.status(400).json({ message: "يجب تحديد عدد أيام صحيح" });
      const allFollowups = await storage.getFollowupsByEmployee(employeeId);
      const fu = allFollowups.find(f => f.id === followupId);
      if (!fu) return res.status(403).json({ message: "غير مصرح" });
      const updated = await storage.updateCorrespondenceFollowup(followupId, { followUpDays: days });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "حدث خطأ في تعديل مدة المتابعة" });
    }
  });

  app.delete("/api/followups/:id", isAuthenticated, async (req: any, res) => {
    try {
      const employeeId = (req.session as any).employeeId;
      const followupId = parseInt(req.params.id);
      const allFollowups = await storage.getFollowupsByEmployee(employeeId);
      const fu = allFollowups.find(f => f.id === followupId);
      if (!fu) return res.status(403).json({ message: "غير مصرح" });
      await storage.deleteCorrespondenceFollowup(followupId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "حدث خطأ في إزالة المتابعة" });
    }
  });

  app.patch("/api/assignments/:id/extend-followup", isAuthenticated, async (req: any, res) => {
    try {
      const employeeId = (req.session as any).employeeId;
      const assignmentId = parseInt(req.params.id);
      const { days } = req.body;
      if (!days || days <= 0) return res.status(400).json({ message: "يجب تحديد عدد أيام صحيح" });
      const assignments = await storage.getFollowUpAssignmentsByEmployee(employeeId);
      const assignment = assignments.find(a => a.id === assignmentId);
      if (!assignment) return res.status(403).json({ message: "غير مصرح" });
      const newDeadline = new Date();
      newDeadline.setDate(newDeadline.getDate() + days);
      const result = await storage.updateAssignment(assignmentId, {
        followUpDays: days,
        responseDeadline: newDeadline,
        completedAt: null,
      });
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "حدث خطأ في تعديل مدة المتابعة" });
    }
  });

  app.patch("/api/assignments/:id/remove-followup", isAuthenticated, async (req: any, res) => {
    try {
      const employeeId = (req.session as any).employeeId;
      const assignmentId = parseInt(req.params.id);
      const assignments = await storage.getFollowUpAssignmentsByEmployee(employeeId);
      const assignment = assignments.find(a => a.id === assignmentId);
      if (!assignment) return res.status(403).json({ message: "غير مصرح" });
      const result = await storage.updateAssignment(assignmentId, {
        isFollowUp: false,
        followUpDays: null,
        responseDeadline: null,
      });
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "حدث خطأ في إزالة المتابعة" });
    }
  });

  app.get("/api/correspondence/overdue-reminders", isAuthenticated, async (req: any, res) => {
    try {
      const employeeId = (req.session as any).employeeId;
      const overdue = await storage.getOverdueCorrespondence();
      const myOverdue = overdue.filter((c: any) => c.createdById === employeeId);
      res.json(myOverdue);
    } catch (error) {
      res.status(500).json({ message: "حدث خطأ في جلب التذكيرات" });
    }
  });

  app.post("/api/correspondence/check-followup-expiry", isAuthenticated, async (req: any, res) => {
    try {
      const employeeId = (req.session as any).employeeId;
      const employee = await storage.getEmployee(employeeId);
      if (!employee) return res.status(401).json({ message: "Unauthorized" });

      const today = new Date().toISOString().slice(0, 10);
      const sessionKey = `followupChecked_${today}`;
      if ((req.session as any)[sessionKey]) {
        return res.json({ notified: 0, cached: true });
      }

      let notified = 0;
      const now = new Date();

      const existingNotifs = await storage.getNotificationsForEmployee(employeeId);
      const todayNotifMessages = new Set(
        existingNotifs
          .filter((n: any) => n.createdAt && new Date(n.createdAt).toISOString().slice(0, 10) === today)
          .map((n: any) => n.message)
      );

      const followUpAssignments = await storage.getFollowUpAssignmentsByEmployee(employeeId);
      for (const a of followUpAssignments) {
        if (a.completedAt || !a.responseDeadline) continue;
        const deadline = new Date(a.responseDeadline);
        if (deadline <= now) {
          const corr = await storage.getCorrespondenceById(a.correspondenceId);
          if (corr) {
            const msg = `انتهت مدة متابعة المراسلة الواردة: ${corr.subject}`;
            if (!todayNotifMessages.has(msg)) {
              await notifyEmployee(employeeId, msg, { category: "correspondence", relatedEntityId: corr.id, relatedEntityType: corr.type });
              notified++;
            }
          }
        }
      }

      const userFollowups = await storage.getFollowupsByEmployee(employeeId);
      for (const fu of userFollowups) {
        const corr = await storage.getCorrespondenceById(fu.correspondenceId);
        if (!corr) continue;
        const startDate = fu.createdAt ? new Date(fu.createdAt) : new Date();
        const deadline = new Date(startDate);
        deadline.setDate(deadline.getDate() + fu.followUpDays);
        if (deadline <= now) {
          const msg = `انتهت مدة متابعة المراسلة الصادرة: ${corr.subject}`;
          if (!todayNotifMessages.has(msg)) {
            await notifyEmployee(employeeId, msg, { category: "correspondence", relatedEntityId: corr.id, relatedEntityType: corr.type });
            notified++;
          }
        }
      }

      (req.session as any)[sessionKey] = true;
      res.json({ notified });
    } catch (error) {
      console.error("Follow-up expiry check error:", error);
      res.status(500).json({ message: "حدث خطأ في فحص انتهاء المتابعات" });
    }
  });

  app.post("/api/admin/check-reminders", isAuthenticated, async (req: any, res) => {
    try {
      const employeeId = (req.session as any).employeeId;
      const employee = await storage.getEmployee(employeeId);
      if (!employee || employee.role !== "admin") {
        return res.status(403).json({ message: "غير مصرح" });
      }

      const overdue = await storage.getOverdueCorrespondence();
      let notified = 0;
      for (const corr of overdue) {
        const creator = await storage.getEmployee(corr.createdById!);
        if (creator) {
          const notification = await storage.createNotification({
            message: `تذكير: المراسلة "${corr.subject}" تحتاج إلى رد ولم يتم الرد عليها بعد تاريخ التذكير المحدد`,
            targetType: "specific",
            sentById: employee.id,
          });
          await storage.createNotificationRecipients(notification.id, [creator.id]);
          notified++;
        }
      }
      res.json({ message: `تم إرسال ${notified} تذكير` });
    } catch (error) {
      res.status(500).json({ message: "حدث خطأ" });
    }
  });

  app.get("/api/correspondence/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const item = await storage.getCorrespondenceById(id);
      if (!item) return res.status(404).json({ message: "المراسلة غير موجودة" });

      const employeeId = (req.session as any).employeeId;
      const employee = await storage.getEmployee(employeeId);
      const isAdmin = employee?.role === "admin";
      const isCentralMail = employee?.role === "central_mail";

      if (isCentralMail) {
        const hasAccess = item.createdById === employeeId || (item as any).centralMailAssignedById === employeeId;
        if (!hasAccess) return res.status(403).json({ message: "لا تملك صلاحية عرض هذه المراسلة" });

        const assignments = await storage.getAssignmentsByCorrespondence(id);
        let ccs = await storage.getCCsByCorrespondence(id);
        const externalCcs = await storage.getExternalCCsByCorrespondence(id);
        const replies = await storage.getCorrespondenceReplies(id);
        const result: any = { ...item, assignments, ccs, externalCcs, replies, _isInSenderChain: false };
        return res.json(result);
      }

      let isInSenderChain = false;
      if (item.createdById === employeeId) {
        isInSenderChain = true;
      } else if ((item as any).flowTemplateGroupId && employee?.departmentId) {
        const flowGroup = await storage.getFlowTemplateGroup((item as any).flowTemplateGroupId);
        if (flowGroup?.accounts?.includes(employee.departmentId)) {
          isInSenderChain = true;
        }
      }

      const assignments = await storage.getAssignmentsByCorrespondence(id);
      let ccs = await storage.getCCsByCorrespondence(id);
      const externalCcs = await storage.getExternalCCsByCorrespondence(id);
      const replies = await storage.getCorrespondenceReplies(id);

      if (!isAdmin && !isInSenderChain) {
        ccs = ccs.filter((cc: any) => !cc.isHidden);
      }

      const result: any = { ...item, assignments, ccs, externalCcs, replies, _isInSenderChain: isInSenderChain || isAdmin };

      if (!isAdmin && !isInSenderChain) {
        result.marginNotes = null;
      }

      if (!isAdmin && !isInSenderChain && item.type === "external_incoming") {
        delete result.centralMailAssignedById;
      }

      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "حدث خطأ" });
    }
  });

  app.post("/api/correspondence", isAuthenticated, async (req: any, res) => {
    try {
      const employeeId = (req.session as any).employeeId;
      const employee = await storage.getEmployee(employeeId);
      if (!employee) return res.status(401).json({ message: "Unauthorized" });

      if (typeof req.body?.content === "string") {
        req.body.content = sanitizeHtmlContent(req.body.content);
      }

      const corrType = req.body.type;
      const isOutgoing = corrType === "internal_outgoing" || corrType === "external_outgoing";
      const isExternalIncoming = corrType === "external_incoming";

      let inheritedContribDeptIds: number[] | null = null;
      let inheritedContribBatchId: string | null = null;
      if (req.body.parentCorrespondenceId && (corrType === "internal_outgoing" || corrType === "external_outgoing") && employee.departmentId) {
        const parentId = parseInt(req.body.parentCorrespondenceId);
        const parentAssignments = (await storage.getAssignmentsByCorrespondence(parentId))
          .filter((a: any) => a.isActiveBatch !== false && a.routingBatchId);
        const myLead = parentAssignments.find((a: any) => a.departmentId === employee.departmentId && a.isLead);
        if (myLead && myLead.routingBatchId) {
          const contribs = await storage.getContributionsByBatch(parentId, myLead.routingBatchId);
          const incomplete = contribs.filter((c: any) => !c.isLead && c.status !== "submitted" && c.status !== "declined");
          if (incomplete.length > 0) {
            return res.status(400).json({
              message: `بانتظار مساهمات من ${incomplete.length} جهة قبل إعداد الإجابة النهائية`,
            });
          }
          inheritedContribBatchId = myLead.routingBatchId;
          inheritedContribDeptIds = contribs.map((c: any) => c.contributingDepartmentId);
        }
      }

      if (isExternalIncoming && employee.role !== "central_mail" && employee.role !== "admin") {
        return res.status(403).json({ message: "فقط حساب البريد المركزي يمكنه إدخال الوارد الخارجي" });
      }

      if (isExternalIncoming) {
        if (!req.body.externalEntity) {
          return res.status(400).json({ message: "الجهة الخارجية المرسلة مطلوبة" });
        }
        if (!req.body.externalRefNumber) {
          return res.status(400).json({ message: "عدد الكتاب الخارجي مطلوب" });
        }
        if (!req.body.externalDate) {
          return res.status(400).json({ message: "تاريخ الكتاب الخارجي مطلوب" });
        }
        if (!req.body.subject) {
          return res.status(400).json({ message: "الموضوع مطلوب" });
        }
        if (!req.body.assignToEmployeeId) {
          return res.status(400).json({ message: "يجب تحديد الحساب المخوّل لاستلام المراسلة" });
        }
        const assignee = await storage.getEmployee(req.body.assignToEmployeeId);
        if (!assignee || !assignee.canReceiveExternalIncoming) {
          return res.status(400).json({ message: "الحساب المحدد غير مخوّل لاستلام الوارد الخارجي" });
        }

        const existingEntity = await storage.getExternalEntityByName(req.body.externalEntity);
        if (!existingEntity) {
          await storage.createExternalEntity({ name: req.body.externalEntity });
        }

        const refNumber = await generateReferenceNumber("external_incoming", null);

        const assignToEmployeeId = req.body.assignToEmployeeId;
        delete req.body.assignToEmployeeId;

        const data = {
          ...req.body,
          senderDepartmentId: employee.departmentId || null,
          receiverDepartmentId: assignee.departmentId,
          referenceNumber: refNumber,
          createdById: employee.id,
          status: "in_progress",
          centralMailAssignedById: employee.id,
          assignedToId: assignToEmployeeId,
          currentDepartmentId: assignee.departmentId,
          flowTemplateId: null,
          flowTemplateGroupId: null,
        };

        if (data.externalDate) {
          data.externalDate = new Date(data.externalDate);
        }

        delete data.ccList;
        delete data.externalCcList;
        delete data.hiddenCcList;

        const parsed = insertCorrespondenceSchema.parse(data);
        const item = await storage.createCorrespondence(parsed);

        await storage.createWorkflowEvent({
          correspondenceId: item.id,
          action: "receive_incoming",
          fromStatus: null,
          toStatus: "in_progress",
          performedById: employee.id,
          fromDepartmentId: null,
          toDepartmentId: assignee.departmentId,
          notes: `إسناد وارد خارجي إلى ${assignee.fullName}`,
          signature: true,
        });

        const corrMeta = { category: "correspondence", relatedEntityId: item.id, relatedEntityType: "external_incoming" };
        await notifyEmployee(assignToEmployeeId, `تم إسناد وارد خارجي جديد إليك: ${item.subject}`, corrMeta);
        if (assignee.departmentId) {
          await notifyDepartmentEmployees(
            assignee.departmentId,
            `وارد خارجي جديد من ${item.externalEntity || "جهة خارجية"}: ${item.subject}`,
            assignToEmployeeId,
            corrMeta
          );
        }

        await storage.createAuditLog({
          entityType: "correspondence",
          entityId: item.id,
          action: "created",
          performedById: employee.id,
          employeeId: employee.id,
          module: "correspondence",
          details: `إدخال وارد خارجي وإسناده إلى ${assignee.fullName}: ${item.subject}`,
        });

        return res.status(201).json(item);
      }

      let selectedFlowTemplateId = req.body.flowTemplateId || null;
      let selectedFlowTemplateGroupId = req.body.flowTemplateGroupId || null;

      if (isOutgoing && employee.role !== "admin") {
        const empFlowTemplates = await storage.getFlowTemplatesForEmployee(employee.id);
        const flowsForType = empFlowTemplates.filter((ft: any) => ft.correspondenceType === corrType);
        if (flowsForType.length === 0) {
          return res.status(403).json({ message: "لا يمكنك إنشاء هذا النوع من المراسلات - الحساب غير مرتبط بمسار تدفق لهذا النوع" });
        }
        if (selectedFlowTemplateId) {
          const matchingFlow = flowsForType.find((ft: any) => ft.id === selectedFlowTemplateId);
          if (!matchingFlow) {
            return res.status(403).json({ message: "مسار التدفق المحدد غير صالح لهذا الحساب" });
          }
          selectedFlowTemplateGroupId = matchingFlow.groupId;
        } else if (flowsForType.length === 1) {
          selectedFlowTemplateId = flowsForType[0].id;
          selectedFlowTemplateGroupId = flowsForType[0].groupId;
        } else {
          return res.status(400).json({ message: "يجب تحديد مسار التدفق - يوجد أكثر من مسار متاح" });
        }
      }

      let refNumber = req.body.referenceNumber || null;

      if (req.body.status === "issued" && !refNumber) {
        refNumber = await generateReferenceNumber(corrType, req.body.senderDepartmentId || null);
      }

      let senderDeptId = req.body.senderDepartmentId || null;
      if (!senderDeptId && selectedFlowTemplateGroupId && selectedFlowTemplateId) {
        const allTemplates = await storage.getFlowTemplates();
        const tmpl = allTemplates.find((t: any) => t.id === selectedFlowTemplateId);
        if (tmpl) {
          const grp = (tmpl as any).groups?.find((g: any) => g.id === selectedFlowTemplateGroupId);
          if (grp && grp.accounts && grp.accounts.length > 0) {
            const topDeptId = grp.accounts[grp.accounts.length - 1];
            const topDept = await storage.getDepartment(topDeptId);
            if (topDept && topDept.isCentral) {
              senderDeptId = topDept.id;
            }
          }
        }
      }

      const data = {
        ...req.body,
        senderDepartmentId: senderDeptId,
        referenceNumber: refNumber,
        createdById: employee.id,
        flowTemplateId: selectedFlowTemplateId,
        flowTemplateGroupId: selectedFlowTemplateGroupId,
        currentDepartmentId: req.body.currentDepartmentId || senderDeptId || employee.departmentId || null,
      };

      const ccList = req.body.ccList || [];
      const externalCcList = req.body.externalCcList || [];
      const hiddenCcList = req.body.hiddenCcList || [];
      delete data.ccList;
      delete data.externalCcList;
      delete data.hiddenCcList;

      if (inheritedContribDeptIds && inheritedContribDeptIds.length > 0) {
        data.contributingDepartmentIds = inheritedContribDeptIds;
        data.contributionRoutingBatchId = inheritedContribBatchId;
      }

      if (corrType === "external_outgoing" && data.externalEntity) {
        const existingEntity = await storage.getExternalEntityByName(data.externalEntity);
        if (!existingEntity) {
          await storage.createExternalEntity({ name: data.externalEntity });
        }
      }

      const parsed = insertCorrespondenceSchema.parse(data);
      const item = await storage.createCorrespondence(parsed);

      if (ccList.length > 0) {
        for (const cc of ccList) {
          if (!cc.departmentId) continue;
          await storage.createCC({
            correspondenceId: item.id,
            departmentId: cc.departmentId,
            reason: cc.reason || null,
            isHidden: false,
          });
        }
      }

      if (externalCcList.length > 0) {
        for (const ecc of externalCcList) {
          if (!ecc.entityName && !ecc.externalEntityId) continue;
          if (!ecc.reason || !ecc.reason.trim()) continue;
          let entityId = ecc.externalEntityId;
          if (!entityId && ecc.entityName) {
            let entity = await storage.getExternalEntityByName(ecc.entityName);
            if (!entity) {
              entity = await storage.createExternalEntity({ name: ecc.entityName });
            }
            entityId = entity.id;
          }
          if (entityId) {
            await storage.createExternalCC({
              correspondenceId: item.id,
              externalEntityId: entityId,
              reason: ecc.reason.trim(),
            });
          }
        }
      }

      if (hiddenCcList.length > 0) {
        for (const hcc of hiddenCcList) {
          if (!hcc.departmentId) continue;
          if (!hcc.reason || !hcc.reason.trim()) continue;
          await storage.createCC({
            correspondenceId: item.id,
            departmentId: hcc.departmentId,
            reason: hcc.reason.trim(),
            isHidden: true,
          });
        }
      }

      if (req.body.parentCorrespondenceId && isOutgoing) {
        const parentCorr = await storage.getCorrespondenceById(req.body.parentCorrespondenceId);
        if (parentCorr && parentCorr.status !== "archived" && parentCorr.status !== "cancelled") {
          const isReceiverOfParent = parentCorr.receiverDepartmentId === employee.departmentId ||
            parentCorr.currentDepartmentId === employee.departmentId;
          const isParentIncoming = parentCorr.type === "internal_outgoing" || parentCorr.type === "internal_incoming" || parentCorr.type === "external_incoming";
          if (isReceiverOfParent && isParentIncoming) {
            await storage.updateCorrespondence(parentCorr.id, {
              status: "archived",
              closedAt: new Date(),
              closedById: employee.id,
            });
            await storage.createWorkflowEvent({
              correspondenceId: parentCorr.id,
              action: "reply_and_archive",
              fromStatus: parentCorr.status,
              toStatus: "archived",
              performedById: employee.id,
              fromDepartmentId: employee.departmentId,
              toDepartmentId: null,
              notes: `تم الرد بمراسلة صادرة رقم ${item.id} وحفظ المراسلة الواردة تلقائياً`,
              signature: false,
            });
          }
        }
      }

      await storage.createAuditLog({
        entityType: "correspondence",
        entityId: item.id,
        action: "created",
        performedById: employee.id,
        employeeId: employee.id,
        module: "correspondence",
        details: `إنشاء مراسلة: ${item.subject}`,
      });

      const wantsSignOnCreate = req.body.signOnCreate === true;
      if (wantsSignOnCreate && isOutgoing) {
        const userDept = employee.departmentId ? await storage.getDepartment(employee.departmentId) : null;
        if (!userDept?.isCentral) {
          return res.status(403).json({ message: "فقط حسابات التشكيلات المركزية يمكنها التوقيع النهائي عند الإنشاء" });
        }

        const refNumberFinal = item.referenceNumber || await generateReferenceNumber(corrType, item.senderDepartmentId);

        await storage.updateCorrespondence(item.id, {
          status: "issued",
          referenceNumber: refNumberFinal,
          issuedAt: new Date(),
          issuedById: employee.id,
          currentDepartmentId: employee.departmentId,
        });

        await storage.createWorkflowEvent({
          correspondenceId: item.id,
          action: "final_approve_and_issue",
          fromStatus: "draft",
          toStatus: "issued",
          performedById: employee.id,
          fromDepartmentId: employee.departmentId,
          toDepartmentId: item.receiverDepartmentId || null,
          notes: "توقيع نهائي وإصدار عند الإنشاء",
          signature: true,
        });

        if (corrType === "internal_outgoing" && item.receiverDepartmentId) {
          await storage.createWorkflowEvent({
            correspondenceId: item.id,
            action: "auto_received",
            fromStatus: "issued",
            toStatus: "in_progress",
            performedById: employee.id,
            fromDepartmentId: employee.departmentId,
            toDepartmentId: item.receiverDepartmentId,
            notes: "استلام تلقائي عند الإصدار",
            signature: false,
          });
          await storage.updateCorrespondence(item.id, {
            status: "in_progress",
            currentDepartmentId: item.receiverDepartmentId,
          });

          const senderDept = userDept;
          const senderName = senderDept?.name || employee.fullName;
          await notifyDepartmentEmployees(
            item.receiverDepartmentId,
            `وارد داخلي جديد من ${senderName}: ${item.subject}`,
            undefined,
            { category: "correspondence", relatedEntityId: item.id, relatedEntityType: "internal_incoming" }
          );
        }

        try {
          const ccsList = await storage.getCCsByCorrespondence(item.id);
          const senderNameForCc = userDept?.name || employee.fullName;
          const seenDepts = new Set<number>();
          for (const cc of ccsList) {
            if (!cc.departmentId) continue;
            if (cc.departmentId === item.receiverDepartmentId) continue;
            if (seenDepts.has(cc.departmentId)) continue;
            seenDepts.add(cc.departmentId);
            await notifyDepartmentEmployees(
              cc.departmentId,
              `نسخة إلى قسمكم — مراسلة من ${senderNameForCc}: ${item.subject}`,
              undefined,
              { category: "correspondence", relatedEntityId: item.id, relatedEntityType: corrType }
            );
          }
        } catch (e) {
          console.error("Failed to notify CC departments on create", e);
        }

        await storage.createAuditLog({
          entityType: "correspondence",
          entityId: item.id,
          action: "final_signed_on_create",
          performedById: employee.id,
          employeeId: employee.id,
          module: "correspondence",
          details: `توقيع نهائي وإصدار عند الإنشاء: ${item.subject} (${refNumberFinal})`,
        });

        const finalItem = await storage.getCorrespondenceById(item.id);
        return res.status(201).json(finalItem || item);
      }

      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "بيانات غير صحيحة", errors: error.errors });
      }
      console.error("Error creating correspondence:", error);
      res.status(500).json({ message: "حدث خطأ في إنشاء المراسلة" });
    }
  });

  app.patch("/api/correspondence/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (typeof req.body?.content === "string") {
        req.body.content = sanitizeHtmlContent(req.body.content);
      }
      const parsed = correspondenceUpdateSchema.parse(req.body);
      const employeeId = (req.session as any).employeeId;
      const employee = await storage.getEmployee(employeeId);
      if (!employee) return res.status(401).json({ message: "Unauthorized" });

      const { ccList, externalCcList, hiddenCcList, ...fieldUpdates } = parsed;
      const updates: any = { ...fieldUpdates };

      if (req.body.reminderDate === null) {
        updates.reminderDate = null;
      } else if (req.body.reminderDate) {
        updates.reminderDate = new Date(req.body.reminderDate);
      }

      if (req.body.status === "issued" && !updates.referenceNumber) {
        const existing = await storage.getCorrespondenceById(id);
        if (existing && !existing.referenceNumber) {
          updates.referenceNumber = await generateReferenceNumber(existing.type, existing.senderDepartmentId);
          updates.issuedAt = new Date();
          updates.issuedById = employee.id;
        }
      }

      const item = await storage.updateCorrespondence(id, updates);

      if (ccList !== undefined || hiddenCcList !== undefined) {
        await storage.deleteCCsByCorrespondence(id);
        const allRegularCCs = ccList || [];
        const allHiddenCCs = hiddenCcList || [];
        for (const cc of allRegularCCs) {
          if (cc.departmentId > 0) {
            await storage.createCC({
              correspondenceId: id,
              departmentId: cc.departmentId,
              reason: cc.reason || "",
              isHidden: false,
            });
          }
        }
        for (const hcc of allHiddenCCs) {
          if (hcc.departmentId > 0) {
            await storage.createCC({
              correspondenceId: id,
              departmentId: hcc.departmentId,
              reason: hcc.reason || "",
              isHidden: true,
            });
          }
        }
      }

      if (externalCcList !== undefined) {
        const { db: database } = await import("./db");
        const { sql: sqlTag } = await import("drizzle-orm");
        await database.execute(sqlTag`DELETE FROM external_correspondence_ccs WHERE correspondence_id = ${id}`);
        for (const ecc of externalCcList) {
          if (ecc.entityName.trim()) {
            await database.execute(sqlTag`INSERT INTO external_correspondence_ccs (correspondence_id, entity_name, reason) VALUES (${id}, ${ecc.entityName}, ${ecc.reason || ""})`);
          }
        }
      }
      if (!item) return res.status(404).json({ message: "المراسلة غير موجودة" });

      await storage.createAuditLog({
        entityType: "correspondence",
        entityId: id,
        action: req.body.status ? `status_changed_to_${req.body.status}` : "updated",
        performedById: employee.id,
        employeeId: employee.id,
        module: "correspondence",
        details: `تحديث المراسلة`,
      });

      if (req.body.status) {
        const statusLabels: Record<string, string> = {
          under_review: "قيد المراجعة",
          pending_approval: "بانتظار الموافقة",
          approved: "تمت الموافقة",
          issued: "تم الإصدار",
          in_progress: "قيد التنفيذ",
          completed: "مكتملة",
        };
        const statusLabel = statusLabels[req.body.status];
        if (statusLabel) {
          const msg = `تم تحديث حالة المراسلة "${item.subject}" إلى: ${statusLabel}`;
          if (item.receiverDepartmentId) {
            await notifyDepartmentEmployees(item.receiverDepartmentId, msg, employeeId);
          }
          if (item.senderDepartmentId && item.senderDepartmentId !== item.receiverDepartmentId) {
            await notifyDepartmentEmployees(item.senderDepartmentId, msg, employeeId);
          }
          if (item.createdById && item.createdById !== employeeId) {
            await notifyEmployee(item.createdById, msg);
          }
        }
      }

      res.json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "بيانات غير صحيحة", errors: error.errors });
      }
      console.error("Error updating correspondence:", error);
      res.status(500).json({ message: "حدث خطأ في تحديث المراسلة" });
    }
  });

  app.post("/api/correspondence/:id/assign", isAuthenticated, async (req: any, res) => {
    try {
      const corrId = parseInt(req.params.id);
      const { departmentId, isLead, notes } = req.body;
      if (!departmentId) return res.status(400).json({ message: "القسم مطلوب" });

      const assignment = await storage.createAssignment({
        correspondenceId: corrId,
        departmentId,
        isLead: isLead || false,
        notes,
      });

      const employeeId = (req.session as any).employeeId;
      const employee = await storage.getEmployee(employeeId);
      await storage.createAuditLog({
        entityType: "correspondence",
        entityId: corrId,
        action: "assigned",
        performedById: employee?.id || employeeId,
        employeeId: employeeId,
        module: "correspondence",
        details: `إسناد إلى القسم ${departmentId}`,
      });

      const corr = await storage.getCorrespondenceById(corrId);
      const dept = await storage.getDepartment(departmentId);
      if (dept) {
        await notifyDepartmentEmployees(
          departmentId,
          `تم إسناد مراسلة "${corr?.subject || ""}" إلى ${dept.name}`,
          employeeId
        );
      }

      res.status(201).json(assignment);
    } catch (error) {
      res.status(500).json({ message: "حدث خطأ في الإسناد" });
    }
  });

  app.post("/api/correspondence/:id/reply", isAuthenticated, async (req: any, res) => {
    try {
      const parentId = parseInt(req.params.id);
      const parent = await storage.getCorrespondenceById(parentId);
      if (!parent) return res.status(404).json({ message: "المراسلة الأصلية غير موجودة" });

      if (typeof req.body?.content === "string") {
        req.body.content = sanitizeHtmlContent(req.body.content);
      }

      const employeeId = (req.session as any).employeeId;
      const employee = await storage.getEmployee(employeeId);
      if (!employee) return res.status(401).json({ message: "Unauthorized" });

      const replyType = parent.type === "external_incoming" ? "external_outgoing" :
                       parent.type === "internal_incoming" ? "internal_outgoing" :
                       "internal_outgoing";

      const data = {
        ...req.body,
        type: replyType,
        parentCorrespondenceId: parentId,
        createdById: employee.id,
        status: "draft",
      };

      const parsed = insertCorrespondenceSchema.parse(data);
      const item = await storage.createCorrespondence(parsed);

      await storage.createAuditLog({
        entityType: "correspondence",
        entityId: item.id,
        action: "reply_created",
        performedById: employee.id,
        employeeId: employee.id,
        module: "correspondence",
        details: `إنشاء رد على المراسلة رقم ${parentId}`,
      });

      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "بيانات غير صحيحة", errors: error.errors });
      }
      console.error("Error creating reply:", error);
      res.status(500).json({ message: "حدث خطأ في إنشاء الرد" });
    }
  });

  const VALID_LEAVE_TRANSITIONS: Record<string, string[]> = {
    pending: ["approved_by_direct", "rejected", "cancelled"],
    approved_by_direct: ["approved_by_section", "rejected", "cancelled"],
    approved_by_section: ["approved_by_hr", "rejected", "cancelled"],
    approved_by_hr: ["approved", "rejected", "cancelled"],
    approved: [],
    rejected: [],
    cancelled: [],
  };

  const leaveStatusArabicLabels: Record<string, string> = {
    pending: "قيد الانتظار",
    approved_by_direct: "موافقة المسؤول المباشر",
    approved_by_section: "موافقة رئيس القسم",
    approved_by_hr: "موافقة الموارد البشرية",
    approved: "معتمد نهائياً",
    rejected: "مرفوض",
    cancelled: "ملغي",
  };

  async function notifyLeaveWorkflow(nextStatus: string, targetEmployee: any, leaveReq: any, actor: any) {
    try {
      const meta: NotificationMeta = { category: "personal_requests", relatedEntityId: leaveReq.id, relatedEntityType: "leave_request" };
      const allEmployees = await storage.getEmployees();

      if (nextStatus === "pending") {
        if (targetEmployee.departmentId) {
          const deptOfficers = allEmployees.filter(e => e.isActive && e.role === "officer" && e.departmentId === targetEmployee.departmentId && e.id !== targetEmployee.id);
          for (const off of deptOfficers) {
            await notifyEmployee(off.id, `طلب إجازة جديد بانتظار موافقتك من الموظف: ${targetEmployee.fullName}`, meta);
          }
        }
        const admins = allEmployees.filter(e => e.isActive && e.role === "admin" && e.id !== targetEmployee.id);
        for (const adm of admins) {
          await notifyEmployee(adm.id, `طلب إجازة جديد من الموظف: ${targetEmployee.fullName} (${leaveReq.daysCount || 1} يوم)`, meta);
        }
      } else if (nextStatus === "approved_by_direct") {
        if (targetEmployee.departmentId) {
          const deptOfficers = allEmployees.filter(e => e.isActive && (e.role === "officer" || e.role === "section_head") && e.departmentId === targetEmployee.departmentId && e.id !== actor.id);
          for (const off of deptOfficers) {
            await notifyEmployee(off.id, `طلب إجازة للموظف ${targetEmployee.fullName} بانتظار موافقة رئيس القسم`, meta);
          }
        }
        const admins = allEmployees.filter(e => e.isActive && e.role === "admin" && e.id !== actor.id);
        for (const adm of admins) {
          await notifyEmployee(adm.id, `طلب إجازة للموظف ${targetEmployee.fullName} بانتظار موافقة رئيس القسم`, meta);
        }
      } else if (nextStatus === "approved_by_section") {
        const allDepts = await storage.getDepartments();
        const hrDept = allDepts.find(d => d.name.includes("موارد بشرية") || (d.nameEn && d.nameEn.toLowerCase().includes("human resources")) || d.code === "HR");
        if (hrDept) {
          const hrStaff = allEmployees.filter(e => e.isActive && e.departmentId === hrDept.id && e.id !== actor.id);
          for (const hr of hrStaff) {
            await notifyEmployee(hr.id, `طلب إجازة للموظف ${targetEmployee.fullName} بانتظار موافقة الموارد البشرية`, meta);
          }
        }
        const admins = allEmployees.filter(e => e.isActive && e.role === "admin" && e.id !== actor.id);
        for (const adm of admins) {
          await notifyEmployee(adm.id, `طلب إجازة للموظف ${targetEmployee.fullName} بانتظار موافقة الموارد البشرية`, meta);
        }
      } else if (nextStatus === "approved_by_hr") {
        const admins = allEmployees.filter(e => e.isActive && e.role === "admin" && e.id !== actor.id);
        for (const adm of admins) {
          await notifyEmployee(adm.id, `طلب إجازة للموظف ${targetEmployee.fullName} بانتظار الاعتماد النهائي وتحديث الرصيد`, meta);
        }
      }
    } catch (err) {
      console.error("Error sending leave workflow notification:", err);
    }
  }

  app.get("/api/leave-requests", isAuthenticated, async (req: any, res) => {
    try {
      const employeeId = (req.session as any).employeeId;
      const employee = await storage.getEmployee(employeeId);
      if (!employee) return res.status(401).json({ message: "Unauthorized" });

      const allRequests = await storage.getLeaveRequests();

      // Filter based on role:
      // admin and central_mail can see all
      if (employee.role === "admin" || employee.role === "central_mail") {
        return res.json(allRequests);
      }

      // officer can see requests of employees in their department
      if (employee.role === "officer") {
        if (!employee.departmentId) {
          const ownRequests = allRequests.filter(r => r.employeeId === employee.id);
          return res.json(ownRequests);
        }
        const allEmployees = await storage.getEmployees();
        const deptEmployeeIds = new Set(
          allEmployees
            .filter(e => e.departmentId === employee.departmentId)
            .map(e => e.id)
        );
        deptEmployeeIds.add(employee.id); // officer also sees own requests
        const filtered = allRequests.filter(r => deptEmployeeIds.has(r.employeeId));
        return res.json(filtered);
      }

      // employee (and other non-privileged roles) can only see their own requests
      const ownRequests = allRequests.filter(r => r.employeeId === employee.id);
      return res.json(ownRequests);
    } catch (error) {
      console.error("Error fetching leave requests:", error);
      res.status(500).json({ message: "حدث خطأ في جلب طلبات الإجازة" });
    }
  });

  app.post("/api/leave-requests", isAuthenticated, async (req: any, res) => {
    try {
      const employeeId = (req.session as any).employeeId;
      const employee = await storage.getEmployee(employeeId);
      if (!employee) return res.status(401).json({ message: "Unauthorized" });

      const startDate = new Date(req.body.startDate);
      const endDate = new Date(req.body.endDate);
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(400).json({ message: "تواريخ الإجازة غير صحيحة" });
      }
      if (endDate < startDate) {
        return res.status(400).json({ message: "تاريخ نهاية الإجازة لا يمكن أن يكون قبل تاريخ البداية" });
      }

      const daysCount = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      // Balance check
      const currentBalance = employee.leaveBalance ?? 30;
      if (currentBalance < daysCount) {
        return res.status(400).json({
          message: `رصيد الإجازات غير كافٍ. رصيدك المتاح (${currentBalance} يوم) أقل من الأيام المطلوبة (${daysCount} يوم)`,
        });
      }

      const data = {
        ...req.body,
        startDate,
        endDate,
        daysCount,
        employeeId: employee.id,
        status: "pending" as const,
      };

      const parsed = insertLeaveRequestSchema.parse(data);
      const item = await storage.createLeaveRequest(parsed);

      // Audit Log
      await storage.createAuditLog({
        entityType: "leave_request",
        entityId: item.id,
        action: "create",
        performedById: employee.id,
        employeeId: employee.id,
        module: "leave_requests",
        details: `تقديم طلب إجازة (${item.leaveType}) لمدة ${item.daysCount} يوم من ${startDate.toISOString().split("T")[0]} إلى ${endDate.toISOString().split("T")[0]}${item.reason ? ` - السبب: ${item.reason}` : ""}`,
        ipAddress: req.ip || req.socket?.remoteAddress,
      });

      // Workflow Notification
      await notifyLeaveWorkflow("pending", employee, item, employee);

      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "بيانات غير صحيحة", errors: error.errors });
      }
      console.error("Error creating leave request:", error);
      res.status(500).json({ message: "حدث خطأ في إنشاء طلب الإجازة" });
    }
  });

  app.patch("/api/leave-requests/:id/status", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const { status, notes } = leaveStatusUpdateSchema.parse(req.body);

      const employeeId = (req.session as any).employeeId;
      const employee = await storage.getEmployee(employeeId);
      if (!employee) return res.status(401).json({ message: "Unauthorized" });

      const targetRequest = await storage.getLeaveRequest(id);
      if (!targetRequest) {
        return res.status(404).json({ message: "الطلب غير موجود" });
      }

      const currentStatus = targetRequest.status || "pending";

      // Terminal state check
      if (currentStatus === "approved" || currentStatus === "rejected" || currentStatus === "cancelled") {
        return res.status(400).json({
          message: `لا يمكن تعديل حالة الطلب لأنه في حالة نهائية (${leaveStatusArabicLabels[currentStatus] || currentStatus})`,
        });
      }

      // State machine validation
      const allowedNextStatuses = VALID_LEAVE_TRANSITIONS[currentStatus] || [];
      if (!allowedNextStatuses.includes(status)) {
        return res.status(400).json({
          message: `انتقال غير صالح: لا يمكن الانتقال المباشر من (${leaveStatusArabicLabels[currentStatus] || currentStatus}) إلى (${leaveStatusArabicLabels[status] || status}). يجب اتباع تسلسل مراحل الاعتماد: موافقة المسؤول المباشر ← موافقة رئيس القسم ← موافقة الموارد البشرية ← الاعتماد النهائي.`,
        });
      }

      // Role and Ownership checks
      if (status === "cancelled") {
        if (targetRequest.employeeId !== employee.id && employee.role !== "admin") {
          return res.status(403).json({ message: "غير مسموح لك بإلغاء طلب إجازة خاص بموظف آخر" });
        }
      } else {
        if (targetRequest.employeeId === employee.id && employee.role !== "admin") {
          return res.status(403).json({ message: "غير مسموح لك بالموافقة على أو رفض طلب الإجازة الخاص بك" });
        }

        if (employee.role !== "admin") {
          const targetEmployee = await storage.getEmployee(targetRequest.employeeId);
          if (!targetEmployee) {
            return res.status(404).json({ message: "الموظف صاحب الطلب غير موجود" });
          }

          if (employee.role === "officer") {
            if (status === "approved_by_direct" || status === "approved_by_section" || status === "rejected") {
              if (!employee.departmentId || targetEmployee.departmentId !== employee.departmentId) {
                return res.status(403).json({ message: "غير مسموح لك بالبت في طلب إجازة لموظف خارج قسمك" });
              }
            }
          } else {
            return res.status(403).json({ message: "غير مصرح لك بتغيير حالة طلب الإجازة" });
          }
        }
      }

      const targetEmployee = await storage.getEmployee(targetRequest.employeeId);
      if (!targetEmployee) {
        return res.status(404).json({ message: "الموظف صاحب الطلب غير موجود" });
      }

      // If final approval ("approved"), check balance and deduct daysCount atomically
      if (status === "approved") {
        const days = targetRequest.daysCount || 0;
        const currentBalance = targetEmployee.leaveBalance ?? 0;
        if (currentBalance < days) {
          return res.status(400).json({
            message: `الرصيد غير كافٍ. رصيد الموظف المتاح (${currentBalance} يوم) أقل من الأيام المطلوبة (${days} يوم)`,
          });
        }

        const newBalance = currentBalance - days;
        await storage.updateEmployee(targetEmployee.id, { leaveBalance: newBalance });
      }

      const item = await storage.updateLeaveRequestStatus(id, status, employee.id, notes);
      if (!item) return res.status(404).json({ message: "الطلب غير موجود" });

      // Audit Log
      await storage.createAuditLog({
        entityType: "leave_request",
        entityId: item.id,
        action: status,
        performedById: employee.id,
        employeeId: targetRequest.employeeId,
        module: "leave_requests",
        details: `تحديث حالة طلب الإجازة #${item.id} من (${leaveStatusArabicLabels[currentStatus] || currentStatus}) إلى (${leaveStatusArabicLabels[status] || status}) بواسطة ${employee.fullName}${notes ? ` - ملاحظات: ${notes}` : ""}`,
        ipAddress: req.ip || req.socket?.remoteAddress,
      });

      // Notification to Requester
      const notifMsg = `تم تحديث حالة طلب الإجازة الخاص بك إلى "${leaveStatusArabicLabels[status] || status}" بواسطة ${employee.fullName}${notes ? ` (ملاحظات: ${notes})` : ""}`;
      await notifyEmployee(targetRequest.employeeId, notifMsg, {
        category: "personal_requests",
        relatedEntityId: item.id,
        relatedEntityType: "leave_request",
      });

      // Notification to Next Step in workflow
      if (status !== "approved" && status !== "rejected" && status !== "cancelled") {
        await notifyLeaveWorkflow(status, targetEmployee, item, employee);
      }

      res.json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "بيانات غير صحيحة", errors: error.errors });
      }
      console.error("Error updating leave request status:", error);
      res.status(500).json({ message: "حدث خطأ في تحديث الطلب" });
    }
  });

  app.get("/api/permissions", isAuthenticated, async (req, res) => {
    try {
      const category = req.query.category as string | undefined;
      const items = category
        ? await storage.getPermissionsByCategory(category)
        : await storage.getPermissions();
      res.json(items);
    } catch (error) {
      res.status(500).json({ message: "حدث خطأ في جلب الصلاحيات" });
    }
  });

  app.get("/api/employees/:id/permissions", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id as string);
      const items = await storage.getUserPermissions(id);
      res.json(items);
    } catch (error) {
      res.status(500).json({ message: "حدث خطأ في جلب صلاحيات الموظف" });
    }
  });

  app.post("/api/employees/:id/permissions", isAuthenticated, async (req: any, res) => {
    try {
      const empId = parseInt(req.params.id as string);
      const { permissionId } = req.body;
      if (!permissionId) return res.status(400).json({ message: "معرف الصلاحية مطلوب" });

      const granterId = (req.session as any).employeeId;

      const item = await storage.grantPermission({
        employeeId: empId,
        permissionId,
        grantedById: granterId,
      });
      res.status(201).json(item);
    } catch (error) {
      console.error("Error granting permission:", error);
      res.status(500).json({ message: "حدث خطأ في منح الصلاحية" });
    }
  });

  app.delete("/api/employees/:id/permissions/:permissionId", isAuthenticated, async (req, res) => {
    try {
      const empId = parseInt(req.params.id as string);
      const permissionId = parseInt(req.params.permissionId as string);
      await storage.revokePermission(empId, permissionId);
      res.json({ message: "تم سحب الصلاحية" });
    } catch (error) {
      res.status(500).json({ message: "حدث خطأ في سحب الصلاحية" });
    }
  });

  app.get("/api/correspondence/:id/workflow", isAuthenticated, async (req: any, res) => {
    try {
      const corrId = parseInt(req.params.id);
      const corr = await storage.getCorrespondenceById(corrId);
      if (!corr) return res.status(404).json({ message: "المراسلة غير موجودة" });

      const employeeId = (req.session as any).employeeId;
      const employee = await storage.getEmployee(employeeId);
      if (!employee) return res.status(401).json({ message: "Unauthorized" });

      const events = await storage.getWorkflowEventsByCorrespondence(corrId);

      const isAdmin = employee.role === "admin";
      const isCentralMail = employee.role === "central_mail";

      if (isCentralMail) {
        const hasAccess = corr.createdById === employee.id || (corr as any).centralMailAssignedById === employee.id;
        if (!hasAccess) return res.status(403).json({ message: "لا تملك صلاحية" });
        return res.json(events);
      }

      let isInSenderChain = false;
      if (corr.createdById === employee.id) {
        isInSenderChain = true;
      } else if ((corr as any).flowTemplateGroupId && employee.departmentId) {
        const flowGroup = await storage.getFlowTemplateGroup((corr as any).flowTemplateGroupId);
        if (flowGroup?.accounts?.includes(employee.departmentId)) {
          isInSenderChain = true;
        }
      }

      if (isAdmin || isInSenderChain) {
        res.json(events);
      } else {
        const senderInternalActions = ["create_draft", "sign_and_forward", "return_for_modification", "approve_and_forward", "elevate"];
        let filteredEvents = events.filter((evt: any) => {
          if (senderInternalActions.includes(evt.action)) return false;
          if (evt.action === "final_sign" || evt.action === "final_approve_and_issue") return true;
          return true;
        });

        if (corr.type === "external_incoming" && corr.assignedToId !== employee.id && (corr as any).centralMailAssignedById !== employee.id) {
          filteredEvents = filteredEvents.filter((evt: any) => {
            if (evt.action === "receive_incoming") {
              const centralMailEmpId = (corr as any).centralMailAssignedById;
              if (centralMailEmpId && evt.performedById === centralMailEmpId) {
                return false;
              }
            }
            return true;
          });
        }

        const sanitizedEvents = filteredEvents.map((evt: any) => {
          if (evt.action === "final_sign" || evt.action === "final_approve_and_issue") {
            return { ...evt, marginNote: null };
          }
          return evt;
        });
        res.json(sanitizedEvents);
      }
    } catch (error) {
      res.status(500).json({ message: "حدث خطأ في جلب سجل سير العمل" });
    }
  });

  app.post("/api/correspondence/:id/workflow", isAuthenticated, async (req: any, res) => {
    try {
      const corrId = parseInt(req.params.id);
      const corr = await storage.getCorrespondenceById(corrId);
      if (!corr) return res.status(404).json({ message: "المراسلة غير موجودة" });

      const employeeId = (req.session as any).employeeId;
      const employee = await storage.getEmployee(employeeId);
      if (!employee) return res.status(401).json({ message: "Unauthorized" });

      const eventData = {
        correspondenceId: corrId,
        action: req.body.action,
        fromStatus: corr.status,
        toStatus: req.body.toStatus || corr.status,
        performedById: employee.id,
        fromDepartmentId: employee.departmentId || req.body.fromDepartmentId || null,
        toDepartmentId: req.body.toDepartmentId || null,
        marginNote: req.body.marginNote || null,
        signature: req.body.signature !== false,
        notes: req.body.notes || null,
      };

      const actionDeptId = employee.departmentId || req.body.fromDepartmentId || corr.currentDepartmentId;
      const actionDept = actionDeptId ? await storage.getDepartment(actionDeptId) : null;

      if (req.body.action === "receive_incoming" && actionDept && !actionDept.isCentral) {
        return res.status(400).json({
          message: "فقط التشكيلات المركزية يمكنها استلام المراسلات الواردة مباشرة"
        });
      }

      if (req.body.action === "final_approve_and_issue" && actionDept && !actionDept.isCentral) {
        return res.status(400).json({
          message: "فقط التشكيلات المركزية يمكنها إعطاء الموافقة النهائية وإصدار المراسلة"
        });
      }

      if (req.body.action === "return_for_modification" && req.body.toDepartmentId && employee.role !== "admin") {
        const allEvents = await storage.getWorkflowEventsByCorrespondence(corrId);
        const hadRaisedToMe = allEvents.some(evt =>
          evt.fromDepartmentId === req.body.toDepartmentId &&
          evt.toDepartmentId === employee.departmentId &&
          ["elevate", "sign_and_forward", "approve_and_forward"].includes(evt.action)
        );
        if (!hadRaisedToMe) {
          return res.status(400).json({
            message: "لا يمكن إعادة المراسلة إلى تشكيل لم يقم برفعها إليك"
          });
        }
      }

      if (req.body.action === "prepare_response" && employee.departmentId) {
        const activeAssignments = (await storage.getAssignmentsByCorrespondence(corrId))
          .filter((a: any) => a.isActiveBatch !== false && a.routingBatchId);
        const myActiveLead = activeAssignments.find((a: any) => a.departmentId === employee.departmentId && a.isLead);
        if (myActiveLead && myActiveLead.routingBatchId) {
          const contribs = await storage.getContributionsByBatch(corrId, myActiveLead.routingBatchId);
          const nonLeadContribs = contribs.filter((c: any) => !c.isLead);
          const incomplete = nonLeadContribs.filter((c: any) => c.status !== "submitted" && c.status !== "declined");
          if (incomplete.length > 0) {
            return res.status(400).json({
              message: `بانتظار مساهمات من ${incomplete.length} جهة قبل إعداد الإجابة`,
            });
          }
        }
      }

      if (req.body.action === "route_to_subordinate") {
        const rawIds = Array.isArray(req.body.toDepartmentIds) && req.body.toDepartmentIds.length > 0
          ? req.body.toDepartmentIds
          : (req.body.toDepartmentId ? [req.body.toDepartmentId] : []);
        const toDepartmentIds: number[] = Array.from(new Set(rawIds.map((x: any) => parseInt(x)).filter((n: number) => !isNaN(n))));

        if (toDepartmentIds.length === 0) {
          return res.status(400).json({ message: "يجب اختيار جهة تابعة واحدة على الأقل" });
        }

        if (employee.role !== "admin") {
          let canRoute = employee.departmentId === corr.currentDepartmentId
            || employee.departmentId === corr.receiverDepartmentId;
          if (!canRoute && employee.departmentId) {
            const ccsForRoute = await storage.getCCsByCorrespondence(corrId);
            if (ccsForRoute.some((cc: any) => cc.departmentId === employee.departmentId)) {
              canRoute = true;
            }
          }
          if (!canRoute && employee.departmentId) {
            const myAssignments = (await storage.getAssignmentsByCorrespondence(corrId))
              .filter((a: any) => a.departmentId === employee.departmentId);
            if (myAssignments.length > 0) {
              canRoute = true;
            }
          }
          if (!canRoute) {
            return res.status(403).json({ message: "يجب أن تكون مستلِماً للمراسلة لتتمكن من إحالتها" });
          }
        }

        for (const did of toDepartmentIds) {
          const targetDept = await storage.getDepartment(did);
          if (!targetDept) {
            return res.status(400).json({ message: `الجهة #${did} غير موجودة` });
          }
          if (employee.role !== "admin" && targetDept.parentId !== employee.departmentId) {
            return res.status(403).json({ message: `الجهة "${targetDept.name}" ليست تابعة لتشكيلكم` });
          }
        }

        const isBatch = toDepartmentIds.length > 1;
        const leadDeptId = isBatch
          ? (req.body.leadDepartmentId ? parseInt(req.body.leadDepartmentId) : toDepartmentIds[0])
          : toDepartmentIds[0];

        if (isBatch && !toDepartmentIds.includes(leadDeptId)) {
          return res.status(400).json({ message: "الجهة الرئيسية يجب أن تكون ضمن الجهات المختارة" });
        }

        const batchId = isBatch ? randomUUID() : null;

        if (isBatch) {
          const previousAssignments = (await storage.getAssignmentsByCorrespondence(corrId))
            .filter((a: any) => a.isActiveBatch !== false && a.routingBatchId);
          for (const prev of previousAssignments) {
            await storage.updateAssignment(prev.id, { isActiveBatch: false } as any);
          }
        }

        const fDays = req.body.followUpDays ? parseInt(req.body.followUpDays) : null;
        let deadline: Date | undefined;
        if (fDays && fDays > 0) {
          deadline = new Date();
          deadline.setDate(deadline.getDate() + fDays);
        } else if (req.body.responseDeadline && !isNaN(new Date(req.body.responseDeadline).getTime())) {
          deadline = new Date(req.body.responseDeadline);
        }

        let firstEvent: any = null;
        const routerDept = employee.departmentId ? await storage.getDepartment(employee.departmentId) : null;
        const routerName = routerDept?.name || employee.fullName;

        for (const deptId of toDepartmentIds) {
          const event = await storage.createWorkflowEvent({
            correspondenceId: corrId,
            action: "route_to_subordinate",
            fromStatus: corr.status,
            toStatus: req.body.toStatus || "in_progress",
            performedById: employee.id,
            fromDepartmentId: employee.departmentId || req.body.fromDepartmentId || null,
            toDepartmentId: deptId,
            marginNote: req.body.marginNote || null,
            signature: req.body.signature !== false,
            notes: req.body.notes || null,
          });
          if (!firstEvent) firstEvent = event;

          await storage.createAssignment({
            correspondenceId: corrId,
            departmentId: deptId,
            assignedById: employee.id,
            isLead: isBatch ? (deptId === leadDeptId) : false,
            isFollowUp: !!req.body.isFollowUp,
            followUpDays: fDays || undefined,
            status: "pending",
            responseDeadline: deadline,
            routingBatchId: batchId,
            isActiveBatch: true,
          } as any);

          if (isBatch) {
            await storage.createContribution({
              correspondenceId: corrId,
              routingBatchId: batchId!,
              contributingDepartmentId: deptId,
              leadDepartmentId: leadDeptId,
              isLead: deptId === leadDeptId,
              status: deptId === leadDeptId ? "lead" : "pending",
            } as any);
          }

          const msg = isBatch && deptId === leadDeptId
            ? `أنتم الجهة الرئيسية لرد جماعي على مراسلة من ${routerName}: ${corr.subject}`
            : isBatch
              ? `طُلبت مساهمتكم في رد جماعي على مراسلة من ${routerName}: ${corr.subject}`
              : `تم إحالة مراسلة واردة إليكم من ${routerName}: ${corr.subject}`;
          await notifyDepartmentEmployees(
            deptId,
            msg,
            employee.id,
            { category: "correspondence", relatedEntityId: corrId, relatedEntityType: corr.type }
          );
        }

        const newStatus = req.body.toStatus || "in_progress";
        await storage.updateCorrespondence(corrId, {
          status: newStatus,
          currentDepartmentId: leadDeptId,
        });

        if (req.body.marginNote) {
          const existingNotes = corr.marginNotes ? corr.marginNotes + "\n" : "";
          await storage.updateCorrespondence(corrId, {
            marginNotes: existingNotes + `[${employee.fullName}]: ${req.body.marginNote}`,
          });
        }

        await storage.createAuditLog({
          entityType: "correspondence",
          entityId: corrId,
          action: `workflow_route_to_subordinate`,
          performedById: employee.id,
          employeeId: employee.id,
          module: "correspondence",
          details: req.body.notes || (isBatch ? `إحالة جماعية لـ ${toDepartmentIds.length} جهة، الرئيسية #${leadDeptId}` : `إحالة لجهة تابعة`),
        });

        return res.status(201).json(firstEvent);
      }

      const lockableActions = ["elevate", "return_for_modification", "final_sign", "sign_and_forward", "approve_and_forward", "final_approve_and_issue"];
      if (lockableActions.includes(req.body.action) && (corr.status === "issued" || corr.status === "archived" || corr.status === "cancelled")) {
        return res.status(400).json({ message: "لا يمكن تنفيذ إجراءات على مراسلة تم إصدارها أو أرشفتها." });
      }
      if (lockableActions.includes(req.body.action) && employee.role !== "admin") {
        const existingEvents = await storage.getWorkflowEventsByCorrespondence(corrId);
        const myActions = existingEvents.filter(evt =>
          evt.fromDepartmentId === employee.departmentId && lockableActions.includes(evt.action)
        );
        if (myActions.length > 0) {
          const lastIncomingToMe = existingEvents
            .filter(evt => evt.toDepartmentId === employee.departmentId &&
              (evt.action === "return_for_modification" || evt.action === "elevate" || evt.action === "sign_and_forward" || evt.action === "approve_and_forward"))
            .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())[0];
          const lastMyAction = myActions.sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())[0];
          if (!lastIncomingToMe || new Date(lastIncomingToMe.createdAt!) < new Date(lastMyAction.createdAt!)) {
            return res.status(400).json({ message: "تم تنفيذ الإجراء مسبقاً. لا يمكنك التنفيذ مرة أخرى حتى تتم إعادة المراسلة إليك." });
          }
        }
      }

      const parsed = insertWorkflowEventSchema.parse(eventData);
      const event = await storage.createWorkflowEvent(parsed);

      if (req.body.action === "route_to_subordinate" && req.body.toDepartmentId) {
        const targetDept = await storage.getDepartment(req.body.toDepartmentId);
        if (targetDept) {
          const fDays = req.body.followUpDays ? parseInt(req.body.followUpDays) : null;
          let deadline: Date | undefined;
          if (fDays && fDays > 0) {
            deadline = new Date();
            deadline.setDate(deadline.getDate() + fDays);
          } else if (req.body.responseDeadline && !isNaN(new Date(req.body.responseDeadline).getTime())) {
            deadline = new Date(req.body.responseDeadline);
          }
          await storage.createAssignment({
            correspondenceId: corrId,
            departmentId: req.body.toDepartmentId,
            assignedById: employee.id,
            isLead: false,
            isFollowUp: !!req.body.isFollowUp,
            followUpDays: fDays || undefined,
            status: "pending",
            responseDeadline: deadline,
          });
        }
      }

      const shouldUpdate = (req.body.toStatus && req.body.toStatus !== corr.status) ||
        (req.body.toDepartmentId && req.body.toDepartmentId !== corr.currentDepartmentId) ||
        (req.body.action === "route_to_subordinate" && req.body.toDepartmentId) ||
        (req.body.action === "final_approve_and_issue" || req.body.action === "final_sign");
      if (shouldUpdate) {
        const updates: any = {};
        if (req.body.toStatus) updates.status = req.body.toStatus;
        if (req.body.toDepartmentId) {
          updates.currentDepartmentId = req.body.toDepartmentId;
          if (req.body.action !== "route_to_subordinate" && corr.flowTemplateGroupId) {
            const group = await storage.getFlowTemplateGroup(corr.flowTemplateGroupId);
            if (!group || !group.accounts?.includes(req.body.toDepartmentId)) {
              return res.status(400).json({ message: "التشكيل المستهدف ليس ضمن مجموعة مسار التدفق" });
            }
          }
        }
        if (req.body.action === "final_approve_and_issue" || req.body.action === "final_sign") {
          updates.referenceNumber = await generateReferenceNumber(corr.type, corr.senderDepartmentId);
          updates.issuedAt = new Date();
          updates.issuedById = employee.id;
        }
        await storage.updateCorrespondence(corrId, updates);
      }

      if (req.body.action === "final_approve_and_issue" || req.body.action === "final_sign") {
        if (corr.receiverDepartmentId && corr.status !== "issued" && corr.status !== "in_progress") {
          await storage.createWorkflowEvent({
            correspondenceId: corrId,
            action: "auto_received",
            fromStatus: "issued",
            toStatus: "in_progress",
            performedById: employee.id,
            fromDepartmentId: employee.departmentId,
            toDepartmentId: corr.receiverDepartmentId,
            marginNote: null,
            signature: false,
            notes: "استلام تلقائي عند الإصدار",
          });
          await storage.updateCorrespondence(corrId, {
            status: "in_progress",
            currentDepartmentId: corr.receiverDepartmentId,
          });

          const senderDept = employee.departmentId ? await storage.getDepartment(employee.departmentId) : null;
          const senderName = senderDept?.name || employee.fullName;
          const corrTypeLabel = corr.type === "internal_outgoing" ? "وارد داخلي" : "وارد خارجي";
          const incomingType = corr.type === "internal_outgoing" ? "internal_incoming" : "external_incoming";
          await notifyDepartmentEmployees(
            corr.receiverDepartmentId,
            `${corrTypeLabel} جديد من ${senderName}: ${corr.subject}`,
            undefined,
            { category: "correspondence", relatedEntityId: corrId, relatedEntityType: incomingType }
          );
        }

        try {
          const ccsList = await storage.getCCsByCorrespondence(corrId);
          const senderDeptForCc = employee.departmentId ? await storage.getDepartment(employee.departmentId) : null;
          const senderNameForCc = senderDeptForCc?.name || employee.fullName;
          const seenDepts = new Set<number>();
          for (const cc of ccsList) {
            if (!cc.departmentId) continue;
            if (cc.departmentId === corr.receiverDepartmentId) continue;
            if (seenDepts.has(cc.departmentId)) continue;
            seenDepts.add(cc.departmentId);
            await notifyDepartmentEmployees(
              cc.departmentId,
              `نسخة إلى قسمكم — مراسلة من ${senderNameForCc}: ${corr.subject}`,
              undefined,
              { category: "correspondence", relatedEntityId: corrId, relatedEntityType: corr.type }
            );
          }
        } catch (e) {
          console.error("Failed to notify CC departments", e);
        }
      }

      if (req.body.action === "route_to_subordinate" && req.body.toDepartmentId) {
        const routerDept = employee.departmentId ? await storage.getDepartment(employee.departmentId) : null;
        const routerName = routerDept?.name || employee.fullName;
        await notifyDepartmentEmployees(
          req.body.toDepartmentId,
          `تم إحالة مراسلة واردة إليكم من ${routerName}: ${corr.subject}`,
          employee.id,
          { category: "correspondence", relatedEntityId: corrId, relatedEntityType: corr.type }
        );
      }

      const elevateActions = ["elevate", "sign_and_forward", "approve_and_forward"];
      if (elevateActions.includes(req.body.action) && req.body.toDepartmentId) {
        const senderDept = employee.departmentId ? await storage.getDepartment(employee.departmentId) : null;
        const senderName = senderDept?.name || employee.fullName;
        const actionLabel = req.body.action === "elevate" ? "رفع" : req.body.action === "sign_and_forward" ? "توقيع ورفع" : "موافقة ورفع";
        await notifyDepartmentEmployees(
          req.body.toDepartmentId,
          `تم ${actionLabel} مراسلة صادرة إليكم من ${senderName}: ${corr.subject}`,
          employee.id,
          { category: "correspondence", relatedEntityId: corrId, relatedEntityType: corr.type }
        );
      }

      if (req.body.action === "return_for_modification" && req.body.toDepartmentId) {
        const returnerDept = employee.departmentId ? await storage.getDepartment(employee.departmentId) : null;
        const returnerName = returnerDept?.name || employee.fullName;
        await notifyDepartmentEmployees(
          req.body.toDepartmentId,
          `تم إعادة مراسلة للتعديل من ${returnerName}: ${corr.subject}`,
          employee.id,
          { category: "correspondence", relatedEntityId: corrId, relatedEntityType: corr.type }
        );
      }

      if (req.body.marginNote) {
        const existingNotes = corr.marginNotes ? corr.marginNotes + "\n" : "";
        await storage.updateCorrespondence(corrId, {
          marginNotes: existingNotes + `[${employee.fullName}]: ${req.body.marginNote}`,
        });
      }

      await storage.createAuditLog({
        entityType: "correspondence",
        entityId: corrId,
        action: `workflow_${req.body.action}`,
        performedById: employee.id,
        employeeId: employee.id,
        module: "correspondence",
        details: req.body.notes || req.body.marginNote || `إجراء: ${req.body.action}`,
      });

      res.status(201).json(event);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "بيانات غير صحيحة", errors: error.errors });
      }
      console.error("Error creating workflow event:", error);
      res.status(500).json({ message: "حدث خطأ في تسجيل إجراء سير العمل" });
    }
  });

  app.get("/api/correspondence/:id/contributions", isAuthenticated, async (req: any, res) => {
    try {
      const corrId = parseInt(req.params.id);
      const employeeId = (req.session as any).employeeId;
      const employee = await storage.getEmployee(employeeId);
      if (!employee) return res.status(401).json({ message: "Unauthorized" });

      const contributions = await storage.getContributionsByCorrespondence(corrId);
      const assignments = await storage.getAssignmentsByCorrespondence(corrId);
      const corr = await storage.getCorrespondenceById(corrId);
      if (!corr) return res.status(404).json({ message: "المراسلة غير موجودة" });

      const isAdmin = employee.role === "admin";
      const userDeptId = employee.departmentId;
      const myActiveAssignment = assignments.find((a: any) =>
        a.departmentId === userDeptId && a.isActiveBatch !== false && a.routingBatchId);
      const isLeadOfActiveBatch = !!(myActiveAssignment && myActiveAssignment.isLead);
      const isContributorOfActiveBatch = !!(myActiveAssignment && !myActiveAssignment.isLead);
      const isCurrentHolder = userDeptId === corr.currentDepartmentId;

      let isChildReplyReader = false;
      if (!isAdmin && !myActiveAssignment && !isCurrentHolder) {
        const replies = await storage.getCorrespondenceReplies(corrId);
        for (const r of replies) {
          if ((r as any).contributionRoutingBatchId) {
            if (await checkCorrespondenceReadAccess(employeeId, r.id)) {
              isChildReplyReader = true;
              break;
            }
          }
        }
        if (!isChildReplyReader) {
          return res.status(403).json({ message: "غير مصرح" });
        }
      }

      const activeBatchContribs = contributions.filter((c: any) => {
        const a = assignments.find((x: any) => x.routingBatchId === c.routingBatchId && x.departmentId === c.contributingDepartmentId);
        return a ? a.isActiveBatch !== false : true;
      });

      const showFullDetails = isAdmin || isLeadOfActiveBatch || isCurrentHolder || isChildReplyReader;

      const allAttachments = await storage.getAttachmentsByCorrespondence(corrId);

      const enriched = await Promise.all(activeBatchContribs.map(async (c: any) => {
        const isMyRow = c.contributingDepartmentId === userDeptId;
        const [dept, leadDept, submitter] = await Promise.all([
          storage.getDepartment(c.contributingDepartmentId),
          storage.getDepartment(c.leadDepartmentId),
          c.submittedById ? storage.getEmployee(c.submittedById) : Promise.resolve(null),
        ]);
        const base: any = {
          id: c.id,
          correspondenceId: c.correspondenceId,
          routingBatchId: c.routingBatchId,
          contributingDepartmentId: c.contributingDepartmentId,
          leadDepartmentId: c.leadDepartmentId,
          isLead: c.isLead,
          status: c.status,
          submittedAt: c.submittedAt,
          createdAt: c.createdAt,
          contributingDepartment: dept,
          leadDepartment: leadDept,
        };
        if (showFullDetails || isMyRow) {
          base.content = c.content;
          base.declineReason = c.declineReason;
          base.submittedById = c.submittedById;
          base.submittedBy = submitter ? { id: submitter.id, fullName: submitter.fullName, signatureUrl: (submitter as any).signatureUrl || null } : null;
          base.attachments = allAttachments
            .filter((a: any) => a.contributionId === c.id)
            .map((a: any) => ({ id: a.id, originalName: a.originalName, mimeType: a.mimeType, fileSize: a.fileSize, description: a.description }));
        }
        return base;
      }));

      res.json(enriched);
    } catch (error) {
      console.error("Error fetching contributions:", error);
      res.status(500).json({ message: "حدث خطأ في جلب المساهمات" });
    }
  });

  app.post("/api/correspondence/:id/contributions", isAuthenticated, async (req: any, res) => {
    try {
      const corrId = parseInt(req.params.id);
      const employeeId = (req.session as any).employeeId;
      const employee = await storage.getEmployee(employeeId);
      if (!employee || !employee.departmentId) return res.status(401).json({ message: "Unauthorized" });

      const corr = await storage.getCorrespondenceById(corrId);
      if (!corr) return res.status(404).json({ message: "المراسلة غير موجودة" });
      if (corr.status && ["archived", "completed", "cancelled", "issued"].includes(corr.status)) {
        return res.status(400).json({ message: "لا يمكن تعديل المساهمات بعد إغلاق المراسلة" });
      }

      const assignments = await storage.getAssignmentsByCorrespondence(corrId);
      const myActiveAssignment = assignments.find((a: any) =>
        a.departmentId === employee.departmentId && a.isActiveBatch !== false && a.routingBatchId);
      if (!myActiveAssignment) {
        return res.status(403).json({ message: "لا يوجد طلب مساهمة فعّال لتشكيلك على هذه المراسلة" });
      }
      if (myActiveAssignment.isLead) {
        return res.status(400).json({ message: "أنت الجهة الرئيسية، لا يمكنك إرسال مساهمة" });
      }

      const contribs = await storage.getContributionsByBatch(corrId, myActiveAssignment.routingBatchId!);
      const myContrib = contribs.find((c: any) => c.contributingDepartmentId === employee.departmentId);
      if (!myContrib) {
        return res.status(404).json({ message: "لم يتم العثور على سجل المساهمة" });
      }
      const rawContent = typeof req.body.content === "string" ? req.body.content : "";
      const content = sanitizeHtmlContent(rawContent);
      if (!content || !content.trim()) {
        return res.status(400).json({ message: "محتوى المساهمة مطلوب" });
      }

      const isResubmit = myContrib.status === "submitted" || myContrib.status === "declined";

      const updated = await storage.updateContribution(myContrib.id, {
        content,
        status: "submitted",
        declineReason: null,
        submittedById: employee.id,
        submittedAt: new Date(),
      });

      await storage.updateAssignment(myActiveAssignment.id, {
        status: "completed",
        completedAt: new Date(),
      } as any);

      await storage.createWorkflowEvent({
        correspondenceId: corrId,
        action: "submit_contribution",
        fromStatus: corr.status,
        toStatus: corr.status,
        performedById: employee.id,
        fromDepartmentId: employee.departmentId,
        toDepartmentId: myContrib.leadDepartmentId,
        marginNote: null,
        signature: true,
        notes: "تم إرسال المساهمة للجهة الرئيسية",
      });

      const myDept = await storage.getDepartment(employee.departmentId);
      await notifyDepartmentEmployees(
        myContrib.leadDepartmentId,
        `وردتكم مساهمة من ${myDept?.name || employee.fullName} على المراسلة: ${corr.subject}`,
        employee.id,
        { category: "correspondence", relatedEntityId: corrId, relatedEntityType: corr.type }
      );

      await storage.createAuditLog({
        entityType: "correspondence",
        entityId: corrId,
        action: "submit_contribution",
        performedById: employee.id,
        employeeId: employee.id,
        module: "correspondence",
        details: `إرسال مساهمة من تشكيل #${employee.departmentId}`,
      });

      res.status(201).json(updated);
    } catch (error) {
      console.error("Error submitting contribution:", error);
      res.status(500).json({ message: "حدث خطأ في إرسال المساهمة" });
    }
  });

  app.post("/api/correspondence/:id/contributions/decline", isAuthenticated, async (req: any, res) => {
    try {
      const corrId = parseInt(req.params.id);
      const employeeId = (req.session as any).employeeId;
      const employee = await storage.getEmployee(employeeId);
      if (!employee || !employee.departmentId) return res.status(401).json({ message: "Unauthorized" });

      const corr = await storage.getCorrespondenceById(corrId);
      if (!corr) return res.status(404).json({ message: "المراسلة غير موجودة" });
      if (corr.status && ["archived", "completed", "cancelled", "issued"].includes(corr.status)) {
        return res.status(400).json({ message: "لا يمكن تعديل المساهمات بعد إغلاق المراسلة" });
      }

      const reason = typeof req.body.reason === "string" ? req.body.reason.trim() : "";
      if (!reason) return res.status(400).json({ message: "سبب الاعتذار مطلوب" });

      const assignments = await storage.getAssignmentsByCorrespondence(corrId);
      const myActiveAssignment = assignments.find((a: any) =>
        a.departmentId === employee.departmentId && a.isActiveBatch !== false && a.routingBatchId);
      if (!myActiveAssignment) {
        return res.status(403).json({ message: "لا يوجد طلب مساهمة فعّال لتشكيلك" });
      }
      if (myActiveAssignment.isLead) {
        return res.status(400).json({ message: "الجهة الرئيسية لا يمكنها الاعتذار" });
      }

      const contribs = await storage.getContributionsByBatch(corrId, myActiveAssignment.routingBatchId!);
      const myContrib = contribs.find((c: any) => c.contributingDepartmentId === employee.departmentId);
      if (!myContrib) return res.status(404).json({ message: "لم يتم العثور على سجل المساهمة" });
      const updated = await storage.updateContribution(myContrib.id, {
        status: "declined",
        declineReason: reason,
        submittedById: employee.id,
        submittedAt: new Date(),
      });

      await storage.updateAssignment(myActiveAssignment.id, {
        status: "completed",
        completedAt: new Date(),
      } as any);

      await storage.createWorkflowEvent({
        correspondenceId: corrId,
        action: "decline_contribution",
        fromStatus: corr.status,
        toStatus: corr.status,
        performedById: employee.id,
        fromDepartmentId: employee.departmentId,
        toDepartmentId: myContrib.leadDepartmentId,
        marginNote: null,
        signature: true,
        notes: `اعتذار عن المساهمة: ${reason}`,
      });

      const myDept = await storage.getDepartment(employee.departmentId);
      await notifyDepartmentEmployees(
        myContrib.leadDepartmentId,
        `اعتذرت ${myDept?.name || employee.fullName} عن المساهمة على المراسلة: ${corr.subject}`,
        employee.id,
        { category: "correspondence", relatedEntityId: corrId, relatedEntityType: corr.type }
      );

      await storage.createAuditLog({
        entityType: "correspondence",
        entityId: corrId,
        action: "decline_contribution",
        performedById: employee.id,
        employeeId: employee.id,
        module: "correspondence",
        details: `اعتذار: ${reason}`,
      });

      res.status(201).json(updated);
    } catch (error) {
      console.error("Error declining contribution:", error);
      res.status(500).json({ message: "حدث خطأ في الاعتذار عن المساهمة" });
    }
  });

  app.patch("/api/correspondence/:id/change-flow", isAuthenticated, async (req: any, res) => {
    try {
      const corrId = parseInt(req.params.id);
      const corr = await storage.getCorrespondenceById(corrId);
      if (!corr) return res.status(404).json({ message: "المراسلة غير موجودة" });

      const employeeId = (req.session as any).employeeId;
      const employee = await storage.getEmployee(employeeId);
      if (!employee) return res.status(401).json({ message: "Unauthorized" });

      const isOutgoing = corr.type === "internal_outgoing" || corr.type === "external_outgoing";
      if (!isOutgoing) {
        return res.status(400).json({ message: "تغيير المسار متاح فقط للمراسلات الصادرة" });
      }

      if (corr.status === "issued" || corr.status === "archived" || corr.status === "cancelled") {
        return res.status(400).json({ message: "لا يمكن تغيير المسار بعد إطلاق المراسلة" });
      }

      if (!corr.flowTemplateGroupId) {
        return res.status(400).json({ message: "المراسلة ليست مرتبطة بمسار تدفق" });
      }

      const currentGroup = await storage.getFlowTemplateGroup(corr.flowTemplateGroupId);
      if (!currentGroup) {
        return res.status(400).json({ message: "مجموعة المسار الحالية غير موجودة" });
      }

      const currentUserPos = employee.departmentId ? (currentGroup.accounts?.indexOf(employee.departmentId) ?? -1) : -1;
      if (currentUserPos <= 0) {
        return res.status(403).json({ message: "فقط الحسابات الأعلى في سلسلة المصادقة يمكنها تغيير المسار" });
      }

      const { newFlowTemplateId, newFlowTemplateGroupId } = req.body;
      if (!newFlowTemplateId || !newFlowTemplateGroupId) {
        return res.status(400).json({ message: "يجب تحديد المسار الجديد ومجموعة الحسابات" });
      }

      const newTemplate = await storage.getFlowTemplate(newFlowTemplateId);
      if (!newTemplate || !newTemplate.isActive) {
        return res.status(400).json({ message: "مسار التدفق الجديد غير موجود أو غير فعال" });
      }

      if (newTemplate.correspondenceType !== corr.type) {
        return res.status(400).json({ message: "نوع المراسلة لا يتطابق مع نوع المسار الجديد" });
      }

      const newGroup = await storage.getFlowTemplateGroup(newFlowTemplateGroupId);
      if (!newGroup || !newGroup.isActive || newGroup.flowTemplateId !== newFlowTemplateId) {
        return res.status(400).json({ message: "مجموعة الحسابات غير صالحة" });
      }

      const chainAccounts = currentGroup.accounts?.slice(0, currentUserPos + 1) || [];
      for (let i = 0; i < chainAccounts.length; i++) {
        const accId = chainAccounts[i];
        if (!newGroup.accounts || !newGroup.accounts.includes(accId)) {
          return res.status(400).json({ message: `الحساب في الموضع ${i + 1} من السلسلة الحالية غير موجود في المسار الجديد` });
        }
        const newPos = newGroup.accounts.indexOf(accId);
        if (i > 0) {
          const prevAccId = chainAccounts[i - 1];
          const prevNewPos = newGroup.accounts.indexOf(prevAccId);
          if (newPos <= prevNewPos) {
            return res.status(400).json({ message: "ترتيب الحسابات في المسار الجديد لا يتوافق مع السلسلة الحالية" });
          }
        }
      }

      await storage.updateCorrespondence(corrId, {
        flowTemplateId: newFlowTemplateId,
        flowTemplateGroupId: newFlowTemplateGroupId,
      });

      await storage.createWorkflowEvent({
        correspondenceId: corrId,
        action: "elevate" as any,
        fromStatus: corr.status,
        toStatus: corr.status,
        performedById: employee.id,
        fromDepartmentId: employee.departmentId,
        toDepartmentId: employee.departmentId,
        marginNote: `تم تغيير مسار التدفق من "${(await storage.getFlowTemplate(corr.flowTemplateId!))?.name || ''}" إلى "${newTemplate.name}"`,
        signature: false,
        notes: null,
      });

      await storage.createAuditLog({
        entityType: "correspondence",
        entityId: corrId,
        action: "change_flow_template",
        performedById: employee.id,
        employeeId: employee.id,
        module: "correspondence",
        details: `تغيير مسار التدفق إلى: ${newTemplate.name}`,
      });

      res.json({ message: "تم تغيير مسار التدفق بنجاح" });
    } catch (error) {
      console.error("Error changing flow template:", error);
      res.status(500).json({ message: "حدث خطأ في تغيير مسار التدفق" });
    }
  });

  // Cancel correspondence (user action - blocked if issued with reference number)
  app.patch("/api/correspondence/:id/cancel", isAuthenticated, async (req: any, res) => {
    try {
      const corrId = parseInt(req.params.id);
      const corr = await storage.getCorrespondenceById(corrId);
      if (!corr) return res.status(404).json({ message: "المراسلة غير موجودة" });

      const employeeId = (req.session as any).employeeId;
      const employee = await storage.getEmployee(employeeId);
      if (!employee) return res.status(401).json({ message: "Unauthorized" });

      if (employee.role !== "admin" && employee.departmentId !== corr.senderDepartmentId && corr.createdById !== employee.id) {
        return res.status(403).json({ message: "غير مصرح لك بإلغاء هذه المراسلة" });
      }

      if (corr.type !== "internal_outgoing" && corr.type !== "external_outgoing") {
        return res.status(400).json({ message: "يمكن إلغاء المراسلات الصادرة فقط" });
      }

      if (corr.referenceNumber && corr.issuedAt) {
        return res.status(400).json({ message: "لا يمكن إلغاء مراسلة تم إصدارها وحصلت على رقم صادر. يرجى التواصل مع مدير النظام" });
      }

      if (corr.status === "cancelled") {
        return res.status(400).json({ message: "المراسلة ملغاة بالفعل" });
      }

      await storage.createWorkflowEvent({
        correspondenceId: corrId,
        action: "cancel_correspondence",
        fromStatus: corr.status,
        toStatus: "cancelled",
        performedById: employee.id,
        notes: req.body.reason || "تم إلغاء المراسلة",
      });

      await storage.updateCorrespondence(corrId, { status: "cancelled" });

      await storage.createAuditLog({
        entityType: "correspondence",
        entityId: corrId,
        action: "cancel_correspondence",
        performedById: employee.id,
        employeeId: employee.id,
        module: "correspondence",
        details: `إلغاء المراسلة: ${corr.subject}${req.body.reason ? ` - السبب: ${req.body.reason}` : ""}`,
      });

      res.json({ message: "تم إلغاء المراسلة بنجاح" });
    } catch (error) {
      console.error("Error cancelling correspondence:", error);
      res.status(500).json({ message: "حدث خطأ في إلغاء المراسلة" });
    }
  });

  // Admin delete correspondence (soft delete + notification)
  app.delete("/api/admin/correspondence/:id", isAuthenticated, async (req: any, res) => {
    try {
      const employeeId = (req.session as any).employeeId;
      const employee = await storage.getEmployee(employeeId);
      if (!employee || employee.role !== "admin") return res.status(403).json({ message: "غير مصرح" });

      const perms = await storage.getUserPermissions(employee.id);
      const permKeys = perms.map((p: any) => p.key || p.permission?.key);
      if (!permKeys.includes("SYS_CORRESPONDENCE_DELETE")) {
        return res.status(403).json({ message: "لا تملك صلاحية حذف المراسلات" });
      }

      const corrId = parseInt(req.params.id);
      const corr = await storage.getCorrespondenceById(corrId);
      if (!corr) return res.status(404).json({ message: "المراسلة غير موجودة" });

      const reason = req.body.reason || "تم حذف المراسلة بواسطة مدير النظام";

      await storage.createWorkflowEvent({
        correspondenceId: corrId,
        action: "admin_delete",
        fromStatus: corr.status,
        toStatus: corr.status,
        performedById: employee.id,
        notes: reason,
      });

      await storage.updateCorrespondence(corrId, {
        isDeleted: true,
        deletedAt: new Date(),
        deletedById: employee.id,
        deleteReason: reason,
      });

      // Send notification to the sender department
      if (corr.senderDepartmentId) {
        const deptEmployees = await storage.getEmployees();
        const deptEmps = deptEmployees.filter(e => e.departmentId === corr.senderDepartmentId && e.isActive);
        if (deptEmps.length > 0) {
          const notifMessage = req.body.notificationMessage || `تم حذف المراسلة "${corr.subject}" (${corr.referenceNumber || "بدون رقم"}) بواسطة مدير النظام. السبب: ${reason}`;
          const notif = await storage.createNotification({
            message: notifMessage,
            targetType: "specific",
            sentById: employee.id,
          });
          await storage.createNotificationRecipients(
            notif.id,
            deptEmps.map(e => e.id)
          );
        }
      }

      await storage.createAuditLog({
        entityType: "correspondence",
        entityId: corrId,
        action: "admin_delete_correspondence",
        performedById: employee.id,
        employeeId: employee.id,
        module: "correspondence",
        details: `حذف المراسلة: ${corr.subject} (${corr.referenceNumber || "بدون رقم"}) - السبب: ${reason}`,
      });

      res.json({ message: "تم حذف المراسلة بنجاح" });
    } catch (error) {
      console.error("Error admin deleting correspondence:", error);
      res.status(500).json({ message: "حدث خطأ في حذف المراسلة" });
    }
  });

  // Get deleted correspondence (admin only)
  app.get("/api/admin/deleted-correspondence", isAuthenticated, async (req: any, res) => {
    try {
      const employeeId = (req.session as any).employeeId;
      const employee = await storage.getEmployee(employeeId);
      if (!employee || employee.role !== "admin") return res.status(403).json({ message: "غير مصرح" });
      const items = await storage.getDeletedCorrespondence();
      res.json(items);
    } catch (error) {
      res.status(500).json({ message: "حدث خطأ في جلب المراسلات المحذوفة" });
    }
  });

  // Request deletion of correspondence
  app.post("/api/correspondence/:id/request-deletion", isAuthenticated, async (req: any, res) => {
    try {
      const employeeId = (req.session as any).employeeId;
      const employee = await storage.getEmployee(employeeId);
      if (!employee) return res.status(401).json({ message: "غير مصرح" });

      const corrId = parseInt(req.params.id);
      const corr = await storage.getCorrespondenceById(corrId);
      if (!corr) return res.status(404).json({ message: "المراسلة غير موجودة" });

      const isOutgoing = corr.type === "internal_outgoing" || corr.type === "external_outgoing";

      if (isOutgoing && !corr.issuedAt && !corr.referenceNumber) {
        return res.status(400).json({ message: "المراسلة لم تحصل على توقيع نهائي بعد. يمكنك إلغاؤها مباشرة." });
      }

      if (employee.role !== "admin") {
        const isSenderDept = employee.departmentId === corr.senderDepartmentId;
        const isReceiverDept = employee.departmentId === corr.receiverDepartmentId;
        const assignments = await storage.getAssignmentsByCorrespondence(corrId);
        const isAssigned = assignments.some(a => a.departmentId === employee.departmentId);
        const wfEvents = await storage.getWorkflowEventsByCorrespondence(corrId);
        const isInWorkflow = wfEvents.some((e: any) => e.fromDepartmentId === employee.departmentId || e.toDepartmentId === employee.departmentId);
        if (!isSenderDept && !isReceiverDept && !isAssigned && !isInWorkflow) {
          return res.status(403).json({ message: "ليس لديك صلاحية لطلب حذف هذه المراسلة" });
        }
      }

      const existingRequest = await storage.getDeletionRequestByCorrespondenceId(corrId);
      if (existingRequest) {
        return res.status(400).json({ message: "يوجد طلب حذف معلّق لهذه المراسلة بالفعل" });
      }

      const { reason } = req.body;
      if (!reason || !reason.trim()) {
        return res.status(400).json({ message: "يجب ذكر سبب الحذف" });
      }

      const request = await storage.createDeletionRequest({
        correspondenceId: corrId,
        requestedById: employee.id,
        requestedDepartmentId: employee.departmentId!,
        reason: reason.trim(),
      });

      await storage.createAuditLog({
        entityType: "correspondence",
        entityId: corrId,
        action: "request_deletion",
        performedById: employee.id,
        employeeId: employee.id,
        module: "correspondence",
        details: `طلب حذف المراسلة: ${corr.subject} (${corr.referenceNumber}) - السبب: ${reason.trim()}`,
      });

      // Notify admins
      const allEmployees = await storage.getEmployees();
      const admins = allEmployees.filter(e => e.role === "admin" && e.isActive);
      if (admins.length > 0) {
        const dept = await storage.getDepartment(employee.departmentId!);
        const notif = await storage.createNotification({
          message: `طلب حذف مراسلة: "${corr.subject}" (${corr.referenceNumber}) من ${dept?.name || "غير محدد"} - السبب: ${reason.trim()}`,
          targetType: "specific",
          sentById: employee.id,
        });
        await storage.createNotificationRecipients(notif.id, admins.map(a => a.id));
      }

      res.json({ message: "تم إرسال طلب الحذف بنجاح", request });
    } catch (error) {
      console.error("Error requesting deletion:", error);
      res.status(500).json({ message: "حدث خطأ في إرسال طلب الحذف" });
    }
  });

  // Get deletion requests (admin only)
  app.get("/api/admin/deletion-requests", isAuthenticated, async (req: any, res) => {
    try {
      const employeeId = (req.session as any).employeeId;
      const employee = await storage.getEmployee(employeeId);
      if (!employee || employee.role !== "admin") return res.status(403).json({ message: "غير مصرح" });

      const status = req.query.status as string | undefined;
      const requests = await storage.getDeletionRequests(status);

      const allEmployees = await storage.getEmployees();
      const allDepts = await storage.getDepartments();

      const enriched = await Promise.all(requests.map(async (r) => {
        const corr = await storage.getCorrespondenceById(r.correspondenceId);
        const requester = allEmployees.find(e => e.id === r.requestedById);
        const dept = allDepts.find(d => d.id === r.requestedDepartmentId);
        const processor = r.processedById ? allEmployees.find(e => e.id === r.processedById) : null;
        return {
          ...r,
          correspondence: corr ? { id: corr.id, subject: corr.subject, referenceNumber: corr.referenceNumber, type: corr.type, issuedAt: corr.issuedAt, senderDepartmentId: corr.senderDepartmentId } : null,
          requesterName: requester?.fullName || "-",
          departmentName: dept?.name || "-",
          processedByName: processor?.fullName || null,
        };
      }));

      res.json(enriched);
    } catch (error) {
      console.error("Error getting deletion requests:", error);
      res.status(500).json({ message: "حدث خطأ في جلب طلبات الحذف" });
    }
  });

  // Approve deletion request (admin only)
  app.post("/api/admin/deletion-requests/:id/approve", isAuthenticated, async (req: any, res) => {
    try {
      const employeeId = (req.session as any).employeeId;
      const employee = await storage.getEmployee(employeeId);
      if (!employee || employee.role !== "admin") return res.status(403).json({ message: "غير مصرح" });

      const requestId = parseInt(req.params.id);
      const request = await storage.getDeletionRequest(requestId);
      if (!request) return res.status(404).json({ message: "طلب الحذف غير موجود" });
      if (request.status !== "pending") return res.status(400).json({ message: "تمت معالجة هذا الطلب مسبقاً" });

      const corr = await storage.getCorrespondenceById(request.correspondenceId);
      if (!corr) return res.status(404).json({ message: "المراسلة غير موجودة" });

      const adminNotes = req.body.adminNotes || "";

      await storage.updateDeletionRequest(requestId, {
        status: "approved",
        processedById: employee.id,
        processedAt: new Date(),
        adminNotes,
      });

      await storage.createWorkflowEvent({
        correspondenceId: corr.id,
        action: "admin_delete",
        fromStatus: corr.status,
        toStatus: corr.status,
        performedById: employee.id,
        notes: `حذف بناءً على طلب - السبب: ${request.reason}`,
      });

      await storage.updateCorrespondence(corr.id, {
        isDeleted: true,
        deletedAt: new Date(),
        deletedById: employee.id,
        deleteReason: request.reason,
      });

      // Send notification to ALL departments that worked on this correspondence
      const workflowEvts = await storage.getWorkflowEventsByCorrespondence(corr.id);
      const involvedDeptIds = new Set<number>();
      if (corr.senderDepartmentId) involvedDeptIds.add(corr.senderDepartmentId);
      if (corr.receiverDepartmentId) involvedDeptIds.add(corr.receiverDepartmentId);
      for (const evt of workflowEvts) {
        if (evt.fromDepartmentId) involvedDeptIds.add(evt.fromDepartmentId);
        if (evt.toDepartmentId) involvedDeptIds.add(evt.toDepartmentId);
      }

      const reqDept = await storage.getDepartment(request.requestedDepartmentId);
      const notifMsg = `تم حذف المراسلة "${corr.subject}" (${corr.referenceNumber || "بدون رقم"}) بتاريخ ${corr.issuedAt ? new Date(corr.issuedAt).toLocaleDateString("ar") : "-"} بناءً على طلب ${reqDept?.name || "غير محدد"}`;

      const allEmployees = await storage.getEmployees();
      const recipientIds = new Set<number>();
      for (const deptId of involvedDeptIds) {
        allEmployees.filter(e => e.departmentId === deptId && e.isActive).forEach(e => recipientIds.add(e.id));
      }

      if (recipientIds.size > 0) {
        const notif = await storage.createNotification({
          message: notifMsg,
          targetType: "specific",
          sentById: employee.id,
        });
        await storage.createNotificationRecipients(notif.id, Array.from(recipientIds));
      }

      await storage.createAuditLog({
        entityType: "correspondence",
        entityId: corr.id,
        action: "approve_deletion_request",
        performedById: employee.id,
        employeeId: employee.id,
        module: "correspondence",
        details: `الموافقة على طلب حذف المراسلة: ${corr.subject} (${corr.referenceNumber || "بدون رقم"}) - طلب من: ${reqDept?.name || "-"}`,
      });

      res.json({ message: "تمت الموافقة على طلب الحذف وحذف المراسلة" });
    } catch (error) {
      console.error("Error approving deletion request:", error);
      res.status(500).json({ message: "حدث خطأ في معالجة طلب الحذف" });
    }
  });

  // Reject deletion request (admin only)
  app.post("/api/admin/deletion-requests/:id/reject", isAuthenticated, async (req: any, res) => {
    try {
      const employeeId = (req.session as any).employeeId;
      const employee = await storage.getEmployee(employeeId);
      if (!employee || employee.role !== "admin") return res.status(403).json({ message: "غير مصرح" });

      const requestId = parseInt(req.params.id);
      const request = await storage.getDeletionRequest(requestId);
      if (!request) return res.status(404).json({ message: "طلب الحذف غير موجود" });
      if (request.status !== "pending") return res.status(400).json({ message: "تمت معالجة هذا الطلب مسبقاً" });

      const adminNotes = req.body.adminNotes || "";

      await storage.updateDeletionRequest(requestId, {
        status: "rejected",
        processedById: employee.id,
        processedAt: new Date(),
        adminNotes,
      });

      // Notify requester
      await notifyEmployee(request.requestedById, `تم رفض طلب حذف المراسلة. ${adminNotes ? "ملاحظة: " + adminNotes : ""}`);

      const corr = await storage.getCorrespondenceById(request.correspondenceId);
      await storage.createAuditLog({
        entityType: "correspondence",
        entityId: request.correspondenceId,
        action: "reject_deletion_request",
        performedById: employee.id,
        employeeId: employee.id,
        module: "correspondence",
        details: `رفض طلب حذف المراسلة: ${corr?.subject || "-"} (${corr?.referenceNumber || "بدون رقم"})`,
      });

      res.json({ message: "تم رفض طلب الحذف" });
    } catch (error) {
      console.error("Error rejecting deletion request:", error);
      res.status(500).json({ message: "حدث خطأ في رفض طلب الحذف" });
    }
  });

  // Restore deleted correspondence (admin only)
  app.patch("/api/admin/correspondence/:id/restore", isAuthenticated, async (req: any, res) => {
    try {
      const employeeId = (req.session as any).employeeId;
      const employee = await storage.getEmployee(employeeId);
      if (!employee || employee.role !== "admin") return res.status(403).json({ message: "غير مصرح" });

      const corrId = parseInt(req.params.id);
      const corr = await storage.getCorrespondenceById(corrId);
      if (!corr) return res.status(404).json({ message: "المراسلة غير موجودة" });
      if (!corr.isDeleted) return res.status(400).json({ message: "المراسلة ليست محذوفة" });

      await storage.updateCorrespondence(corrId, {
        isDeleted: false,
        deletedAt: null,
        deletedById: null,
        deleteReason: null,
      });

      await storage.createWorkflowEvent({
        correspondenceId: corrId,
        action: "admin_restore",
        fromStatus: corr.status,
        toStatus: corr.status,
        performedById: employee.id,
        notes: "إلغاء حذف المراسلة واستعادتها",
      });

      // Send notification to ALL departments that worked on this correspondence
      const workflowEvts = await storage.getWorkflowEventsByCorrespondence(corrId);
      const involvedDeptIds = new Set<number>();
      if (corr.senderDepartmentId) involvedDeptIds.add(corr.senderDepartmentId);
      if (corr.receiverDepartmentId) involvedDeptIds.add(corr.receiverDepartmentId);
      for (const evt of workflowEvts) {
        if (evt.fromDepartmentId) involvedDeptIds.add(evt.fromDepartmentId);
        if (evt.toDepartmentId) involvedDeptIds.add(evt.toDepartmentId);
      }

      const notifMsg = `تم إلغاء حذف المراسلة "${corr.subject}" (${corr.referenceNumber || "بدون رقم"}) واستعادتها من قبل مدير النظام`;

      const allEmployees = await storage.getEmployees();
      const recipientIds = new Set<number>();
      for (const deptId of involvedDeptIds) {
        allEmployees.filter(e => e.departmentId === deptId && e.isActive).forEach(e => recipientIds.add(e.id));
      }

      if (recipientIds.size > 0) {
        const notif = await storage.createNotification({
          message: notifMsg,
          targetType: "specific",
          sentById: employee.id,
        });
        await storage.createNotificationRecipients(notif.id, Array.from(recipientIds));
      }

      await storage.createAuditLog({
        entityType: "correspondence",
        entityId: corrId,
        action: "restore_correspondence",
        performedById: employee.id,
        employeeId: employee.id,
        module: "correspondence",
        details: `إلغاء حذف واستعادة المراسلة: ${corr.subject} (${corr.referenceNumber || "بدون رقم"})`,
      });

      res.json({ message: "تم إلغاء حذف المراسلة واستعادتها بنجاح" });
    } catch (error) {
      console.error("Error restoring correspondence:", error);
      res.status(500).json({ message: "حدث خطأ في استعادة المراسلة" });
    }
  });

  app.get("/api/departments/:id/ancestors", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id as string);
      const ancestors = await storage.getDepartmentAncestors(id);
      res.json(ancestors);
    } catch (error) {
      res.status(500).json({ message: "حدث خطأ في جلب التسلسل الإداري" });
    }
  });

  app.patch("/api/departments/:id", isAuthenticated, async (req: any, res) => {
    try {
      const currentUserId = (req.session as any).employeeId;
      const currentUser = await storage.getEmployee(currentUserId);
      if (!currentUser || currentUser.role !== "admin") {
        return res.status(403).json({ message: "غير مصرح بتعديل الهيكل التنظيمي" });
      }

      const id = parseInt(req.params.id);
      const existingDept = (await storage.getDepartments()).find(d => d.id === id);
      if (!existingDept) return res.status(404).json({ message: "الجهة غير موجودة" });
      const isCentral = req.body.isCentral !== undefined ? req.body.isCentral : existingDept.isCentral;
      const code = req.body.code !== undefined ? req.body.code : (existingDept.code || "");
      if (isCentral && (!code || code.trim() === "")) {
        return res.status(400).json({ message: "رمز التشكيل مطلوب للأقسام المركزية" });
      }
      if (req.body.level || req.body.parentId !== undefined) {
        const existing = existingDept;
        const level = req.body.level || existing.level;
        const parentId = req.body.parentId !== undefined ? req.body.parentId : existing.parentId;
        const hierarchyError = await validateDepartmentHierarchy(level, parentId, id);
        if (hierarchyError) {
          return res.status(400).json({ message: hierarchyError });
        }
      }
      const item = await storage.updateDepartment(id, req.body);
      if (!item) return res.status(404).json({ message: "الجهة غير موجودة" });

      if (isCentral && req.body.code !== undefined && req.body.code !== existingDept.code) {
        const updatedLevel = req.body.level || existingDept.level;
        if (updatedLevel !== "general_manager" && updatedLevel !== "assistant") {
          const allDepts = await storage.getDepartments();
          const childMap = new Map<number, typeof allDepts>();
          for (const d of allDepts) {
            if (d.parentId) {
              if (!childMap.has(d.parentId)) childMap.set(d.parentId, []);
              childMap.get(d.parentId)!.push(d);
            }
          }
          const cascadeCode = async (parentId: number, newCode: string) => {
            const children = childMap.get(parentId) || [];
            for (const child of children) {
              if (child.isCentral) continue;
              await storage.updateDepartment(child.id, { code: newCode });
              await cascadeCode(child.id, newCode);
            }
          };
          await cascadeCode(id, req.body.code);
        }
      }

      res.json(item);
    } catch (error) {
      res.status(500).json({ message: "حدث خطأ في تحديث الجهة" });
    }
  });

  app.patch("/api/departments/:id/toggle-active", isAuthenticated, async (req: any, res) => {
    try {
      const currentUserId = (req.session as any).employeeId;
      const currentUser = await storage.getEmployee(currentUserId);
      if (!currentUser || currentUser.role !== "admin") {
        return res.status(403).json({ message: "غير مصرح" });
      }

      const id = parseInt(req.params.id);
      const dept = await storage.getDepartment(id);
      if (!dept) return res.status(404).json({ message: "الجهة غير موجودة" });

      const newStatus = !dept.isActive;
      const updated = await storage.updateDepartment(id, { isActive: newStatus });

      await storage.createAuditLog({
        entityType: "department",
        entityId: id,
        action: newStatus ? "activate" : "deactivate",
        performedById: currentUserId,
        employeeId: null,
        ipAddress: req.ip || null,
        module: "departments",
        details: `${newStatus ? "تنشيط" : "إيقاف"} الجهة: ${dept.name}`,
      });

      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "حدث خطأ" });
    }
  });

  app.delete("/api/departments/:id", isAuthenticated, async (req: any, res) => {
    try {
      const currentUserId = (req.session as any).employeeId;
      const currentUser = await storage.getEmployee(currentUserId);
      if (!currentUser || currentUser.role !== "admin") {
        return res.status(403).json({ message: "غير مصرح" });
      }

      const id = parseInt(req.params.id);
      const dept = await storage.getDepartment(id);
      if (!dept) return res.status(404).json({ message: "الجهة غير موجودة" });

      const children = await storage.getDepartmentChildren(id);
      if (children.length > 0) {
        return res.status(400).json({ message: "لا يمكن حذف جهة لديها أقسام فرعية" });
      }

      const allEmployees = await storage.getEmployees();
      const deptEmployees = allEmployees.filter(e => e.departmentId === id);
      if (deptEmployees.length > 0) {
        return res.status(400).json({ message: "لا يمكن حذف جهة مرتبط بها موظفون" });
      }

      await storage.deleteDepartment(id);

      await storage.createAuditLog({
        entityType: "department",
        entityId: id,
        action: "delete",
        performedById: currentUserId,
        employeeId: null,
        ipAddress: req.ip || null,
        module: "departments",
        details: `حذف الجهة: ${dept.name}`,
      });

      res.json({ message: "تم حذف الجهة بنجاح" });
    } catch (error) {
      res.status(500).json({ message: "حدث خطأ في حذف الجهة" });
    }
  });

  app.get("/api/password-reset-requests", isAuthenticated, async (req: any, res) => {
    try {
      const employeeId = (req.session as any).employeeId;
      const emp = await storage.getEmployee(employeeId);
      if (!emp || emp.role !== "admin") return res.status(403).json({ message: "غير مصرح" });
      const requests = await storage.getPasswordResetRequests();
      res.json(requests);
    } catch (error) {
      res.status(500).json({ message: "حدث خطأ" });
    }
  });

  app.patch("/api/password-reset-requests/:id", isAuthenticated, async (req: any, res) => {
    try {
      const employeeId = (req.session as any).employeeId;
      const emp = await storage.getEmployee(employeeId);
      if (!emp || emp.role !== "admin") return res.status(403).json({ message: "غير مصرح" });
      const id = parseInt(req.params.id);
      const { status, notes, newPassword } = req.body;

      const request = await storage.getPasswordResetRequest(id);
      if (!request) return res.status(404).json({ message: "الطلب غير موجود" });

      if (newPassword && status === "completed") {
        const targetEmp = await storage.getEmployeeByUsername(request.username);
        if (targetEmp) {
          const hash = await bcrypt.hash(newPassword, 10);
          await storage.updateEmployee(targetEmp.id, { passwordHash: hash, mustChangePassword: true });
        }
      }

      const updated = await storage.updatePasswordResetRequest(id, {
        status, notes, processedById: employeeId, processedAt: new Date()
      });

      if (request.employeeId && request.employeeId > 0) {
        if (status === "completed") {
          await notifyEmployee(request.employeeId, `تمت الموافقة على طلب إعادة تعيين كلمة المرور الخاص بك وتم تغيير كلمة المرور بنجاح. يرجى تسجيل الدخول بكلمة المرور الجديدة.`);
        } else if (status === "rejected") {
          await notifyEmployee(request.employeeId, `تم رفض طلب إعادة تعيين كلمة المرور الخاص بك.${notes ? ` الملاحظات: ${notes}` : ""}`);
        }
      }

      const actionLabel = status === "completed" ? "الموافقة على" : "رفض";
      await storage.createAuditLog({
        entityType: "employee",
        entityId: request.employeeId || 0,
        action: status === "completed" ? "password_reset_approve" : "password_reset_reject",
        performedById: employeeId,
        employeeId: employeeId,
        ipAddress: req.ip || null,
        module: "employees",
        details: `${actionLabel} طلب إعادة تعيين كلمة المرور للمستخدم: ${request.employeeName} (${request.username})`,
      });

      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "حدث خطأ" });
    }
  });

  app.get("/api/settings/public", async (req, res) => {
    try {
      const settings = await storage.getSystemSettings();
      const settingsObj: Record<string, string> = {};
      settings.forEach(s => { settingsObj[s.key] = s.value || ""; });
      const logoExists = fs.existsSync(path.join(uploadsDir, "logo.png"));
      res.json({
        orgName: settingsObj.orgName || "شركة نفط الوسط",
        systemName: settingsObj.systemName || "نظام إدارة المعاملات الإلكتروني",
        theme: settingsObj.theme || "crimson",
        customPrimary: settingsObj.customPrimary || "",
        customAccent: settingsObj.customAccent || "",
        fontFamily: settingsObj.fontFamily || "cairo",
        sidebarStyle: settingsObj.sidebarStyle || "primary",
        borderRadius: settingsObj.borderRadius || "md",
        copyrightOwner: settingsObj.copyrightOwner || "",
        logoUrl: logoExists ? "/api/uploads/logo.png" : null,
      });
    } catch (error) {
      res.status(500).json({ message: "حدث خطأ" });
    }
  });

  app.get("/api/uploads/logo.png", (_req, res) => {
    const logoPath = path.join(uploadsDir, "logo.png");
    if (fs.existsSync(logoPath)) {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.sendFile(logoPath);
    } else {
      res.status(404).json({ message: "لم يتم رفع شعار" });
    }
  });

  app.get("/api/uploads/signatures/:filename", (req, res) => {
    const filePath = path.join(signaturesDir, req.params.filename);
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      res.status(404).json({ message: "التوقيع غير موجود" });
    }
  });

  const isAdmin = async (req: any, res: any, next: any) => {
    const employeeId = (req.session as any)?.employeeId || (req as any).employeeId;
    if (!employeeId) return res.status(401).json({ message: "غير مصرح" });
    const emp = await storage.getEmployee(employeeId);
    if (!emp || emp.role !== "admin") return res.status(403).json({ message: "غير مصرح بهذا الإجراء" });
    next();
  };

  app.post(
    "/api/settings/logo",
    isAuthenticated,
    isAdmin,
    (req: any, res: any, next: any) => {
      logoUpload.single("logo")(req, res, (err: any) => {
        if (err) {
          const message =
            err?.code === "LIMIT_FILE_SIZE"
              ? "حجم الشعار كبير جداً. الحد الأقصى 2 ميجابايت."
              : (err?.message || "تعذر رفع ملف الشعار");
          return res.status(400).json({ message });
        }
        next();
      });
    },
    async (req: any, res) => {
      try {
        const employeeId = (req.session as any)?.employeeId || (req as any).employeeId;

        if (!req.file) {
          return res.status(400).json({ message: "يرجى اختيار ملف صورة صالح (PNG, JPG, SVG, WebP, GIF) بحجم أقصى 2MB" });
        }

        await storage.createAuditLog({
          entityType: "settings",
          entityId: 0,
          action: "update_logo",
          performedById: employeeId,
          employeeId: employeeId,
          module: "settings",
          details: "تحديث شعار النظام",
        });

        res.json({ message: "تم رفع الشعار بنجاح", logoUrl: "/api/uploads/logo.png" });
      } catch (error) {
        res.status(500).json({ message: "حدث خطأ في رفع الشعار" });
      }
    }
  );

  app.delete("/api/settings/logo", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const employeeId = (req.session as any)?.employeeId || (req as any).employeeId;
      const logoPath = path.join(uploadsDir, "logo.png");
      if (fs.existsSync(logoPath)) fs.unlinkSync(logoPath);

      await storage.createAuditLog({
        entityType: "settings",
        entityId: 0,
        action: "delete_logo",
        performedById: employeeId,
        employeeId: employeeId,
        module: "settings",
        details: "حذف شعار النظام",
      });

      res.json({ message: "تم حذف الشعار" });
    } catch (error) {
      res.status(500).json({ message: "حدث خطأ" });
    }
  });

  app.post("/api/uploads/inline-image", isAuthenticated, (req, res, next) => {
    inlineImageUpload.single("file")(req, res, (err: any) => {
      if (err) {
        const message = err?.code === "LIMIT_FILE_SIZE"
          ? "حجم الصورة كبير جداً. الحد الأقصى 10 ميجابايت."
          : (err?.message || "تعذّر رفع الصورة");
        return res.status(400).json({ message });
      }
      next();
    });
  }, async (req: any, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "الملف مطلوب" });
      const url = `/api/uploads/inline-images/${req.file.filename}`;
      res.status(201).json({ url });
    } catch (error) {
      console.error("Error uploading inline image:", error);
      res.status(500).json({ message: "حدث خطأ في رفع الصورة" });
    }
  });

  app.get("/api/uploads/inline-images/:filename", isAuthenticated, (req: any, res) => {
    const filename = path.basename(req.params.filename);
    const filePath = path.join(inlineImagesDir, filename);
    if (!filePath.startsWith(inlineImagesDir + path.sep)) {
      return res.status(400).json({ message: "مسار غير صالح" });
    }
    if (!fs.existsSync(filePath)) return res.status(404).json({ message: "الصورة غير موجودة" });
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.sendFile(filePath);
  });

  async function checkCorrespondenceReadAccess(employeeId: number, corrId: number): Promise<boolean> {
    const emp = await storage.getEmployee(employeeId);
    const corr = await storage.getCorrespondenceById(corrId);
    if (!emp || !corr) return false;
    if (emp.role === "admin") return true;
    const corrAssigns = await storage.getAssignmentsByCorrespondence(corrId);
    const hasAssign = corrAssigns.some((a: any) => a.departmentId === emp.departmentId);
    let inSenderChain = corr.createdById === employeeId;
    if (!inSenderChain && (corr as any).flowTemplateGroupId && emp.departmentId) {
      const fg = await storage.getFlowTemplateGroup((corr as any).flowTemplateGroupId);
      if (fg?.accounts?.includes(emp.departmentId)) inSenderChain = true;
    }
    const isCurrent = corr.currentDepartmentId === emp.departmentId;
    const ccs = await storage.getCCsByCorrespondence(corrId);
    const inCc = ccs.some((cc: any) => cc.departmentId === emp.departmentId);
    const isCentralMailLink = emp.role === "central_mail" && ((corr as any).centralMailAssignedById === employeeId || corr.createdById === employeeId);
    return hasAssign || inSenderChain || isCurrent || inCc || isCentralMailLink;
  }

  app.post("/api/correspondence/:id/attachments", isAuthenticated, attachmentUpload.single("file"), async (req: any, res) => {
    try {
      const corrId = parseInt(req.params.id);
      const employeeId = (req.session as any).employeeId;
      const description = req.body.description;
      if (!description) return res.status(400).json({ message: "وصف المرفق مطلوب" });
      if (!req.file) return res.status(400).json({ message: "الملف مطلوب" });

      const emp = await storage.getEmployee(employeeId);
      const corr = await storage.getCorrespondenceById(corrId);
      if (!emp || !corr) return res.status(404).json({ message: "المراسلة غير موجودة" });
      const allowed = await checkCorrespondenceReadAccess(employeeId, corrId);
      if (!allowed) {
        return res.status(403).json({ message: "لا تملك صلاحية رفع مرفقات لهذه المراسلة" });
      }

      let originalName = req.file.originalname;
      try {
        originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
      } catch (e) {}

      const ext = path.extname(originalName);
      const safeDesc = String(description).trim().replace(/[\/\\:*?"<>|\r\n\t]+/g, '_').slice(0, 200);
      const displayName = safeDesc
        ? (safeDesc.toLowerCase().endsWith(ext.toLowerCase()) ? safeDesc : `${safeDesc}${ext}`)
        : originalName;

      let contributionId: number | null = null;
      if (req.body.contributionId) {
        const cid = parseInt(req.body.contributionId);
        if (!Number.isNaN(cid)) {
          const contrib = await storage.getContribution(cid);
          if (!contrib || contrib.correspondenceId !== corrId) {
            return res.status(400).json({ message: "سجل المساهمة غير صالح" });
          }
          if (emp.role !== "admin" && contrib.contributingDepartmentId !== emp.departmentId) {
            return res.status(403).json({ message: "لا يحق لك رفع مرفقات لهذه المساهمة" });
          }
          contributionId = cid;
        }
      }

      const attachment = await storage.createAttachment({
        correspondenceId: corrId,
        contributionId,
        fileName: req.file.filename,
        originalName: displayName,
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
        description,
        uploadedById: employeeId,
      });

      res.status(201).json(attachment);
    } catch (error) {
      console.error("Error uploading attachment:", error);
      res.status(500).json({ message: "حدث خطأ في رفع المرفق" });
    }
  });

  app.get("/api/correspondence/:id/attachments", isAuthenticated, async (req: any, res) => {
    try {
      const corrId = parseInt(req.params.id);
      const employeeId = (req.session as any).employeeId;
      const allowed = await checkCorrespondenceReadAccess(employeeId, corrId);
      if (!allowed) return res.status(403).json({ message: "غير مصرح" });
      const attachments = await storage.getAttachmentsByCorrespondence(corrId);
      res.json(attachments);
    } catch (error) {
      res.status(500).json({ message: "حدث خطأ" });
    }
  });

  app.get("/api/attachments/:id/preview", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const attachment = await storage.getAttachment(id);
      if (!attachment) return res.status(404).json({ message: "المرفق غير موجود" });
      const employeeId = (req.session as any).employeeId;
      const allowed = await checkCorrespondenceReadAccess(employeeId, attachment.correspondenceId);
      if (!allowed) return res.status(403).json({ message: "غير مصرح" });

      const filePath = path.join(attachmentsDir, attachment.fileName);
      if (!fs.existsSync(filePath)) return res.status(404).json({ message: "الملف غير موجود" });

      const noInlineTypes = ["image/svg+xml"];
      if (noInlineTypes.includes(attachment.mimeType)) {
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(attachment.originalName)}"`);
      } else {
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(attachment.originalName)}"`);
      }
      res.setHeader('Content-Type', attachment.mimeType);
      res.setHeader('X-Content-Type-Options', 'nosniff');

      const mt = attachment.mimeType;
      if (mt === 'application/pdf') {
        res.setHeader('X-Frame-Options', 'SAMEORIGIN');
      } else if (mt.startsWith('image/') || mt.startsWith('video/') || mt.startsWith('audio/')) {
        res.setHeader('X-Frame-Options', 'SAMEORIGIN');
      } else {
        res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
        res.setHeader('X-Frame-Options', 'SAMEORIGIN');
      }

      res.sendFile(filePath);
    } catch (error) {
      res.status(500).json({ message: "حدث خطأ في معاينة المرفق" });
    }
  });

  app.get("/api/attachments/:id/download", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const attachment = await storage.getAttachment(id);
      if (!attachment) return res.status(404).json({ message: "المرفق غير موجود" });
      const employeeId = (req.session as any).employeeId;
      const allowed = await checkCorrespondenceReadAccess(employeeId, attachment.correspondenceId);
      if (!allowed) return res.status(403).json({ message: "غير مصرح" });

      const filePath = path.join(attachmentsDir, attachment.fileName);
      if (!fs.existsSync(filePath)) return res.status(404).json({ message: "الملف غير موجود" });

      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(attachment.originalName)}"`);
      res.setHeader('Content-Type', attachment.mimeType);
      res.sendFile(filePath);
    } catch (error) {
      res.status(500).json({ message: "حدث خطأ في تحميل المرفق" });
    }
  });

  app.delete("/api/attachments/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const attachment = await storage.getAttachment(id);
      if (!attachment) return res.status(404).json({ message: "المرفق غير موجود" });
      const employeeId = (req.session as any).employeeId;
      const emp = await storage.getEmployee(employeeId);
      if (emp?.role !== "admin") {
        const allowed = await checkCorrespondenceReadAccess(employeeId, attachment.correspondenceId);
        if (!allowed || (attachment.uploadedById !== employeeId)) {
          return res.status(403).json({ message: "غير مصرح" });
        }
      }

      const filePath = path.join(attachmentsDir, attachment.fileName);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

      await storage.deleteAttachment(id);
      res.json({ message: "تم حذف المرفق" });
    } catch (error) {
      res.status(500).json({ message: "حدث خطأ في حذف المرفق" });
    }
  });

  app.get("/api/departments/:id/central-parent", isAuthenticated, async (req: any, res) => {
    try {
      const deptId = parseInt(req.params.id);
      const allDepts = await storage.getDepartments();
      const deptMap = new Map(allDepts.map(d => [d.id, d]));
      
      let current = deptMap.get(deptId);
      if (!current) return res.status(404).json({ message: "القسم غير موجود" });

      if (current.isCentral) return res.json(current);

      while (current && current.parentId) {
        const parent = deptMap.get(current.parentId);
        if (!parent) break;
        if (parent.isCentral) return res.json(parent);
        current = parent;
      }

      return res.json(current);
    } catch (error) {
      res.status(500).json({ message: "حدث خطأ" });
    }
  });

  app.get("/api/settings", isAuthenticated, async (req, res) => {
    try {
      const settings = await storage.getSystemSettings();
      const settingsObj: Record<string, string> = {};
      settings.forEach(s => { settingsObj[s.key] = s.value || ""; });
      res.json(settingsObj);
    } catch (error) {
      res.status(500).json({ message: "حدث خطأ" });
    }
  });

  app.put("/api/settings", isAuthenticated, async (req: any, res) => {
    try {
      const employeeId = (req.session as any).employeeId;
      const emp = await storage.getEmployee(employeeId);
      if (!emp || emp.role !== "admin") return res.status(403).json({ message: "غير مصرح" });
      const entries = Object.entries(req.body);
      for (const [key, value] of entries) {
        await storage.upsertSystemSetting(key, value as string, employeeId);
      }
      res.json({ message: "تم حفظ الإعدادات" });
    } catch (error) {
      res.status(500).json({ message: "حدث خطأ" });
    }
  });

  app.get("/api/activity-log", isAuthenticated, async (req: any, res) => {
    try {
      const employeeId = (req.session as any).employeeId;
      const emp = await storage.getEmployee(employeeId);
      if (!emp || emp.role !== "admin") return res.status(403).json({ message: "غير مصرح" });

      const userId = req.query.userId ? parseInt(req.query.userId) : undefined;
      const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined;
      const dateTo = req.query.dateTo ? new Date(req.query.dateTo as string + "T23:59:59.999Z") : undefined;

      const logs = await storage.getActivityLog({ userId, dateFrom, dateTo });
      const employees = await storage.getEmployees();
      const empMap = new Map(employees.map(e => [e.id, e]));
      const enriched = logs.map(log => {
        const performer = log.performedById ? empMap.get(log.performedById) : null;
        return {
          ...log,
          performerName: performer?.fullName || null,
          performerUsername: performer?.username || null,
          performerRole: performer?.role || null,
        };
      });
      res.json(enriched);
    } catch (error) {
      res.status(500).json({ message: "حدث خطأ" });
    }
  });

  app.get("/api/active-users", isAuthenticated, async (req: any, res) => {
    try {
      const employeeId = (req as any).employeeId || (req.session as any)?.employeeId;
      const emp = await storage.getEmployee(employeeId);
      if (!emp || emp.role !== "admin") return res.status(403).json({ message: "غير مصرح" });

      const allEmployees = await storage.getEmployees();
      const allDepartments = await storage.getDepartments();
      const deptMap = new Map(allDepartments.map(d => [d.id, d.name]));

      const users = allEmployees.map(e => {
        const online = e.isActive && isUserOnline(e.id, e.lastLoginAt);
        const activity = getUserActivity(e.id);
        const lastLoginAt = e.lastLoginAt || (activity ? activity.lastSeenAt : null);
        const lastLoginIp = e.lastLoginIp || (activity ? activity.ip : null);

        return {
          id: e.id,
          fullName: e.fullName,
          username: e.username,
          role: e.role,
          departmentId: e.departmentId,
          departmentName: e.departmentId ? deptMap.get(e.departmentId) || null : null,
          lastLoginAt,
          lastLoginIp,
          lastLoginLocation: e.lastLoginLocation,
          isActive: e.isActive,
          isOnline: online,
        };
      });

      res.json(users);
    } catch (error) {
      console.error("Error fetching active users:", error);
      res.status(500).json({ message: "حدث خطأ" });
    }
  });

  app.post("/api/notifications/send", isAuthenticated, async (req: any, res) => {
    try {
      const currentUserId = (req.session as any).employeeId;
      const currentUser = await storage.getEmployee(currentUserId);
      if (!currentUser || currentUser.role !== "admin") {
        return res.status(403).json({ message: "غير مصرح" });
      }
      const hasPerm = await storage.hasPermission(currentUserId, "SYS_NOTIFICATIONS_SEND");
      if (!hasPerm) return res.status(403).json({ message: "ليس لديك صلاحية إرسال الإشعارات" });

      const { message, targetType, specificEmployeeIds } = req.body;
      if (!message || !targetType) {
        return res.status(400).json({ message: "نص الإشعار ونوع الهدف مطلوبان" });
      }

      const notif = await storage.createNotification({ message, targetType, sentById: currentUserId, category: "system" });

      const allEmployees = await storage.getEmployees();
      let recipientIds: number[] = [];

      switch (targetType) {
        case "all":
          recipientIds = allEmployees.filter(e => e.isActive).map(e => e.id);
          break;
        case "admin":
          recipientIds = allEmployees.filter(e => e.isActive && e.role === "admin").map(e => e.id);
          break;
        case "officer":
          recipientIds = allEmployees.filter(e => e.isActive && e.role === "officer").map(e => e.id);
          break;
        case "employee":
          recipientIds = allEmployees.filter(e => e.isActive && e.role === "employee").map(e => e.id);
          break;
        case "specific":
          if (specificEmployeeIds && Array.isArray(specificEmployeeIds)) {
            recipientIds = specificEmployeeIds.filter((id: number) => allEmployees.some(e => e.id === id && e.isActive));
          }
          break;
      }

      await storage.createNotificationRecipients(notif.id, recipientIds);

      await storage.createAuditLog({
        entityType: "notification",
        entityId: notif.id,
        action: "send_notification",
        performedById: currentUserId,
        employeeId: currentUserId,
        module: "settings",
        details: `إرسال إشعار إلى ${targetType === "all" ? "جميع المستخدمين" : targetType === "specific" ? `${recipientIds.length} مستخدم محدد` : `فئة ${targetType}`} (${recipientIds.length} مستلم)`,
      });

      res.json({ message: "تم إرسال الإشعار بنجاح", recipientCount: recipientIds.length });
    } catch (error) {
      console.error("Error sending notification:", error);
      res.status(500).json({ message: "حدث خطأ في إرسال الإشعار" });
    }
  });

  app.get("/api/notifications", isAuthenticated, async (req: any, res) => {
    try {
      const employeeId = (req.session as any).employeeId;
      const notifications = await storage.getNotificationsForEmployee(employeeId);
      res.json(notifications);
    } catch (error) {
      res.status(500).json({ message: "حدث خطأ" });
    }
  });

  app.get("/api/notifications/unread-count", isAuthenticated, async (req: any, res) => {
    try {
      const employeeId = (req.session as any).employeeId;
      const count = await storage.getUnreadNotificationCount(employeeId);
      res.json({ count });
    } catch (error) {
      res.status(500).json({ message: "حدث خطأ" });
    }
  });

  app.patch("/api/notifications/:id/read", isAuthenticated, async (req: any, res) => {
    try {
      const employeeId = (req.session as any).employeeId;
      const notificationId = parseInt(req.params.id);
      await storage.markNotificationRead(notificationId, employeeId);
      res.json({ message: "تم" });
    } catch (error) {
      res.status(500).json({ message: "حدث خطأ" });
    }
  });

  app.patch("/api/notifications/read-all", isAuthenticated, async (req: any, res) => {
    try {
      const employeeId = (req.session as any).employeeId;
      await storage.markAllNotificationsRead(employeeId);
      res.json({ message: "تم تعيين جميع الإشعارات كمقروءة" });
    } catch (error) {
      res.status(500).json({ message: "حدث خطأ" });
    }
  });

  app.post("/api/admin/factory-reset", isAuthenticated, async (req: any, res) => {
    try {
      const employeeId = (req.session as any).employeeId;
      const emp = await storage.getEmployee(employeeId);
      if (!emp || emp.role !== "admin") return res.status(403).json({ message: "غير مصرح" });

      const hasPerm = await storage.hasPermission(employeeId, "SYS_DATA_RESET");
      if (!hasPerm) return res.status(403).json({ message: "ليس لديك صلاحية إعادة ضبط المصنع" });

      const { categories, confirmText } = req.body;
      if (!categories || !Array.isArray(categories) || categories.length === 0) {
        return res.status(400).json({ message: "يجب تحديد فئة واحدة على الأقل" });
      }
      if (confirmText !== "تأكيد ضبط المصنع") {
        return res.status(400).json({ message: "يجب كتابة نص التأكيد بشكل صحيح" });
      }

      const validCategories = ["correspondence", "notifications", "users", "departments", "leave_requests", "settings"];
      for (const cat of categories) {
        if (!validCategories.includes(cat)) {
          return res.status(400).json({ message: `فئة غير صالحة: ${cat}` });
        }
      }

      const { db: database } = await import("./db");
      const { sql: sqlTag } = await import("drizzle-orm");

      const resetResults: string[] = [];

      if (categories.includes("correspondence")) {
        await database.execute(sqlTag`DELETE FROM external_correspondence_ccs`);
        await database.execute(sqlTag`DELETE FROM correspondence_attachments`);
        await database.execute(sqlTag`DELETE FROM workflow_events`);
        await database.execute(sqlTag`DELETE FROM correspondence_assignments`);
        await database.execute(sqlTag`DELETE FROM correspondence_ccs`);
        await database.execute(sqlTag`DELETE FROM correspondence`);
        await database.execute(sqlTag`DELETE FROM correspondence_counters`);
        await database.execute(sqlTag`DELETE FROM external_entities`);
        resetResults.push("المراسلات");
      }

      if (categories.includes("notifications")) {
        await database.execute(sqlTag`DELETE FROM notification_recipients`);
        await database.execute(sqlTag`DELETE FROM system_notifications`);
        resetResults.push("الإشعارات");
      }

      if (categories.includes("users")) {
        await database.execute(sqlTag`DELETE FROM user_permissions WHERE employee_id != ${emp.id}`);
        await database.execute(sqlTag`DELETE FROM notification_recipients WHERE employee_id != ${emp.id}`);
        await database.execute(sqlTag`DELETE FROM password_reset_requests`);
        await database.execute(sqlTag`DELETE FROM employees WHERE id != ${emp.id}`);
        const defaultHash = bcrypt.hashSync("admin123", 10);
        await database.execute(sqlTag`UPDATE employees SET password_hash = ${defaultHash}, must_change_password = false, department_id = NULL, last_login_ip = NULL, last_login_location = NULL WHERE id = ${emp.id}`);
        resetResults.push("المستخدمين");
      }

      if (categories.includes("departments")) {
        await database.execute(sqlTag`UPDATE employees SET department_id = NULL`);
        await database.execute(sqlTag`DELETE FROM departments`);
        resetResults.push("الهيكل التنظيمي");
      }

      if (categories.includes("leave_requests")) {
        await database.execute(sqlTag`DELETE FROM leave_requests`);
        resetResults.push("الإجازات");
      }

      if (categories.includes("settings")) {
        await database.execute(sqlTag`DELETE FROM audit_log`);
        await database.execute(sqlTag`DELETE FROM password_reset_requests`);
        await database.execute(sqlTag`DELETE FROM system_settings`);
        await database.execute(sqlTag`INSERT INTO system_settings (key, value) VALUES ('orgName', 'شركة نفط الوسط'), ('systemName', 'نظام إدارة المعاملات الإلكتروني'), ('theme', 'blue') ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`);
        resetResults.push("الإعدادات");
      }

      await storage.createAuditLog({
        entityType: "system",
        entityId: 0,
        action: "factory_reset",
        performedById: emp.id,
        employeeId: emp.id,
        module: "settings",
        details: `إعادة ضبط المصنع: ${resetResults.join("، ")}`,
      });

      res.json({ message: `تم إعادة ضبط المصنع: ${resetResults.join("، ")}` });
    } catch (error) {
      console.error("Factory reset error:", error);
      res.status(500).json({ message: "حدث خطأ في إعادة ضبط المصنع" });
    }
  });

  app.delete("/api/correspondence/:id", isAuthenticated, async (req: any, res) => {
    try {
      const corrId = parseInt(req.params.id);
      const corr = await storage.getCorrespondenceById(corrId);
      if (!corr) return res.status(404).json({ message: "المراسلة غير موجودة" });

      const employeeId = (req.session as any).employeeId;
      const employee = await storage.getEmployee(employeeId);
      if (!employee) return res.status(401).json({ message: "Unauthorized" });

      const isOutgoing = corr.type === "internal_outgoing" || corr.type === "external_outgoing";
      if (!isOutgoing) {
        return res.status(400).json({ message: "لا يمكن حذف هذا النوع من المراسلات" });
      }

      if (corr.status !== "archived") {
        return res.status(400).json({ message: "يمكن حذف المراسلات المؤرشفة (المسودة) فقط" });
      }

      if (corr.issuedAt || corr.referenceNumber) {
        return res.status(400).json({ message: "لا يمكن حذف مراسلة تم إصدارها" });
      }

      if (corr.closedById !== employee.id) {
        return res.status(403).json({ message: "فقط الحساب الذي قام بأرشفة المراسلة يمكنه حذفها" });
      }

      const inlineImageRegex = /\/api\/uploads\/inline-images\/([A-Za-z0-9._-]+)/g;
      const seenInlineFiles = new Set<string>();
      for (const text of [corr.content, (corr as any).marginNotes, (corr as any).notes]) {
        if (typeof text !== "string") continue;
        let m: RegExpExecArray | null;
        while ((m = inlineImageRegex.exec(text)) !== null) seenInlineFiles.add(m[1]);
      }
      for (const fname of seenInlineFiles) {
        const safe = path.basename(fname);
        const fp = path.join(inlineImagesDir, safe);
        if (fp.startsWith(inlineImagesDir + path.sep) && fs.existsSync(fp)) {
          try { fs.unlinkSync(fp); } catch (e) { console.warn("Failed to remove inline image", safe, e); }
        }
      }

      const { db: database } = await import("./db");
      const { sql: sqlTag } = await import("drizzle-orm");

      await database.execute(sqlTag`DELETE FROM correspondence_read_status WHERE correspondence_id = ${corrId}`);
      await database.execute(sqlTag`DELETE FROM external_correspondence_ccs WHERE correspondence_id = ${corrId}`);
      await database.execute(sqlTag`DELETE FROM correspondence_attachments WHERE correspondence_id = ${corrId}`);
      await database.execute(sqlTag`DELETE FROM workflow_events WHERE correspondence_id = ${corrId}`);
      await database.execute(sqlTag`DELETE FROM correspondence_assignments WHERE correspondence_id = ${corrId}`);
      await database.execute(sqlTag`DELETE FROM correspondence_ccs WHERE correspondence_id = ${corrId}`);
      await database.execute(sqlTag`DELETE FROM correspondence WHERE id = ${corrId}`);

      await storage.createAuditLog({
        entityType: "correspondence",
        entityId: corrId,
        action: "permanently_deleted",
        performedById: employee.id,
        employeeId: employee.id,
        module: "correspondence",
        details: `حذف نهائي للمسودة المؤرشفة: ${corr.subject}`,
      });

      res.json({ message: "تم حذف المراسلة نهائياً" });
    } catch (error) {
      console.error("Error deleting correspondence:", error);
      res.status(500).json({ message: "حدث خطأ في حذف المراسلة" });
    }
  });

  app.post("/api/correspondence/:id/close", isAuthenticated, async (req: any, res) => {
    try {
      const corrId = parseInt(req.params.id);
      const corr = await storage.getCorrespondenceById(corrId);
      if (!corr) return res.status(404).json({ message: "المراسلة غير موجودة" });

      const employeeId = (req.session as any).employeeId;
      const employee = await storage.getEmployee(employeeId);
      if (!employee) return res.status(401).json({ message: "Unauthorized" });

      const isOutgoing = corr.type === "internal_outgoing" || corr.type === "external_outgoing";
      const isReceiverDept = corr.receiverDepartmentId === employee.departmentId;
      const isCurrentDept = corr.currentDepartmentId === employee.departmentId;
      const assignments = await storage.getAssignmentsByCorrespondence(corrId);
      const isAssigned = assignments.some((a: any) => a.departmentId === employee.departmentId);
      if (employee.role !== "admin") {
        if (isOutgoing && !isReceiverDept && !isAssigned) {
          if (!isCurrentDept) {
            return res.status(403).json({ message: "فقط الجهة التي لديها المراسلة حالياً أو مدير النظام يمكنه إغلاقها" });
          }
        }
        if (!isOutgoing) {
          const canClose = corr.createdById === employee.id || isReceiverDept || isAssigned || isCurrentDept;
          if (!canClose) {
            return res.status(403).json({ message: "ليس لديك صلاحية لحفظ هذه المراسلة" });
          }
        }
      }

      if (corr.closedAt) {
        return res.status(400).json({ message: "المراسلة مغلقة بالفعل" });
      }

      const updated = await storage.updateCorrespondence(corrId, {
        closedAt: new Date(),
        closedById: employee.id,
        status: "archived",
      });

      await storage.createWorkflowEvent({
        correspondenceId: corrId,
        action: "close",
        fromStatus: corr.status,
        toStatus: "archived",
        performedById: employee.id,
        notes: req.body.notes || "تم إغلاق المراسلة",
      });

      await storage.createAuditLog({
        entityType: "correspondence",
        entityId: corrId,
        action: "closed",
        performedById: employee.id,
        employeeId: employee.id,
        module: "correspondence",
        details: `إغلاق المراسلة: ${corr.subject}`,
      });

      if (corr.receiverDepartmentId) {
        await notifyDepartmentEmployees(corr.receiverDepartmentId, `تم إغلاق المراسلة "${corr.subject}"`, employeeId);
      }

      res.json(updated);
    } catch (error) {
      console.error("Error closing correspondence:", error);
      res.status(500).json({ message: "حدث خطأ في إغلاق المراسلة" });
    }
  });

  app.post("/api/correspondence/:id/reopen", isAuthenticated, async (req: any, res) => {
    try {
      const corrId = parseInt(req.params.id);
      const corr = await storage.getCorrespondenceById(corrId);
      if (!corr) return res.status(404).json({ message: "المراسلة غير موجودة" });

      const employeeId = (req.session as any).employeeId;
      const employee = await storage.getEmployee(employeeId);
      if (!employee) return res.status(401).json({ message: "Unauthorized" });

      if (corr.status !== "archived") {
        return res.status(400).json({ message: "المراسلة ليست مؤرشفة" });
      }

      const isOutgoing = corr.type === "internal_outgoing" || corr.type === "external_outgoing";
      if (!isOutgoing) {
        return res.status(400).json({ message: "هذا الإجراء متاح فقط للمراسلات الصادرة المستلمة" });
      }

      if (employee.role !== "admin" && corr.closedById !== employee.id) {
        return res.status(403).json({ message: "فقط الشخص الذي أرشف المراسلة يمكنه إعادة فتحها" });
      }

      const updated = await storage.updateCorrespondence(corrId, {
        status: "in_progress",
        closedAt: null,
        closedById: null,
      });

      await storage.createWorkflowEvent({
        correspondenceId: corrId,
        action: "reopen",
        fromStatus: "archived",
        toStatus: "in_progress",
        performedById: employee.id,
        fromDepartmentId: employee.departmentId,
        toDepartmentId: null,
        marginNote: null,
        signature: false,
        notes: req.body.notes || "تم إعادة فتح المراسلة لتغيير الإجراء",
      });

      await storage.createAuditLog({
        entityType: "correspondence",
        entityId: corrId,
        action: "reopened",
        performedById: employee.id,
        employeeId: employee.id,
        module: "correspondence",
        details: `إعادة فتح المراسلة: ${corr.subject}`,
      });

      res.json(updated);
    } catch (error) {
      console.error("Error reopening correspondence:", error);
      res.status(500).json({ message: "حدث خطأ في إعادة فتح المراسلة" });
    }
  });

  app.post("/api/correspondence/:id/return-to-central-mail", isAuthenticated, async (req: any, res) => {
    try {
      const corrId = parseInt(req.params.id);
      const corr = await storage.getCorrespondenceById(corrId);
      if (!corr) return res.status(404).json({ message: "المراسلة غير موجودة" });

      const employeeId = (req.session as any).employeeId;
      const employee = await storage.getEmployee(employeeId);
      if (!employee) return res.status(401).json({ message: "Unauthorized" });

      if (corr.type !== "external_incoming") {
        return res.status(400).json({ message: "هذا الإجراء متاح فقط للوارد الخارجي" });
      }

      if (corr.assignedToId !== employee.id) {
        return res.status(403).json({ message: "فقط الحساب المخوّل المستلم يمكنه إعادة المراسلة للبريد المركزي" });
      }

      if (!req.body.comment || !req.body.comment.trim()) {
        return res.status(400).json({ message: "يجب كتابة سبب الإعادة" });
      }

      const centralMailEmployee = corr.centralMailAssignedById ? await storage.getEmployee(corr.centralMailAssignedById) : null;

      const updated = await storage.updateCorrespondence(corrId, {
        assignedToId: null,
        currentDepartmentId: corr.senderDepartmentId,
        receiverDepartmentId: corr.senderDepartmentId,
      });

      await storage.createWorkflowEvent({
        correspondenceId: corrId,
        action: "return_to_central_mail",
        fromStatus: "in_progress",
        toStatus: "in_progress",
        performedById: employee.id,
        fromDepartmentId: employee.departmentId,
        toDepartmentId: null,
        notes: req.body.comment.trim(),
        signature: false,
      });

      if (corr.centralMailAssignedById) {
        await notifyEmployee(corr.centralMailAssignedById, `تم إعادة وارد خارجي إليك: ${corr.subject} - السبب: ${req.body.comment.trim()}`, { category: "correspondence", relatedEntityId: corr.id, relatedEntityType: "external_incoming" });
      }

      await storage.createAuditLog({
        entityType: "correspondence",
        entityId: corrId,
        action: "return_to_central_mail",
        performedById: employee.id,
        employeeId: employee.id,
        module: "correspondence",
        details: `إعادة وارد خارجي للبريد المركزي: ${corr.subject} - ${req.body.comment.trim()}`,
      });

      res.json(updated);
    } catch (error) {
      console.error("Error returning to central mail:", error);
      res.status(500).json({ message: "حدث خطأ في إعادة المراسلة للبريد المركزي" });
    }
  });

  app.post("/api/correspondence/:id/reassign-external-incoming", isAuthenticated, async (req: any, res) => {
    try {
      const corrId = parseInt(req.params.id);
      const corr = await storage.getCorrespondenceById(corrId);
      if (!corr) return res.status(404).json({ message: "المراسلة غير موجودة" });

      const employeeId = (req.session as any).employeeId;
      const employee = await storage.getEmployee(employeeId);
      if (!employee) return res.status(401).json({ message: "Unauthorized" });

      if (corr.type !== "external_incoming") {
        return res.status(400).json({ message: "هذا الإجراء متاح فقط للوارد الخارجي" });
      }

      if (employee.role !== "central_mail" && employee.role !== "admin") {
        return res.status(403).json({ message: "فقط حساب البريد المركزي يمكنه إعادة الإسناد" });
      }

      if (corr.centralMailAssignedById !== employee.id && employee.role !== "admin") {
        return res.status(403).json({ message: "لا يمكنك إعادة إسناد مراسلة لم تقم بإدخالها" });
      }

      if (corr.assignedToId) {
        return res.status(400).json({ message: "المراسلة مسندة حالياً - يجب إعادتها أولاً من المخوّل" });
      }

      const { assignToEmployeeId } = req.body;
      if (!assignToEmployeeId) {
        return res.status(400).json({ message: "يجب تحديد الحساب المخوّل الجديد" });
      }

      const newAssignee = await storage.getEmployee(assignToEmployeeId);
      if (!newAssignee || !newAssignee.canReceiveExternalIncoming) {
        return res.status(400).json({ message: "الحساب المحدد غير مخوّل لاستلام الوارد الخارجي" });
      }

      const updated = await storage.updateCorrespondence(corrId, {
        assignedToId: assignToEmployeeId,
        receiverDepartmentId: newAssignee.departmentId,
        currentDepartmentId: newAssignee.departmentId,
      });

      await storage.createWorkflowEvent({
        correspondenceId: corrId,
        action: "receive_incoming",
        fromStatus: "in_progress",
        toStatus: "in_progress",
        performedById: employee.id,
        fromDepartmentId: employee.departmentId,
        toDepartmentId: newAssignee.departmentId,
        notes: `إعادة إسناد وارد خارجي إلى ${newAssignee.fullName}`,
        signature: true,
      });

      await notifyEmployee(assignToEmployeeId, `تم إسناد وارد خارجي جديد إليك: ${corr.subject}`, { category: "correspondence", relatedEntityId: corr.id, relatedEntityType: "external_incoming" });

      await storage.createAuditLog({
        entityType: "correspondence",
        entityId: corrId,
        action: "reassign_external_incoming",
        performedById: employee.id,
        employeeId: employee.id,
        module: "correspondence",
        details: `إعادة إسناد وارد خارجي إلى ${newAssignee.fullName}: ${corr.subject}`,
      });

      res.json(updated);
    } catch (error) {
      console.error("Error reassigning external incoming:", error);
      res.status(500).json({ message: "حدث خطأ في إعادة الإسناد" });
    }
  });

  app.get("/api/flow-templates", isAuthenticated, async (req: any, res) => {
    try {
      const templates = await storage.getFlowTemplates();
      const enriched = [];
      for (const t of templates) {
        const groups = await storage.getFlowTemplateGroups(t.id);
        const enrichedGroups = [];
        for (const g of groups) {
          const accountDetails = [];
          for (const deptId of (g.accounts || [])) {
            const dept = await storage.getDepartment(deptId);
            if (dept) {
              accountDetails.push({ id: dept.id, name: dept.name, level: dept.level, parentId: dept.parentId });
            }
          }
          enrichedGroups.push({ ...g, accountDetails });
        }
        enriched.push({ ...t, groups: enrichedGroups });
      }
      res.json(enriched);
    } catch (error) {
      res.status(500).json({ message: "حدث خطأ في جلب مسارات التدفق" });
    }
  });

  app.post("/api/flow-templates", isAuthenticated, async (req: any, res) => {
    try {
      const employeeId = (req.session as any).employeeId;
      const emp = await storage.getEmployee(employeeId);
      if (!emp || emp.role !== "admin") return res.status(403).json({ message: "غير مصرح" });

      const { name, correspondenceType, levels } = req.body;
      if (!name || !correspondenceType || !levels || !Array.isArray(levels) || levels.length < 1) {
        return res.status(400).json({ message: "يجب تحديد اسم المسار ونوع المراسلة والمستويات" });
      }

      const template = await storage.createFlowTemplate({ name, correspondenceType, levels, createdById: emp.id });

      await storage.createAuditLog({
        entityType: "flow_template", entityId: template.id, action: "create",
        performedById: emp.id, employeeId: emp.id, module: "flow_templates",
        details: `إنشاء مسار تدفق: ${name} (${correspondenceType})`,
      });

      res.json(template);
    } catch (error) {
      res.status(500).json({ message: "حدث خطأ في إنشاء مسار التدفق" });
    }
  });

  app.patch("/api/flow-templates/:id", isAuthenticated, async (req: any, res) => {
    try {
      const employeeId = (req.session as any).employeeId;
      const emp = await storage.getEmployee(employeeId);
      if (!emp || emp.role !== "admin") return res.status(403).json({ message: "غير مصرح" });

      const id = parseInt(req.params.id);
      const { name, isActive, correspondenceType, levels } = req.body;
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (isActive !== undefined) updateData.isActive = isActive;
      if (correspondenceType !== undefined) updateData.correspondenceType = correspondenceType;
      if (levels !== undefined) updateData.levels = levels;

      const updated = await storage.updateFlowTemplate(id, updateData);
      if (!updated) return res.status(404).json({ message: "مسار التدفق غير موجود" });

      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "حدث خطأ في تعديل مسار التدفق" });
    }
  });

  app.delete("/api/flow-templates/:id", isAuthenticated, async (req: any, res) => {
    try {
      const employeeId = (req.session as any).employeeId;
      const emp = await storage.getEmployee(employeeId);
      if (!emp || emp.role !== "admin") return res.status(403).json({ message: "غير مصرح" });

      const id = parseInt(req.params.id);
      const template = await storage.getFlowTemplate(id);
      if (!template) return res.status(404).json({ message: "مسار التدفق غير موجود" });

      await storage.deleteFlowTemplate(id);

      await storage.createAuditLog({
        entityType: "flow_template", entityId: id, action: "delete",
        performedById: emp.id, employeeId: emp.id, module: "flow_templates",
        details: `حذف مسار تدفق: ${template.name}`,
      });

      res.json({ message: "تم حذف مسار التدفق" });
    } catch (error) {
      res.status(500).json({ message: "حدث خطأ في حذف مسار التدفق" });
    }
  });

  app.post("/api/flow-templates/:id/groups", isAuthenticated, async (req: any, res) => {
    try {
      const employeeId = (req.session as any).employeeId;
      const emp = await storage.getEmployee(employeeId);
      if (!emp || emp.role !== "admin") return res.status(403).json({ message: "غير مصرح" });

      const flowTemplateId = parseInt(req.params.id);
      const template = await storage.getFlowTemplate(flowTemplateId);
      if (!template) return res.status(404).json({ message: "مسار التدفق غير موجود" });

      const { accounts } = req.body;
      if (!accounts || !Array.isArray(accounts) || accounts.length !== template.levels.length) {
        return res.status(400).json({ message: `يجب تحديد ${template.levels.length} حساب (حساب لكل مستوى في المسار)` });
      }

      const existingGroups = await storage.getFlowTemplateGroups(flowTemplateId);
      const isDuplicate = existingGroups.some(g =>
        g.accounts.length === accounts.length &&
        g.accounts.every((a: number, i: number) => a === accounts[i])
      );
      if (isDuplicate) {
        return res.status(400).json({ message: "هذه المجموعة موجودة مسبقاً بنفس التشكيلات والترتيب في هذا المسار" });
      }

      const allEmployees = await storage.getEmployees();
      for (const accId of accounts) {
        const dept = await storage.getDepartment(accId);
        if (!dept) return res.status(400).json({ message: `التشكيل رقم ${accId} غير موجود` });
        const hasEmployee = allEmployees.some(e => e.departmentId === accId && e.isActive);
        if (!hasEmployee) {
          return res.status(400).json({ message: `التشكيل "${dept.name}" لا يملك حساب موظف مرتبط به. يجب إنشاء حساب لهذا التشكيل قبل إدراجه في مسار التدفق.` });
        }
      }

      const group = await storage.createFlowTemplateGroup({ flowTemplateId, accounts });

      await storage.createAuditLog({
        entityType: "flow_template_group", entityId: group.id, action: "create",
        performedById: emp.id, employeeId: emp.id, module: "flow_templates",
        details: `إضافة مجموعة حسابات لمسار: ${template.name}`,
      });

      res.json(group);
    } catch (error) {
      res.status(500).json({ message: "حدث خطأ في إضافة مجموعة الحسابات" });
    }
  });

  app.patch("/api/flow-template-groups/:id", isAuthenticated, async (req: any, res) => {
    try {
      const employeeId = (req.session as any).employeeId;
      const emp = await storage.getEmployee(employeeId);
      if (!emp || emp.role !== "admin") return res.status(403).json({ message: "غير مصرح" });

      const id = parseInt(req.params.id);
      const { accounts } = req.body;
      if (!accounts || !Array.isArray(accounts) || accounts.length === 0) {
        return res.status(400).json({ message: "يجب تحديد الحسابات" });
      }

      const currentGroup = await storage.getFlowTemplateGroup(id);
      if (!currentGroup) return res.status(404).json({ message: "المجموعة غير موجودة" });

      const existingGroups = await storage.getFlowTemplateGroups(currentGroup.flowTemplateId);
      const isDuplicate = existingGroups.some(g =>
        g.id !== id &&
        g.accounts.length === accounts.length &&
        g.accounts.every((a: number, i: number) => a === accounts[i])
      );
      if (isDuplicate) {
        return res.status(400).json({ message: "هذه المجموعة موجودة مسبقاً بنفس التشكيلات والترتيب في هذا المسار" });
      }

      const allEmployees = await storage.getEmployees();
      for (const accId of accounts) {
        const dept = await storage.getDepartment(accId);
        if (!dept) return res.status(400).json({ message: `التشكيل رقم ${accId} غير موجود` });
        const hasEmployee = allEmployees.some(e => e.departmentId === accId && e.isActive);
        if (!hasEmployee) {
          return res.status(400).json({ message: `التشكيل "${dept.name}" لا يملك حساب موظف مرتبط به. يجب إنشاء حساب لهذا التشكيل قبل إدراجه في مسار التدفق.` });
        }
      }

      const updated = await storage.updateFlowTemplateGroup(id, { accounts });
      if (!updated) return res.status(404).json({ message: "المجموعة غير موجودة" });

      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "حدث خطأ في تعديل مجموعة الحسابات" });
    }
  });

  app.delete("/api/flow-template-groups/:id", isAuthenticated, async (req: any, res) => {
    try {
      const employeeId = (req.session as any).employeeId;
      const emp = await storage.getEmployee(employeeId);
      if (!emp || emp.role !== "admin") return res.status(403).json({ message: "غير مصرح" });

      const id = parseInt(req.params.id);
      const deleted = await storage.deleteFlowTemplateGroup(id);
      if (!deleted) return res.status(404).json({ message: "المجموعة غير موجودة" });

      res.json({ message: "تم حذف مجموعة الحسابات" });
    } catch (error) {
      res.status(500).json({ message: "حدث خطأ في حذف مجموعة الحسابات" });
    }
  });

  app.get("/api/employees/:id/flow-templates", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const templates = await storage.getFlowTemplatesForEmployee(id);
      res.json(templates);
    } catch (error) {
      res.status(500).json({ message: "حدث خطأ" });
    }
  });

  return httpServer;
}
