import type { Request, Response, NextFunction } from "express";

interface ActivityRecord {
  lastSeenAt: number;
  ip?: string;
  path?: string;
}

const DEFAULT_ACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes window

// In-memory tracker for active users, independent of session storage (SQLite, MemoryStore, Postgres, etc.)
const userActivityMap = new Map<number, ActivityRecord>();

export function recordUserActivity(employeeId: number, ip?: string, path?: string): void {
  if (!employeeId || isNaN(employeeId)) return;
  userActivityMap.set(employeeId, {
    lastSeenAt: Date.now(),
    ip,
    path,
  });
}

export function clearUserActivity(employeeId: number): void {
  if (!employeeId) return;
  userActivityMap.delete(employeeId);
}

export function getUserActivity(employeeId: number): { lastSeenAt: Date; ip?: string; path?: string } | null {
  const record = userActivityMap.get(employeeId);
  if (!record) return null;
  return {
    lastSeenAt: new Date(record.lastSeenAt),
    ip: record.ip,
    path: record.path,
  };
}

export function isUserOnline(
  employeeId: number,
  lastLoginAt?: Date | string | null,
  thresholdMs: number = DEFAULT_ACTIVITY_TIMEOUT_MS
): boolean {
  const now = Date.now();

  // 1. Check in-memory activity tracker
  const record = userActivityMap.get(employeeId);
  if (record && now - record.lastSeenAt <= thresholdMs) {
    return true;
  }

  // 2. Check lastLoginAt timestamp as a resilient fallback
  if (lastLoginAt) {
    const loginTime = typeof lastLoginAt === "string" ? new Date(lastLoginAt).getTime() : lastLoginAt.getTime();
    if (!isNaN(loginTime) && now - loginTime <= thresholdMs) {
      return true;
    }
  }

  return false;
}

export function userActivityMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const employeeId = (req as any).employeeId || (req.session as any)?.employeeId;
  if (employeeId) {
    const xForwardedFor = req.headers["x-forwarded-for"] as string;
    const clientIp =
      (req.headers["x-real-ip"] as string) ||
      (req.headers["cf-connecting-ip"] as string) ||
      (xForwardedFor ? xForwardedFor.split(",")[0].trim() : null) ||
      req.socket?.remoteAddress ||
      undefined;

    recordUserActivity(Number(employeeId), clientIp, req.path);
  }
  next();
}
