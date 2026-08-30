// @ts-ignore
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";

let sqliteDb: any = null;

export function getSqliteDb(): any {
  if (!sqliteDb) {
    const dataDir = path.join(process.cwd(), ".data");
    if (!fs.existsSync(dataDir)) {
      try {
        fs.mkdirSync(dataDir, { recursive: true });
      } catch {}
    }
    const dbPath = path.join(dataDir, "sqlite.db");
    try {
      sqliteDb = new DatabaseSync(dbPath);
      // Quick test to ensure file is not malformed
      sqliteDb.exec("PRAGMA schema_version;");
      initSchema(sqliteDb);
      migrateSchema(sqliteDb);
    } catch (err) {
      console.warn("SQLite file open/init failed or corrupted, recreating fresh database:", err);
      try {
        if (fs.existsSync(dbPath)) {
          fs.unlinkSync(dbPath);
        }
        sqliteDb = new DatabaseSync(dbPath);
        initSchema(sqliteDb);
        migrateSchema(sqliteDb);
      } catch {
        sqliteDb = new DatabaseSync(":memory:");
        initSchema(sqliteDb);
        migrateSchema(sqliteDb);
      }
    }
  }
  return sqliteDb;
}

function addColumnIfNotExists(db: any, tableName: string, columnName: string, columnDef: string) {
  try {
    const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as any[];
    const exists = columns.some((c: any) => c.name.toLowerCase() === columnName.toLowerCase());
    if (!exists) {
      db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef}`);
    }
  } catch (e) {
    // Ignore error if column cannot be added or table doesn't exist yet
  }
}

function migrateSchema(db: any) {
  // Migrate system_notifications
  addColumnIfNotExists(db, "system_notifications", "message", "TEXT NOT NULL DEFAULT ''");
  addColumnIfNotExists(db, "system_notifications", "target_type", "TEXT NOT NULL DEFAULT 'all'");
  addColumnIfNotExists(db, "system_notifications", "sent_by_id", "INTEGER");
  addColumnIfNotExists(db, "system_notifications", "category", "TEXT DEFAULT 'system'");
  addColumnIfNotExists(db, "system_notifications", "related_entity_id", "INTEGER");
  addColumnIfNotExists(db, "system_notifications", "related_entity_type", "TEXT");

  try {
    const cols = db.prepare(`PRAGMA table_info(system_notifications)`).all() as any[];
    const hasContent = cols.some((c: any) => c.name === "content");
    const hasMessage = cols.some((c: any) => c.name === "message");
    const hasSenderId = cols.some((c: any) => c.name === "sender_id");
    const hasSentById = cols.some((c: any) => c.name === "sent_by_id");
    if (hasContent && hasMessage) {
      db.exec(`UPDATE system_notifications SET message = content WHERE (message IS NULL OR message = '') AND content IS NOT NULL`);
    }
    if (hasSenderId && hasSentById) {
      db.exec(`UPDATE system_notifications SET sent_by_id = sender_id WHERE sent_by_id IS NULL AND sender_id IS NOT NULL`);
    }
  } catch {}

  // Migrate correspondence
  addColumnIfNotExists(db, "correspondence", "external_date", "TEXT");
  addColumnIfNotExists(db, "correspondence", "created_by_id", "INTEGER");
  addColumnIfNotExists(db, "correspondence", "assigned_to_id", "INTEGER");
  addColumnIfNotExists(db, "correspondence", "send_to_all", "INTEGER DEFAULT 0");
  addColumnIfNotExists(db, "correspondence", "flow_template_id", "INTEGER");
  addColumnIfNotExists(db, "correspondence", "flow_template_group_id", "INTEGER");
  addColumnIfNotExists(db, "correspondence", "contributing_department_ids", "TEXT");
  addColumnIfNotExists(db, "correspondence", "contribution_routing_batch_id", "TEXT");
  addColumnIfNotExists(db, "correspondence", "margin_notes", "TEXT");
  addColumnIfNotExists(db, "correspondence", "notes", "TEXT");
  addColumnIfNotExists(db, "correspondence", "issued_at", "TEXT");
  addColumnIfNotExists(db, "correspondence", "issued_by_id", "INTEGER");
  addColumnIfNotExists(db, "correspondence", "follow_up_days", "INTEGER DEFAULT 0");
  addColumnIfNotExists(db, "correspondence", "delete_reason", "TEXT");
  addColumnIfNotExists(db, "correspondence", "deletion_reason", "TEXT");
  addColumnIfNotExists(db, "correspondence", "archived_at", "TEXT");

  try {
    const cols = db.prepare(`PRAGMA table_info(correspondence)`).all() as any[];
    const hasCreatorId = cols.some((c: any) => c.name === "creator_id");
    const hasCreatedById = cols.some((c: any) => c.name === "created_by_id");
    if (hasCreatorId && hasCreatedById) {
      db.exec(`UPDATE correspondence SET created_by_id = creator_id WHERE created_by_id IS NULL AND creator_id IS NOT NULL`);
    }

    // Check if reference_number or content have NOT NULL constraints in SQLite
    const refCol = cols.find((c: any) => c.name.toLowerCase() === "reference_number");
    const contentCol = cols.find((c: any) => c.name.toLowerCase() === "content");
    if ((refCol && refCol.notnull === 1) || (contentCol && contentCol.notnull === 1)) {
      db.exec("PRAGMA foreign_keys = OFF;");
      db.exec(`
        CREATE TABLE correspondence_temp_fix (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          type TEXT NOT NULL,
          reference_number TEXT,
          external_ref_number TEXT,
          external_date TEXT,
          subject TEXT NOT NULL,
          content TEXT,
          sender_department_id INTEGER,
          receiver_department_id INTEGER,
          current_department_id INTEGER,
          created_by_id INTEGER,
          assigned_to_id INTEGER,
          send_to_all INTEGER DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'draft',
          priority TEXT NOT NULL DEFAULT 'medium',
          confidentiality TEXT NOT NULL DEFAULT 'normal',
          central_mail_assigned_by_id INTEGER,
          flow_template_id INTEGER,
          flow_template_group_id INTEGER,
          parent_correspondence_id INTEGER,
          contributing_department_ids TEXT,
          contribution_routing_batch_id TEXT,
          margin_notes TEXT,
          notes TEXT,
          issued_at TEXT,
          issued_by_id INTEGER,
          requires_reply INTEGER DEFAULT 0,
          reminder_date TEXT,
          follow_up_days INTEGER DEFAULT 0,
          closed_at TEXT,
          closed_by_id INTEGER,
          is_deleted INTEGER DEFAULT 0,
          deleted_at TEXT,
          deleted_by_id INTEGER,
          delete_reason TEXT,
          deletion_reason TEXT,
          is_archived INTEGER DEFAULT 0,
          archived_at TEXT,
          reply_to_correspondence_id INTEGER,
          is_final_reply INTEGER DEFAULT 0,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
      `);

      const tempCols = db.prepare(`PRAGMA table_info(correspondence_temp_fix)`).all() as any[];
      const existingColNames = new Set(cols.map((c: any) => c.name.toLowerCase()));
      const commonCols = tempCols.map((c: any) => c.name).filter((name: string) => existingColNames.has(name.toLowerCase()));
      const colList = commonCols.join(", ");

      db.exec(`INSERT INTO correspondence_temp_fix (${colList}) SELECT ${colList} FROM correspondence;`);
      db.exec("DROP TABLE correspondence;");
      db.exec("ALTER TABLE correspondence_temp_fix RENAME TO correspondence;");
      db.exec("PRAGMA foreign_keys = ON;");
    }
  } catch {}

  // Migrate flow_templates
  addColumnIfNotExists(db, "flow_templates", "created_by_id", "INTEGER");

  // Migrate departments
  addColumnIfNotExists(db, "departments", "allowed_external_entities", "TEXT");
  addColumnIfNotExists(db, "departments", "can_send_internal_outgoing", "INTEGER DEFAULT 1");
  addColumnIfNotExists(db, "departments", "can_send_external_outgoing", "INTEGER DEFAULT 0");
  addColumnIfNotExists(db, "departments", "can_receive_internal_incoming", "INTEGER DEFAULT 1");
  addColumnIfNotExists(db, "departments", "can_receive_external_incoming", "INTEGER DEFAULT 0");

  // Migrate employees
  addColumnIfNotExists(db, "employees", "can_receive_external_incoming", "INTEGER DEFAULT 0");
  addColumnIfNotExists(db, "employees", "must_change_password", "INTEGER DEFAULT 0");
  addColumnIfNotExists(db, "employees", "can_access_correspondence", "INTEGER DEFAULT 1");
  addColumnIfNotExists(db, "employees", "can_access_leave_requests", "INTEGER DEFAULT 1");
  addColumnIfNotExists(db, "employees", "last_login_at", "TEXT");
  addColumnIfNotExists(db, "employees", "last_login_ip", "TEXT");
  addColumnIfNotExists(db, "employees", "last_login_location", "TEXT");

  // Migrate leave_requests (ensure leave_type column exists and sync from type if needed)
  addColumnIfNotExists(db, "leave_requests", "leave_type", "TEXT");
  addColumnIfNotExists(db, "leave_requests", "notes", "TEXT");
  addColumnIfNotExists(db, "leave_requests", "updated_at", "TEXT DEFAULT CURRENT_TIMESTAMP");
  try {
    const leaveCols = db.prepare(`PRAGMA table_info(leave_requests)`).all() as any[];
    const hasTypeCol = leaveCols.some((c: any) => c.name === "type");
    const hasLeaveTypeCol = leaveCols.some((c: any) => c.name === "leave_type");
    if (hasTypeCol && hasLeaveTypeCol) {
      db.exec(`UPDATE leave_requests SET leave_type = type WHERE leave_type IS NULL AND type IS NOT NULL`);
    }
  } catch {}

  // Clean up removed service_requests table
  try {
    db.exec(`DROP TABLE IF EXISTS service_requests;`);
  } catch {}
}

function initSchema(db: DatabaseSync) {
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

    CREATE TABLE IF NOT EXISTS system_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      value TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_by_id INTEGER
    );

    CREATE TABLE IF NOT EXISTS correspondence (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reference_number TEXT,
      type TEXT NOT NULL,
      subject TEXT NOT NULL,
      content TEXT,
      status TEXT DEFAULT 'draft',
      priority TEXT DEFAULT 'medium',
      confidentiality TEXT DEFAULT 'normal',
      sender_department_id INTEGER,
      receiver_department_id INTEGER,
      created_by_id INTEGER,
      assigned_to_id INTEGER,
      current_department_id INTEGER,
      send_to_all INTEGER DEFAULT 0,
      external_entity TEXT,
      external_ref_number TEXT,
      external_date TEXT,
      central_mail_assigned_by_id INTEGER,
      flow_template_id INTEGER,
      flow_template_group_id INTEGER,
      parent_correspondence_id INTEGER,
      contributing_department_ids TEXT,
      contribution_routing_batch_id TEXT,
      margin_notes TEXT,
      notes TEXT,
      issued_at TEXT,
      issued_by_id INTEGER,
      requires_reply INTEGER DEFAULT 0,
      reminder_date TEXT,
      follow_up_days INTEGER,
      closed_at TEXT,
      closed_by_id INTEGER,
      is_deleted INTEGER DEFAULT 0,
      deleted_at TEXT,
      deleted_by_id INTEGER,
      delete_reason TEXT,
      deletion_reason TEXT,
      is_archived INTEGER DEFAULT 0,
      archived_at TEXT,
      reply_to_correspondence_id INTEGER,
      is_final_reply INTEGER DEFAULT 0,
      is_delegated INTEGER DEFAULT 0,
      delegated_to_id INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS correspondence_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      correspondence_id INTEGER NOT NULL,
      department_id INTEGER NOT NULL,
      employee_id INTEGER,
      assigned_by_id INTEGER,
      is_lead INTEGER DEFAULT 0,
      is_follow_up INTEGER DEFAULT 0,
      follow_up_days INTEGER,
      action_required TEXT,
      notes TEXT,
      status TEXT DEFAULT 'pending',
      response_deadline TEXT,
      completed_at TEXT,
      routing_batch_id TEXT,
      is_active_batch INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS correspondence_ccs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      correspondence_id INTEGER NOT NULL,
      department_id INTEGER NOT NULL,
      reason TEXT,
      is_automatic INTEGER DEFAULT 0,
      is_hidden INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS correspondence_attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      correspondence_id INTEGER NOT NULL,
      file_name TEXT NOT NULL,
      original_name TEXT,
      mime_type TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      description TEXT,
      file_path TEXT,
      uploaded_by_id INTEGER NOT NULL,
      contribution_id INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      performed_by_id INTEGER,
      employee_id INTEGER,
      ip_address TEXT,
      module TEXT,
      details TEXT,
      user_agent TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS workflow_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      correspondence_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      from_status TEXT,
      to_status TEXT,
      performed_by_id INTEGER NOT NULL,
      from_department_id INTEGER,
      to_department_id INTEGER,
      margin_note TEXT,
      signature INTEGER DEFAULT 1,
      signature_url TEXT,
      notes TEXT,
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

    CREATE TABLE IF NOT EXISTS password_reset_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER,
      username TEXT NOT NULL,
      employee_name TEXT NOT NULL,
      company_number TEXT,
      mobile_phone TEXT,
      landline_phone TEXT,
      status TEXT DEFAULT 'pending',
      temp_password TEXT,
      processed_by_id INTEGER,
      processed_at TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS system_notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message TEXT NOT NULL DEFAULT '',
      target_type TEXT NOT NULL DEFAULT 'all',
      sent_by_id INTEGER,
      category TEXT DEFAULT 'system',
      related_entity_id INTEGER,
      related_entity_type TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS notification_recipients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      notification_id INTEGER NOT NULL,
      employee_id INTEGER NOT NULL,
      is_read INTEGER DEFAULT 0,
      read_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS external_entities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS external_correspondence_ccs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      correspondence_id INTEGER NOT NULL,
      external_entity_id INTEGER NOT NULL,
      reason TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS flow_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      correspondence_type TEXT NOT NULL,
      levels TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_by_id INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS flow_template_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      flow_template_id INTEGER NOT NULL,
      accounts TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS deletion_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      correspondence_id INTEGER NOT NULL,
      requested_by_id INTEGER NOT NULL,
      requested_department_id INTEGER,
      reason TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      admin_notes TEXT,
      processed_by_id INTEGER,
      processed_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS correspondence_read_status (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      correspondence_id INTEGER NOT NULL,
      employee_id INTEGER NOT NULL,
      read_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS correspondence_contributions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      correspondence_id INTEGER NOT NULL,
      routing_batch_id TEXT NOT NULL,
      contributing_department_id INTEGER,
      lead_department_id INTEGER,
      department_id INTEGER,
      contributor_id INTEGER,
      submitted_by_id INTEGER,
      is_lead INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending',
      content TEXT,
      decline_reason TEXT,
      submitted_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS correspondence_followups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      correspondence_id INTEGER NOT NULL,
      employee_id INTEGER NOT NULL,
      follow_up_days INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS correspondence_counters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      counter_type TEXT NOT NULL,
      department_id INTEGER,
      year INTEGER NOT NULL,
      current_value INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
}
