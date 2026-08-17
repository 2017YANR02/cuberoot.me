import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "node:path";
import { segmentCjk } from "../lib/search/segment";

const DB_PATH = process.env.DB_PATH ?? path.join(process.cwd(), "data.db");

const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
// FTS5 triggers in migration 0008 call cube_seg(...) — must register before
// running migrate() so the backfill INSERT statements can resolve it.
sqlite.function("cube_seg", { deterministic: true }, (v: unknown) =>
  segmentCjk(v),
);
const db = drizzle(sqlite);

migrate(db, { migrationsFolder: path.join(process.cwd(), "db/migrations") });

sqlite.close();
console.log("migrated:", DB_PATH);
