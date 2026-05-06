#!/usr/bin/env node
/**
 * Convert a `mysqldump` SQL file into a PostgreSQL-compatible script.
 *
 * Strategy: schema is already created by schema.pg.sql, so we strip everything
 * structural and keep only INSERT statements. The biggest gotcha is string
 * escaping — mysqldump uses C-style backslash escapes (`\'`, `\\`, `\n`, ...)
 * which PostgreSQL only honors inside E'...' literals. We wrap the output
 * with `SET standard_conforming_strings = OFF` so PG accepts the escapes
 * verbatim for this session.
 *
 * Usage:
 *   node mysql_dump_to_pg.mjs <input.sql> > <output.sql>
 */
import { readFileSync, writeFileSync } from 'node:fs';

const [, , inFile, outFile] = process.argv;
if (!inFile || !outFile) {
  console.error('usage: mysql_dump_to_pg.mjs <input.sql> <output.sql>');
  process.exit(1);
}

const src = readFileSync(inFile, 'utf8');
const lines = src.split(/\r?\n/);

const out = [
  '-- Auto-generated from mysqldump by mysql_dump_to_pg.mjs',
  '-- Schema is assumed pre-created by schema.pg.sql.',
  'SET standard_conforming_strings = OFF;',
  'SET escape_string_warning = OFF;',
  'SET client_min_messages = WARNING;',
  'BEGIN;',
  '',
];

let inCreateBlock = false;
let kept = 0;
let skipped = 0;

for (const raw of lines) {
  const line = raw;

  // skip empty / pure comment lines
  if (!line.trim() || line.startsWith('--')) { skipped++; continue; }

  // skip mysqldump conditional comments /*!.../*/
  if (/^\s*\/\*!/.test(line) && /\*\/\s*;?\s*$/.test(line)) { skipped++; continue; }

  // skip the leading sandbox-mode marker `/*M!999999\- ... */`
  if (/^\s*\/\*M!\d+/.test(line)) { skipped++; continue; }

  // start of a CREATE TABLE block — skip until matching `) ENGINE=...`
  if (/^\s*DROP TABLE IF EXISTS/.test(line)) { skipped++; continue; }
  if (/^\s*CREATE TABLE/.test(line)) { inCreateBlock = true; skipped++; continue; }
  if (inCreateBlock) {
    skipped++;
    if (/^\s*\)\s*ENGINE=/.test(line)) inCreateBlock = false;
    continue;
  }

  // skip LOCK / UNLOCK / KEYS toggles
  if (/^\s*(LOCK|UNLOCK)\s+TABLES/.test(line)) { skipped++; continue; }

  // INSERT — strip backticks and add OVERRIDING SYSTEM VALUE if needed
  if (/^\s*INSERT INTO/.test(line)) {
    const transformed = line.replace(/`([a-zA-Z0-9_]+)`/g, '$1');
    out.push(transformed);
    kept++;
    continue;
  }

  skipped++;
}

out.push('', 'COMMIT;', '');
writeFileSync(outFile, out.join('\n'), 'utf8');
console.error(`kept ${kept} INSERT lines, skipped ${skipped} non-data lines → ${outFile}`);
