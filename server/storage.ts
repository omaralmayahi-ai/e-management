import {
  departments, employees, correspondence, correspondenceAssignments, correspondenceCCs, correspondenceAttachments, auditLog, leaveRequests,
  permissions, userPermissions, workflowEvents, passwordResetRequests, systemSettings, correspondenceCounters,
  systemNotifications, notificationRecipients,
  externalEntities, externalCorrespondenceCCs,
  flowTemplates, flowTemplateGroups,
  deletionRequests, correspondenceReadStatus, correspondenceContributions,
  type CorrespondenceContribution, type InsertCorrespondenceContribution,
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
  type NotificationRecipient,
  type ExternalEntity, type InsertExternalEntity,
  type ExternalCorrespondenceCC, type InsertExternalCorrespondenceCC,
  type FlowTemplate, type InsertFlowTemplate,
  type FlowTemplateGroup, type InsertFlowTemplateGroup,
  type DeletionRequest, type InsertDeletionRequest,
  type CorrespondenceReadStatus,
  correspondenceFollowups,
  type CorrespondenceFollowup, type InsertCorrespondenceFollowup,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, or, inArray, isNull, isNotNull, not, sql, gte, lte } from "drizzle-orm";
import { SqliteStorage } from "./sqliteStorage";

export interface IStorage {
  getDepartments(): Promise<Department[]>;
  getDepartment(id: number): Promise<Department | undefined>;
  createDepartment(data: InsertDepartment): Promise<Department>;
  updateDepartment(id: number, data: Partial<Department>): Promise<Department | undefined>;
  deleteDepartment(id: number): Promise<boolean>;
  getDepartmentChildren(parentId: number): Promise<Department[]>;
  getDepartmentAncestors(departmentId: number): Promise<Department[]>;

  getEmployees(): Promise<Employee[]>;
  getEmployee(id: number): Promise<Employee | undefined>;
  getEmployeeByUserId(userId: string): Promise<Employee | undefined>;
  getEmployeeByUsername(username: string): Promise<Employee | undefined>;
  createEmployee(data: InsertEmployee): Promise<Employee>;
  updateEmployee(id: number, data: Partial<Employee>): Promise<Employee | undefined>;
  deleteEmployee(id: number): Promise<void>;
  getOrCreateEmployee(userId: string, fullName: string): Promise<Employee>;

  getCorrespondence(): Promise<Correspondence[]>;
  getCorrespondenceById(id: number): Promise<Correspondence | undefined>;
  getCorrespondenceByDepartment(deptId: number): Promise<Correspondence[]>;
  createCorrespondence(data: InsertCorrespondence): Promise<Correspondence>;
  updateCorrespondence(id: number, data: Partial<Correspondence>): Promise<Correspondence | undefined>;
  getCorrespondenceReplies(parentId: number): Promise<Correspondence[]>;
  getDeletedCorrespondence(): Promise<Correspondence[]>;

  createAssignment(data: InsertCorrespondenceAssignment): Promise<CorrespondenceAssignment>;
  getAssignmentsByCorrespondence(corrId: number): Promise<CorrespondenceAssignment[]>;
  getFollowUpAssignmentsByEmployee(employeeId: number): Promise<CorrespondenceAssignment[]>;
  updateAssignment(id: number, data: Partial<CorrespondenceAssignment>): Promise<CorrespondenceAssignment | undefined>;

  createContribution(data: InsertCorrespondenceContribution): Promise<CorrespondenceContribution>;
  getContributionsByCorrespondence(corrId: number): Promise<CorrespondenceContribution[]>;
  getContributionsByBatch(corrId: number, routingBatchId: string): Promise<CorrespondenceContribution[]>;
  getContribution(id: number): Promise<CorrespondenceContribution | undefined>;
  updateContribution(id: number, data: Partial<CorrespondenceContribution>): Promise<CorrespondenceContribution | undefined>;

  createCorrespondenceFollowup(data: InsertCorrespondenceFollowup): Promise<CorrespondenceFollowup>;
  getFollowupsByEmployee(employeeId: number): Promise<CorrespondenceFollowup[]>;
  getFollowupByEmployeeAndCorrespondence(employeeId: number, correspondenceId: number): Promise<CorrespondenceFollowup | undefined>;
  updateCorrespondenceFollowup(id: number, data: Partial<CorrespondenceFollowup>): Promise<CorrespondenceFollowup | undefined>;
  deleteCorrespondenceFollowup(id: number): Promise<void>;

  markCorrespondenceRead(correspondenceId: number, employeeId: number): Promise<CorrespondenceReadStatus>;
  getReadStatusesForEmployee(employeeId: number): Promise<CorrespondenceReadStatus[]>;
  getDeadlineAlerts(employeeId: number): Promise<any[]>;

  createCC(data: InsertCorrespondenceCC): Promise<CorrespondenceCC>;
  getCCsByCorrespondence(corrId: number): Promise<CorrespondenceCC[]>;
  deleteCCsByCorrespondence(corrId: number): Promise<void>;

  createAttachment(data: InsertCorrespondenceAttachment): Promise<CorrespondenceAttachment>;
  getAttachmentsByCorrespondence(corrId: number): Promise<CorrespondenceAttachment[]>;
  getAttachment(id: number): Promise<CorrespondenceAttachment | undefined>;
  deleteAttachment(id: number): Promise<boolean>;

  createAuditLog(data: InsertAuditLog): Promise<AuditLog>;
  getActivityLog(filters?: { userId?: number; dateFrom?: Date; dateTo?: Date }): Promise<AuditLog[]>;

  getPermissions(): Promise<Permission[]>;
  getPermissionsByCategory(category: string): Promise<Permission[]>;
  createPermission(data: InsertPermission): Promise<Permission>;

  getUserPermissions(employeeId: number): Promise<(UserPermission & { permission: Permission })[]>;
  grantPermission(data: InsertUserPermission): Promise<UserPermission>;
  revokePermission(employeeId: number, permissionId: number): Promise<void>;
  hasPermission(employeeId: number, permissionKey: string): Promise<boolean>;
  batchUpdatePermissions(employeeId: number, permissionKeys: string[], grantedById: number): Promise<void>;

  createWorkflowEvent(data: InsertWorkflowEvent): Promise<WorkflowEvent>;
  getWorkflowEventsByCorrespondence(corrId: number): Promise<WorkflowEvent[]>;
  getCorrespondenceIdsActedOnBy(employeeId: number, actions: string[]): Promise<number[]>;
  getCorrespondenceIdsActedOnByDept(deptId: number, actions: string[]): Promise<number[]>;
  getCorrespondenceIdsWithReplies(): Promise<number[]>;

  getLeaveRequests(): Promise<LeaveRequest[]>;
  getLeaveRequestsByEmployee(employeeId: number): Promise<LeaveRequest[]>;
  getLeaveRequest(id: number): Promise<LeaveRequest | undefined>;
  createLeaveRequest(data: InsertLeaveRequest): Promise<LeaveRequest>;
  updateLeaveRequestStatus(id: number, status: string, approvedById?: number, notes?: string): Promise<LeaveRequest | undefined>;

  getPasswordResetRequests(): Promise<PasswordResetRequest[]>;
  getPasswordResetRequest(id: number): Promise<PasswordResetRequest | undefined>;
  createPasswordResetRequest(data: InsertPasswordResetRequest): Promise<PasswordResetRequest>;
  updatePasswordResetRequest(id: number, data: Partial<PasswordResetRequest>): Promise<PasswordResetRequest | undefined>;

  getSystemSettings(): Promise<SystemSetting[]>;
  getSystemSetting(key: string): Promise<SystemSetting | undefined>;
  upsertSystemSetting(key: string, value: string, updatedById?: number): Promise<SystemSetting>;

  createNotification(data: InsertSystemNotification): Promise<SystemNotification>;
  createNotificationRecipients(notificationId: number, employeeIds: number[]): Promise<void>;
  getNotificationsForEmployee(employeeId: number): Promise<any[]>;
  getUnreadNotificationCount(employeeId: number): Promise<number>;
  markNotificationRead(notificationId: number, employeeId: number): Promise<void>;
  markAllNotificationsRead(employeeId: number): Promise<void>;

  getExternalEntities(): Promise<ExternalEntity[]>;
  getExternalEntity(id: number): Promise<ExternalEntity | undefined>;
  getExternalEntityByName(name: string): Promise<ExternalEntity | undefined>;
  createExternalEntity(data: InsertExternalEntity): Promise<ExternalEntity>;

  createExternalCC(data: InsertExternalCorrespondenceCC): Promise<ExternalCorrespondenceCC>;
  getExternalCCsByCorrespondence(correspondenceId: number): Promise<any[]>;

  getFlowTemplates(): Promise<FlowTemplate[]>;
  getFlowTemplate(id: number): Promise<FlowTemplate | undefined>;
  createFlowTemplate(data: InsertFlowTemplate): Promise<FlowTemplate>;
  updateFlowTemplate(id: number, data: Partial<FlowTemplate>): Promise<FlowTemplate | undefined>;
  deleteFlowTemplate(id: number): Promise<boolean>;
  getFlowTemplateGroups(flowTemplateId: number): Promise<FlowTemplateGroup[]>;
  getFlowTemplateGroup(id: number): Promise<FlowTemplateGroup | undefined>;
  createFlowTemplateGroup(data: InsertFlowTemplateGroup): Promise<FlowTemplateGroup>;
  updateFlowTemplateGroup(id: number, data: Partial<InsertFlowTemplateGroup>): Promise<FlowTemplateGroup | undefined>;
  deleteFlowTemplateGroup(id: number): Promise<boolean>;
  getFlowTemplatesForEmployee(employeeId: number): Promise<any[]>;
  getNextSequenceNumber(counterType: string, departmentId: number | null, startValue?: number): Promise<number>;
  getOverdueCorrespondence(): Promise<Correspondence[]>;

  createDeletionRequest(data: InsertDeletionRequest): Promise<DeletionRequest>;
  getDeletionRequests(status?: string): Promise<DeletionRequest[]>;
  getDeletionRequest(id: number): Promise<DeletionRequest | undefined>;
  getDeletionRequestByCorrespondenceId(correspondenceId: number): Promise<DeletionRequest | undefined>;
  updateDeletionRequest(id: number, data: Partial<DeletionRequest>): Promise<DeletionRequest | undefined>;
}

export class DatabaseStorage implements IStorage {
  async getDepartments(): Promise<Department[]> {
    return db.select().from(departments).orderBy(departments.id);
  }

  async getDepartment(id: number): Promise<Department | undefined> {
    const [dept] = await db.select().from(departments).where(eq(departments.id, id));
    return dept;
  }

  async createDepartment(data: InsertDepartment): Promise<Department> {
    const [dept] = await db.insert(departments).values(data).returning();
    return dept;
  }

  async updateDepartment(id: number, data: Partial<Department>): Promise<Department | undefined> {
    const [dept] = await db.update(departments).set(data).where(eq(departments.id, id)).returning();
    return dept;
  }

  async deleteDepartment(id: number): Promise<boolean> {
    const result = await db.delete(departments).where(eq(departments.id, id)).returning();
    return result.length > 0;
  }

  async getDepartmentChildren(parentId: number): Promise<Department[]> {
    return db.select().from(departments).where(eq(departments.parentId, parentId));
  }

  async getDepartmentAncestors(departmentId: number): Promise<Department[]> {
    const ancestors: Department[] = [];
    let currentId: number | null = departmentId;
    while (currentId) {
      const rows: Department[] = await db.select().from(departments).where(eq(departments.id, currentId));
      const dept = rows[0];
      if (!dept || !dept.parentId) break;
      const parentRows: Department[] = await db.select().from(departments).where(eq(departments.id, dept.parentId));
      const parent = parentRows[0];
      if (!parent) break;
      ancestors.push(parent);
      currentId = parent.parentId;
    }
    return ancestors;
  }

  async getEmployees(): Promise<Employee[]> {
    return db.select().from(employees).orderBy(employees.id);
  }

  async getEmployee(id: number): Promise<Employee | undefined> {
    const [emp] = await db.select().from(employees).where(eq(employees.id, id));
    return emp;
  }

  async getEmployeeByUserId(userId: string): Promise<Employee | undefined> {
    const [emp] = await db.select().from(employees).where(eq(employees.userId, userId));
    return emp;
  }

  async getEmployeeByUsername(username: string): Promise<Employee | undefined> {
    const [emp] = await db.select().from(employees).where(eq(employees.username, username));
    return emp;
  }

  async createEmployee(data: InsertEmployee): Promise<Employee> {
    const [emp] = await db.insert(employees).values(data).returning();
    return emp;
  }

  async updateEmployee(id: number, data: Partial<Employee>): Promise<Employee | undefined> {
    const [emp] = await db.update(employees).set(data).where(eq(employees.id, id)).returning();
    return emp;
  }

  async deleteEmployee(id: number): Promise<void> {
    await db.delete(userPermissions).where(eq(userPermissions.employeeId, id));
    await db.delete(employees).where(eq(employees.id, id));
  }

  async getOrCreateEmployee(userId: string, fullName: string, email?: string): Promise<Employee> {
    const existing = await this.getEmployeeByUserId(userId);
    if (existing) return existing;

    const [existingAdmin] = await db.select().from(employees).where(eq(employees.role, "admin")).limit(1);
    const needsAdmin = !existingAdmin;

    let gmDeptId: number | undefined;
    if (needsAdmin) {
      const [gmDept] = await db.select().from(departments).where(eq(departments.level, "general_manager")).limit(1);
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

  async getCorrespondence(): Promise<Correspondence[]> {
    return db.select().from(correspondence)
      .where(or(eq(correspondence.isDeleted, false), isNull(correspondence.isDeleted)))
      .orderBy(desc(correspondence.createdAt));
  }

  async getCorrespondenceById(id: number): Promise<Correspondence | undefined> {
    const [item] = await db.select().from(correspondence).where(eq(correspondence.id, id));
    return item;
  }

  async getCorrespondenceByDepartment(deptId: number): Promise<Correspondence[]> {
    return db.select().from(correspondence)
      .where(and(
        or(eq(correspondence.isDeleted, false), isNull(correspondence.isDeleted)),
        or(
          eq(correspondence.senderDepartmentId, deptId),
          eq(correspondence.receiverDepartmentId, deptId),
          eq(correspondence.currentDepartmentId, deptId)
        )
      ))
      .orderBy(desc(correspondence.createdAt));
  }

  async getDeletedCorrespondence(): Promise<Correspondence[]> {
    return db.select().from(correspondence)
      .where(eq(correspondence.isDeleted, true))
      .orderBy(desc(correspondence.deletedAt));
  }

  async createCorrespondence(data: InsertCorrespondence): Promise<Correspondence> {
    const [item] = await db.insert(correspondence).values(data).returning();
    return item;
  }

  async updateCorrespondence(id: number, data: Partial<Correspondence>): Promise<Correspondence | undefined> {
    const [item] = await db.update(correspondence)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(correspondence.id, id))
      .returning();
    return item;
  }

  async getCorrespondenceReplies(parentId: number): Promise<Correspondence[]> {
    return db.select().from(correspondence)
      .where(and(
        eq(correspondence.parentCorrespondenceId, parentId),
        or(eq(correspondence.isDeleted, false), isNull(correspondence.isDeleted))
      ))
      .orderBy(desc(correspondence.createdAt));
  }

  async createAssignment(data: InsertCorrespondenceAssignment): Promise<CorrespondenceAssignment> {
    const [item] = await db.insert(correspondenceAssignments).values(data).returning();
    return item;
  }

  async getAssignmentsByCorrespondence(corrId: number): Promise<CorrespondenceAssignment[]> {
    return db.select().from(correspondenceAssignments)
      .where(eq(correspondenceAssignments.correspondenceId, corrId));
  }

  async getFollowUpAssignmentsByEmployee(employeeId: number): Promise<CorrespondenceAssignment[]> {
    const emp = await this.getEmployee(employeeId);
    if (!emp) return [];
    return db.select().from(correspondenceAssignments)
      .where(and(
        eq(correspondenceAssignments.assignedById, employeeId),
        eq(correspondenceAssignments.isFollowUp, true),
      ));
  }

  async updateAssignment(id: number, data: Partial<CorrespondenceAssignment>): Promise<CorrespondenceAssignment | undefined> {
    const [updated] = await db.update(correspondenceAssignments).set(data).where(eq(correspondenceAssignments.id, id)).returning();
    return updated;
  }

  async createContribution(data: InsertCorrespondenceContribution): Promise<CorrespondenceContribution> {
    const [item] = await db.insert(correspondenceContributions).values(data).returning();
    return item;
  }

  async getContributionsByCorrespondence(corrId: number): Promise<CorrespondenceContribution[]> {
    return db.select().from(correspondenceContributions)
      .where(eq(correspondenceContributions.correspondenceId, corrId))
      .orderBy(desc(correspondenceContributions.createdAt));
  }

  async getContributionsByBatch(corrId: number, routingBatchId: string): Promise<CorrespondenceContribution[]> {
    return db.select().from(correspondenceContributions)
      .where(and(
        eq(correspondenceContributions.correspondenceId, corrId),
        eq(correspondenceContributions.routingBatchId, routingBatchId),
      ));
  }

  async getContribution(id: number): Promise<CorrespondenceContribution | undefined> {
    const [item] = await db.select().from(correspondenceContributions).where(eq(correspondenceContributions.id, id));
    return item;
  }

  async updateContribution(id: number, data: Partial<CorrespondenceContribution>): Promise<CorrespondenceContribution | undefined> {
    const [updated] = await db.update(correspondenceContributions).set(data).where(eq(correspondenceContributions.id, id)).returning();
    return updated;
  }

  async createCorrespondenceFollowup(data: InsertCorrespondenceFollowup): Promise<CorrespondenceFollowup> {
    const [item] = await db.insert(correspondenceFollowups).values(data).returning();
    return item;
  }

  async getFollowupsByEmployee(employeeId: number): Promise<CorrespondenceFollowup[]> {
    return db.select().from(correspondenceFollowups)
      .where(eq(correspondenceFollowups.employeeId, employeeId));
  }

  async getFollowupByEmployeeAndCorrespondence(employeeId: number, correspondenceId: number): Promise<CorrespondenceFollowup | undefined> {
    const [item] = await db.select().from(correspondenceFollowups)
      .where(and(
        eq(correspondenceFollowups.employeeId, employeeId),
        eq(correspondenceFollowups.correspondenceId, correspondenceId),
      ));
    return item;
  }

  async updateCorrespondenceFollowup(id: number, data: Partial<CorrespondenceFollowup>): Promise<CorrespondenceFollowup | undefined> {
    const [updated] = await db.update(correspondenceFollowups).set(data).where(eq(correspondenceFollowups.id, id)).returning();
    return updated;
  }

  async deleteCorrespondenceFollowup(id: number): Promise<void> {
    await db.delete(correspondenceFollowups).where(eq(correspondenceFollowups.id, id));
  }

  async markCorrespondenceRead(correspondenceId: number, employeeId: number): Promise<CorrespondenceReadStatus> {
    const [existing] = await db.select().from(correspondenceReadStatus)
      .where(and(
        eq(correspondenceReadStatus.correspondenceId, correspondenceId),
        eq(correspondenceReadStatus.employeeId, employeeId),
      ));
    if (existing) return existing;
    const [item] = await db.insert(correspondenceReadStatus).values({ correspondenceId, employeeId }).returning();
    return item;
  }

  async getReadStatusesForEmployee(employeeId: number): Promise<CorrespondenceReadStatus[]> {
    return db.select().from(correspondenceReadStatus)
      .where(eq(correspondenceReadStatus.employeeId, employeeId));
  }

  async getDeadlineAlerts(employeeId: number): Promise<any[]> {
    const assignments = await db.select().from(correspondenceAssignments)
      .where(and(
        eq(correspondenceAssignments.assignedById, employeeId),
        eq(correspondenceAssignments.isFollowUp, true),
        isNotNull(correspondenceAssignments.responseDeadline),
        isNull(correspondenceAssignments.completedAt),
      ));
    const results: any[] = [];
    for (const a of assignments) {
      const corr = await this.getCorrespondenceById(a.correspondenceId);
      if (corr) {
        const now = new Date();
        const deadline = new Date(a.responseDeadline!);
        const diffMs = deadline.getTime() - now.getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        results.push({
          ...corr,
          assignmentId: a.id,
          responseDeadline: a.responseDeadline,
          departmentId: a.departmentId,
          daysRemaining: diffDays,
          isOverdue: diffDays < 0,
          isApproaching: diffDays >= 0 && diffDays <= 2,
        });
      }
    }
    return results;
  }

  async createCC(data: InsertCorrespondenceCC): Promise<CorrespondenceCC> {
    const [item] = await db.insert(correspondenceCCs).values(data).returning();
    return item;
  }

  async getCCsByCorrespondence(corrId: number): Promise<CorrespondenceCC[]> {
    return db.select().from(correspondenceCCs)
      .where(eq(correspondenceCCs.correspondenceId, corrId));
  }

  async deleteCCsByCorrespondence(corrId: number): Promise<void> {
    await db.delete(correspondenceCCs).where(eq(correspondenceCCs.correspondenceId, corrId));
  }

  async createAttachment(data: InsertCorrespondenceAttachment): Promise<CorrespondenceAttachment> {
    const [item] = await db.insert(correspondenceAttachments).values(data).returning();
    return item;
  }

  async getAttachmentsByCorrespondence(corrId: number): Promise<CorrespondenceAttachment[]> {
    return db.select().from(correspondenceAttachments)
      .where(eq(correspondenceAttachments.correspondenceId, corrId));
  }

  async getAttachment(id: number): Promise<CorrespondenceAttachment | undefined> {
    const [item] = await db.select().from(correspondenceAttachments)
      .where(eq(correspondenceAttachments.id, id));
    return item;
  }

  async deleteAttachment(id: number): Promise<boolean> {
    const result = await db.delete(correspondenceAttachments)
      .where(eq(correspondenceAttachments.id, id));
    return true;
  }

  async createAuditLog(data: InsertAuditLog): Promise<AuditLog> {
    const [item] = await db.insert(auditLog).values(data).returning();
    return item;
  }

  async getActivityLog(filters?: { userId?: number; dateFrom?: Date; dateTo?: Date }): Promise<AuditLog[]> {
    const conditions: any[] = [];
    if (filters?.userId) {
      conditions.push(eq(auditLog.performedById, filters.userId));
    }
    if (filters?.dateFrom) {
      conditions.push(gte(auditLog.createdAt, filters.dateFrom));
    }
    if (filters?.dateTo) {
      conditions.push(lte(auditLog.createdAt, filters.dateTo));
    }
    if (conditions.length > 0) {
      return db.select().from(auditLog).where(and(...conditions)).orderBy(desc(auditLog.createdAt)).limit(500);
    }
    return db.select().from(auditLog).orderBy(desc(auditLog.createdAt)).limit(500);
  }

  async getPermissions(): Promise<Permission[]> {
    return db.select().from(permissions).orderBy(permissions.sortOrder);
  }

  async getPermissionsByCategory(category: string): Promise<Permission[]> {
    return db.select().from(permissions)
      .where(eq(permissions.category, category as any))
      .orderBy(permissions.sortOrder);
  }

  async createPermission(data: InsertPermission): Promise<Permission> {
    const [item] = await db.insert(permissions).values(data).returning();
    return item;
  }

  async getUserPermissions(employeeId: number): Promise<(UserPermission & { permission: Permission })[]> {
    const results = await db.select({
      id: userPermissions.id,
      employeeId: userPermissions.employeeId,
      permissionId: userPermissions.permissionId,
      grantedById: userPermissions.grantedById,
      grantedAt: userPermissions.grantedAt,
      permission: permissions,
    })
    .from(userPermissions)
    .innerJoin(permissions, eq(userPermissions.permissionId, permissions.id))
    .where(eq(userPermissions.employeeId, employeeId));

    return results.map((r: any) => ({
      id: r.id,
      employeeId: r.employeeId,
      permissionId: r.permissionId,
      grantedById: r.grantedById,
      grantedAt: r.grantedAt,
      permission: r.permission,
    }));
  }

  async grantPermission(data: InsertUserPermission): Promise<UserPermission> {
    const [item] = await db.insert(userPermissions).values(data).returning();
    return item;
  }

  async revokePermission(employeeId: number, permissionId: number): Promise<void> {
    await db.delete(userPermissions)
      .where(and(
        eq(userPermissions.employeeId, employeeId),
        eq(userPermissions.permissionId, permissionId)
      ));
  }

  async hasPermission(employeeId: number, permissionKey: string): Promise<boolean> {
    const ADMIN_INHERENT_PERMISSIONS = ["SYS_DATA_RESET"];
    if (ADMIN_INHERENT_PERMISSIONS.includes(permissionKey)) {
      const emp = await this.getEmployee(employeeId);
      if (emp && emp.role === "admin") return true;
    }

    const result = await db.select({ id: userPermissions.id })
      .from(userPermissions)
      .innerJoin(permissions, eq(userPermissions.permissionId, permissions.id))
      .where(and(
        eq(userPermissions.employeeId, employeeId),
        eq(permissions.key, permissionKey)
      ))
      .limit(1);
    return result.length > 0;
  }

  async batchUpdatePermissions(employeeId: number, permissionKeys: string[], grantedById: number): Promise<void> {
    await db.delete(userPermissions).where(eq(userPermissions.employeeId, employeeId));

    if (permissionKeys.length > 0) {
      const allPerms = await db.select().from(permissions).where(inArray(permissions.key, permissionKeys));
      const inserts = allPerms.map((p: any) => ({
        employeeId,
        permissionId: p.id,
        grantedById,
      }));
      if (inserts.length > 0) {
        await db.insert(userPermissions).values(inserts);
      }
    }
  }

  async createWorkflowEvent(data: InsertWorkflowEvent): Promise<WorkflowEvent> {
    const [item] = await db.insert(workflowEvents).values(data).returning();
    return item;
  }

  async getWorkflowEventsByCorrespondence(corrId: number): Promise<WorkflowEvent[]> {
    return db.select().from(workflowEvents)
      .where(eq(workflowEvents.correspondenceId, corrId))
      .orderBy(workflowEvents.createdAt);
  }

  async getCorrespondenceIdsActedOnBy(employeeId: number, actions: string[]): Promise<number[]> {
    if (actions.length === 0) return [];
    const rows = await db.selectDistinct({ correspondenceId: workflowEvents.correspondenceId })
      .from(workflowEvents)
      .where(and(
        eq(workflowEvents.performedById, employeeId),
        inArray(workflowEvents.action, actions as any),
      ));
    return rows.map((r: any) => r.correspondenceId).filter((v: any): v is number => v !== null);
  }

  async getCorrespondenceIdsActedOnByDept(deptId: number, actions: string[]): Promise<number[]> {
    if (actions.length === 0) return [];
    const rows = await db.selectDistinct({ correspondenceId: workflowEvents.correspondenceId })
      .from(workflowEvents)
      .where(and(
        eq(workflowEvents.fromDepartmentId, deptId),
        inArray(workflowEvents.action, actions as any),
      ));
    return rows.map((r: any) => r.correspondenceId).filter((v: any): v is number => v !== null);
  }

  async getCorrespondenceIdsWithReplies(): Promise<number[]> {
    const rows = await db.selectDistinct({ parentId: correspondence.parentCorrespondenceId })
      .from(correspondence)
      .where(and(
        isNotNull(correspondence.parentCorrespondenceId),
        eq(correspondence.isDeleted, false),
      ));
    return rows.map((r: any) => r.parentId).filter((v: any): v is number => v !== null);
  }

  async getLeaveRequests(): Promise<LeaveRequest[]> {
    return db.select().from(leaveRequests).orderBy(desc(leaveRequests.createdAt));
  }

  async getLeaveRequestsByEmployee(employeeId: number): Promise<LeaveRequest[]> {
    return db.select().from(leaveRequests)
      .where(eq(leaveRequests.employeeId, employeeId))
      .orderBy(desc(leaveRequests.createdAt));
  }

  async getLeaveRequest(id: number): Promise<LeaveRequest | undefined> {
    const [item] = await db.select().from(leaveRequests).where(eq(leaveRequests.id, id));
    return item;
  }

  async createLeaveRequest(data: InsertLeaveRequest): Promise<LeaveRequest> {
    const [item] = await db.insert(leaveRequests).values(data).returning();
    return item;
  }

  async updateLeaveRequestStatus(id: number, status: string, approvedById?: number, notes?: string): Promise<LeaveRequest | undefined> {
    const updates: any = { status: status as any, updatedAt: new Date() };
    if (approvedById !== undefined) updates.approvedById = approvedById;
    if (notes !== undefined) updates.notes = notes;
    const [item] = await db.update(leaveRequests)
      .set(updates)
      .where(eq(leaveRequests.id, id))
      .returning();
    return item;
  }

  async getPasswordResetRequests(): Promise<PasswordResetRequest[]> {
    return db.select().from(passwordResetRequests).orderBy(desc(passwordResetRequests.createdAt));
  }

  async getPasswordResetRequest(id: number): Promise<PasswordResetRequest | undefined> {
    const [item] = await db.select().from(passwordResetRequests).where(eq(passwordResetRequests.id, id));
    return item;
  }

  async createPasswordResetRequest(data: InsertPasswordResetRequest): Promise<PasswordResetRequest> {
    const [item] = await db.insert(passwordResetRequests).values(data).returning();
    return item;
  }

  async updatePasswordResetRequest(id: number, data: Partial<PasswordResetRequest>): Promise<PasswordResetRequest | undefined> {
    const [item] = await db.update(passwordResetRequests)
      .set(data)
      .where(eq(passwordResetRequests.id, id))
      .returning();
    return item;
  }

  async getSystemSettings(): Promise<SystemSetting[]> {
    return db.select().from(systemSettings);
  }

  async getSystemSetting(key: string): Promise<SystemSetting | undefined> {
    const [item] = await db.select().from(systemSettings).where(eq(systemSettings.key, key));
    return item;
  }

  async upsertSystemSetting(key: string, value: string, updatedById?: number): Promise<SystemSetting> {
    const [item] = await db
      .insert(systemSettings)
      .values({ key, value, updatedById })
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: { value, updatedAt: new Date(), updatedById },
      })
      .returning();
    return item;
  }

  async createNotification(data: InsertSystemNotification): Promise<SystemNotification> {
    const [notif] = await db.insert(systemNotifications).values(data).returning();
    return notif;
  }

  async createNotificationRecipients(notificationId: number, employeeIds: number[]): Promise<void> {
    if (employeeIds.length === 0) return;
    const values = employeeIds.map(eid => ({ notificationId, employeeId: eid }));
    await db.insert(notificationRecipients).values(values);
  }

  async getNotificationsForEmployee(employeeId: number): Promise<any[]> {
    const results = await db
      .select({
        id: notificationRecipients.id,
        notificationId: notificationRecipients.notificationId,
        isRead: notificationRecipients.isRead,
        readAt: notificationRecipients.readAt,
        createdAt: notificationRecipients.createdAt,
        message: systemNotifications.message,
        targetType: systemNotifications.targetType,
        sentById: systemNotifications.sentById,
        category: systemNotifications.category,
        relatedEntityId: systemNotifications.relatedEntityId,
        relatedEntityType: systemNotifications.relatedEntityType,
        sentAt: systemNotifications.createdAt,
      })
      .from(notificationRecipients)
      .innerJoin(systemNotifications, eq(notificationRecipients.notificationId, systemNotifications.id))
      .where(eq(notificationRecipients.employeeId, employeeId))
      .orderBy(desc(notificationRecipients.createdAt));
    return results;
  }

  async getUnreadNotificationCount(employeeId: number): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notificationRecipients)
      .where(and(eq(notificationRecipients.employeeId, employeeId), eq(notificationRecipients.isRead, false)));
    return result?.count || 0;
  }

  async markNotificationRead(notificationId: number, employeeId: number): Promise<void> {
    await db
      .update(notificationRecipients)
      .set({ isRead: true, readAt: new Date() })
      .where(and(eq(notificationRecipients.notificationId, notificationId), eq(notificationRecipients.employeeId, employeeId)));
  }

  async markAllNotificationsRead(employeeId: number): Promise<void> {
    await db
      .update(notificationRecipients)
      .set({ isRead: true, readAt: new Date() })
      .where(and(eq(notificationRecipients.employeeId, employeeId), eq(notificationRecipients.isRead, false)));
  }

  async getExternalEntities(): Promise<ExternalEntity[]> {
    return db.select().from(externalEntities).orderBy(externalEntities.name);
  }

  async getExternalEntity(id: number): Promise<ExternalEntity | undefined> {
    const [item] = await db.select().from(externalEntities).where(eq(externalEntities.id, id));
    return item;
  }

  async getExternalEntityByName(name: string): Promise<ExternalEntity | undefined> {
    const [item] = await db.select().from(externalEntities).where(eq(externalEntities.name, name));
    return item;
  }

  async createExternalEntity(data: InsertExternalEntity): Promise<ExternalEntity> {
    const [item] = await db.insert(externalEntities).values(data).returning();
    return item;
  }

  async createExternalCC(data: InsertExternalCorrespondenceCC): Promise<ExternalCorrespondenceCC> {
    const [item] = await db.insert(externalCorrespondenceCCs).values(data).returning();
    return item;
  }

  async getExternalCCsByCorrespondence(correspondenceId: number): Promise<any[]> {
    const ccs = await db
      .select()
      .from(externalCorrespondenceCCs)
      .where(eq(externalCorrespondenceCCs.correspondenceId, correspondenceId));
    const result = [];
    for (const cc of ccs) {
      const entity = await this.getExternalEntity(cc.externalEntityId);
      result.push({ ...cc, externalEntity: entity });
    }
    return result;
  }

  async getFlowTemplates(): Promise<FlowTemplate[]> {
    return db.select().from(flowTemplates).orderBy(flowTemplates.id);
  }

  async getFlowTemplate(id: number): Promise<FlowTemplate | undefined> {
    const [ft] = await db.select().from(flowTemplates).where(eq(flowTemplates.id, id));
    return ft;
  }

  async createFlowTemplate(data: InsertFlowTemplate): Promise<FlowTemplate> {
    const [ft] = await db.insert(flowTemplates).values(data).returning();
    return ft;
  }

  async updateFlowTemplate(id: number, data: Partial<FlowTemplate>): Promise<FlowTemplate | undefined> {
    const [ft] = await db.update(flowTemplates).set(data).where(eq(flowTemplates.id, id)).returning();
    return ft;
  }

  async deleteFlowTemplate(id: number): Promise<boolean> {
    const result = await db.delete(flowTemplates).where(eq(flowTemplates.id, id)).returning();
    return result.length > 0;
  }

  async getFlowTemplateGroups(flowTemplateId: number): Promise<FlowTemplateGroup[]> {
    return db.select().from(flowTemplateGroups).where(eq(flowTemplateGroups.flowTemplateId, flowTemplateId)).orderBy(flowTemplateGroups.id);
  }

  async getFlowTemplateGroup(id: number): Promise<FlowTemplateGroup | undefined> {
    const [group] = await db.select().from(flowTemplateGroups).where(eq(flowTemplateGroups.id, id));
    return group;
  }

  async createFlowTemplateGroup(data: InsertFlowTemplateGroup): Promise<FlowTemplateGroup> {
    const [grp] = await db.insert(flowTemplateGroups).values(data).returning();
    return grp;
  }

  async updateFlowTemplateGroup(id: number, data: Partial<InsertFlowTemplateGroup>): Promise<FlowTemplateGroup | undefined> {
    const [updated] = await db.update(flowTemplateGroups).set(data).where(eq(flowTemplateGroups.id, id)).returning();
    return updated;
  }

  async deleteFlowTemplateGroup(id: number): Promise<boolean> {
    const result = await db.delete(flowTemplateGroups).where(eq(flowTemplateGroups.id, id)).returning();
    return result.length > 0;
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

    const deptCondition = departmentId !== null
      ? sql`department_id = ${departmentId}`
      : sql`department_id IS NULL`;

    const result = await db.execute(sql`
      INSERT INTO correspondence_counters (counter_type, department_id, year, current_value, updated_at)
      VALUES (${counterType}, ${departmentId}, ${currentYear}, ${startValue}, NOW())
      ON CONFLICT (counter_type, COALESCE(department_id, 0), year)
      DO UPDATE SET current_value = correspondence_counters.current_value + 1, updated_at = NOW()
      RETURNING current_value
    `);

    return (result as any).rows?.[0]?.current_value ?? startValue;
  }

  async getOverdueCorrespondence(): Promise<Correspondence[]> {
    const now = new Date();
    const results = await db.select().from(correspondence)
      .where(
        and(
          eq(correspondence.requiresReply, true),
          isNull(correspondence.closedAt),
          isNotNull(correspondence.reminderDate),
          lte(correspondence.reminderDate, now),
          not(eq(correspondence.status, "draft")),
          not(eq(correspondence.status, "cancelled")),
        )
      );
    return results;
  }

  async createDeletionRequest(data: InsertDeletionRequest): Promise<DeletionRequest> {
    const [request] = await db.insert(deletionRequests).values(data).returning();
    return request;
  }

  async getDeletionRequests(status?: string): Promise<DeletionRequest[]> {
    if (status) {
      return db.select().from(deletionRequests).where(eq(deletionRequests.status, status as any)).orderBy(desc(deletionRequests.createdAt));
    }
    return db.select().from(deletionRequests).orderBy(desc(deletionRequests.createdAt));
  }

  async getDeletionRequest(id: number): Promise<DeletionRequest | undefined> {
    const [request] = await db.select().from(deletionRequests).where(eq(deletionRequests.id, id));
    return request;
  }

  async getDeletionRequestByCorrespondenceId(correspondenceId: number): Promise<DeletionRequest | undefined> {
    const [request] = await db.select().from(deletionRequests)
      .where(and(
        eq(deletionRequests.correspondenceId, correspondenceId),
        eq(deletionRequests.status, "pending")
      ));
    return request;
  }

  async updateDeletionRequest(id: number, data: Partial<DeletionRequest>): Promise<DeletionRequest | undefined> {
    const [updated] = await db.update(deletionRequests).set(data).where(eq(deletionRequests.id, id)).returning();
    return updated;
  }
}

export const storage: IStorage = process.env.DATABASE_URL ? new DatabaseStorage() : new SqliteStorage();
