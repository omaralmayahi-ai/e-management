import { getSqliteDb } from "./sqliteStore";
import type { IStorage } from "./storage";
import {
  type Department, type InsertDepartment,
  type Employee, type InsertEmployee,
  type Correspondence, type InsertCorrespondence,
  type CorrespondenceAssignment, type InsertCorrespondenceAssignment,
  type CorrespondenceCC, type InsertCorrespondenceCC,
  type CorrespondenceAttachment, type InsertCorrespondenceAttachment,
  type AuditLog, type InsertAuditLog,
  type LeaveRequest, type InsertLeaveRequest,
  type Permission, type InsertPermission,
  type UserPermission, type InsertUserPermission,
  type WorkflowEvent, type InsertWorkflowEvent,
  type PasswordResetRequest, type InsertPasswordResetRequest,
  type SystemSetting,
  type SystemNotification, type InsertSystemNotification,
  type ExternalEntity, type InsertExternalEntity,
  type ExternalCorrespondenceCC, type InsertExternalCorrespondenceCC,
  type FlowTemplate, type InsertFlowTemplate,
  type FlowTemplateGroup, type InsertFlowTemplateGroup,
  type DeletionRequest, type InsertDeletionRequest,
  type CorrespondenceReadStatus,
  type CorrespondenceContribution, type InsertCorrespondenceContribution,
  type CorrespondenceFollowup, type InsertCorrespondenceFollowup,
} from "@shared/schema";
import bcrypt from "bcryptjs";

function boolToNum(val: any): number {
  if (val === true || val === 1 || val === "1") return 1;
  return 0;
}

function numToBool(val: any): boolean {
  return val === 1 || val === true || val === "1";
}

function mapDepartment(row: any): Department {
  if (!row) return row;
  return {
    id: row.id,
    name: row.name,
    nameEn: row.name_en,
    level: row.level,
    isCentral: numToBool(row.is_central),
    parentId: row.parent_id,
    managerId: row.manager_id,
    code: row.code,
    description: row.description,
    canSendInternalOutgoing: numToBool(row.can_send_internal_outgoing),
    canSendExternalOutgoing: numToBool(row.can_send_external_outgoing),
    canReceiveInternalIncoming: numToBool(row.can_receive_internal_incoming),
    canReceiveExternalIncoming: numToBool(row.can_receive_external_incoming),
    allowedExternalEntities: row.allowed_external_entities ? JSON.parse(row.allowed_external_entities) : null,
    isActive: numToBool(row.is_active),
    createdAt: row.created_at ? new Date(row.created_at) : new Date(),
  };
}

function mapEmployee(row: any): Employee {
  if (!row) return row;
  return {
    id: row.id,
    userId: row.user_id || "",
    username: row.username,
    passwordHash: row.password_hash,
    fullName: row.full_name,
    departmentId: row.department_id,
    jobTitle: row.job_title,
    employeeNumber: row.employee_number || null,
    phone: row.phone || null,
    mobilePhone: row.mobile_phone,
    landlinePhone: row.landline_phone,
    companyNumber: row.company_number,
    email: row.email,
    role: row.role,
    isActive: numToBool(row.is_active),
    leaveBalance: row.leave_balance ?? 30,
    mustChangePassword: numToBool(row.must_change_password),
    canAccessCorrespondence: numToBool(row.can_access_correspondence),
    canAccessLeaveRequests: numToBool(row.can_access_leave_requests),
    canReceiveExternalIncoming: numToBool(row.can_receive_external_incoming),
    signatureUrl: row.signature_url,
    lastLoginAt: row.last_login_at ? new Date(row.last_login_at) : null,
    lastLoginIp: row.last_login_ip,
    lastLoginLocation: row.last_login_location,
    createdAt: row.created_at ? new Date(row.created_at) : new Date(),
  };
}

function mapCorrespondence(row: any): Correspondence {
  if (!row) return row;
  let contributingDeptIds = row.contributing_department_ids;
  if (typeof contributingDeptIds === "string") {
    try {
      contributingDeptIds = JSON.parse(contributingDeptIds);
    } catch {
      contributingDeptIds = [];
    }
  }
  return {
    id: row.id,
    type: row.type,
    referenceNumber: row.reference_number,
    externalRefNumber: row.external_ref_number,
    externalEntity: row.external_entity,
    externalDate: row.external_date ? new Date(row.external_date) : null,
    subject: row.subject,
    content: row.content,
    status: row.status,
    priority: row.priority,
    confidentiality: row.confidentiality,
    senderDepartmentId: row.sender_department_id,
    receiverDepartmentId: row.receiver_department_id,
    currentDepartmentId: row.current_department_id,
    createdById: row.created_by_id,
    assignedToId: row.assigned_to_id,
    sendToAll: numToBool(row.send_to_all),
    centralMailAssignedById: row.central_mail_assigned_by_id,
    flowTemplateId: row.flow_template_id,
    flowTemplateGroupId: row.flow_template_group_id,
    parentCorrespondenceId: row.parent_correspondence_id,
    contributingDepartmentIds: Array.isArray(contributingDeptIds) ? contributingDeptIds : null,
    contributionRoutingBatchId: row.contribution_routing_batch_id,
    marginNotes: row.margin_notes,
    notes: row.notes,
    issuedAt: row.issued_at ? new Date(row.issued_at) : null,
    issuedById: row.issued_by_id,
    requiresReply: numToBool(row.requires_reply),
    reminderDate: row.reminder_date ? new Date(row.reminder_date) : null,
    followUpDays: row.follow_up_days,
    closedAt: row.closed_at ? new Date(row.closed_at) : null,
    closedById: row.closed_by_id,
    isDeleted: numToBool(row.is_deleted),
    deletedAt: row.deleted_at ? new Date(row.deleted_at) : null,
    deletedById: row.deleted_by_id,
    deleteReason: row.delete_reason || row.deletion_reason,
    createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
  };
}

function mapPermission(row: any): Permission {
  if (!row) return row;
  return {
    id: row.id,
    key: row.key,
    nameAr: row.name_ar,
    nameEn: row.name_en,
    description: row.description,
    category: row.category,
    sortOrder: row.sort_order,
    isActive: numToBool(row.is_active),
  };
}

function mapUserPermission(row: any): UserPermission {
  if (!row) return row;
  return {
    id: row.id,
    employeeId: row.employee_id,
    permissionId: row.permission_id,
    grantedById: row.granted_by_id,
    grantedAt: row.granted_at ? new Date(row.granted_at) : new Date(),
  };
}

function mapSystemSetting(row: any): SystemSetting {
  if (!row) return row;
  return {
    id: row.id,
    key: row.key,
    value: row.value,
    updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
    updatedById: row.updated_by_id,
  };
}

export class SqliteStorage implements IStorage {
  private db = getSqliteDb();

  constructor() {
    this.seedDefaultDataIfNeeded();
  }

  private seedDefaultDataIfNeeded() {
    try {
      const adminPasswordHash = bcrypt.hashSync("admin123", 10);
      const existingAdmin = this.db.prepare("SELECT * FROM employees WHERE username = ? OR role = 'admin'").get("admin") as any;

      if (!existingAdmin) {
        // Insert Admin department
        const gmDept = this.db.prepare(`
          INSERT INTO departments (name, name_en, level, is_central, code, can_send_internal_outgoing, can_send_external_outgoing, can_receive_internal_incoming, can_receive_external_incoming)
          VALUES ('مكتب المدير العام', 'General Manager Office', 'general_manager', 1, 'GM', 1, 1, 1, 1)
          RETURNING *
        `).get() as any;

        const hrDept = this.db.prepare(`
          INSERT INTO departments (name, name_en, level, parent_id, code, can_send_internal_outgoing, can_receive_internal_incoming)
          VALUES ('هيئة الشؤون الإدارية والموارد البشرية', 'Admin & HR Directorate', 'directorate', ?, 'HR', 1, 1)
          RETURNING *
        `).get(gmDept?.id || 1) as any;

        const itDept = this.db.prepare(`
          INSERT INTO departments (name, name_en, level, parent_id, code, is_central, can_send_internal_outgoing, can_receive_internal_incoming)
          VALUES ('قسم تكنولوجيا المعلومات', 'IT Section', 'section', ?, 'IT', 1, 1, 1)
          RETURNING *
        `).get(hrDept?.id || 2) as any;

        // Insert Admin Employee
        this.db.prepare(`
          INSERT INTO employees (username, password_hash, full_name, role, department_id, job_title, company_number, landline_phone, is_active, must_change_password, can_access_correspondence)
          VALUES (?, ?, 'مدير النظام', 'admin', ?, 'مدير النظام', '0001', '0000000', 1, 0, 1)
        `).run("admin", adminPasswordHash, gmDept?.id || 1);

        console.log("[SqliteStorage] Seeded default admin account: admin / admin123");
      } else {
        // Make sure password is admin123 and active
        this.db.prepare(`
          UPDATE employees SET username = 'admin', password_hash = ?, role = 'admin', is_active = 1, must_change_password = 0 WHERE id = ?
        `).run(adminPasswordHash, existingAdmin.id);
        console.log("[SqliteStorage] Verified default admin credentials: admin / admin123");
      }

      // Seed settings
      const settings = [
        { key: "orgName", value: "شركة نفط الوسط" },
        { key: "systemName", value: "نظام إدارة المعاملات الإلكتروني" },
        { key: "theme", value: "blue" },
        { key: "copyrightOwner", value: "شركة نفط الوسط" },
      ];
      for (const s of settings) {
        this.db.prepare(`
          INSERT OR IGNORE INTO system_settings (key, value) VALUES (?, ?)
        `).run(s.key, s.value);
      }

      // Seed standard permissions
      const defaultPerms = [
        { key: "CORR_CREATE", nameAr: "إنشاء مراسلة", description: "إنشاء مراسلة جديدة", category: "correspondence", sortOrder: 1 },
        { key: "CORR_ELEVATE", nameAr: "رفع المراسلة", description: "رفع المراسلة إلى المسؤول المباشر في مسار التدفق", category: "correspondence", sortOrder: 2 },
        { key: "CORR_ASSIGN_DOWN", nameAr: "إسناد المراسلة", description: "إسناد المراسلة إلى المستوى الأدنى في مسار التدفق", category: "correspondence", sortOrder: 3 },
        { key: "CORR_EDIT", nameAr: "تعديل المراسلة", description: "تعديل محتوى المراسلة", category: "correspondence", sortOrder: 4 },
        { key: "CORR_MARGIN", nameAr: "وضع هامش", description: "وضع هامش أو ملاحظة على المراسلة", category: "correspondence", sortOrder: 5 },
        { key: "CORR_DELETE_DRAFT", nameAr: "حذف المسودة", description: "حذف مسودة المراسلة", category: "correspondence", sortOrder: 6 },
        { key: "CORR_FINAL_SIGN", nameAr: "توقيع نهائي وإطلاق", description: "التوقيع النهائي على المراسلة وإطلاقها للجهة المستلمة", category: "correspondence", sortOrder: 7 },
        { key: "SYS_VIEW_DASHBOARD", nameAr: "عرض لوحة التحكم", description: "الوصول إلى لوحة التحكم الرئيسية", category: "system_admin", sortOrder: 1 },
        { key: "SYS_VIEW_CORRESPONDENCE", nameAr: "عرض نافذة المراسلات", description: "الوصول إلى نافذة المراسلات", category: "system_admin", sortOrder: 2 },
        { key: "SYS_VIEW_PERSONAL_REQUESTS", nameAr: "عرض نافذة الطلبات الخاصة", description: "الوصول إلى نافذة الطلبات الخاصة", category: "system_admin", sortOrder: 3 },
        { key: "SYS_VIEW_WORK_REQUESTS", nameAr: "عرض نافذة طلبات العمل", description: "الوصول إلى نافذة طلبات العمل", category: "system_admin", sortOrder: 4 },
        { key: "SYS_VIEW_ORG", nameAr: "عرض نافذة الهيكل التنظيمي", description: "الوصول إلى نافذة الهيكل التنظيمي", category: "system_admin", sortOrder: 5 },
        { key: "SYS_VIEW_USERS", nameAr: "عرض نافذة المستخدمين", description: "الوصول إلى نافذة إدارة المستخدمين", category: "system_admin", sortOrder: 6 },
        { key: "SYS_VIEW_PERMISSIONS", nameAr: "عرض نافذة الصلاحيات", description: "الوصول إلى نافذة إدارة الصلاحيات", category: "system_admin", sortOrder: 7 },
        { key: "SYS_VIEW_SETTINGS", nameAr: "عرض نافذة الإعدادات", description: "الوصول إلى نافذة إعدادات النظام", category: "system_admin", sortOrder: 8 },
        { key: "SYS_ORG_MANAGE", nameAr: "العمل على الهيكل التنظيمي", description: "إنشاء وتعديل الأقسام", category: "system_admin", sortOrder: 9 },
        { key: "SYS_USERS_MANAGE", nameAr: "العمل على إدارة المستخدمين", description: "إنشاء وتعديل حسابات المستخدمين", category: "system_admin", sortOrder: 10 },
        { key: "SYS_PERMS_MANAGE", nameAr: "العمل على الصلاحيات", description: "منح وسحب الصلاحيات للمستخدمين", category: "system_admin", sortOrder: 11 },
        { key: "SYS_SETTINGS_GENERAL", nameAr: "إعدادات عامة", description: "تعديل الإعدادات العامة للنظام", category: "system_admin", sortOrder: 12 },
        { key: "SYS_SETTINGS_THEME", nameAr: "إعدادات الثيم", description: "تعديل ثيم النظام", category: "system_admin", sortOrder: 13 },
        { key: "SYS_SETTINGS_PASSWORDS", nameAr: "إعدادات كلمات المرور", description: "إدارة طلبات إعادة تعيين كلمات المرور", category: "system_admin", sortOrder: 14 },
        { key: "SYS_SETTINGS_USERS", nameAr: "إعدادات المستخدمون", description: "عرض معلومات المستخدمين النشطين", category: "system_admin", sortOrder: 15 },
        { key: "SYS_SETTINGS_ACTIVITY", nameAr: "إعدادات النشاطات", description: "عرض سجل النشاطات", category: "system_admin", sortOrder: 16 },
        { key: "SYS_USERS_ACTIVATE", nameAr: "تنشيط وإيقاف الحسابات", description: "تنشيط أو إيقاف تنشيط حسابات المستخدمين", category: "system_admin", sortOrder: 17 },
        { key: "SYS_USERS_DELETE", nameAr: "حذف الحسابات", description: "حذف حسابات المستخدمين من النظام", category: "system_admin", sortOrder: 18 },
        { key: "SYS_NOTIFICATIONS_SEND", nameAr: "إرسال إشعارات النظام", description: "إرسال إشعارات إلى مستخدمي النظام", category: "system_admin", sortOrder: 19 },
        { key: "SYS_NOTIFICATIONS_VIEW", nameAr: "عرض نافذة إشعارات النظام", description: "الوصول إلى نافذة إشعارات النظام", category: "system_admin", sortOrder: 20 },
        { key: "SYS_ORG_ACTIVATE", nameAr: "تنشيط وإيقاف الأقسام", description: "تنشيط أو إيقاف تنشيط الأقسام في الهيكل التنظيمي", category: "system_admin", sortOrder: 21 },
        { key: "SYS_ORG_DELETE", nameAr: "حذف الأقسام", description: "حذف الأقسام من الهيكل التنظيمي", category: "system_admin", sortOrder: 22 },
        { key: "SYS_DATA_RESET", nameAr: "تصفير بيانات النظام", description: "إعادة تصفير بيانات النظام بالكامل أو لجهة محددة", category: "system_admin", sortOrder: 23 },
        { key: "SYS_CORRESPONDENCE_DELETE", nameAr: "حذف المراسلات", description: "حذف المراسلات من النظام", category: "system_admin", sortOrder: 24 },
      ];

      for (const p of defaultPerms) {
        this.db.prepare(`
          INSERT OR IGNORE INTO permissions (key, name_ar, description, category, sort_order)
          VALUES (?, ?, ?, ?, ?)
        `).run(p.key, p.nameAr, p.description, p.category, p.sortOrder);
      }
    } catch (err) {
      console.error("Error seeding default data in SqliteStorage:", err);
    }
  }

  // --- Departments ---
  async getDepartments(): Promise<Department[]> {
    const rows = this.db.prepare("SELECT * FROM departments ORDER BY id ASC").all();
    return rows.map(mapDepartment);
  }

  async getDepartment(id: number): Promise<Department | undefined> {
    const row = this.db.prepare("SELECT * FROM departments WHERE id = ?").get(id);
    return row ? mapDepartment(row) : undefined;
  }

  async createDepartment(data: InsertDepartment): Promise<Department> {
    const stmt = this.db.prepare(`
      INSERT INTO departments (name, name_en, level, is_central, parent_id, manager_id, code, description, can_send_internal_outgoing, can_send_external_outgoing, can_receive_internal_incoming, can_receive_external_incoming, allowed_external_entities, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `);
    const row = stmt.get(
      data.name,
      data.nameEn || null,
      data.level || "unit",
      boolToNum(data.isCentral),
      data.parentId || null,
      data.managerId || null,
      data.code || null,
      data.description || null,
      boolToNum(data.canSendInternalOutgoing ?? true),
      boolToNum(data.canSendExternalOutgoing ?? false),
      boolToNum(data.canReceiveInternalIncoming ?? true),
      boolToNum(data.canReceiveExternalIncoming ?? false),
      data.allowedExternalEntities ? JSON.stringify(data.allowedExternalEntities) : null,
      boolToNum(data.isActive ?? true)
    );
    return mapDepartment(row);
  }

  async updateDepartment(id: number, data: Partial<Department>): Promise<Department | undefined> {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.name !== undefined) { fields.push("name = ?"); values.push(data.name); }
    if (data.nameEn !== undefined) { fields.push("name_en = ?"); values.push(data.nameEn); }
    if (data.level !== undefined) { fields.push("level = ?"); values.push(data.level); }
    if (data.isCentral !== undefined) { fields.push("is_central = ?"); values.push(boolToNum(data.isCentral)); }
    if (data.parentId !== undefined) { fields.push("parent_id = ?"); values.push(data.parentId); }
    if (data.managerId !== undefined) { fields.push("manager_id = ?"); values.push(data.managerId); }
    if (data.code !== undefined) { fields.push("code = ?"); values.push(data.code); }
    if (data.description !== undefined) { fields.push("description = ?"); values.push(data.description); }
    if (data.canSendInternalOutgoing !== undefined) { fields.push("can_send_internal_outgoing = ?"); values.push(boolToNum(data.canSendInternalOutgoing)); }
    if (data.canSendExternalOutgoing !== undefined) { fields.push("can_send_external_outgoing = ?"); values.push(boolToNum(data.canSendExternalOutgoing)); }
    if (data.canReceiveInternalIncoming !== undefined) { fields.push("can_receive_internal_incoming = ?"); values.push(boolToNum(data.canReceiveInternalIncoming)); }
    if (data.canReceiveExternalIncoming !== undefined) { fields.push("can_receive_external_incoming = ?"); values.push(boolToNum(data.canReceiveExternalIncoming)); }
    if (data.allowedExternalEntities !== undefined) { fields.push("allowed_external_entities = ?"); values.push(data.allowedExternalEntities ? JSON.stringify(data.allowedExternalEntities) : null); }
    if (data.isActive !== undefined) { fields.push("is_active = ?"); values.push(boolToNum(data.isActive)); }

    if (fields.length === 0) return this.getDepartment(id);

    values.push(id);
    const stmt = this.db.prepare(`UPDATE departments SET ${fields.join(", ")} WHERE id = ? RETURNING *`);
    const row = stmt.get(...values);
    return row ? mapDepartment(row) : undefined;
  }

  async deleteDepartment(id: number): Promise<boolean> {
    const res = this.db.prepare("DELETE FROM departments WHERE id = ?").run(id);
    return res.changes > 0;
  }

  async getDepartmentChildren(parentId: number): Promise<Department[]> {
    const rows = this.db.prepare("SELECT * FROM departments WHERE parent_id = ?").all(parentId);
    return rows.map(mapDepartment);
  }

  async getDepartmentAncestors(departmentId: number): Promise<Department[]> {
    const ancestors: Department[] = [];
    let currentId: number | null = departmentId;
    while (currentId) {
      const row = this.db.prepare("SELECT * FROM departments WHERE id = ?").get(currentId) as any;
      if (!row || !row.parent_id) break;
      const parent = this.db.prepare("SELECT * FROM departments WHERE id = ?").get(row.parent_id) as any;
      if (!parent) break;
      ancestors.push(mapDepartment(parent));
      currentId = parent.parent_id;
    }
    return ancestors;
  }

  // --- Employees ---
  async getEmployees(): Promise<Employee[]> {
    const rows = this.db.prepare("SELECT * FROM employees ORDER BY id ASC").all();
    return rows.map(mapEmployee);
  }

  async getEmployee(id: number): Promise<Employee | undefined> {
    const row = this.db.prepare("SELECT * FROM employees WHERE id = ?").get(id);
    return row ? mapEmployee(row) : undefined;
  }

  async getEmployeeByUserId(userId: string): Promise<Employee | undefined> {
    const row = this.db.prepare("SELECT * FROM employees WHERE user_id = ?").get(userId);
    return row ? mapEmployee(row) : undefined;
  }

  async getEmployeeByUsername(username: string): Promise<Employee | undefined> {
    const row = this.db.prepare("SELECT * FROM employees WHERE LOWER(username) = LOWER(?)").get(username);
    return row ? mapEmployee(row) : undefined;
  }

  async createEmployee(data: InsertEmployee): Promise<Employee> {
    const stmt = this.db.prepare(`
      INSERT INTO employees (user_id, username, password_hash, full_name, department_id, job_title, role, signature_url, company_number, landline_phone, mobile_phone, email, is_active, must_change_password, can_access_correspondence, can_access_leave_requests, can_receive_external_incoming)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `);
    const row = stmt.get(
      data.userId || "",
      data.username || null,
      data.passwordHash || null,
      data.fullName || "موظف",
      data.departmentId || null,
      data.jobTitle || null,
      data.role || "employee",
      data.signatureUrl || null,
      data.companyNumber || null,
      data.landlinePhone || null,
      data.mobilePhone || null,
      data.email || null,
      boolToNum(data.isActive ?? true),
      boolToNum(data.mustChangePassword ?? false),
      boolToNum(data.canAccessCorrespondence ?? true),
      boolToNum(data.canAccessLeaveRequests ?? true),
      boolToNum(data.canReceiveExternalIncoming ?? false)
    );
    return mapEmployee(row);
  }

  async updateEmployee(id: number, data: Partial<Employee>): Promise<Employee | undefined> {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.userId !== undefined) { fields.push("user_id = ?"); values.push(data.userId); }
    if (data.username !== undefined) { fields.push("username = ?"); values.push(data.username); }
    if (data.passwordHash !== undefined) { fields.push("password_hash = ?"); values.push(data.passwordHash); }
    if (data.fullName !== undefined) { fields.push("full_name = ?"); values.push(data.fullName); }
    if (data.departmentId !== undefined) { fields.push("department_id = ?"); values.push(data.departmentId); }
    if (data.jobTitle !== undefined) { fields.push("job_title = ?"); values.push(data.jobTitle); }
    if (data.role !== undefined) { fields.push("role = ?"); values.push(data.role); }
    if (data.signatureUrl !== undefined) { fields.push("signature_url = ?"); values.push(data.signatureUrl); }
    if (data.companyNumber !== undefined) { fields.push("company_number = ?"); values.push(data.companyNumber); }
    if (data.landlinePhone !== undefined) { fields.push("landline_phone = ?"); values.push(data.landlinePhone); }
    if (data.mobilePhone !== undefined) { fields.push("mobile_phone = ?"); values.push(data.mobilePhone); }
    if (data.email !== undefined) { fields.push("email = ?"); values.push(data.email); }
    if (data.isActive !== undefined) { fields.push("is_active = ?"); values.push(boolToNum(data.isActive)); }
    if (data.mustChangePassword !== undefined) { fields.push("must_change_password = ?"); values.push(boolToNum(data.mustChangePassword)); }
    if (data.canAccessCorrespondence !== undefined) { fields.push("can_access_correspondence = ?"); values.push(boolToNum(data.canAccessCorrespondence)); }
    if (data.canAccessLeaveRequests !== undefined) { fields.push("can_access_leave_requests = ?"); values.push(boolToNum(data.canAccessLeaveRequests)); }
    if (data.canReceiveExternalIncoming !== undefined) { fields.push("can_receive_external_incoming = ?"); values.push(boolToNum(data.canReceiveExternalIncoming)); }
    if (data.lastLoginAt !== undefined) { fields.push("last_login_at = ?"); values.push(data.lastLoginAt?.toISOString() || null); }
    if (data.lastLoginIp !== undefined) { fields.push("last_login_ip = ?"); values.push(data.lastLoginIp); }
    if (data.lastLoginLocation !== undefined) { fields.push("last_login_location = ?"); values.push(data.lastLoginLocation); }

    if (fields.length === 0) return this.getEmployee(id);

    values.push(id);
    const stmt = this.db.prepare(`UPDATE employees SET ${fields.join(", ")} WHERE id = ? RETURNING *`);
    const row = stmt.get(...values);
    return row ? mapEmployee(row) : undefined;
  }

  async deleteEmployee(id: number): Promise<void> {
    this.db.prepare("DELETE FROM user_permissions WHERE employee_id = ?").run(id);
    this.db.prepare("DELETE FROM employees WHERE id = ?").run(id);
  }

  async getOrCreateEmployee(userId: string, fullName: string, email?: string): Promise<Employee> {
    const existing = await this.getEmployeeByUserId(userId);
    if (existing) return existing;

    const existingAdmin = this.db.prepare("SELECT * FROM employees WHERE role = 'admin' LIMIT 1").get();
    const needsAdmin = !existingAdmin;

    let gmDeptId: number | undefined;
    if (needsAdmin) {
      const gmDept = this.db.prepare("SELECT * FROM departments WHERE level = 'general_manager' LIMIT 1").get() as any;
      gmDeptId = gmDept?.id;
    }

    return this.createEmployee({
      userId,
      fullName,
      email: email || undefined,
      role: needsAdmin ? "admin" : "employee",
      departmentId: gmDeptId,
      jobTitle: needsAdmin ? "مدير النظام" : undefined,
    });
  }

  // --- Correspondence ---
  async getCorrespondence(): Promise<Correspondence[]> {
    const rows = this.db.prepare("SELECT * FROM correspondence WHERE is_deleted = 0 OR is_deleted IS NULL ORDER BY created_at DESC").all();
    return rows.map(mapCorrespondence);
  }

  async getCorrespondenceById(id: number): Promise<Correspondence | undefined> {
    const row = this.db.prepare("SELECT * FROM correspondence WHERE id = ?").get(id);
    return row ? mapCorrespondence(row) : undefined;
  }

  async getCorrespondenceByDepartment(deptId: number): Promise<Correspondence[]> {
    const rows = this.db.prepare(`
      SELECT * FROM correspondence
      WHERE (is_deleted = 0 OR is_deleted IS NULL)
        AND (sender_department_id = ? OR receiver_department_id = ? OR current_department_id = ?)
      ORDER BY created_at DESC
    `).all(deptId, deptId, deptId);
    return rows.map(mapCorrespondence);
  }

  async getDeletedCorrespondence(): Promise<Correspondence[]> {
    const rows = this.db.prepare("SELECT * FROM correspondence WHERE is_deleted = 1 ORDER BY deleted_at DESC").all();
    return rows.map(mapCorrespondence);
  }

  async createCorrespondence(data: InsertCorrespondence): Promise<Correspondence> {
    const stmt = this.db.prepare(`
      INSERT INTO correspondence (
        type, reference_number, external_ref_number, external_entity, external_date, subject, content,
        sender_department_id, receiver_department_id, current_department_id, created_by_id, assigned_to_id, send_to_all,
        status, priority, confidentiality, central_mail_assigned_by_id,
        flow_template_id, flow_template_group_id, parent_correspondence_id, contributing_department_ids,
        contribution_routing_batch_id, margin_notes, notes, issued_at, issued_by_id,
        requires_reply, reminder_date, follow_up_days, closed_at, closed_by_id,
        is_deleted, deleted_at, deleted_by_id, delete_reason
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `);
    const row = stmt.get(
      data.type,
      data.referenceNumber || null,
      data.externalRefNumber || null,
      data.externalEntity || null,
      data.externalDate ? (data.externalDate instanceof Date ? data.externalDate.toISOString() : String(data.externalDate)) : null,
      data.subject,
      data.content || null,
      data.senderDepartmentId || null,
      data.receiverDepartmentId || null,
      data.currentDepartmentId || null,
      data.createdById || null,
      data.assignedToId || null,
      boolToNum(data.sendToAll ?? false),
      data.status || "draft",
      data.priority || "medium",
      data.confidentiality || "normal",
      data.centralMailAssignedById || null,
      data.flowTemplateId || null,
      data.flowTemplateGroupId || null,
      data.parentCorrespondenceId || null,
      data.contributingDepartmentIds ? JSON.stringify(data.contributingDepartmentIds) : null,
      data.contributionRoutingBatchId || null,
      data.marginNotes || null,
      data.notes || null,
      data.issuedAt ? (data.issuedAt instanceof Date ? data.issuedAt.toISOString() : String(data.issuedAt)) : null,
      data.issuedById || null,
      boolToNum(data.requiresReply ?? false),
      data.reminderDate ? (data.reminderDate instanceof Date ? data.reminderDate.toISOString() : String(data.reminderDate)) : null,
      data.followUpDays || null,
      data.closedAt ? (data.closedAt instanceof Date ? data.closedAt.toISOString() : String(data.closedAt)) : null,
      data.closedById || null,
      boolToNum(data.isDeleted ?? false),
      data.deletedAt ? (data.deletedAt instanceof Date ? data.deletedAt.toISOString() : String(data.deletedAt)) : null,
      data.deletedById || null,
      data.deleteReason || null
    );
    return mapCorrespondence(row);
  }

  async updateCorrespondence(id: number, data: Partial<Correspondence>): Promise<Correspondence | undefined> {
    const fields: string[] = ["updated_at = CURRENT_TIMESTAMP"];
    const values: any[] = [];

    if (data.type !== undefined) { fields.push("type = ?"); values.push(data.type); }
    if (data.referenceNumber !== undefined) { fields.push("reference_number = ?"); values.push(data.referenceNumber); }
    if (data.externalRefNumber !== undefined) { fields.push("external_ref_number = ?"); values.push(data.externalRefNumber); }
    if (data.externalEntity !== undefined) { fields.push("external_entity = ?"); values.push(data.externalEntity); }
    if (data.externalDate !== undefined) { fields.push("external_date = ?"); values.push(data.externalDate ? (data.externalDate instanceof Date ? data.externalDate.toISOString() : String(data.externalDate)) : null); }
    if (data.subject !== undefined) { fields.push("subject = ?"); values.push(data.subject); }
    if (data.content !== undefined) { fields.push("content = ?"); values.push(data.content); }
    if (data.senderDepartmentId !== undefined) { fields.push("sender_department_id = ?"); values.push(data.senderDepartmentId); }
    if (data.receiverDepartmentId !== undefined) { fields.push("receiver_department_id = ?"); values.push(data.receiverDepartmentId); }
    if (data.currentDepartmentId !== undefined) { fields.push("current_department_id = ?"); values.push(data.currentDepartmentId); }
    if (data.createdById !== undefined) { fields.push("created_by_id = ?"); values.push(data.createdById); }
    if (data.assignedToId !== undefined) { fields.push("assigned_to_id = ?"); values.push(data.assignedToId); }
    if (data.sendToAll !== undefined) { fields.push("send_to_all = ?"); values.push(boolToNum(data.sendToAll)); }
    if (data.status !== undefined) { fields.push("status = ?"); values.push(data.status); }
    if (data.priority !== undefined) { fields.push("priority = ?"); values.push(data.priority); }
    if (data.confidentiality !== undefined) { fields.push("confidentiality = ?"); values.push(data.confidentiality); }
    if (data.centralMailAssignedById !== undefined) { fields.push("central_mail_assigned_by_id = ?"); values.push(data.centralMailAssignedById); }
    if (data.flowTemplateId !== undefined) { fields.push("flow_template_id = ?"); values.push(data.flowTemplateId); }
    if (data.flowTemplateGroupId !== undefined) { fields.push("flow_template_group_id = ?"); values.push(data.flowTemplateGroupId); }
    if (data.parentCorrespondenceId !== undefined) { fields.push("parent_correspondence_id = ?"); values.push(data.parentCorrespondenceId); }
    if (data.contributingDepartmentIds !== undefined) { fields.push("contributing_department_ids = ?"); values.push(data.contributingDepartmentIds ? JSON.stringify(data.contributingDepartmentIds) : null); }
    if (data.contributionRoutingBatchId !== undefined) { fields.push("contribution_routing_batch_id = ?"); values.push(data.contributionRoutingBatchId); }
    if (data.marginNotes !== undefined) { fields.push("margin_notes = ?"); values.push(data.marginNotes); }
    if (data.notes !== undefined) { fields.push("notes = ?"); values.push(data.notes); }
    if (data.issuedAt !== undefined) { fields.push("issued_at = ?"); values.push(data.issuedAt ? (data.issuedAt instanceof Date ? data.issuedAt.toISOString() : String(data.issuedAt)) : null); }
    if (data.issuedById !== undefined) { fields.push("issued_by_id = ?"); values.push(data.issuedById); }
    if (data.requiresReply !== undefined) { fields.push("requires_reply = ?"); values.push(boolToNum(data.requiresReply)); }
    if (data.reminderDate !== undefined) { fields.push("reminder_date = ?"); values.push(data.reminderDate ? (data.reminderDate instanceof Date ? data.reminderDate.toISOString() : String(data.reminderDate)) : null); }
    if (data.followUpDays !== undefined) { fields.push("follow_up_days = ?"); values.push(data.followUpDays); }
    if (data.closedAt !== undefined) { fields.push("closed_at = ?"); values.push(data.closedAt ? (data.closedAt instanceof Date ? data.closedAt.toISOString() : String(data.closedAt)) : null); }
    if (data.closedById !== undefined) { fields.push("closed_by_id = ?"); values.push(data.closedById); }
    if (data.isDeleted !== undefined) { fields.push("is_deleted = ?"); values.push(boolToNum(data.isDeleted)); }
    if (data.deletedAt !== undefined) { fields.push("deleted_at = ?"); values.push(data.deletedAt ? (data.deletedAt instanceof Date ? data.deletedAt.toISOString() : String(data.deletedAt)) : null); }
    if (data.deletedById !== undefined) { fields.push("deleted_by_id = ?"); values.push(data.deletedById); }
    if (data.deleteReason !== undefined) { fields.push("delete_reason = ?"); values.push(data.deleteReason); }

    values.push(id);
    const stmt = this.db.prepare(`UPDATE correspondence SET ${fields.join(", ")} WHERE id = ? RETURNING *`);
    const row = stmt.get(...values);
    return row ? mapCorrespondence(row) : undefined;
  }

  async getCorrespondenceReplies(parentId: number): Promise<Correspondence[]> {
    const rows = this.db.prepare(`
      SELECT * FROM correspondence
      WHERE parent_correspondence_id = ? AND (is_deleted = 0 OR is_deleted IS NULL)
      ORDER BY created_at DESC
    `).all(parentId);
    return rows.map(mapCorrespondence);
  }

  // --- Assignments ---
  async createAssignment(data: InsertCorrespondenceAssignment): Promise<CorrespondenceAssignment> {
    const stmt = this.db.prepare(`
      INSERT INTO correspondence_assignments (
        correspondence_id, department_id, assigned_by_id, is_lead, is_follow_up, follow_up_days, notes, status, response_deadline, routing_batch_id, is_active_batch
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `);
    const row = stmt.get(
      data.correspondenceId,
      data.departmentId,
      data.assignedById || null,
      boolToNum(data.isLead ?? false),
      boolToNum(data.isFollowUp ?? false),
      data.followUpDays || null,
      data.notes || null,
      data.status || "pending",
      data.responseDeadline ? (data.responseDeadline instanceof Date ? data.responseDeadline.toISOString() : String(data.responseDeadline)) : null,
      data.routingBatchId || null,
      boolToNum(data.isActiveBatch ?? true)
    ) as any;
    return {
      id: row.id,
      correspondenceId: row.correspondence_id,
      departmentId: row.department_id,
      assignedById: row.assigned_by_id,
      isLead: numToBool(row.is_lead),
      isFollowUp: numToBool(row.is_follow_up),
      followUpDays: row.follow_up_days,
      notes: row.notes,
      status: row.status,
      responseDeadline: row.response_deadline ? new Date(row.response_deadline) : null,
      completedAt: row.completed_at ? new Date(row.completed_at) : null,
      routingBatchId: row.routing_batch_id,
      isActiveBatch: numToBool(row.is_active_batch),
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    };
  }

  async getAssignmentsByCorrespondence(corrId: number): Promise<CorrespondenceAssignment[]> {
    const rows = this.db.prepare("SELECT * FROM correspondence_assignments WHERE correspondence_id = ?").all(corrId) as any[];
    return rows.map(row => ({
      id: row.id,
      correspondenceId: row.correspondence_id,
      departmentId: row.department_id,
      assignedById: row.assigned_by_id,
      isLead: numToBool(row.is_lead),
      isFollowUp: numToBool(row.is_follow_up),
      followUpDays: row.follow_up_days,
      notes: row.notes,
      status: row.status,
      responseDeadline: row.response_deadline ? new Date(row.response_deadline) : null,
      completedAt: row.completed_at ? new Date(row.completed_at) : null,
      routingBatchId: row.routing_batch_id,
      isActiveBatch: numToBool(row.is_active_batch),
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    }));
  }

  async getFollowUpAssignmentsByEmployee(employeeId: number): Promise<CorrespondenceAssignment[]> {
    const rows = this.db.prepare(`
      SELECT * FROM correspondence_assignments WHERE assigned_by_id = ? AND is_follow_up = 1
    `).all(employeeId) as any[];
    return rows.map(row => ({
      id: row.id,
      correspondenceId: row.correspondence_id,
      departmentId: row.department_id,
      assignedById: row.assigned_by_id,
      isLead: numToBool(row.is_lead),
      isFollowUp: numToBool(row.is_follow_up),
      followUpDays: row.follow_up_days,
      notes: row.notes,
      status: row.status,
      responseDeadline: row.response_deadline ? new Date(row.response_deadline) : null,
      completedAt: row.completed_at ? new Date(row.completed_at) : null,
      routingBatchId: row.routing_batch_id,
      isActiveBatch: numToBool(row.is_active_batch),
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    }));
  }

  async updateAssignment(id: number, data: Partial<CorrespondenceAssignment>): Promise<CorrespondenceAssignment | undefined> {
    const fields: string[] = [];
    const values: any[] = [];
    if (data.status !== undefined) { fields.push("status = ?"); values.push(data.status); }
    if (data.completedAt !== undefined) { fields.push("completed_at = ?"); values.push(data.completedAt ? (data.completedAt instanceof Date ? data.completedAt.toISOString() : String(data.completedAt)) : null); }
    if (data.notes !== undefined) { fields.push("notes = ?"); values.push(data.notes); }
    if (data.isLead !== undefined) { fields.push("is_lead = ?"); values.push(boolToNum(data.isLead)); }
    if (data.isActiveBatch !== undefined) { fields.push("is_active_batch = ?"); values.push(boolToNum(data.isActiveBatch)); }
    if (fields.length === 0) return undefined;

    values.push(id);
    const stmt = this.db.prepare(`UPDATE correspondence_assignments SET ${fields.join(", ")} WHERE id = ? RETURNING *`);
    const row = stmt.get(...values) as any;
    if (!row) return undefined;
    return {
      id: row.id,
      correspondenceId: row.correspondence_id,
      departmentId: row.department_id,
      assignedById: row.assigned_by_id,
      isLead: numToBool(row.is_lead),
      isFollowUp: numToBool(row.is_follow_up),
      followUpDays: row.follow_up_days,
      notes: row.notes,
      status: row.status,
      responseDeadline: row.response_deadline ? new Date(row.response_deadline) : null,
      completedAt: row.completed_at ? new Date(row.completed_at) : null,
      routingBatchId: row.routing_batch_id,
      isActiveBatch: numToBool(row.is_active_batch),
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    };
  }

  // --- Contributions ---
  async createContribution(data: InsertCorrespondenceContribution): Promise<CorrespondenceContribution> {
    const stmt = this.db.prepare(`
      INSERT INTO correspondence_contributions (
        correspondence_id, routing_batch_id, contributing_department_id, lead_department_id, is_lead, status, content, decline_reason, submitted_by_id, submitted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `);
    const row = stmt.get(
      data.correspondenceId,
      data.routingBatchId,
      data.contributingDepartmentId,
      data.leadDepartmentId,
      boolToNum(data.isLead ?? false),
      data.status || "pending",
      data.content || null,
      data.declineReason || null,
      data.submittedById || null,
      data.submittedAt ? (data.submittedAt instanceof Date ? data.submittedAt.toISOString() : String(data.submittedAt)) : null
    ) as any;
    return {
      id: row.id,
      correspondenceId: row.correspondence_id,
      routingBatchId: row.routing_batch_id,
      contributingDepartmentId: row.contributing_department_id,
      leadDepartmentId: row.lead_department_id,
      isLead: numToBool(row.is_lead),
      status: row.status,
      content: row.content,
      declineReason: row.decline_reason,
      submittedById: row.submitted_by_id ?? null,
      submittedAt: row.submitted_at ? new Date(row.submitted_at) : null,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    };
  }

  async getContributionsByCorrespondence(corrId: number): Promise<CorrespondenceContribution[]> {
    const rows = this.db.prepare("SELECT * FROM correspondence_contributions WHERE correspondence_id = ? ORDER BY created_at DESC").all(corrId) as any[];
    return rows.map(row => ({
      id: row.id,
      correspondenceId: row.correspondence_id,
      routingBatchId: row.routing_batch_id,
      contributingDepartmentId: row.contributing_department_id,
      leadDepartmentId: row.lead_department_id,
      isLead: numToBool(row.is_lead),
      status: row.status,
      content: row.content,
      declineReason: row.decline_reason,
      submittedById: row.submitted_by_id ?? null,
      submittedAt: row.submitted_at ? new Date(row.submitted_at) : null,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    }));
  }

  async getContributionsByBatch(corrId: number, routingBatchId: string): Promise<CorrespondenceContribution[]> {
    const rows = this.db.prepare("SELECT * FROM correspondence_contributions WHERE correspondence_id = ? AND routing_batch_id = ?").all(corrId, routingBatchId) as any[];
    return rows.map(row => ({
      id: row.id,
      correspondenceId: row.correspondence_id,
      routingBatchId: row.routing_batch_id,
      contributingDepartmentId: row.contributing_department_id,
      leadDepartmentId: row.lead_department_id,
      isLead: numToBool(row.is_lead),
      status: row.status,
      content: row.content,
      declineReason: row.decline_reason,
      submittedById: row.submitted_by_id ?? null,
      submittedAt: row.submitted_at ? new Date(row.submitted_at) : null,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    }));
  }

  async getContribution(id: number): Promise<CorrespondenceContribution | undefined> {
    const row = this.db.prepare("SELECT * FROM correspondence_contributions WHERE id = ?").get(id) as any;
    if (!row) return undefined;
    return {
      id: row.id,
      correspondenceId: row.correspondence_id,
      routingBatchId: row.routing_batch_id,
      contributingDepartmentId: row.contributing_department_id || row.department_id,
      leadDepartmentId: row.lead_department_id || 0,
      isLead: numToBool(row.is_lead),
      status: row.status,
      content: row.content,
      declineReason: row.decline_reason,
      submittedById: row.submitted_by_id ?? null,
      submittedAt: row.submitted_at ? new Date(row.submitted_at) : null,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    };
  }

  async updateContribution(id: number, data: Partial<CorrespondenceContribution>): Promise<CorrespondenceContribution | undefined> {
    const fields: string[] = [];
    const values: any[] = [];
    if (data.content !== undefined) { fields.push("content = ?"); values.push(data.content); }
    if (data.status !== undefined) { fields.push("status = ?"); values.push(data.status); }
    if (data.declineReason !== undefined) { fields.push("decline_reason = ?"); values.push(data.declineReason); }
    if (data.submittedById !== undefined) { fields.push("submitted_by_id = ?"); values.push(data.submittedById); }
    if (data.submittedAt !== undefined) { fields.push("submitted_at = ?"); values.push(data.submittedAt ? (data.submittedAt instanceof Date ? data.submittedAt.toISOString() : String(data.submittedAt)) : null); }

    if (fields.length === 0) return this.getContribution(id);
    values.push(id);
    const stmt = this.db.prepare(`UPDATE correspondence_contributions SET ${fields.join(", ")} WHERE id = ? RETURNING *`);
    const row = stmt.get(...values) as any;
    if (!row) return undefined;
    return {
      id: row.id,
      correspondenceId: row.correspondence_id,
      routingBatchId: row.routing_batch_id,
      contributingDepartmentId: row.contributing_department_id || row.department_id,
      leadDepartmentId: row.lead_department_id || 0,
      isLead: numToBool(row.is_lead),
      status: row.status,
      content: row.content,
      declineReason: row.decline_reason,
      submittedById: row.submitted_by_id ?? null,
      submittedAt: row.submitted_at ? new Date(row.submitted_at) : null,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    };
  }

  // --- Followups ---
  async createCorrespondenceFollowup(data: InsertCorrespondenceFollowup): Promise<CorrespondenceFollowup> {
    const stmt = this.db.prepare("INSERT INTO correspondence_followups (correspondence_id, employee_id, follow_up_days) VALUES (?, ?, ?) RETURNING *");
    const row = stmt.get(data.correspondenceId, data.employeeId, data.followUpDays) as any;
    return {
      id: row.id,
      correspondenceId: row.correspondence_id,
      employeeId: row.employee_id,
      followUpDays: row.follow_up_days,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    };
  }

  async getFollowupsByEmployee(employeeId: number): Promise<CorrespondenceFollowup[]> {
    const rows = this.db.prepare("SELECT * FROM correspondence_followups WHERE employee_id = ?").all(employeeId) as any[];
    return rows.map(r => ({
      id: r.id,
      correspondenceId: r.correspondence_id,
      employeeId: r.employee_id,
      followUpDays: r.follow_up_days ?? 0,
      createdAt: r.created_at ? new Date(r.created_at) : new Date(),
    }));
  }

  async getFollowupByEmployeeAndCorrespondence(employeeId: number, correspondenceId: number): Promise<CorrespondenceFollowup | undefined> {
    const row = this.db.prepare("SELECT * FROM correspondence_followups WHERE employee_id = ? AND correspondence_id = ?").get(employeeId, correspondenceId) as any;
    if (!row) return undefined;
    return {
      id: row.id,
      correspondenceId: row.correspondence_id,
      employeeId: row.employee_id,
      followUpDays: row.follow_up_days ?? 0,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    };
  }

  async updateCorrespondenceFollowup(id: number, data: Partial<CorrespondenceFollowup>): Promise<CorrespondenceFollowup | undefined> {
    return undefined;
  }

  async deleteCorrespondenceFollowup(id: number): Promise<void> {
    this.db.prepare("DELETE FROM correspondence_followups WHERE id = ?").run(id);
  }

  // --- Read Status ---
  async markCorrespondenceRead(correspondenceId: number, employeeId: number): Promise<CorrespondenceReadStatus> {
    const existing = this.db.prepare("SELECT * FROM correspondence_read_status WHERE correspondence_id = ? AND employee_id = ?").get(correspondenceId, employeeId) as any;
    if (existing) {
      return {
        id: existing.id,
        correspondenceId: existing.correspondence_id,
        employeeId: existing.employee_id,
        readAt: existing.read_at ? new Date(existing.read_at) : new Date(),
      };
    }
    const stmt = this.db.prepare("INSERT INTO correspondence_read_status (correspondence_id, employee_id) VALUES (?, ?) RETURNING *");
    const row = stmt.get(correspondenceId, employeeId) as any;
    return {
      id: row.id,
      correspondenceId: row.correspondence_id,
      employeeId: row.employee_id,
      readAt: row.read_at ? new Date(row.read_at) : new Date(),
    };
  }

  async getReadStatusesForEmployee(employeeId: number): Promise<CorrespondenceReadStatus[]> {
    const rows = this.db.prepare("SELECT * FROM correspondence_read_status WHERE employee_id = ?").all(employeeId) as any[];
    return rows.map(r => ({
      id: r.id,
      correspondenceId: r.correspondence_id,
      employeeId: r.employee_id,
      readAt: r.read_at ? new Date(r.read_at) : new Date(),
    }));
  }

  async getDeadlineAlerts(employeeId: number): Promise<any[]> {
    const assignments = this.db.prepare(`
      SELECT * FROM correspondence_assignments
      WHERE assigned_by_id = ? AND is_follow_up = 1 AND response_deadline IS NOT NULL AND completed_at IS NULL
    `).all(employeeId) as any[];

    const results: any[] = [];
    for (const a of assignments) {
      const corr = await this.getCorrespondenceById(a.correspondence_id);
      if (corr) {
        const now = new Date();
        const deadline = new Date(a.response_deadline);
        const diffMs = deadline.getTime() - now.getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        results.push({
          ...corr,
          assignmentId: a.id,
          responseDeadline: a.response_deadline,
          departmentId: a.department_id,
          daysRemaining: diffDays,
          isOverdue: diffDays < 0,
          isApproaching: diffDays >= 0 && diffDays <= 2,
        });
      }
    }
    return results;
  }

  // --- CCs & Attachments ---
  async createCC(data: InsertCorrespondenceCC): Promise<CorrespondenceCC> {
    const stmt = this.db.prepare("INSERT INTO correspondence_ccs (correspondence_id, department_id, reason, is_automatic, is_hidden) VALUES (?, ?, ?, ?, ?) RETURNING *");
    const row = stmt.get(data.correspondenceId, data.departmentId, data.reason || null, boolToNum(data.isAutomatic ?? false), boolToNum(data.isHidden ?? false)) as any;
    return {
      id: row.id,
      correspondenceId: row.correspondence_id,
      departmentId: row.department_id,
      reason: row.reason,
      isAutomatic: numToBool(row.is_automatic),
      isHidden: numToBool(row.is_hidden),
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    };
  }

  async getCCsByCorrespondence(corrId: number): Promise<CorrespondenceCC[]> {
    const rows = this.db.prepare("SELECT * FROM correspondence_ccs WHERE correspondence_id = ?").all(corrId) as any[];
    return rows.map(r => ({
      id: r.id,
      correspondenceId: r.correspondence_id,
      departmentId: r.department_id,
      reason: r.reason,
      isAutomatic: numToBool(r.is_automatic),
      isHidden: numToBool(r.is_hidden),
      createdAt: r.created_at ? new Date(r.created_at) : new Date(),
    }));
  }

  async deleteCCsByCorrespondence(corrId: number): Promise<void> {
    this.db.prepare("DELETE FROM correspondence_ccs WHERE correspondence_id = ?").run(corrId);
  }

  async createAttachment(data: InsertCorrespondenceAttachment): Promise<CorrespondenceAttachment> {
    const stmt = this.db.prepare(`
      INSERT INTO correspondence_attachments (correspondence_id, file_name, original_name, mime_type, file_size, description, uploaded_by_id, contribution_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `);
    const row = stmt.get(
      data.correspondenceId,
      data.fileName,
      data.originalName || data.fileName,
      data.mimeType,
      data.fileSize,
      data.description || "",
      data.uploadedById,
      data.contributionId || null
    ) as any;
    return {
      id: row.id,
      correspondenceId: row.correspondence_id,
      fileName: row.file_name,
      originalName: row.original_name,
      mimeType: row.mime_type,
      fileSize: row.file_size,
      description: row.description,
      uploadedById: row.uploaded_by_id,
      contributionId: row.contribution_id ?? null,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    };
  }

  async getAttachmentsByCorrespondence(corrId: number): Promise<CorrespondenceAttachment[]> {
    const rows = this.db.prepare("SELECT * FROM correspondence_attachments WHERE correspondence_id = ?").all(corrId) as any[];
    return rows.map(r => ({
      id: r.id,
      correspondenceId: r.correspondence_id,
      fileName: r.file_name,
      originalName: r.original_name,
      mimeType: r.mime_type,
      fileSize: r.file_size,
      description: r.description,
      uploadedById: r.uploaded_by_id,
      contributionId: r.contribution_id ?? null,
      createdAt: r.created_at ? new Date(r.created_at) : new Date(),
    }));
  }

  async getAttachment(id: number): Promise<CorrespondenceAttachment | undefined> {
    const row = this.db.prepare("SELECT * FROM correspondence_attachments WHERE id = ?").get(id) as any;
    if (!row) return undefined;
    return {
      id: row.id,
      correspondenceId: row.correspondence_id,
      fileName: row.file_name,
      originalName: row.original_name,
      mimeType: row.mime_type,
      fileSize: row.file_size,
      description: row.description,
      uploadedById: row.uploaded_by_id,
      contributionId: row.contribution_id ?? null,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    };
  }

  async deleteAttachment(id: number): Promise<boolean> {
    const res = this.db.prepare("DELETE FROM correspondence_attachments WHERE id = ?").run(id);
    return res.changes > 0;
  }

  // --- Audit Log ---
  async createAuditLog(data: InsertAuditLog): Promise<AuditLog> {
    const stmt = this.db.prepare(`
      INSERT INTO audit_log (entity_type, entity_id, action, performed_by_id, employee_id, ip_address, module, details)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `);
    const row = stmt.get(
      data.entityType,
      data.entityId,
      data.action,
      data.performedById || null,
      data.employeeId || null,
      data.ipAddress || null,
      data.module || null,
      data.details || null
    ) as any;
    return {
      id: row.id,
      entityType: row.entity_type,
      entityId: row.entity_id,
      action: row.action,
      performedById: row.performed_by_id,
      employeeId: row.employee_id,
      ipAddress: row.ip_address,
      module: row.module,
      details: row.details,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    };
  }

  async getActivityLog(filters?: { userId?: number; dateFrom?: Date; dateTo?: Date }): Promise<AuditLog[]> {
    const conditions: string[] = [];
    const values: any[] = [];
    if (filters?.userId) { conditions.push("performed_by_id = ?"); values.push(filters.userId); }
    if (filters?.dateFrom) { conditions.push("created_at >= ?"); values.push(filters.dateFrom.toISOString()); }
    if (filters?.dateTo) { conditions.push("created_at <= ?"); values.push(filters.dateTo.toISOString()); }

    let sql = "SELECT * FROM audit_log";
    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }
    sql += " ORDER BY created_at DESC LIMIT 500";
    const rows = this.db.prepare(sql).all(...values) as any[];
    return rows.map(r => ({
      id: r.id,
      entityType: r.entity_type,
      entityId: r.entity_id,
      action: r.action,
      performedById: r.performed_by_id,
      employeeId: r.employee_id,
      ipAddress: r.ip_address,
      module: r.module,
      details: r.details,
      createdAt: r.created_at ? new Date(r.created_at) : new Date(),
    }));
  }

  // --- Permissions ---
  async getPermissions(): Promise<Permission[]> {
    const rows = this.db.prepare("SELECT * FROM permissions ORDER BY sort_order ASC").all();
    return rows.map(mapPermission);
  }

  async getPermissionsByCategory(category: string): Promise<Permission[]> {
    const rows = this.db.prepare("SELECT * FROM permissions WHERE category = ? ORDER BY sort_order ASC").all(category);
    return rows.map(mapPermission);
  }

  async createPermission(data: InsertPermission): Promise<Permission> {
    const stmt = this.db.prepare(`
      INSERT INTO permissions (key, name_ar, name_en, description, category, sort_order, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `);
    const row = stmt.get(
      data.key,
      data.nameAr,
      data.nameEn || null,
      data.description || null,
      data.category,
      data.sortOrder || 0,
      boolToNum(data.isActive ?? true)
    );
    return mapPermission(row);
  }

  async getUserPermissions(employeeId: number): Promise<(UserPermission & { permission: Permission })[]> {
    const rows = this.db.prepare(`
      SELECT up.*, p.key as p_key, p.name_ar as p_name_ar, p.name_en as p_name_en, p.description as p_description, p.category as p_category, p.sort_order as p_sort_order, p.is_active as p_is_active
      FROM user_permissions up
      JOIN permissions p ON up.permission_id = p.id
      WHERE up.employee_id = ?
    `).all(employeeId) as any[];

    return rows.map(r => ({
      id: r.id,
      employeeId: r.employee_id,
      permissionId: r.permission_id,
      grantedById: r.granted_by_id,
      grantedAt: r.granted_at ? new Date(r.granted_at) : new Date(),
      permission: {
        id: r.permission_id,
        key: r.p_key,
        nameAr: r.p_name_ar,
        nameEn: r.p_name_en,
        description: r.p_description,
        category: r.p_category,
        sortOrder: r.p_sort_order,
        isActive: numToBool(r.p_is_active),
      },
    }));
  }

  async grantPermission(data: InsertUserPermission): Promise<UserPermission> {
    const stmt = this.db.prepare("INSERT INTO user_permissions (employee_id, permission_id, granted_by_id) VALUES (?, ?, ?) RETURNING *");
    const row = stmt.get(data.employeeId, data.permissionId, data.grantedById || null) as any;
    return mapUserPermission(row);
  }

  async revokePermission(employeeId: number, permissionId: number): Promise<void> {
    this.db.prepare("DELETE FROM user_permissions WHERE employee_id = ? AND permission_id = ?").run(employeeId, permissionId);
  }

  async hasPermission(employeeId: number, permissionKey: string): Promise<boolean> {
    const ADMIN_INHERENT_PERMISSIONS = ["SYS_DATA_RESET"];
    if (ADMIN_INHERENT_PERMISSIONS.includes(permissionKey)) {
      const emp = await this.getEmployee(employeeId);
      if (emp && emp.role === "admin") return true;
    }
    const row = this.db.prepare(`
      SELECT up.id FROM user_permissions up
      JOIN permissions p ON up.permission_id = p.id
      WHERE up.employee_id = ? AND p.key = ?
      LIMIT 1
    `).get(employeeId, permissionKey);
    return !!row;
  }

  async batchUpdatePermissions(employeeId: number, permissionKeys: string[], grantedById: number): Promise<void> {
    this.db.prepare("DELETE FROM user_permissions WHERE employee_id = ?").run(employeeId);
    if (permissionKeys.length > 0) {
      const insertStmt = this.db.prepare("INSERT INTO user_permissions (employee_id, permission_id, granted_by_id) VALUES (?, ?, ?)");
      for (const key of permissionKeys) {
        const perm = this.db.prepare("SELECT id FROM permissions WHERE key = ?").get(key) as any;
        if (perm) {
          insertStmt.run(employeeId, perm.id, grantedById);
        }
      }
    }
  }

  // --- Workflow Events ---
  async createWorkflowEvent(data: InsertWorkflowEvent): Promise<WorkflowEvent> {
    const stmt = this.db.prepare(`
      INSERT INTO workflow_events (correspondence_id, action, from_status, to_status, from_department_id, to_department_id, performed_by_id, margin_note, signature, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `);
    const row = stmt.get(
      data.correspondenceId,
      data.action,
      data.fromStatus || null,
      data.toStatus || null,
      data.fromDepartmentId || null,
      data.toDepartmentId || null,
      data.performedById,
      data.marginNote || null,
      boolToNum(data.signature ?? true),
      data.notes || null
    ) as any;
    return {
      id: row.id,
      correspondenceId: row.correspondence_id,
      action: row.action,
      fromStatus: row.from_status,
      toStatus: row.to_status,
      performedById: row.performed_by_id,
      fromDepartmentId: row.from_department_id,
      toDepartmentId: row.to_department_id,
      marginNote: row.margin_note,
      signature: numToBool(row.signature),
      notes: row.notes,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    };
  }

  async getWorkflowEventsByCorrespondence(corrId: number): Promise<WorkflowEvent[]> {
    const rows = this.db.prepare("SELECT * FROM workflow_events WHERE correspondence_id = ? ORDER BY created_at ASC").all(corrId) as any[];
    return rows.map(r => ({
      id: r.id,
      correspondenceId: r.correspondence_id,
      action: r.action,
      fromStatus: r.from_status,
      toStatus: r.to_status,
      performedById: r.performed_by_id,
      fromDepartmentId: r.from_department_id,
      toDepartmentId: r.to_department_id,
      marginNote: r.margin_note,
      signature: numToBool(r.signature),
      notes: r.notes,
      createdAt: r.created_at ? new Date(r.created_at) : new Date(),
    }));
  }

  async getCorrespondenceIdsActedOnBy(employeeId: number, actions: string[]): Promise<number[]> {
    if (actions.length === 0) return [];
    const placeholders = actions.map(() => "?").join(",");
    const rows = this.db.prepare(`
      SELECT DISTINCT correspondence_id FROM workflow_events WHERE performed_by_id = ? AND action IN (${placeholders})
    `).all(employeeId, ...actions) as any[];
    return rows.map(r => r.correspondence_id).filter(v => v !== null);
  }

  async getCorrespondenceIdsActedOnByDept(deptId: number, actions: string[]): Promise<number[]> {
    if (actions.length === 0) return [];
    const placeholders = actions.map(() => "?").join(",");
    const rows = this.db.prepare(`
      SELECT DISTINCT correspondence_id FROM workflow_events WHERE from_department_id = ? AND action IN (${placeholders})
    `).all(deptId, ...actions) as any[];
    return rows.map(r => r.correspondence_id).filter(v => v !== null);
  }

  async getCorrespondenceIdsWithReplies(): Promise<number[]> {
    const rows = this.db.prepare(`
      SELECT DISTINCT parent_correspondence_id as parentId FROM correspondence WHERE parent_correspondence_id IS NOT NULL AND (is_deleted = 0 OR is_deleted IS NULL)
    `).all() as any[];
    return rows.map(r => r.parentId).filter(v => v !== null);
  }

  // --- Leave Requests ---
  async getLeaveRequests(): Promise<LeaveRequest[]> {
    const rows = this.db.prepare("SELECT * FROM leave_requests ORDER BY created_at DESC").all() as any[];
    return rows.map(r => ({
      id: r.id,
      employeeId: r.employee_id,
      leaveType: r.leave_type || r.type,
      startDate: r.start_date ? new Date(r.start_date) : new Date(),
      endDate: r.end_date ? new Date(r.end_date) : new Date(),
      daysCount: r.days_count,
      reason: r.reason,
      status: r.status,
      approvedById: r.approved_by_id,
      notes: r.notes ?? null,
      createdAt: r.created_at ? new Date(r.created_at) : new Date(),
      updatedAt: r.updated_at ? new Date(r.updated_at) : new Date(),
    }));
  }

  async getLeaveRequestsByEmployee(employeeId: number): Promise<LeaveRequest[]> {
    const rows = this.db.prepare("SELECT * FROM leave_requests WHERE employee_id = ? ORDER BY created_at DESC").all(employeeId) as any[];
    return rows.map(r => ({
      id: r.id,
      employeeId: r.employee_id,
      leaveType: r.leave_type || r.type,
      startDate: r.start_date ? new Date(r.start_date) : new Date(),
      endDate: r.end_date ? new Date(r.end_date) : new Date(),
      daysCount: r.days_count,
      reason: r.reason,
      status: r.status,
      approvedById: r.approved_by_id,
      notes: r.notes ?? null,
      createdAt: r.created_at ? new Date(r.created_at) : new Date(),
      updatedAt: r.updated_at ? new Date(r.updated_at) : new Date(),
    }));
  }

  async createLeaveRequest(data: InsertLeaveRequest): Promise<LeaveRequest> {
    const stmt = this.db.prepare(`
      INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, days_count, reason, status, approved_by_id, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `);
    const row = stmt.get(
      data.employeeId,
      data.leaveType,
      data.startDate instanceof Date ? data.startDate.toISOString() : String(data.startDate),
      data.endDate instanceof Date ? data.endDate.toISOString() : String(data.endDate),
      data.daysCount ?? null,
      data.reason || null,
      data.status || "pending",
      data.approvedById || null,
      data.notes || null
    ) as any;
    return {
      id: row.id,
      employeeId: row.employee_id,
      leaveType: row.leave_type,
      startDate: row.start_date ? new Date(row.start_date) : new Date(),
      endDate: row.end_date ? new Date(row.end_date) : new Date(),
      daysCount: row.days_count,
      reason: row.reason,
      status: row.status,
      approvedById: row.approved_by_id,
      notes: row.notes ?? null,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
      updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
    };
  }

  async updateLeaveRequestStatus(id: number, status: string, approvedById?: number): Promise<LeaveRequest | undefined> {
    const stmt = this.db.prepare("UPDATE leave_requests SET status = ?, approved_by_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? RETURNING *");
    const row = stmt.get(status, approvedById || null, id) as any;
    if (!row) return undefined;
    return {
      id: row.id,
      employeeId: row.employee_id,
      leaveType: row.leave_type,
      startDate: row.start_date ? new Date(row.start_date) : new Date(),
      endDate: row.end_date ? new Date(row.end_date) : new Date(),
      daysCount: row.days_count,
      reason: row.reason,
      status: row.status,
      approvedById: row.approved_by_id,
      notes: row.notes ?? null,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
      updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
    };
  }

  // --- Password Reset Requests ---
  async getPasswordResetRequests(): Promise<PasswordResetRequest[]> {
    const rows = this.db.prepare("SELECT * FROM password_reset_requests ORDER BY created_at DESC").all() as any[];
    return rows.map(r => ({
      id: r.id,
      employeeId: r.employee_id || 0,
      username: r.username,
      employeeName: r.employee_name,
      companyNumber: r.company_number,
      mobilePhone: r.mobile_phone,
      landlinePhone: r.landline_phone,
      status: r.status,
      processedById: r.processed_by_id,
      processedAt: r.processed_at ? new Date(r.processed_at) : null,
      notes: r.notes ?? null,
      createdAt: r.created_at ? new Date(r.created_at) : new Date(),
    }));
  }

  async getPasswordResetRequest(id: number): Promise<PasswordResetRequest | undefined> {
    const row = this.db.prepare("SELECT * FROM password_reset_requests WHERE id = ?").get(id) as any;
    if (!row) return undefined;
    return {
      id: row.id,
      employeeId: row.employee_id || 0,
      username: row.username,
      employeeName: row.employee_name,
      companyNumber: row.company_number,
      mobilePhone: row.mobile_phone,
      landlinePhone: row.landline_phone,
      status: row.status,
      processedById: row.processed_by_id,
      processedAt: row.processed_at ? new Date(row.processed_at) : null,
      notes: row.notes ?? null,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    };
  }

  async createPasswordResetRequest(data: InsertPasswordResetRequest): Promise<PasswordResetRequest> {
    const stmt = this.db.prepare(`
      INSERT INTO password_reset_requests (employee_id, username, employee_name, company_number, mobile_phone, landline_phone, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `);
    const row = stmt.get(
      data.employeeId,
      data.username,
      data.employeeName,
      data.companyNumber || null,
      data.mobilePhone || null,
      data.landlinePhone || null,
      data.status || "pending",
      data.notes || null
    ) as any;
    return {
      id: row.id,
      employeeId: row.employee_id,
      username: row.username,
      employeeName: row.employee_name,
      companyNumber: row.company_number,
      mobilePhone: row.mobile_phone,
      landlinePhone: row.landline_phone,
      status: row.status,
      processedById: row.processed_by_id,
      processedAt: row.processed_at ? new Date(row.processed_at) : null,
      notes: row.notes ?? null,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    };
  }

  async updatePasswordResetRequest(id: number, data: Partial<PasswordResetRequest>): Promise<PasswordResetRequest | undefined> {
    const fields: string[] = [];
    const values: any[] = [];
    if (data.status !== undefined) { fields.push("status = ?"); values.push(data.status); }
    if (data.notes !== undefined) { fields.push("notes = ?"); values.push(data.notes); }
    if (data.processedById !== undefined) { fields.push("processed_by_id = ?"); values.push(data.processedById); }
    if (data.processedAt !== undefined) { fields.push("processed_at = ?"); values.push(data.processedAt ? (data.processedAt instanceof Date ? data.processedAt.toISOString() : String(data.processedAt)) : null); }
    if (fields.length === 0) return this.getPasswordResetRequest(id);

    values.push(id);
    const stmt = this.db.prepare(`UPDATE password_reset_requests SET ${fields.join(", ")} WHERE id = ? RETURNING *`);
    const row = stmt.get(...values) as any;
    if (!row) return undefined;
    return {
      id: row.id,
      employeeId: row.employee_id,
      username: row.username,
      employeeName: row.employee_name,
      companyNumber: row.company_number,
      mobilePhone: row.mobile_phone,
      landlinePhone: row.landline_phone,
      status: row.status,
      processedById: row.processed_by_id,
      processedAt: row.processed_at ? new Date(row.processed_at) : null,
      notes: row.notes ?? null,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    };
  }

  // --- Settings ---
  async getSystemSettings(): Promise<SystemSetting[]> {
    const rows = this.db.prepare("SELECT * FROM system_settings").all();
    return rows.map(mapSystemSetting);
  }

  async getSystemSetting(key: string): Promise<SystemSetting | undefined> {
    const row = this.db.prepare("SELECT * FROM system_settings WHERE key = ?").get(key);
    return row ? mapSystemSetting(row) : undefined;
  }

  async upsertSystemSetting(key: string, value: string, updatedById?: number): Promise<SystemSetting> {
    const stmt = this.db.prepare(`
      INSERT INTO system_settings (key, value, updated_by_id, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_by_id = excluded.updated_by_id, updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `);
    const row = stmt.get(key, value, updatedById || null);
    return mapSystemSetting(row);
  }

  // --- Notifications ---
  async createNotification(data: InsertSystemNotification): Promise<SystemNotification> {
    const stmt = this.db.prepare(`
      INSERT INTO system_notifications (message, target_type, sent_by_id, category, related_entity_id, related_entity_type)
      VALUES (?, ?, ?, ?, ?, ?)
      RETURNING *
    `);
    const row = stmt.get(
      data.message,
      data.targetType,
      data.sentById ?? null,
      data.category ?? "system",
      data.relatedEntityId ?? null,
      data.relatedEntityType ?? null
    ) as any;
    return {
      id: row.id,
      message: row.message || "",
      targetType: row.target_type || "all",
      sentById: row.sent_by_id || null,
      category: row.category || "system",
      relatedEntityId: row.related_entity_id || null,
      relatedEntityType: row.related_entity_type || null,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    };
  }

  async createNotificationRecipients(notificationId: number, employeeIds: number[]): Promise<void> {
    if (employeeIds.length === 0) return;
    const stmt = this.db.prepare("INSERT INTO notification_recipients (notification_id, employee_id) VALUES (?, ?)");
    for (const eid of employeeIds) {
      stmt.run(notificationId, eid);
    }
  }

  async getNotificationsForEmployee(employeeId: number): Promise<any[]> {
    const rows = this.db.prepare(`
      SELECT nr.id, nr.notification_id as notificationId, nr.is_read as isRead, nr.read_at as readAt,
             sn.message, sn.target_type as targetType, sn.sent_by_id as sentById, sn.category,
             sn.related_entity_id as relatedEntityId, sn.related_entity_type as relatedEntityType, sn.created_at as createdAt
      FROM notification_recipients nr
      JOIN system_notifications sn ON nr.notification_id = sn.id
      WHERE nr.employee_id = ?
      ORDER BY nr.id DESC
    `).all(employeeId) as any[];

    return rows.map(r => ({
      ...r,
      isRead: numToBool(r.isRead),
    }));
  }

  async getUnreadNotificationCount(employeeId: number): Promise<number> {
    const row = this.db.prepare("SELECT count(*) as count FROM notification_recipients WHERE employee_id = ? AND is_read = 0").get(employeeId) as any;
    return row?.count || 0;
  }

  async markNotificationRead(notificationId: number, employeeId: number): Promise<void> {
    this.db.prepare("UPDATE notification_recipients SET is_read = 1, read_at = CURRENT_TIMESTAMP WHERE notification_id = ? AND employee_id = ?").run(notificationId, employeeId);
  }

  async markAllNotificationsRead(employeeId: number): Promise<void> {
    this.db.prepare("UPDATE notification_recipients SET is_read = 1, read_at = CURRENT_TIMESTAMP WHERE employee_id = ? AND is_read = 0").run(employeeId);
  }

  // --- External Entities ---
  async getExternalEntities(): Promise<ExternalEntity[]> {
    const rows = this.db.prepare("SELECT * FROM external_entities ORDER BY name ASC").all() as any[];
    return rows.map(r => ({
      id: r.id,
      name: r.name,
      createdAt: r.created_at ? new Date(r.created_at) : new Date(),
    }));
  }

  async getExternalEntity(id: number): Promise<ExternalEntity | undefined> {
    const row = this.db.prepare("SELECT * FROM external_entities WHERE id = ?").get(id) as any;
    if (!row) return undefined;
    return {
      id: row.id,
      name: row.name,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    };
  }

  async getExternalEntityByName(name: string): Promise<ExternalEntity | undefined> {
    const row = this.db.prepare("SELECT * FROM external_entities WHERE name = ?").get(name) as any;
    if (!row) return undefined;
    return {
      id: row.id,
      name: row.name,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    };
  }

  async createExternalEntity(data: InsertExternalEntity): Promise<ExternalEntity> {
    const stmt = this.db.prepare("INSERT INTO external_entities (name) VALUES (?) RETURNING *");
    const row = stmt.get(data.name) as any;
    return {
      id: row.id,
      name: row.name,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    };
  }

  async createExternalCC(data: InsertExternalCorrespondenceCC): Promise<ExternalCorrespondenceCC> {
    const stmt = this.db.prepare("INSERT INTO external_correspondence_ccs (correspondence_id, external_entity_id, reason) VALUES (?, ?, ?) RETURNING *");
    const row = stmt.get(data.correspondenceId, data.externalEntityId, data.reason || null) as any;
    return {
      id: row.id,
      correspondenceId: row.correspondence_id,
      externalEntityId: row.external_entity_id,
      reason: row.reason,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    };
  }

  async getExternalCCsByCorrespondence(correspondenceId: number): Promise<any[]> {
    const rows = this.db.prepare("SELECT * FROM external_correspondence_ccs WHERE correspondence_id = ?").all(correspondenceId) as any[];
    const result = [];
    for (const r of rows) {
      const entity = await this.getExternalEntity(r.external_entity_id);
      result.push({
        id: r.id,
        correspondenceId: r.correspondence_id,
        externalEntityId: r.external_entity_id,
        reason: r.reason,
        createdAt: r.created_at ? new Date(r.created_at) : new Date(),
        externalEntity: entity,
      });
    }
    return result;
  }

  // --- Flow Templates ---
  async getFlowTemplates(): Promise<FlowTemplate[]> {
    const rows = this.db.prepare("SELECT * FROM flow_templates ORDER BY id ASC").all() as any[];
    return rows.map(r => ({
      id: r.id,
      name: r.name,
      correspondenceType: r.correspondence_type,
      levels: r.levels ? JSON.parse(r.levels) : [],
      isActive: numToBool(r.is_active),
      createdById: r.created_by_id ?? null,
      createdAt: r.created_at ? new Date(r.created_at) : new Date(),
    }));
  }

  async getFlowTemplate(id: number): Promise<FlowTemplate | undefined> {
    const row = this.db.prepare("SELECT * FROM flow_templates WHERE id = ?").get(id) as any;
    if (!row) return undefined;
    return {
      id: row.id,
      name: row.name,
      correspondenceType: row.correspondence_type,
      levels: row.levels ? JSON.parse(row.levels) : [],
      isActive: numToBool(row.is_active),
      createdById: row.created_by_id ?? null,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    };
  }

  async createFlowTemplate(data: InsertFlowTemplate): Promise<FlowTemplate> {
    const stmt = this.db.prepare("INSERT INTO flow_templates (name, correspondence_type, levels, is_active, created_by_id) VALUES (?, ?, ?, ?, ?) RETURNING *");
    const row = stmt.get(
      data.name,
      data.correspondenceType,
      JSON.stringify(data.levels),
      boolToNum(data.isActive ?? true),
      data.createdById ?? null
    ) as any;
    return {
      id: row.id,
      name: row.name,
      correspondenceType: row.correspondence_type,
      levels: row.levels ? JSON.parse(row.levels) : [],
      isActive: numToBool(row.is_active),
      createdById: row.created_by_id ?? null,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    };
  }

  async updateFlowTemplate(id: number, data: Partial<FlowTemplate>): Promise<FlowTemplate | undefined> {
    const fields: string[] = [];
    const values: any[] = [];
    if (data.name !== undefined) { fields.push("name = ?"); values.push(data.name); }
    if (data.correspondenceType !== undefined) { fields.push("correspondence_type = ?"); values.push(data.correspondenceType); }
    if (data.levels !== undefined) { fields.push("levels = ?"); values.push(JSON.stringify(data.levels)); }
    if (data.isActive !== undefined) { fields.push("is_active = ?"); values.push(boolToNum(data.isActive)); }
    if (data.createdById !== undefined) { fields.push("created_by_id = ?"); values.push(data.createdById); }
    if (fields.length === 0) return this.getFlowTemplate(id);

    values.push(id);
    const stmt = this.db.prepare(`UPDATE flow_templates SET ${fields.join(", ")} WHERE id = ? RETURNING *`);
    const row = stmt.get(...values) as any;
    if (!row) return undefined;
    return {
      id: row.id,
      name: row.name,
      correspondenceType: row.correspondence_type,
      levels: row.levels ? JSON.parse(row.levels) : [],
      isActive: numToBool(row.is_active),
      createdById: row.created_by_id ?? null,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    };
  }

  async deleteFlowTemplate(id: number): Promise<boolean> {
    this.db.prepare("DELETE FROM flow_template_groups WHERE flow_template_id = ?").run(id);
    const res = this.db.prepare("DELETE FROM flow_templates WHERE id = ?").run(id);
    return res.changes > 0;
  }

  async getFlowTemplateGroups(flowTemplateId: number): Promise<FlowTemplateGroup[]> {
    const rows = this.db.prepare("SELECT * FROM flow_template_groups WHERE flow_template_id = ? ORDER BY id ASC").all(flowTemplateId) as any[];
    return rows.map(r => ({
      id: r.id,
      flowTemplateId: r.flow_template_id,
      accounts: r.accounts ? JSON.parse(r.accounts) : [],
      isActive: numToBool(r.is_active),
      createdAt: r.created_at ? new Date(r.created_at) : new Date(),
    }));
  }

  async getFlowTemplateGroup(id: number): Promise<FlowTemplateGroup | undefined> {
    const row = this.db.prepare("SELECT * FROM flow_template_groups WHERE id = ?").get(id) as any;
    if (!row) return undefined;
    return {
      id: row.id,
      flowTemplateId: row.flow_template_id,
      accounts: row.accounts ? JSON.parse(row.accounts) : [],
      isActive: numToBool(row.is_active),
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    };
  }

  async createFlowTemplateGroup(data: InsertFlowTemplateGroup): Promise<FlowTemplateGroup> {
    const stmt = this.db.prepare("INSERT INTO flow_template_groups (flow_template_id, accounts, is_active) VALUES (?, ?, ?) RETURNING *");
    const row = stmt.get(
      data.flowTemplateId,
      JSON.stringify(data.accounts),
      boolToNum(data.isActive ?? true)
    ) as any;
    return {
      id: row.id,
      flowTemplateId: row.flow_template_id,
      accounts: row.accounts ? JSON.parse(row.accounts) : [],
      isActive: numToBool(row.is_active),
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    };
  }

  async updateFlowTemplateGroup(id: number, data: Partial<InsertFlowTemplateGroup>): Promise<FlowTemplateGroup | undefined> {
    const fields: string[] = [];
    const values: any[] = [];
    if (data.accounts !== undefined) { fields.push("accounts = ?"); values.push(JSON.stringify(data.accounts)); }
    if (data.isActive !== undefined) { fields.push("is_active = ?"); values.push(boolToNum(data.isActive)); }
    if (fields.length === 0) return this.getFlowTemplateGroup(id);

    values.push(id);
    const stmt = this.db.prepare(`UPDATE flow_template_groups SET ${fields.join(", ")} WHERE id = ? RETURNING *`);
    const row = stmt.get(...values) as any;
    if (!row) return undefined;
    return {
      id: row.id,
      flowTemplateId: row.flow_template_id,
      accounts: row.accounts ? JSON.parse(row.accounts) : [],
      isActive: numToBool(row.is_active),
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    };
  }

  async deleteFlowTemplateGroup(id: number): Promise<boolean> {
    const res = this.db.prepare("DELETE FROM flow_template_groups WHERE id = ?").run(id);
    return res.changes > 0;
  }

  async getFlowTemplatesForEmployee(employeeId: number): Promise<any[]> {
    const allTemplates = await this.getFlowTemplates();
    const result: any[] = [];
    for (const template of allTemplates) {
      if (!template.isActive) continue;
      const groups = await this.getFlowTemplateGroups(template.id);
      for (const group of groups) {
        if (!group.isActive) continue;
        const emp = await this.getEmployee(employeeId);
        const deptId = emp?.departmentId;
        if (deptId && group.accounts && group.accounts.includes(deptId)) {
          result.push({ ...template, groupId: group.id, position: group.accounts.indexOf(deptId), groupAccounts: group.accounts });
          break;
        }
      }
    }
    return result;
  }

  async getNextSequenceNumber(counterType: string, departmentId: number | null, startValue: number = 1): Promise<number> {
    const currentYear = new Date().getFullYear();
    const existing = this.db.prepare(`
      SELECT * FROM correspondence_counters
      WHERE counter_type = ? AND (department_id = ? OR (department_id IS NULL AND ? IS NULL)) AND year = ?
    `).get(counterType, departmentId, departmentId, currentYear) as any;

    if (existing) {
      const nextVal = existing.current_value + 1;
      this.db.prepare("UPDATE correspondence_counters SET current_value = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(nextVal, existing.id);
      return nextVal;
    } else {
      this.db.prepare("INSERT INTO correspondence_counters (counter_type, department_id, year, current_value) VALUES (?, ?, ?, ?)").run(counterType, departmentId, currentYear, startValue);
      return startValue;
    }
  }

  async getOverdueCorrespondence(): Promise<Correspondence[]> {
    const now = new Date().toISOString();
    const rows = this.db.prepare(`
      SELECT * FROM correspondence
      WHERE requires_reply = 1 AND closed_at IS NULL AND reminder_date IS NOT NULL AND reminder_date <= ? AND status NOT IN ('draft', 'cancelled')
    `).all(now);
    return rows.map(mapCorrespondence);
  }

  // --- Deletion Requests ---
  async createDeletionRequest(data: InsertDeletionRequest): Promise<DeletionRequest> {
    const stmt = this.db.prepare(`
      INSERT INTO deletion_requests (correspondence_id, requested_by_id, requested_department_id, reason, status)
      VALUES (?, ?, ?, ?, ?)
      RETURNING *
    `);
    const row = stmt.get(
      data.correspondenceId,
      data.requestedById,
      data.requestedDepartmentId,
      data.reason,
      data.status || "pending"
    ) as any;
    return {
      id: row.id,
      correspondenceId: row.correspondence_id,
      requestedById: row.requested_by_id,
      requestedDepartmentId: row.requested_department_id,
      reason: row.reason,
      status: row.status,
      adminNotes: row.admin_notes,
      processedById: row.processed_by_id,
      processedAt: row.processed_at ? new Date(row.processed_at) : null,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    };
  }

  async getDeletionRequests(status?: string): Promise<DeletionRequest[]> {
    let sql = "SELECT * FROM deletion_requests";
    const values: any[] = [];
    if (status) { sql += " WHERE status = ?"; values.push(status); }
    sql += " ORDER BY created_at DESC";

    const rows = this.db.prepare(sql).all(...values) as any[];
    return rows.map(r => ({
      id: r.id,
      correspondenceId: r.correspondence_id,
      requestedById: r.requested_by_id,
      requestedDepartmentId: r.requested_department_id,
      reason: r.reason,
      status: r.status,
      adminNotes: r.admin_notes,
      processedById: r.processed_by_id,
      processedAt: r.processed_at ? new Date(r.processed_at) : null,
      createdAt: r.created_at ? new Date(r.created_at) : new Date(),
    }));
  }

  async getDeletionRequest(id: number): Promise<DeletionRequest | undefined> {
    const row = this.db.prepare("SELECT * FROM deletion_requests WHERE id = ?").get(id) as any;
    if (!row) return undefined;
    return {
      id: row.id,
      correspondenceId: row.correspondence_id,
      requestedById: row.requested_by_id,
      requestedDepartmentId: row.requested_department_id,
      reason: row.reason,
      status: row.status,
      adminNotes: row.admin_notes,
      processedById: row.processed_by_id,
      processedAt: row.processed_at ? new Date(row.processed_at) : null,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    };
  }

  async getDeletionRequestByCorrespondenceId(correspondenceId: number): Promise<DeletionRequest | undefined> {
    const row = this.db.prepare("SELECT * FROM deletion_requests WHERE correspondence_id = ? AND status = 'pending'").get(correspondenceId) as any;
    if (!row) return undefined;
    return {
      id: row.id,
      correspondenceId: row.correspondence_id,
      requestedById: row.requested_by_id,
      requestedDepartmentId: row.requested_department_id,
      reason: row.reason,
      status: row.status,
      adminNotes: row.admin_notes,
      processedById: row.processed_by_id,
      processedAt: row.processed_at ? new Date(row.processed_at) : null,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    };
  }

  async updateDeletionRequest(id: number, data: Partial<DeletionRequest>): Promise<DeletionRequest | undefined> {
    const fields: string[] = [];
    const values: any[] = [];
    if (data.status !== undefined) { fields.push("status = ?"); values.push(data.status); }
    if (data.adminNotes !== undefined) { fields.push("admin_notes = ?"); values.push(data.adminNotes); }
    if (data.processedById !== undefined) { fields.push("processed_by_id = ?"); values.push(data.processedById); }
    if (data.processedAt !== undefined) { fields.push("processed_at = ?"); values.push(data.processedAt ? (data.processedAt instanceof Date ? data.processedAt.toISOString() : String(data.processedAt)) : null); }
    if (fields.length === 0) return this.getDeletionRequest(id);

    values.push(id);
    const stmt = this.db.prepare(`UPDATE deletion_requests SET ${fields.join(", ")} WHERE id = ? RETURNING *`);
    const row = stmt.get(...values) as any;
    if (!row) return undefined;
    return {
      id: row.id,
      correspondenceId: row.correspondence_id,
      requestedById: row.requested_by_id,
      requestedDepartmentId: row.requested_department_id,
      reason: row.reason,
      status: row.status,
      adminNotes: row.admin_notes,
      processedById: row.processed_by_id,
      processedAt: row.processed_at ? new Date(row.processed_at) : null,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    };
  }
}
