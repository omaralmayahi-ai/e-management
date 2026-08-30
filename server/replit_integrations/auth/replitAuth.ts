import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import createMemoryStore from "memorystore";
import crypto from "crypto";
import { storage } from "../../storage";
import { userActivityMiddleware, recordUserActivity } from "../../userActivity";

function resolveTokenSecret(): string {
  const envSecret = process.env.SESSION_SECRET;
  if (envSecret && envSecret.trim().length > 0) {
    return envSecret.trim();
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("CRITICAL SECURITY ERROR: SESSION_SECRET environment variable is mandatory in production!");
  }

  const generatedDevSecret = crypto.randomBytes(32).toString("hex");
  console.warn(
    "[SECURITY WARNING] No SESSION_SECRET was provided in environment. Generated a temporary random secret for this session. (All tokens will invalidate upon server restart)."
  );
  return generatedDevSecret;
}

const TOKEN_SECRET = resolveTokenSecret();

export function generateAuthToken(employeeId: number, username: string): string {
  const payload = JSON.stringify({
    employeeId,
    username,
    exp: Date.now() + 30 * 24 * 60 * 60 * 1000,
  });
  const base64Payload = Buffer.from(payload).toString("base64url");
  const signature = crypto.createHmac("sha256", TOKEN_SECRET).update(base64Payload).digest("base64url");
  return `${base64Payload}.${signature}`;
}

export function verifyAuthToken(token: string): { employeeId: number; username: string } | null {
  try {
    const [base64Payload, signature] = token.split(".");
    if (!base64Payload || !signature) return null;
    const expectedSignature = crypto.createHmac("sha256", TOKEN_SECRET).update(base64Payload).digest("base64url");
    if (signature !== expectedSignature) return null;
    const data = JSON.parse(Buffer.from(base64Payload, "base64url").toString("utf8"));
    if (data.exp && data.exp < Date.now()) return null;
    return { employeeId: data.employeeId, username: data.username };
  } catch {
    return null;
  }
}

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000;
  let sessionStore: any;

  if (process.env.DATABASE_URL) {
    try {
      const pgStore = connectPg(session);
      sessionStore = new pgStore({
        conString: process.env.DATABASE_URL,
        createTableIfMissing: true,
        ttl: sessionTtl,
        tableName: "sessions",
      });
    } catch (e) {
      console.warn("connectPg store init failed, using MemoryStore:", e);
    }
  }

  if (!sessionStore) {
    const MemoryStore = createMemoryStore(session);
    sessionStore = new MemoryStore({
      checkPeriod: 86400000,
    });
  }

  return session({
    secret: TOKEN_SECRET,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: sessionTtl,
    },
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());

  // Token-based authentication middleware: Only accepts Authorization: Bearer or X-Auth-Token headers
  // (?token= is strictly rejected to prevent leak in server logs, history & referrers)
  app.use((req, _res, next) => {
    let token: string | undefined;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.slice(7).trim();
    } else if (req.headers["x-auth-token"]) {
      token = req.headers["x-auth-token"] as string;
    }

    if (token) {
      const decoded = verifyAuthToken(token);
      if (decoded) {
        (req as any).employeeId = decoded.employeeId;
        if (req.session) {
          (req.session as any).employeeId = decoded.employeeId;
        }
      }
    } else if (req.session && (req.session as any).employeeId) {
      (req as any).employeeId = (req.session as any).employeeId;
    }

    next();
  });

  // Track activity for any authenticated request
  app.use(userActivityMiddleware);
}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  const employeeId = (req as any).employeeId || (req.session && (req.session as any).employeeId);
  if (employeeId) {
    if (req.session) {
      (req.session as any).employeeId = employeeId;
    }
    const xForwardedFor = req.headers["x-forwarded-for"] as string;
    const clientIp =
      (req.headers["x-real-ip"] as string) ||
      (req.headers["cf-connecting-ip"] as string) ||
      (xForwardedFor ? xForwardedFor.split(",")[0].trim() : null) ||
      req.socket?.remoteAddress ||
      undefined;
    recordUserActivity(Number(employeeId), clientIp, req.path);
    return next();
  }
  return res.status(401).json({ message: "Unauthorized" });
};

/**
 * Middleware that enforces mandatory password change if mustChangePassword is true.
 * Blocks all API endpoints with 403 Forbidden except auth management.
 */
export const requirePasswordChanged: RequestHandler = async (req, res, next) => {
  const employeeId = (req as any).employeeId || (req.session && (req.session as any).employeeId);
  if (!employeeId) {
    return next();
  }

  try {
    const employee = await storage.getEmployee(employeeId);
    if (employee && employee.mustChangePassword) {
      return res.status(403).json({
        message: "يجب تغيير كلمة المرور للمتابعة قبل استخدام النظام",
        mustChangePassword: true,
      });
    }
  } catch (err) {
    console.error("Error checking mustChangePassword status:", err);
  }

  next();
};


