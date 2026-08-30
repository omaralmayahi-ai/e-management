import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, pgEnum, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

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

export const insertDepartmentSchema = createInsertSchema(departments);
export const insertEmployeeSchema = createInsertSchema(employees);
export const insertCorrespondenceSchema = createInsertSchema(correspondence);
export const insertCorrespondenceAssignmentSchema = createInsertSchema(correspondenceAssignments);
export const insertCorrespondenceCCSchema = createInsertSchema(correspondenceCCs);
export const insertCorrespondenceAttachmentSchema = createInsertSchema(correspondenceAttachments);
export const insertExternalEntitySchema = createInsertSchema(externalEntities);
export const insertExternalCorrespondenceCCSchema = createInsertSchema(externalCorrespondenceCCs);
export const insertAuditLogSchema = createInsertSchema(auditLog);
export const insertPasswordResetRequestSchema = createInsertSchema(passwordResetRequests);
export const insertSystemSettingSchema = createInsertSchema(systemSettings);
export const insertLeaveRequestSchema = createInsertSchema(leaveRequests);
export const insertPermissionSchema = createInsertSchema(permissions);
export const insertUserPermissionSchema = createInsertSchema(userPermissions);
export const insertWorkflowEventSchema = createInsertSchema(workflowEvents);
export const insertSystemNotificationSchema = createInsertSchema(systemNotifications);
export const insertNotificationRecipientSchema = createInsertSchema(notificationRecipients);
export const insertCorrespondenceContributionSchema = createInsertSchema(correspondenceContributions);
export type CorrespondenceContribution = typeof correspondenceContributions.$inferSelect;
export type InsertCorrespondenceContribution = typeof correspondenceContributions.$inferInsert;

export type Department = typeof departments.$inferSelect;
export type InsertDepartment = typeof departments.$inferInsert;
export type Employee = typeof employees.$inferSelect;
export type InsertEmployee = typeof employees.$inferInsert;
export type Correspondence = typeof correspondence.$inferSelect;
export type InsertCorrespondence = typeof correspondence.$inferInsert;
export type CorrespondenceAssignment = typeof correspondenceAssignments.$inferSelect;
export type InsertCorrespondenceAssignment = typeof correspondenceAssignments.$inferInsert;
export type CorrespondenceCC = typeof correspondenceCCs.$inferSelect;
export type InsertCorrespondenceCC = typeof correspondenceCCs.$inferInsert;
export type CorrespondenceAttachment = typeof correspondenceAttachments.$inferSelect;
export type InsertCorrespondenceAttachment = typeof correspondenceAttachments.$inferInsert;
export type AuditLog = typeof auditLog.$inferSelect;
export type InsertAuditLog = typeof auditLog.$inferInsert;
export type LeaveRequest = typeof leaveRequests.$inferSelect;
export type InsertLeaveRequest = typeof leaveRequests.$inferInsert;
export type Permission = typeof permissions.$inferSelect;
export type InsertPermission = typeof permissions.$inferInsert;
export type UserPermission = typeof userPermissions.$inferSelect;
export type InsertUserPermission = typeof userPermissions.$inferInsert;
export type WorkflowEvent = typeof workflowEvents.$inferSelect;
export type InsertWorkflowEvent = typeof workflowEvents.$inferInsert;
export type PasswordResetRequest = typeof passwordResetRequests.$inferSelect;
export type InsertPasswordResetRequest = typeof passwordResetRequests.$inferInsert;
export type ExternalEntity = typeof externalEntities.$inferSelect;
export type InsertExternalEntity = typeof externalEntities.$inferInsert;
export type ExternalCorrespondenceCC = typeof externalCorrespondenceCCs.$inferSelect;
export type InsertExternalCorrespondenceCC = typeof externalCorrespondenceCCs.$inferInsert;
export type SystemSetting = typeof systemSettings.$inferSelect;
export type InsertSystemSetting = typeof systemSettings.$inferInsert;
export type SystemNotification = typeof systemNotifications.$inferSelect;
export type InsertSystemNotification = typeof systemNotifications.$inferInsert;
export type NotificationRecipient = typeof notificationRecipients.$inferSelect;
export type InsertNotificationRecipient = typeof notificationRecipients.$inferInsert;

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

export const insertCorrespondenceReadStatusSchema = createInsertSchema(correspondenceReadStatus);
export type CorrespondenceReadStatus = typeof correspondenceReadStatus.$inferSelect;
export type InsertCorrespondenceReadStatus = typeof correspondenceReadStatus.$inferInsert;

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

export const insertDeletionRequestSchema = createInsertSchema(deletionRequests);
export type DeletionRequest = typeof deletionRequests.$inferSelect;
export type InsertDeletionRequest = typeof deletionRequests.$inferInsert;

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

export const insertCorrespondenceFollowupSchema = createInsertSchema(correspondenceFollowups);
export type CorrespondenceFollowup = typeof correspondenceFollowups.$inferSelect;
export type InsertCorrespondenceFollowup = typeof correspondenceFollowups.$inferInsert;

export const insertFlowTemplateSchema = createInsertSchema(flowTemplates);
export const insertFlowTemplateGroupSchema = createInsertSchema(flowTemplateGroups);
export type FlowTemplate = typeof flowTemplates.$inferSelect;
export type InsertFlowTemplate = typeof flowTemplates.$inferInsert;
export type FlowTemplateGroup = typeof flowTemplateGroups.$inferSelect;
export type InsertFlowTemplateGroup = typeof flowTemplateGroups.$inferInsert;
