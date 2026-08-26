import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, pgEnum, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export * from "./models/auth";

export const departmentLevelEnum = pgEnum("department_level", [
  "general_manager",
  "assistant",
  "directorate",
  "section",
  "division",
  "unit",
]);

export const roleEnum = pgEnum("role", [
  "admin",
  "officer",
  "central_mail",
  "general_manager",
  "assistant",
  "directorate_head",
  "section_head",
  "division_head",
  "unit_head",
  "employee",
]);

export const permissionCategoryEnum = pgEnum("permission_category", [
  "correspondence",
  "personal_requests",
  "work_requests",
  "system_admin",
]);

export const correspondenceTypeEnum = pgEnum("correspondence_type", [
  "internal_outgoing",
  "external_outgoing",
  "internal_incoming",
  "external_incoming",
]);

export const correspondenceStatusEnum = pgEnum("correspondence_status", [
  "draft",
  "under_review",
  "pending_approval",
  "approved",
  "issued",
  "in_progress",
  "completed",
  "archived",
  "cancelled",
]);

export const workflowActionEnum = pgEnum("workflow_action", [
  "create_draft",
  "sign_and_forward",
  "return_for_modification",
  "approve_and_forward",
  "final_approve_and_issue",
  "receive_incoming",
  "route_to_subordinate",
  "add_margin_note",
  "prepare_response",
  "cancel_correspondence",
  "admin_delete",
  "elevate",
  "assign_down",
  "final_sign",
  "close",
  "auto_received",
  "admin_restore",
  "reopen",
  "return_to_central_mail",
  "reply_and_archive",
  "submit_contribution",
  "decline_contribution",
  "request_modification_from_contributor",
]);

export const priorityEnum = pgEnum("priority", ["low", "medium", "high", "urgent"]);

export const confidentialityEnum = pgEnum("confidentiality", ["normal", "confidential", "top_secret"]);

export const leaveTypeEnum = pgEnum("leave_type", ["annual", "sick", "emergency", "unpaid", "maternity", "study", "other"]);

export const leaveStatusEnum = pgEnum("leave_status", ["pending", "approved_by_direct", "approved_by_section", "approved_by_hr", "approved", "rejected", "cancelled"]);

export const serviceTypeEnum = pgEnum("service_type", ["maintenance", "technical", "administrative", "it_support", "cleaning", "stationery", "other"]);

export const serviceStatusEnum = pgEnum("service_status", ["pending", "assigned", "in_progress", "completed", "verified", "rejected", "cancelled"]);

export const permissions = pgTable("permissions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  key: text("key").notNull().unique(),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en"),
  description: text("description"),
  category: permissionCategoryEnum("category").notNull(),
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
});

export const userPermissions = pgTable("user_permissions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  employeeId: integer("employee_id").notNull(),
  permissionId: integer("permission_id").notNull(),
  grantedById: integer("granted_by_id"),
  grantedAt: timestamp("granted_at").defaultNow(),
});

export const userPermissionsRelations = relations(userPermissions, ({ one }) => ({
  employee: one(employees, { fields: [userPermissions.employeeId], references: [employees.id], relationName: "employeePermissions" }),
  permission: one(permissions, { fields: [userPermissions.permissionId], references: [permissions.id] }),
  grantedBy: one(employees, { fields: [userPermissions.grantedById], references: [employees.id], relationName: "grantedPermissions" }),
}));

export const departments = pgTable("departments", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  nameEn: text("name_en"),
  level: departmentLevelEnum("level").notNull().default("unit"),
  isCentral: boolean("is_central").default(false),
  parentId: integer("parent_id"),
  managerId: integer("manager_id"),
  code: text("code"),
  description: text("description"),
  canSendInternalOutgoing: boolean("can_send_internal_outgoing").default(true),
  canSendExternalOutgoing: boolean("can_send_external_outgoing").default(false),
  canReceiveInternalIncoming: boolean("can_receive_internal_incoming").default(true),
  canReceiveExternalIncoming: boolean("can_receive_external_incoming").default(false),
  allowedExternalEntities: text("allowed_external_entities"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const departmentsRelations = relations(departments, ({ one, many }) => ({
  parent: one(departments, { fields: [departments.parentId], references: [departments.id], relationName: "departmentHierarchy" }),
  children: many(departments, { relationName: "departmentHierarchy" }),
}));

export const employees = pgTable("employees", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").default(""),
  username: text("username").unique(),
  passwordHash: text("password_hash"),
  fullName: text("full_name").notNull().default("موظف"),
  departmentId: integer("department_id"),
  jobTitle: text("job_title"),
  employeeNumber: text("employee_number").unique(),
  phone: text("phone"),
  mobilePhone: text("mobile_phone"),
  landlinePhone: text("landline_phone"),
  companyNumber: text("company_number"),
  email: text("email"),
  role: roleEnum("role").default("employee").notNull(),
  isActive: boolean("is_active").default(true),
  leaveBalance: integer("leave_balance").default(30),
  lastLoginAt: timestamp("last_login_at"),
  lastLoginIp: text("last_login_ip"),
  lastLoginLocation: text("last_login_location"),
  mustChangePassword: boolean("must_change_password").default(true),
  signatureUrl: text("signature_url"),
  canAccessCorrespondence: boolean("can_access_correspondence").default(true),
  canAccessLeaveRequests: boolean("can_access_leave_requests").default(true),
  canAccessServiceRequests: boolean("can_access_service_requests").default(true),
  canReceiveExternalIncoming: boolean("can_receive_external_incoming").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const employeesRelations = relations(employees, ({ one, many }) => ({
  department: one(departments, { fields: [employees.departmentId], references: [departments.id] }),
  permissions: many(userPermissions, { relationName: "employeePermissions" }),
}));

export const correspondence = pgTable("correspondence", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  referenceNumber: text("reference_number"),
  type: correspondenceTypeEnum("type").notNull(),
  subject: text("subject").notNull(),
  content: text("content"),
  status: correspondenceStatusEnum("status").default("draft"),
  priority: priorityEnum("priority").default("medium"),
  confidentiality: confidentialityEnum("confidentiality").default("normal"),

  senderDepartmentId: integer("sender_department_id"),
  receiverDepartmentId: integer("receiver_department_id"),
  createdById: integer("created_by_id"),
  assignedToId: integer("assigned_to_id"),
  currentDepartmentId: integer("current_department_id"),

  sendToAll: boolean("send_to_all").default(false),

  externalEntity: text("external_entity"),
  externalRefNumber: text("external_ref_number"),
  externalDate: timestamp("external_date"),
  centralMailAssignedById: integer("central_mail_assigned_by_id"),

  flowTemplateId: integer("flow_template_id"),
  flowTemplateGroupId: integer("flow_template_group_id"),

  parentCorrespondenceId: integer("parent_correspondence_id"),
  contributingDepartmentIds: integer("contributing_department_ids").array(),
  contributionRoutingBatchId: text("contribution_routing_batch_id"),
  marginNotes: text("margin_notes"),
  notes: text("notes"),

  issuedAt: timestamp("issued_at"),
  issuedById: integer("issued_by_id"),

  requiresReply: boolean("requires_reply").default(false),
  reminderDate: timestamp("reminder_date"),
  followUpDays: integer("follow_up_days"),
  closedAt: timestamp("closed_at"),
  closedById: integer("closed_by_id"),

  isDeleted: boolean("is_deleted").default(false),
  deletedAt: timestamp("deleted_at"),
  deletedById: integer("deleted_by_id"),
  deleteReason: text("delete_reason"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const correspondenceRelations = relations(correspondence, ({ one, many }) => ({
  senderDepartment: one(departments, { fields: [correspondence.senderDepartmentId], references: [departments.id], relationName: "senderDept" }),
  receiverDepartment: one(departments, { fields: [correspondence.receiverDepartmentId], references: [departments.id], relationName: "receiverDept" }),
  currentDepartment: one(departments, { fields: [correspondence.currentDepartmentId], references: [departments.id], relationName: "currentDept" }),
  parentCorrespondence: one(correspondence, { fields: [correspondence.parentCorrespondenceId], references: [correspondence.id], relationName: "correspondenceThread" }),
  replies: many(correspondence, { relationName: "correspondenceThread" }),
}));

export const workflowEvents = pgTable("workflow_events", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  correspondenceId: integer("correspondence_id").notNull(),
  action: workflowActionEnum("action").notNull(),
  fromStatus: correspondenceStatusEnum("from_status"),
  toStatus: correspondenceStatusEnum("to_status"),
  performedById: integer("performed_by_id").notNull(),
  fromDepartmentId: integer("from_department_id"),
  toDepartmentId: integer("to_department_id"),
  marginNote: text("margin_note"),
  signature: boolean("signature").default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const workflowEventsRelations = relations(workflowEvents, ({ one }) => ({
  correspondence: one(correspondence, { fields: [workflowEvents.correspondenceId], references: [correspondence.id] }),
  performedBy: one(employees, { fields: [workflowEvents.performedById], references: [employees.id] }),
  fromDepartment: one(departments, { fields: [workflowEvents.fromDepartmentId], references: [departments.id], relationName: "wfFromDept" }),
  toDepartment: one(departments, { fields: [workflowEvents.toDepartmentId], references: [departments.id], relationName: "wfToDept" }),
}));

export const correspondenceAssignments = pgTable("correspondence_assignments", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  correspondenceId: integer("correspondence_id").notNull(),
  departmentId: integer("department_id").notNull(),
  assignedById: integer("assigned_by_id"),
  isLead: boolean("is_lead").default(false),
  isFollowUp: boolean("is_follow_up").default(false),
  followUpDays: integer("follow_up_days"),
  notes: text("notes"),
  status: text("status").default("pending"),
  responseDeadline: timestamp("response_deadline"),
  completedAt: timestamp("completed_at"),
  routingBatchId: text("routing_batch_id"),
  isActiveBatch: boolean("is_active_batch").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const correspondenceContributions = pgTable("correspondence_contributions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  correspondenceId: integer("correspondence_id").notNull(),
  routingBatchId: text("routing_batch_id").notNull(),
  contributingDepartmentId: integer("contributing_department_id").notNull(),
  leadDepartmentId: integer("lead_department_id").notNull(),
  isLead: boolean("is_lead").default(false),
  status: text("status").default("pending"),
  content: text("content"),
  declineReason: text("decline_reason"),
  submittedById: integer("submitted_by_id"),
  submittedAt: timestamp("submitted_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const correspondenceContributionsRelations = relations(correspondenceContributions, ({ one }) => ({
  correspondence: one(correspondence, { fields: [correspondenceContributions.correspondenceId], references: [correspondence.id] }),
  contributingDepartment: one(departments, { fields: [correspondenceContributions.contributingDepartmentId], references: [departments.id], relationName: "contribDept" }),
  leadDepartment: one(departments, { fields: [correspondenceContributions.leadDepartmentId], references: [departments.id], relationName: "contribLeadDept" }),
  submittedBy: one(employees, { fields: [correspondenceContributions.submittedById], references: [employees.id] }),
}));

export const correspondenceAssignmentsRelations = relations(correspondenceAssignments, ({ one }) => ({
  correspondence: one(correspondence, { fields: [correspondenceAssignments.correspondenceId], references: [correspondence.id] }),
  department: one(departments, { fields: [correspondenceAssignments.departmentId], references: [departments.id] }),
  assignedBy: one(employees, { fields: [correspondenceAssignments.assignedById], references: [employees.id] }),
}));

export const correspondenceCCs = pgTable("correspondence_ccs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  correspondenceId: integer("correspondence_id").notNull(),
  departmentId: integer("department_id").notNull(),
  reason: text("reason"),
  isAutomatic: boolean("is_automatic").default(false),
  isHidden: boolean("is_hidden").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const externalEntities = pgTable("external_entities", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const externalCorrespondenceCCs = pgTable("external_correspondence_ccs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  correspondenceId: integer("correspondence_id").notNull(),
  externalEntityId: integer("external_entity_id").notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const externalCorrespondenceCCsRelations = relations(externalCorrespondenceCCs, ({ one }) => ({
  correspondence: one(correspondence, { fields: [externalCorrespondenceCCs.correspondenceId], references: [correspondence.id] }),
  externalEntity: one(externalEntities, { fields: [externalCorrespondenceCCs.externalEntityId], references: [externalEntities.id] }),
}));

export const correspondenceAttachments = pgTable("correspondence_attachments", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  correspondenceId: integer("correspondence_id").notNull(),
  fileName: text("file_name").notNull(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  fileSize: integer("file_size").notNull(),
  description: text("description").notNull(),
  uploadedById: integer("uploaded_by_id").notNull(),
  contributionId: integer("contribution_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const correspondenceAttachmentsRelations = relations(correspondenceAttachments, ({ one }) => ({
  correspondence: one(correspondence, { fields: [correspondenceAttachments.correspondenceId], references: [correspondence.id] }),
  uploadedBy: one(employees, { fields: [correspondenceAttachments.uploadedById], references: [employees.id] }),
}));

export const auditLog = pgTable("audit_log", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id").notNull(),
  action: text("action").notNull(),
  performedById: integer("performed_by_id"),
  employeeId: integer("employee_id"),
  ipAddress: text("ip_address"),
  module: text("module"),
  details: text("details"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const passwordResetRequests = pgTable("password_reset_requests", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  employeeId: integer("employee_id").notNull(),
  username: text("username").notNull(),
  employeeName: text("employee_name").notNull(),
  companyNumber: text("company_number"),
  mobilePhone: text("mobile_phone"),
  landlinePhone: text("landline_phone"),
  status: text("status").default("pending"),
  processedById: integer("processed_by_id"),
  processedAt: timestamp("processed_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const systemSettings = pgTable("system_settings", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  key: text("key").notNull().unique(),
  value: text("value"),
  updatedAt: timestamp("updated_at").defaultNow(),
  updatedById: integer("updated_by_id"),
});

export const correspondenceCounters = pgTable("correspondence_counters", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  counterType: text("counter_type").notNull(),
  departmentId: integer("department_id"),
  year: integer("year").notNull(),
  currentValue: integer("current_value").notNull().default(0),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const leaveRequests = pgTable("leave_requests", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  employeeId: integer("employee_id").notNull(),
  leaveType: leaveTypeEnum("leave_type").notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  daysCount: integer("days_count"),
  reason: text("reason"),
  status: leaveStatusEnum("status").default("pending"),
  approvedById: integer("approved_by_id"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const leaveRequestsRelations = relations(leaveRequests, ({ one }) => ({
  employee: one(employees, { fields: [leaveRequests.employeeId], references: [employees.id], relationName: "leaveEmployee" }),
  approvedBy: one(employees, { fields: [leaveRequests.approvedById], references: [employees.id], relationName: "leaveApprover" }),
}));

export const serviceRequests = pgTable("service_requests", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  requestNumber: text("request_number").notNull().unique(),
  serviceType: serviceTypeEnum("service_type").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  departmentId: integer("department_id"),
  requestedById: integer("requested_by_id"),
  assignedToId: integer("assigned_to_id"),
  assignedDepartmentId: integer("assigned_department_id"),
  priority: priorityEnum("priority").default("medium"),
  status: serviceStatusEnum("status").default("pending"),
  location: text("location"),
  notes: text("notes"),
  completionNotes: text("completion_notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const serviceRequestsRelations = relations(serviceRequests, ({ one }) => ({
  department: one(departments, { fields: [serviceRequests.departmentId], references: [departments.id] }),
  requestedBy: one(employees, { fields: [serviceRequests.requestedById], references: [employees.id], relationName: "serviceRequester" }),
  assignedTo: one(employees, { fields: [serviceRequests.assignedToId], references: [employees.id], relationName: "serviceAssignee" }),
}));

export const notificationTargetEnum = pgEnum("notification_target", [
  "all",
  "admin",
  "officer",
  "employee",
  "specific",
]);

export const systemNotifications = pgTable("system_notifications", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  message: text("message").notNull(),
  targetType: notificationTargetEnum("target_type").notNull(),
  sentById: integer("sent_by_id"),
  category: text("category").default("system"),
  relatedEntityId: integer("related_entity_id"),
  relatedEntityType: text("related_entity_type"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const notificationRecipients = pgTable("notification_recipients", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  notificationId: integer("notification_id").notNull(),
  employeeId: integer("employee_id").notNull(),
  isRead: boolean("is_read").default(false),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const systemNotificationsRelations = relations(systemNotifications, ({ one, many }) => ({
  sentBy: one(employees, { fields: [systemNotifications.sentById], references: [employees.id] }),
  recipients: many(notificationRecipients),
}));

export const notificationRecipientsRelations = relations(notificationRecipients, ({ one }) => ({
  notification: one(systemNotifications, { fields: [notificationRecipients.notificationId], references: [systemNotifications.id] }),
  employee: one(employees, { fields: [notificationRecipients.employeeId], references: [employees.id] }),
}));

export const flowTemplates = pgTable("flow_templates", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  correspondenceType: correspondenceTypeEnum("correspondence_type").notNull(),
  levels: text("levels").array().notNull(),
  isActive: boolean("is_active").default(true),
  createdById: integer("created_by_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const flowTemplateGroups = pgTable("flow_template_groups", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  flowTemplateId: integer("flow_template_id").notNull(),
  accounts: integer("accounts").array().notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const flowTemplatesRelations = relations(flowTemplates, ({ one, many }) => ({
  createdBy: one(employees, { fields: [flowTemplates.createdById], references: [employees.id] }),
  groups: many(flowTemplateGroups),
}));

export const flowTemplateGroupsRelations = relations(flowTemplateGroups, ({ one }) => ({
  flowTemplate: one(flowTemplates, { fields: [flowTemplateGroups.flowTemplateId], references: [flowTemplates.id] }),
}));

export const insertDepartmentSchema = createInsertSchema(departments).omit({ id: true, createdAt: true } as any);
export const insertEmployeeSchema = createInsertSchema(employees).omit({ id: true, createdAt: true } as any);
export const insertCorrespondenceSchema = createInsertSchema(correspondence).omit({ id: true, createdAt: true, updatedAt: true } as any);
export const insertCorrespondenceAssignmentSchema = createInsertSchema(correspondenceAssignments).omit({ id: true, createdAt: true } as any);
export const insertCorrespondenceCCSchema = createInsertSchema(correspondenceCCs).omit({ id: true, createdAt: true } as any);
export const insertCorrespondenceAttachmentSchema = createInsertSchema(correspondenceAttachments).omit({ id: true, createdAt: true } as any);
export const insertExternalEntitySchema = createInsertSchema(externalEntities).omit({ id: true, createdAt: true } as any);
export const insertExternalCorrespondenceCCSchema = createInsertSchema(externalCorrespondenceCCs).omit({ id: true, createdAt: true } as any);
export const insertAuditLogSchema = createInsertSchema(auditLog).omit({ id: true, createdAt: true } as any);
export const insertPasswordResetRequestSchema = createInsertSchema(passwordResetRequests).omit({ id: true, createdAt: true } as any);
export const insertSystemSettingSchema = createInsertSchema(systemSettings).omit({ id: true, updatedAt: true } as any);
export const insertLeaveRequestSchema = createInsertSchema(leaveRequests).omit({ id: true, createdAt: true, updatedAt: true } as any);
export const insertServiceRequestSchema = createInsertSchema(serviceRequests).omit({ id: true, createdAt: true, updatedAt: true } as any);
export const insertPermissionSchema = createInsertSchema(permissions).omit({ id: true } as any);
export const insertUserPermissionSchema = createInsertSchema(userPermissions).omit({ id: true, grantedAt: true } as any);
export const insertWorkflowEventSchema = createInsertSchema(workflowEvents).omit({ id: true, createdAt: true } as any);
export const insertSystemNotificationSchema = createInsertSchema(systemNotifications).omit({ id: true, createdAt: true } as any);
export const insertNotificationRecipientSchema = createInsertSchema(notificationRecipients).omit({ id: true, createdAt: true } as any);
export const insertCorrespondenceContributionSchema = createInsertSchema(correspondenceContributions).omit({ id: true, createdAt: true } as any);
export type CorrespondenceContribution = typeof correspondenceContributions.$inferSelect;
export type InsertCorrespondenceContribution = z.infer<typeof insertCorrespondenceContributionSchema>;

export type Department = typeof departments.$inferSelect;
export type InsertDepartment = z.infer<typeof insertDepartmentSchema>;
export type Employee = typeof employees.$inferSelect;
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type Correspondence = typeof correspondence.$inferSelect;
export type InsertCorrespondence = z.infer<typeof insertCorrespondenceSchema>;
export type CorrespondenceAssignment = typeof correspondenceAssignments.$inferSelect;
export type InsertCorrespondenceAssignment = z.infer<typeof insertCorrespondenceAssignmentSchema>;
export type CorrespondenceCC = typeof correspondenceCCs.$inferSelect;
export type InsertCorrespondenceCC = z.infer<typeof insertCorrespondenceCCSchema>;
export type CorrespondenceAttachment = typeof correspondenceAttachments.$inferSelect;
export type InsertCorrespondenceAttachment = z.infer<typeof insertCorrespondenceAttachmentSchema>;
export type AuditLog = typeof auditLog.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type LeaveRequest = typeof leaveRequests.$inferSelect;
export type InsertLeaveRequest = z.infer<typeof insertLeaveRequestSchema>;
export type ServiceRequest = typeof serviceRequests.$inferSelect;
export type InsertServiceRequest = z.infer<typeof insertServiceRequestSchema>;
export type Permission = typeof permissions.$inferSelect;
export type InsertPermission = z.infer<typeof insertPermissionSchema>;
export type UserPermission = typeof userPermissions.$inferSelect;
export type InsertUserPermission = z.infer<typeof insertUserPermissionSchema>;
export type WorkflowEvent = typeof workflowEvents.$inferSelect;
export type InsertWorkflowEvent = z.infer<typeof insertWorkflowEventSchema>;
export type PasswordResetRequest = typeof passwordResetRequests.$inferSelect;
export type InsertPasswordResetRequest = z.infer<typeof insertPasswordResetRequestSchema>;
export type ExternalEntity = typeof externalEntities.$inferSelect;
export type InsertExternalEntity = z.infer<typeof insertExternalEntitySchema>;
export type ExternalCorrespondenceCC = typeof externalCorrespondenceCCs.$inferSelect;
export type InsertExternalCorrespondenceCC = z.infer<typeof insertExternalCorrespondenceCCSchema>;
export type SystemSetting = typeof systemSettings.$inferSelect;
export type InsertSystemSetting = z.infer<typeof insertSystemSettingSchema>;
export type SystemNotification = typeof systemNotifications.$inferSelect;
export type InsertSystemNotification = z.infer<typeof insertSystemNotificationSchema>;
export type NotificationRecipient = typeof notificationRecipients.$inferSelect;
export type InsertNotificationRecipient = z.infer<typeof insertNotificationRecipientSchema>;

export const correspondenceReadStatus = pgTable("correspondence_read_status", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  correspondenceId: integer("correspondence_id").notNull(),
  employeeId: integer("employee_id").notNull(),
  readAt: timestamp("read_at").defaultNow(),
});

export const correspondenceReadStatusRelations = relations(correspondenceReadStatus, ({ one }) => ({
  correspondence: one(correspondence, { fields: [correspondenceReadStatus.correspondenceId], references: [correspondence.id] }),
  employee: one(employees, { fields: [correspondenceReadStatus.employeeId], references: [employees.id] }),
}));

export const insertCorrespondenceReadStatusSchema = createInsertSchema(correspondenceReadStatus).omit({ id: true, readAt: true } as any);
export type CorrespondenceReadStatus = typeof correspondenceReadStatus.$inferSelect;
export type InsertCorrespondenceReadStatus = z.infer<typeof insertCorrespondenceReadStatusSchema>;

export const deletionRequestStatusEnum = pgEnum("deletion_request_status", [
  "pending",
  "approved",
  "rejected",
]);

export const deletionRequests = pgTable("deletion_requests", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  correspondenceId: integer("correspondence_id").notNull(),
  requestedById: integer("requested_by_id").notNull(),
  requestedDepartmentId: integer("requested_department_id").notNull(),
  reason: text("reason").notNull(),
  status: deletionRequestStatusEnum("status").default("pending"),
  processedById: integer("processed_by_id"),
  processedAt: timestamp("processed_at"),
  adminNotes: text("admin_notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const deletionRequestsRelations = relations(deletionRequests, ({ one }) => ({
  correspondence: one(correspondence, { fields: [deletionRequests.correspondenceId], references: [correspondence.id] }),
  requestedBy: one(employees, { fields: [deletionRequests.requestedById], references: [employees.id], relationName: "deletionRequester" }),
  processedBy: one(employees, { fields: [deletionRequests.processedById], references: [employees.id], relationName: "deletionProcessor" }),
}));

export const insertDeletionRequestSchema = createInsertSchema(deletionRequests).omit({ id: true, createdAt: true } as any);
export type DeletionRequest = typeof deletionRequests.$inferSelect;
export type InsertDeletionRequest = z.infer<typeof insertDeletionRequestSchema>;

export const correspondenceFollowups = pgTable("correspondence_followups", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  correspondenceId: integer("correspondence_id").notNull(),
  employeeId: integer("employee_id").notNull(),
  followUpDays: integer("follow_up_days").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const correspondenceFollowupsRelations = relations(correspondenceFollowups, ({ one }) => ({
  correspondence: one(correspondence, { fields: [correspondenceFollowups.correspondenceId], references: [correspondence.id] }),
  employee: one(employees, { fields: [correspondenceFollowups.employeeId], references: [employees.id] }),
}));

export const insertCorrespondenceFollowupSchema = createInsertSchema(correspondenceFollowups).omit({ id: true, createdAt: true } as any);
export type CorrespondenceFollowup = typeof correspondenceFollowups.$inferSelect;
export type InsertCorrespondenceFollowup = z.infer<typeof insertCorrespondenceFollowupSchema>;

export const insertFlowTemplateSchema = createInsertSchema(flowTemplates).omit({ id: true, createdAt: true } as any);
export const insertFlowTemplateGroupSchema = createInsertSchema(flowTemplateGroups).omit({ id: true, createdAt: true } as any);
export type FlowTemplate = typeof flowTemplates.$inferSelect;
export type InsertFlowTemplate = z.infer<typeof insertFlowTemplateSchema>;
export type FlowTemplateGroup = typeof flowTemplateGroups.$inferSelect;
export type InsertFlowTemplateGroup = z.infer<typeof insertFlowTemplateGroupSchema>;
