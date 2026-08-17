import "server-only";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import path from "node:path";
import * as schema from "./schema";
import { segmentCjk } from "@/lib/search/segment";

const DB_PATH = process.env.DB_PATH ?? path.join(process.cwd(), "data.db");

declare global {
  // eslint-disable-next-line no-var
  var __cube_sqlite__: Database.Database | undefined;
}

const sqlite =
  globalThis.__cube_sqlite__ ?? new Database(DB_PATH);

if (!globalThis.__cube_sqlite__) {
  sqlite.pragma("journal_mode = WAL");
  // Register CJK segmenter so FTS5 triggers can call cube_seg(...).
  sqlite.function("cube_seg", { deterministic: true }, (v: unknown) =>
    segmentCjk(v),
  );
  globalThis.__cube_sqlite__ = sqlite;
}

export const db = drizzle(sqlite, { schema });
export { schema };
