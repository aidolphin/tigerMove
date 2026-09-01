import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

type D1Database = {
  prepare(query: string): D1PreparedStatement;
  batch<T extends readonly unknown[]>(statements: D1PreparedStatement[]): Promise<D1BatchResult[]>;
  all<T = unknown>(query: string, params?: unknown[]): Promise<D1Result<T>>;
  get<T = unknown>(query: string, params?: unknown[]): Promise<T | undefined>;
  run(query: string, params?: unknown[]): Promise<D1Response>;
  exec(query: string): Promise<D1Response>;
  prepareCursor(query: string, params?: unknown[]): Promise<D1Cursor>;
};

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  run(): Promise<D1Response>;
  all<T = unknown>(): Promise<D1Result<T>>;
  get<T = unknown>(): Promise<T | undefined>;
  raw<T = unknown>(): Promise<T[]>;
}

interface D1Response {
  success: boolean;
  meta: Record<string, unknown>;
  results?: unknown[];
}

interface D1Result<T = unknown> {
  results: T[];
  success: boolean;
  meta: Record<string, unknown>;
}

interface D1BatchResult {
  success: boolean;
  meta: Record<string, unknown>;
  results?: unknown[];
}

interface D1Cursor {
  next(): Promise<{ done: boolean; value?: unknown } | null>;
  close(): Promise<void>;
}

function createFallbackDb() {
  const queryState = {
    from: () => queryState,
    where: () => queryState,
    orderBy: () => queryState,
    limit: async () => [],
    get: async () => undefined,
    all: async () => [],
    then: undefined,
  };

  return {
    select: () => queryState,
    insert: () => ({
      values: async () => ({ returning: async () => [] }),
    }),
    update: () => ({
      set: () => ({
        where: async () => ({ rowsAffected: 0 }),
      }),
    }),
    delete: () => ({
      where: async () => ({ rowsAffected: 0 }),
    }),
  };
}

export function getDb() {
  const env = globalThis as unknown as {
    DB?: D1Database;
    cloudflare?: { env: { DB?: D1Database } };
    process?: { env?: { DB?: D1Database } };
  };

  const dbBinding =
    env.DB ??
    env.cloudflare?.env?.DB ??
    env.process?.env?.DB;

  if (!dbBinding) {
    console.warn(
      "Cloudflare D1 binding `DB` is unavailable. Falling back to a no-op local DB so the app does not crash in local dev."
    );
    return createFallbackDb() as ReturnType<typeof drizzle>;
  }

  return drizzle(dbBinding, { schema });
}
