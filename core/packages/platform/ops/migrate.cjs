// 自包含 SQLite 迁移器,部署时对持久库 /var/lib/cube-platform/data.db 跑。
// 只依赖 better-sqlite3(standalone bundle 自带)+ node 内置,不需要 drizzle-kit / tsx。
// 与 drizzle-orm/better-sqlite3 的 __drizzle_migrations 完全兼容:同样按 _journal.json 的
// when 时间戳判断已应用到哪,写同样的 (hash, created_at),所以和 `pnpm db:migrate` 互不打架。
// 幂等:已应用过的不会重跑。
//
// 用法:DB_PATH=/path/data.db [MIGRATIONS_DIR=/path/db-migrations] node migrate.cjs
//
// 注意:本迁移器只负责"在已存在的库上补新迁移"。FTS 回填(0008)依赖 app 注册的
// cube_seg 函数,但那类历史迁移在线上库早已应用、不会重跑;新增需要 cube_seg 的迁移
// 请改走 CI 的 seed 库或在此注册函数。
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const Database = require("better-sqlite3");

const DB_PATH = process.env.DB_PATH;
const MIGRATIONS_DIR =
  process.env.MIGRATIONS_DIR || path.join(__dirname, "db-migrations");

if (!DB_PATH) {
  console.error("migrate: DB_PATH env required");
  process.exit(1);
}

const journalPath = path.join(MIGRATIONS_DIR, "meta", "_journal.json");
if (!fs.existsSync(journalPath)) {
  console.error("migrate: journal not found at", journalPath);
  process.exit(1);
}

const journal = JSON.parse(fs.readFileSync(journalPath, "utf8"));
const migrations = journal.entries
  .slice()
  .sort((a, b) => a.idx - b.idx)
  .map((e) => {
    const raw = fs.readFileSync(path.join(MIGRATIONS_DIR, `${e.tag}.sql`), "utf8");
    return {
      tag: e.tag,
      when: Number(e.when),
      hash: crypto.createHash("sha256").update(raw).digest("hex"),
      stmts: raw
        .split("--> statement-breakpoint")
        .map((s) => s.trim())
        .filter(Boolean),
    };
  });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.exec(
  'CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (id INTEGER PRIMARY KEY AUTOINCREMENT, hash text NOT NULL, created_at numeric)',
);
const last = db
  .prepare('SELECT created_at FROM "__drizzle_migrations" ORDER BY created_at DESC LIMIT 1')
  .get();
const lastWhen = last ? Number(last.created_at) : -1;

let applied = 0;
const run = db.transaction(() => {
  for (const m of migrations) {
    if (m.when <= lastWhen) continue;
    for (const s of m.stmts) db.exec(s);
    db.prepare('INSERT INTO "__drizzle_migrations" (hash, created_at) VALUES (?, ?)').run(
      m.hash,
      m.when,
    );
    console.log("migrate: applied", m.tag);
    applied++;
  }
});
run();

console.log(applied === 0 ? "migrate: up to date" : `migrate: applied ${applied} migration(s)`);
db.close();
