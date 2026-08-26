import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

export let pool: pg.Pool | null = null;
export let db: any;

if (process.env.DATABASE_URL) {
  try {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    db = drizzle(pool, { schema });
  } catch (err) {
    console.warn("[AI Studio] Database connection error:", err);
  }
}

if (!db) {
  console.warn("[AI Studio] DATABASE_URL not set or database offline — using mock db wrapper");
  const noOpChain = () => {
    const proxy: any = new Proxy(() => proxy, {
      get: () => proxy,
      apply: () => Promise.resolve([]),
    });
    return proxy;
  };

  db = new Proxy({}, {
    get: (_target, prop) => {
      if (prop === "query") {
        return new Proxy({}, {
          get: () => ({
            findMany: async () => [],
            findFirst: async () => null,
            findUnique: async () => null,
          }),
        });
      }
      if (prop === "select" || prop === "insert" || prop === "update" || prop === "delete" || prop === "execute") {
        return () => ({
          from: () => ({
            where: () => ({
              orderBy: () => Promise.resolve([]),
              limit: () => Promise.resolve([]),
              returning: () => Promise.resolve([]),
              then: (fn: any) => Promise.resolve([]).then(fn),
            }),
            orderBy: () => Promise.resolve([]),
            limit: () => Promise.resolve([]),
            then: (fn: any) => Promise.resolve([]).then(fn),
          }),
          values: () => ({
            returning: () => Promise.resolve([{ id: 1 }]),
            onConflictDoUpdate: () => ({
              returning: () => Promise.resolve([{ id: 1 }]),
              then: (fn: any) => Promise.resolve([{ id: 1 }]).then(fn),
            }),
            then: (fn: any) => Promise.resolve([{ id: 1 }]).then(fn),
          }),
          set: () => ({
            where: () => ({
              returning: () => Promise.resolve([{ id: 1 }]),
              then: (fn: any) => Promise.resolve([{ id: 1 }]).then(fn),
            }),
            returning: () => Promise.resolve([{ id: 1 }]),
            then: (fn: any) => Promise.resolve([{ id: 1 }]).then(fn),
          }),
          where: () => ({
            returning: () => Promise.resolve([{ id: 1 }]),
            then: (fn: any) => Promise.resolve([{ id: 1 }]).then(fn),
          }),
          then: (fn: any) => Promise.resolve([]).then(fn),
        });
      }
      return async () => [];
    },
  });
}

