// Step 1 — pull N random real WCA 333 scrambles from the local WCA MySQL dump
// into scrambles.txt. Resolves mysql2 + database.yml from the stats-build package.
//
// Usage: node pull.mjs [N=240]
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../..');
const statsBuild = resolve(repoRoot, 'core/packages/stats-build');

const require = createRequire(resolve(statsBuild, 'package.json'));
const mysql = require('mysql2/promise');

const ymlText = readFileSync(resolve(statsBuild, 'database.yml'), 'utf8');
const cfg = Object.fromEntries(
  [...ymlText.matchAll(/^(\w+):\s*(.+)$/gm)].map((m) => [m[1], m[2].trim().replace(/^["']|["']$/g, '')]),
);

const N = Number(process.argv[2] ?? 240);
const conn = await mysql.createConnection({ host: cfg.host, user: cfg.username, password: cfg.password, database: cfg.database });
const [rows] = await conn.query(
  `SELECT scramble FROM scrambles WHERE event_id='333' AND is_extra=0 AND scramble<>'' ORDER BY RAND() LIMIT ${N}`,
);
writeFileSync(resolve(__dirname, 'scrambles.txt'), rows.map((r) => r.scramble.trim()).join('\n') + '\n');
console.log('wrote', rows.length, 'scrambles → scrambles.txt');
await conn.end();
