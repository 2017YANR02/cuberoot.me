import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "node:path";

const DB_PATH = process.env.DB_PATH ?? path.join(process.cwd(), "data.db");

const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
const db = drizzle(sqlite);

migrate(db, { migrationsFolder: path.join(process.cwd(), "db/migrations") });

sqlite.close();
console.log("migrated:", DB_PATH);
