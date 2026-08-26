import { db } from "./db";
import { departments, correspondence, employees, systemSettings, permissions } from "@shared/schema";
import { sql } from "drizzle-orm";
import bcrypt from "bcryptjs";

async function runMigrations() {
  try {
    await db.execute(sql`ALTER TABLE employees ADD COLUMN IF NOT EXISTS signature_url TEXT`);
    await db.execute(sql`ALTER TABLE correspondence_ccs ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT FALSE`);
    await db.execute(sql`ALTER TABLE employees ADD COLUMN IF NOT EXISTS can_access_correspondence BOOLEAN DEFAULT TRUE`);
    await db.execute(sql`ALTER TABLE employees ADD COLUMN IF NOT EXISTS can_access_leave_requests BOOLEAN DEFAULT TRUE`);
    await db.execute(sql`ALTER TABLE employees ADD COLUMN IF NOT EXISTS can_access_service_requests BOOLEAN DEFAULT TRUE`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS correspondence_counters (
        id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        counter_type TEXT NOT NULL,
        department_id INTEGER,
        year INTEGER NOT NULL,
        current_value INTEGER NOT NULL DEFAULT 0,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_correspondence_counters_unique
      ON correspondence_counters (counter_type, COALESCE(department_id, 0), year)
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS external_entities (
        id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        name TEXT NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS external_correspondence_ccs (
        id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        correspondence_id INTEGER NOT NULL,
        external_entity_id INTEGER NOT NULL,
        reason TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await db.execute(sql`ALTER TABLE correspondence ADD COLUMN IF NOT EXISTS requires_reply BOOLEAN DEFAULT FALSE`);
    await db.execute(sql`ALTER TABLE correspondence ADD COLUMN IF NOT EXISTS reminder_date TIMESTAMP`);
    await db.execute(sql`ALTER TABLE correspondence ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP`);
    await db.execute(sql`ALTER TABLE correspondence ADD COLUMN IF NOT EXISTS closed_by_id INTEGER`);

    try {
      await db.execute(sql`ALTER TYPE role ADD VALUE IF NOT EXISTS 'central_mail'`);
    } catch (e) { /* already exists */ }
    try {
      await db.execute(sql`ALTER TYPE workflow_action ADD VALUE IF NOT EXISTS 'return_to_central_mail'`);
    } catch (e) { /* already exists */ }
    await db.execute(sql`ALTER TABLE employees ADD COLUMN IF NOT EXISTS can_receive_external_incoming BOOLEAN DEFAULT FALSE`);
    await db.execute(sql`ALTER TABLE correspondence ADD COLUMN IF NOT EXISTS central_mail_assigned_by_id INTEGER`);
  } catch (e) {
    console.log("Migration check completed");
  }
}

export async function seedDatabase() {
  await runMigrations();

  const existing = await db.select().from(departments).limit(1);
  if (existing.length > 0) return;

  console.log("Seeding database with شركة نفط الوسط organizational structure...");

  const gmDept = await insertDept({ name: "مكتب المدير العام", nameEn: "General Manager Office", level: "general_manager", code: "GM", canCorrespondExternally: true });

  const assistantTech = await insertDept({ name: "معاون المدير العام للشؤون الفنية", nameEn: "Assistant GM Technical Affairs", level: "assistant", parentId: gmDept.id, code: "AGM-T" });
  const assistantAdmin = await insertDept({ name: "معاون المدير العام للشؤون الإدارية", nameEn: "Assistant GM Administrative Affairs", level: "assistant", parentId: gmDept.id, code: "AGM-A" });

  const legal = await insertDept({ name: "الهيئة القانونية", nameEn: "Legal Directorate", level: "directorate", parentId: gmDept.id, code: "LEG", isCentral: true, canCorrespondExternally: true });
  const inspection = await insertDept({ name: "هيئة التفتيش والرقابة الداخلية", nameEn: "Inspection & Internal Audit", level: "directorate", parentId: gmDept.id, code: "INS", isCentral: true });
  const planningDir = await insertDept({ name: "هيئة التخطيط والمتابعة", nameEn: "Planning & Follow-up", level: "directorate", parentId: gmDept.id, code: "PLN", isCentral: true });
  const mediaSection = await insertDept({ name: "قسم الإعلام والعلاقات العامة", nameEn: "Media & Public Relations", level: "section", parentId: gmDept.id, code: "MED", isCentral: true });
  const securitySection = await insertDept({ name: "قسم الأمن والحماية", nameEn: "Security & Protection", level: "section", parentId: gmDept.id, code: "SEC", isCentral: true });
  const envSection = await insertDept({ name: "قسم البيئة والسلامة", nameEn: "Environment & Safety", level: "section", parentId: gmDept.id, code: "ENV", isCentral: true });

  const techOps = await insertDept({ name: "هيئة العمليات والإنتاج", nameEn: "Operations & Production", level: "directorate", parentId: assistantTech.id, code: "OPS" });
  const drillingDir = await insertDept({ name: "هيئة الحفر", nameEn: "Drilling Directorate", level: "directorate", parentId: assistantTech.id, code: "DRL" });
  const projectsDir = await insertDept({ name: "هيئة المشاريع", nameEn: "Projects Directorate", level: "directorate", parentId: assistantTech.id, code: "PRJ" });
  const geologyDir = await insertDept({ name: "هيئة الجيولوجيا والمكامن", nameEn: "Geology & Reservoirs", level: "directorate", parentId: assistantTech.id, code: "GEO" });

  const opsSection1 = await insertDept({ name: "قسم العمليات النفطية", nameEn: "Oil Operations Section", level: "section", parentId: techOps.id, code: "OPS-1" });
  const opsSection2 = await insertDept({ name: "قسم الإنتاج", nameEn: "Production Section", level: "section", parentId: techOps.id, code: "OPS-2" });
  const opsDivision1 = await insertDept({ name: "شعبة الصيانة الميدانية", nameEn: "Field Maintenance Division", level: "division", parentId: opsSection1.id, code: "OPS-1-1" });
  await insertDept({ name: "وحدة المراقبة والتحكم", nameEn: "Monitoring & Control Unit", level: "unit", parentId: opsDivision1.id, code: "OPS-1-1-1" });

  const drillSection = await insertDept({ name: "قسم عمليات الحفر", nameEn: "Drilling Operations", level: "section", parentId: drillingDir.id, code: "DRL-1" });
  await insertDept({ name: "شعبة معدات الحفر", nameEn: "Drilling Equipment", level: "division", parentId: drillSection.id, code: "DRL-1-1" });

  await insertDept({ name: "قسم التصاميم الهندسية", nameEn: "Engineering Design", level: "section", parentId: projectsDir.id, code: "PRJ-1" });
  await insertDept({ name: "قسم تنفيذ المشاريع", nameEn: "Project Execution", level: "section", parentId: projectsDir.id, code: "PRJ-2" });

  await insertDept({ name: "قسم الجيولوجيا", nameEn: "Geology Section", level: "section", parentId: geologyDir.id, code: "GEO-1" });
  await insertDept({ name: "قسم المكامن", nameEn: "Reservoirs Section", level: "section", parentId: geologyDir.id, code: "GEO-2" });

  const adminHR = await insertDept({ name: "هيئة الشؤون الإدارية والموارد البشرية", nameEn: "Admin & HR Directorate", level: "directorate", parentId: assistantAdmin.id, code: "HR" });
  const financeDir = await insertDept({ name: "هيئة الشؤون المالية", nameEn: "Finance Directorate", level: "directorate", parentId: assistantAdmin.id, code: "FIN" });
  const contractsDir = await insertDept({ name: "هيئة العقود والمشتريات", nameEn: "Contracts & Procurement", level: "directorate", parentId: assistantAdmin.id, code: "CNT" });
  const itSection = await insertDept({ name: "قسم تكنولوجيا المعلومات", nameEn: "IT Section", level: "section", parentId: assistantAdmin.id, code: "IT", isCentral: true });
  await insertDept({ name: "قسم المخازن", nameEn: "Warehousing Section", level: "section", parentId: assistantAdmin.id, code: "WH" });

  const hrSection1 = await insertDept({ name: "قسم شؤون الموظفين", nameEn: "Employee Affairs", level: "section", parentId: adminHR.id, code: "HR-1" });
  await insertDept({ name: "قسم التدريب والتطوير", nameEn: "Training & Development", level: "section", parentId: adminHR.id, code: "HR-2" });
  await insertDept({ name: "شعبة الخدمات الإدارية", nameEn: "Admin Services", level: "division", parentId: hrSection1.id, code: "HR-1-1" });

  const finSection1 = await insertDept({ name: "قسم الحسابات", nameEn: "Accounting", level: "section", parentId: financeDir.id, code: "FIN-1" });
  await insertDept({ name: "قسم الموازنة", nameEn: "Budget Section", level: "section", parentId: financeDir.id, code: "FIN-2" });
  await insertDept({ name: "شعبة الرواتب", nameEn: "Payroll Division", level: "division", parentId: finSection1.id, code: "FIN-1-1" });

  await insertDept({ name: "قسم العقود", nameEn: "Contracts Section", level: "section", parentId: contractsDir.id, code: "CNT-1" });
  await insertDept({ name: "قسم المشتريات", nameEn: "Procurement Section", level: "section", parentId: contractsDir.id, code: "CNT-2" });

  const adminPasswordHash = bcrypt.hashSync("admin1989", 10);
  await db.insert(employees).values({
    username: "admin",
    passwordHash: adminPasswordHash,
    fullName: "مدير النظام",
    role: "admin",
    companyNumber: "0001",
    landlinePhone: "0000000",
    mustChangePassword: true,
  });

  await db.insert(systemSettings).values([
    { key: "orgName", value: "شركة نفط الوسط" },
    { key: "systemName", value: "نظام إدارة المعاملات الإلكتروني" },
    { key: "theme", value: "blue" },
  ]);

  await db.insert(permissions).values([
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
  ]);

  const sampleCorr = [
    {
      type: "internal_outgoing" as const,
      subject: "تعميم بشأن ساعات الدوام الرسمي",
      content: "نود إعلامكم بتعديل ساعات الدوام الرسمي اعتباراً من الشهر القادم",
      status: "issued" as const,
      priority: "high" as const,
      confidentiality: "normal" as const,
      senderDepartmentId: gmDept.id,
      referenceNumber: `GM/1/${new Date().getFullYear()}`,
    },
    {
      type: "internal_outgoing" as const,
      subject: "طلب تقرير شهري عن الإنتاج",
      content: "يرجى تقديم التقرير الشهري عن معدلات الإنتاج",
      status: "issued" as const,
      priority: "medium" as const,
      confidentiality: "normal" as const,
      senderDepartmentId: assistantTech.id,
      receiverDepartmentId: techOps.id,
      referenceNumber: `AGM-T/1/${new Date().getFullYear()}`,
    },
    {
      type: "external_incoming" as const,
      subject: "كتاب وارد من وزارة النفط - تعليمات جديدة",
      content: "بخصوص التعليمات الجديدة الصادرة من الوزارة",
      status: "in_progress" as const,
      priority: "urgent" as const,
      confidentiality: "confidential" as const,
      receiverDepartmentId: gmDept.id,
      externalEntity: "وزارة النفط",
      externalRefNumber: "MOO/2024/1234",
      referenceNumber: `EIN/1/${new Date().getFullYear()}`,
    },
    {
      type: "external_outgoing" as const,
      subject: "رد على وزارة النفط بشأن خطة الإنتاج",
      content: "إلحاقاً بكتابكم المرقم، نرفق لكم خطة الإنتاج المعتمدة",
      status: "approved" as const,
      priority: "high" as const,
      confidentiality: "confidential" as const,
      senderDepartmentId: gmDept.id,
      externalEntity: "وزارة النفط",
      referenceNumber: `GM/EXT/1/${new Date().getFullYear()}`,
    },
    {
      type: "internal_outgoing" as const,
      subject: "توجيه بصيانة معدات الحفر",
      content: "يرجى البدء بصيانة معدات الحفر وفقاً للجدول المرفق",
      status: "draft" as const,
      priority: "medium" as const,
      confidentiality: "normal" as const,
      senderDepartmentId: drillingDir.id,
      receiverDepartmentId: drillSection.id,
    },
  ];

  for (const corr of sampleCorr) {
    await db.insert(correspondence).values(corr);
  }

  console.log("Database seeded successfully with شركة نفط الوسط structure");
}

async function insertDept(data: any) {
  const [dept] = await db.insert(departments).values(data).returning();
  return dept;
}
