import { describe, it, expect, beforeEach } from "vitest";
// @ts-ignore
import { DatabaseSync } from "node:sqlite";
import { SqliteStorage } from "./sqliteStorage";
import { InsertLeaveRequest } from "../shared/schema";

describe("SQLite Leave Requests & Schema Sync Integration", () => {
  let db: any;
  let storage: SqliteStorage;

  beforeEach(() => {
    db = new DatabaseSync(":memory:");
    
    // Initialize full schema
    db.exec(`
      CREATE TABLE IF NOT EXISTS departments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        name_en TEXT,
        level TEXT NOT NULL DEFAULT 'unit',
        is_central INTEGER DEFAULT 0,
        parent_id INTEGER,
        manager_id INTEGER,
        code TEXT,
        description TEXT,
        can_send_internal_outgoing INTEGER DEFAULT 1,
        can_send_external_outgoing INTEGER DEFAULT 0,
        can_receive_internal_incoming INTEGER DEFAULT 1,
        can_receive_external_incoming INTEGER DEFAULT 0,
        allowed_external_entities TEXT,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS employees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT DEFAULT '',
        username TEXT UNIQUE,
        password_hash TEXT,
        full_name TEXT NOT NULL DEFAULT 'موظف',
        department_id INTEGER,
        job_title TEXT,
        employee_number TEXT UNIQUE,
        phone TEXT,
        mobile_phone TEXT,
        landline_phone TEXT,
        company_number TEXT,
        email TEXT,
        role TEXT NOT NULL DEFAULT 'employee',
        is_active INTEGER DEFAULT 1,
        leave_balance INTEGER DEFAULT 30,
        last_login_at TEXT,
        last_login_ip TEXT,
        last_login_location TEXT,
        must_change_password INTEGER DEFAULT 1,
        signature_url TEXT,
        can_access_correspondence INTEGER DEFAULT 1,
        can_access_leave_requests INTEGER DEFAULT 1,
        can_receive_external_incoming INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS leave_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER NOT NULL,
        leave_type TEXT NOT NULL,
        type TEXT,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        days_count INTEGER,
        reason TEXT,
        status TEXT DEFAULT 'pending',
        approved_by_id INTEGER,
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS system_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        value TEXT NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_by_id INTEGER
      );

      CREATE TABLE IF NOT EXISTS permissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT NOT NULL UNIQUE,
        name_ar TEXT NOT NULL,
        name_en TEXT,
        description TEXT,
        category TEXT NOT NULL,
        sort_order INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS user_permissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER NOT NULL,
        permission_id INTEGER NOT NULL,
        granted_by_id INTEGER,
        granted_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    storage = new SqliteStorage(db);
  });

  it("should successfully create a leave request with leave_type and verify columns", async () => {
    // Insert employee first
    const emp = await storage.createEmployee({
      fullName: "موظف اختبار",
      username: "test_leave_emp",
      password: "Password123!",
      role: "employee",
      departmentId: 1,
    });

    const leaveData: InsertLeaveRequest = {
      employeeId: emp.id,
      leaveType: "annual",
      startDate: new Date("2026-09-01T00:00:00.000Z"),
      endDate: new Date("2026-09-05T00:00:00.000Z"),
      daysCount: 5,
      reason: "إجازة سنوية للاختبار الآلي",
      status: "pending",
    };

    // Execute createLeaveRequest - must succeed without column errors
    const created = await storage.createLeaveRequest(leaveData);
    expect(created).toBeDefined();
    expect(created.id).toBeGreaterThan(0);
    expect(created.employeeId).toBe(emp.id);
    expect(created.leaveType).toBe("annual");
    expect(created.daysCount).toBe(5);
    expect(created.reason).toBe("إجازة سنوية للاختبار الآلي");
    expect(created.status).toBe("pending");

    // Retrieve the leave request
    const retrieved = await storage.getLeaveRequest(created.id);
    expect(retrieved).toBeDefined();
    expect(retrieved?.leaveType).toBe("annual");
    expect(retrieved?.reason).toBe("إجازة سنوية للاختبار الآلي");

    // Fetch list by employee
    const empLeaves = await storage.getLeaveRequestsByEmployee(emp.id);
    expect(empLeaves.length).toBe(1);
    expect(empLeaves[0].leaveType).toBe("annual");

    // Update status
    const updated = await storage.updateLeaveRequestStatus(created.id, "approved", 999);
    expect(updated?.status).toBe("approved");
    expect(updated?.approvedById).toBe(999);
  });
});
