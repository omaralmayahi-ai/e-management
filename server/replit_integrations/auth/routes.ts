import type { Express } from "express";
import bcrypt from "bcryptjs";
import { storage } from "../../storage";
import { generateAuthToken } from "./replitAuth";
import { recordUserActivity, clearUserActivity } from "../../userActivity";

export function registerAuthRoutes(app: Express): void {
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ message: "اسم المستخدم وكلمة المرور مطلوبان" });
      }

      const employee = await storage.getEmployeeByUsername(username);
      if (!employee || !employee.passwordHash) {
        return res.status(401).json({ message: "اسم المستخدم أو كلمة المرور غير صحيحة" });
      }

      if (!employee.isActive) {
        return res.status(403).json({ message: "تم إيقاف نشاط الحساب بإمكانك التواصل مع إدارة النظام لمعرفة السبب" });
      }

      const valid = await bcrypt.compare(password, employee.passwordHash);
      if (!valid) {
        return res.status(401).json({ message: "اسم المستخدم أو كلمة المرور غير صحيحة" });
      }

      const xForwardedFor = req.headers["x-forwarded-for"] as string;
      const clientIp = (req.headers["x-real-ip"] as string)
        || (req.headers["cf-connecting-ip"] as string)
        || (xForwardedFor ? xForwardedFor.split(",")[0].trim() : null)
        || req.socket?.remoteAddress || "unknown";

      let locationStr = "";
      try {
        const geoRes = await fetch(`http://ip-api.com/json/${clientIp}?fields=status,country,city&lang=ar`);
        if (geoRes.ok) {
          const geo = await geoRes.json();
          if (geo.status === "success") {
            locationStr = [geo.city, geo.country].filter(Boolean).join("، ");
          }
        }
      } catch {}

      await storage.updateEmployee(employee.id, {
        lastLoginAt: new Date(),
        lastLoginIp: clientIp,
        lastLoginLocation: locationStr || null,
      });

      (req.session as any).employeeId = employee.id;
      (req as any).employeeId = employee.id;
      recordUserActivity(employee.id, clientIp, "/api/auth/login");

      await storage.createAuditLog({
        entityType: "auth",
        entityId: employee.id,
        action: "login",
        performedById: employee.id,
        employeeId: employee.id,
        ipAddress: clientIp,
        module: "auth",
        details: `تسجيل دخول${locationStr ? ` من ${locationStr}` : ""}`,
      });

      const dept = employee.departmentId ? await storage.getDepartment(employee.departmentId) : null;
      const token = generateAuthToken(employee.id, employee.username || "");

      const userPayload = {
        id: employee.id,
        fullName: employee.fullName,
        username: employee.username,
        role: employee.role,
        departmentId: employee.departmentId,
        department: dept,
        signatureUrl: employee.signatureUrl,
        mustChangePassword: employee.mustChangePassword,
        canAccessCorrespondence: employee.canAccessCorrespondence,
        canAccessLeaveRequests: employee.canAccessLeaveRequests,
        token,
      };

      if (req.session && req.session.save) {
        req.session.save((err) => {
          if (err) console.error("Session save error:", err);
          res.json(userPayload);
        });
      } else {
        res.json(userPayload);
      }
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "حدث خطأ في تسجيل الدخول" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    const employeeId = (req as any).employeeId || (req.session as any)?.employeeId;
    if (employeeId) {
      clearUserActivity(Number(employeeId));
    }
    if (req.session) {
      req.session.destroy((err) => {
        if (err) {
          return res.status(500).json({ message: "حدث خطأ" });
        }
        res.json({ message: "تم تسجيل الخروج" });
      });
    } else {
      res.json({ message: "تم تسجيل الخروج" });
    }
  });

  app.get("/api/auth/user", async (req, res) => {
    const employeeId = (req as any).employeeId || (req.session as any)?.employeeId;
    if (!employeeId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    try {
      const employee = await storage.getEmployee(employeeId);
      if (!employee) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const dept = employee.departmentId ? await storage.getDepartment(employee.departmentId) : null;
      res.json({
        id: employee.id,
        fullName: employee.fullName,
        username: employee.username,
        email: employee.email,
        role: employee.role,
        departmentId: employee.departmentId,
        department: dept,
        jobTitle: employee.jobTitle,
        signatureUrl: employee.signatureUrl,
        mustChangePassword: employee.mustChangePassword,
        canAccessCorrespondence: employee.canAccessCorrespondence,
        canAccessLeaveRequests: employee.canAccessLeaveRequests,
      });
    } catch (error) {
      console.error("Auth user error:", error);
      res.status(500).json({ message: "حدث خطأ" });
    }
  });

  app.post("/api/auth/change-password", async (req, res) => {
    const employeeId = (req as any).employeeId || (req.session as any)?.employeeId;
    if (!employeeId) return res.status(401).json({ message: "Unauthorized" });

    const { currentPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" });
    }

    try {
      const employee = await storage.getEmployee(employeeId);
      if (!employee) return res.status(404).json({ message: "الموظف غير موجود" });

      if (!employee.mustChangePassword) {
        if (!currentPassword) {
          return res.status(400).json({ message: "كلمة المرور الحالية مطلوبة" });
        }
        const valid = await bcrypt.compare(currentPassword, employee.passwordHash || "");
        if (!valid) {
          return res.status(401).json({ message: "كلمة المرور الحالية غير صحيحة" });
        }
      }

      const hash = await bcrypt.hash(newPassword, 10);
      await storage.updateEmployee(employee.id, { passwordHash: hash, mustChangePassword: false });

      await storage.createAuditLog({
        entityType: "auth",
        entityId: employee.id,
        action: "change_password",
        performedById: employee.id,
        employeeId: employee.id,
        module: "auth",
        details: "تغيير كلمة المرور",
      });

      res.json({ message: "تم تغيير كلمة المرور بنجاح" });
    } catch (error) {
      res.status(500).json({ message: "حدث خطأ" });
    }
  });

  app.post("/api/auth/reset-request", async (req, res) => {
    const { username, employeeName, companyNumber, mobilePhone, landlinePhone } = req.body;
    if (!username || !employeeName) {
      return res.status(400).json({ message: "اسم المستخدم واسم الموظف مطلوبان" });
    }
    if (!mobilePhone && !landlinePhone) {
      return res.status(400).json({ message: "يرجى إدخال رقم هاتف واحد على الأقل للتواصل" });
    }

    try {
      const employee = await storage.getEmployeeByUsername(username);
      const employeeId = employee ? employee.id : 0;

      await storage.createPasswordResetRequest({
        employeeId,
        username,
        employeeName,
        companyNumber: companyNumber || null,
        mobilePhone: mobilePhone || null,
        landlinePhone: landlinePhone || null,
      });

      const allEmployees = await storage.getEmployees();
      const admins = allEmployees.filter(e => e.role === "admin" && e.isActive);
      if (admins.length > 0) {
        const notif = await storage.createNotification({
          message: `طلب إعادة تعيين كلمة مرور جديد من: ${employeeName} (${username})`,
          targetType: "specific",
          sentById: employeeId || null as any,
        });
        await storage.createNotificationRecipients(notif.id, admins.map(a => a.id));
      }

      await storage.createAuditLog({
        entityType: "employee",
        entityId: employeeId || 0,
        action: "password_reset_request",
        performedById: employeeId || 0,
        employeeId: employeeId || 0,
        ipAddress: req.ip || null,
        module: "employees",
        details: `طلب إعادة تعيين كلمة المرور من: ${employeeName} (${username})`,
      });

      res.json({ message: "تم إرسال الطلب بنجاح. سيتم التواصل معك قريباً" });
    } catch (error) {
      console.error("Reset request error:", error);
      res.status(500).json({ message: "حدث خطأ في إرسال الطلب" });
    }
  });
}
