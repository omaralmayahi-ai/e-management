import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import createMemoryStore from "memorystore";

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
    secret: process.env.SESSION_SECRET || "e-management-session-secret-key-2024",
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false,
      maxAge: sessionTtl,
    },
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  if (req.session && (req.session as any).employeeId) {
    return next();
  }
  return res.status(401).json({ message: "Unauthorized" });
};
