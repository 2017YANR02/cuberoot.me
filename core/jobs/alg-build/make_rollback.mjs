/**
 * 从 `pg_dump` 的备份里切出 alg_cases 的整表回滚脚本。
 *
 * alg_cases **没有任何入向外键**(实测:`SELECT conrelid FROM pg_constraint WHERE confrelid =
 * 'alg_cases'::regclass` 为空,连 alg_submissions 都不指它),所以整表 TRUNCATE + 灌回是安全的。
 * pg_dump 的 COPY 显式列出列名,多一个 `meta` 列照样灌得进(回滚后 meta 为 NULL)——
 * migration 0069 不回滚,加一列是无害的。
 *
 *   node make_rollback.mjs .tmp/phase4/alg_backup_20260713.sql
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../../..');
const src = path.join(ROOT, process.argv[2] ?? '.tmp/phase4/alg_backup_20260713.sql');
const lines = readFileSync(src, 'utf8').split('\n');

const i = lines.findIndex((l) => l.startsWith('COPY public.alg_cases ('));
if (i < 0) throw new Error('备份里找不到 alg_cases 的 COPY 块');
let j = i + 1;
while (j < lines.length && lines[j] !== '\\.') j++;
if (j >= lines.length) throw new Error('COPY 块没有收尾的 \\.');

const out = [
  `-- 1LLL 导入的回滚 —— 把 alg_cases 整表还原到 ${path.basename(src)} 那一刻的快照。`,
  '-- alg_cases 没有入向外键,整表换掉不会孤儿化任何东西。',
  '-- meta 列(migration 0069)保留,回滚后为 NULL。',
  'BEGIN;',
  'TRUNCATE TABLE alg_cases;',
  ...lines.slice(i, j + 1),
  "SELECT setval('alg_cases_id_seq', (SELECT COALESCE(MAX(id), 1) FROM alg_cases), true);",
  'COMMIT;',
  '',
].join('\n');

const dst = path.join(path.dirname(src), 'rollback_1lll.sql');
writeFileSync(dst, out);
console.log(`回滚脚本:${j - i - 1} 行数据 → ${path.relative(ROOT, dst)}`);
