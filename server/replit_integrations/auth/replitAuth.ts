import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import createMemoryStore from "memorystore";
import crypto from "crypto";

const TOKEN_SECRET = process.env.SESSION_SECRET || "e-management-session-secret-key-2024";

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
      secure: false,
      sameSite: "lax",
      maxAge: sessionTtl,
    },
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());

  // Token-based authentication middleware (supports Authorization: Bearer, X-Auth-Token, and ?token=)
  app.use((req, _res, next) => {
    let token: string | undefined;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.slice(7).trim();
    } else if (req.headers["x-auth-token"]) {
      token = req.headers["x-auth-token"] as string;
    } else if (typeof req.query.token === "string") {
      token = req.query.token;
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
}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  const employeeId = (req as any).employeeId || (req.session && (req.session as any).employeeId);
  if (employeeId) {
    if (req.session) {
      (req.session as any).employeeId = employeeId;
    }
    return next();
  }
  return res.status(401).json({ message: "Unauthorized" });
};

