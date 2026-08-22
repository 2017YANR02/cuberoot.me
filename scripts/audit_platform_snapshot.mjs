#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { basename } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const RELATIONSHIPS = [
  ['courses', 'instructor_id', 'instructors', 'id', true],
  ['instructors', 'user_id', 'users', 'id', true],
  ['users', 'instructor_id', 'instructors', 'id', true],
  ['orders', 'user_id', 'users', 'id', false],
  ['payment_logs', 'order_id', 'orders', 'id', false],
  ['instructor_applications', 'user_id', 'users', 'id', true],
  ['posts', 'author_id', 'users', 'id', false],
  ['comments', 'post_id', 'posts', 'id', false],
  ['comments', 'author_id', 'users', 'id', false],
  ['post_likes', 'post_id', 'posts', 'id', false],
  ['post_likes', 'user_id', 'users', 'id', false],
  ['invite_codes', 'owner_id', 'users', 'id', false],
  ['memberships', 'user_id', 'users', 'id', false],
  ['memberships', 'order_id', 'orders', 'id', true],
  ['instructor_payouts', 'instructor_id', 'instructors', 'id', false],
  ['lessons', 'course_id', 'courses', 'id', false],
  ['learning_progress', 'user_id', 'users', 'id', false],
  ['learning_progress', 'lesson_id', 'lessons', 'id', false],
  ['learning_progress', 'course_id', 'courses', 'id', false],
  ['favorites', 'user_id', 'users', 'id', false],
  ['timer_solves', 'user_id', 'users', 'id', false],
  ['study_checkins', 'user_id', 'users', 'id', false],
  ['point_ledger', 'user_id', 'users', 'id', false],
  ['course_reviews', 'course_id', 'courses', 'id', false],
  ['course_reviews', 'user_id', 'users', 'id', false],
  ['user_achievements', 'user_id', 'users', 'id', false],
  ['circle_members', 'user_id', 'users', 'id', false],
  ['notifications', 'user_id', 'users', 'id', false],
  ['notifications', 'actor_id', 'users', 'id', true],
  ['lesson_notes', 'user_id', 'users', 'id', false],
  ['lesson_notes', 'lesson_id', 'lessons', 'id', false],
  ['lesson_notes', 'course_id', 'courses', 'id', false],
  ['quizzes', 'lesson_id', 'lessons', 'id', false],
  ['quizzes', 'course_id', 'courses', 'id', false],
  ['quiz_attempts', 'user_id', 'users', 'id', false],
  ['quiz_attempts', 'quiz_id', 'quizzes', 'id', false],
  ['quiz_attempts', 'lesson_id', 'lessons', 'id', false],
  ['certificates', 'user_id', 'users', 'id', false],
  ['certificates', 'course_id', 'courses', 'id', false],
  ['collection_items', 'collection_id', 'collections', 'id', false],
  ['collection_items', 'course_id', 'courses', 'id', false],
];

const [sourcePath, restorePath] = process.argv.slice(2);
if (!sourcePath || !restorePath) {
  console.error('Usage: node scripts/audit_platform_snapshot.mjs <source.sqlite> <restore.sqlite>');
  process.exit(2);
}

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const quoteIdentifier = (value) => `"${value.replaceAll('"', '""')}"`;
const normalizeValue = (value) => {
  if (typeof value === 'bigint') return { type: 'bigint', value: value.toString() };
  if (value instanceof Uint8Array) return { type: 'blob', value: Buffer.from(value).toString('hex') };
  return value;
};

function openReadOnly(path) {
  return new DatabaseSync(path, { readOnly: true });
}

function businessTables(db) {
  return db.prepare(`
    SELECT name, sql
    FROM sqlite_schema
    WHERE type = 'table'
      AND sql IS NOT NULL
      AND name NOT LIKE 'sqlite_%'
      AND name <> '__drizzle_migrations'
      AND name NOT LIKE '%_fts%'
    ORDER BY name
  `).all();
}

function inspectDatabase(path) {
  const db = openReadOnly(path);
  try {
    const integrity = db.prepare('PRAGMA integrity_check').all().map((row) => row.integrity_check);
    const tables = businessTables(db);
    const schemaPayload = tables.map(({ name, sql }) => ({
      table: name,
      sql: sql.trim().replaceAll(/\s+/g, ' '),
    }));
    const logicalPayload = [];
    const tableCounts = [];

    for (const { name } of tables) {
      const quotedTable = quoteIdentifier(name);
      const columns = db.prepare(`PRAGMA table_info(${quotedTable})`).all()
        .sort((a, b) => Number(a.cid) - Number(b.cid))
        .map((column) => column.name);
      const rows = db.prepare(`SELECT * FROM ${quotedTable}`).all()
        .map((row) => columns.map((column) => normalizeValue(row[column])))
        .map((row) => JSON.stringify(row))
        .sort();
      tableCounts.push({ table: name, rows: rows.length });
      logicalPayload.push({ table: name, columns, rows });
    }

    const relationships = RELATIONSHIPS.map(([childTable, childColumn, parentTable, parentColumn, nullable], index) => {
      const childTableSql = quoteIdentifier(childTable);
      const childColumnSql = quoteIdentifier(childColumn);
      const parentTableSql = quoteIdentifier(parentTable);
      const parentColumnSql = quoteIdentifier(parentColumn);
      const counts = db.prepare(`
        SELECT
          COUNT(*) AS total_rows,
          SUM(CASE WHEN c.${childColumnSql} IS NULL THEN 1 ELSE 0 END) AS null_rows,
          SUM(CASE WHEN c.${childColumnSql} IS NOT NULL AND p.${parentColumnSql} IS NULL THEN 1 ELSE 0 END) AS missing_rows
        FROM ${childTableSql} AS c
        LEFT JOIN ${parentTableSql} AS p ON c.${childColumnSql} = p.${parentColumnSql}
      `).get();
      const totalRows = Number(counts.total_rows ?? 0);
      const nullRows = Number(counts.null_rows ?? 0);
      return {
        id: `rel-${String(index + 1).padStart(3, '0')}`,
        child: `${childTable}.${childColumn}`,
        parent: `${parentTable}.${parentColumn}`,
        nullable,
        checked_child_rows: totalRows - nullRows,
        null_child_rows: nullRows,
        missing_parent_rows: Number(counts.missing_rows ?? 0),
      };
    });

    return {
      file: basename(path),
      sha256: sha256(readFileSync(path)),
      bytes: statSync(path).size,
      integrity_check: integrity.length === 1 ? integrity[0] : integrity,
      business_table_count: tables.length,
      business_row_count: tableCounts.reduce((sum, item) => sum + item.rows, 0),
      schema_sha256: sha256(JSON.stringify(schemaPayload)),
      logical_content_sha256: sha256(JSON.stringify(logicalPayload)),
      table_counts: tableCounts,
      relationship_checks: relationships,
    };
  } finally {
    db.close();
  }
}

const source = inspectDatabase(sourcePath);
const restore = inspectDatabase(restorePath);
const tableCounts = source.table_counts.map((entry, index) => ({
  table: entry.table,
  source_rows: entry.rows,
  restore_rows: restore.table_counts[index]?.table === entry.table
    ? restore.table_counts[index].rows
    : null,
  equal: restore.table_counts[index]?.table === entry.table
    && restore.table_counts[index].rows === entry.rows,
}));
const relationshipChecks = source.relationship_checks.map((entry, index) => {
  const restored = restore.relationship_checks[index];
  return {
    ...entry,
    restore_equal: JSON.stringify(entry) === JSON.stringify(restored),
  };
});

const disposition = {
  merged_no_write: 35,
  rejected: 4,
  reversible_archive_pending_owner: 158,
  retained_under_policy: 960,
  imported: 0,
  blocked: 0,
};
const dispositionTotal = Object.values(disposition).reduce((sum, count) => sum + count, 0);

const report = {
  format_version: 1,
  snapshot_id: 'platform-production-frozen-20260822T1205Z',
  generated_utc: new Date().toISOString(),
  verifier: {
    tool: 'node:sqlite',
    tool_version: process.versions.node,
    check_spec_sha256: sha256(readFileSync(new URL(import.meta.url))),
    normalization_version: 1,
  },
  source: {
    file: source.file,
    sha256: source.sha256,
    bytes: source.bytes,
    integrity_check: source.integrity_check,
    business_table_count: source.business_table_count,
    business_row_count: source.business_row_count,
  },
  restore: {
    file: restore.file,
    sha256: restore.sha256,
    bytes: restore.bytes,
    integrity_check: restore.integrity_check,
    business_table_count: restore.business_table_count,
    business_row_count: restore.business_row_count,
  },
  schema: {
    method: 'audit-v1: sorted business table names plus whitespace-normalized CREATE TABLE SQL',
    source_sha256: source.schema_sha256,
    restore_sha256: restore.schema_sha256,
    equal: source.schema_sha256 === restore.schema_sha256,
  },
  logical_content: {
    method: 'audit-v1: table name and cid-ordered columns plus lexicographically sorted normalized JSON rows; bigint and blob values tagged',
    source_sha256: source.logical_content_sha256,
    restore_sha256: restore.logical_content_sha256,
    equal: source.logical_content_sha256 === restore.logical_content_sha256,
  },
  table_counts: tableCounts,
  relationship_checks: relationshipChecks,
  disposition: {
    source_rows: source.business_row_count,
    ...disposition,
    difference: source.business_row_count - dispositionTotal,
  },
};

const failed = source.integrity_check !== 'ok'
  || restore.integrity_check !== 'ok'
  || !report.schema.equal
  || !report.logical_content.equal
  || tableCounts.some((entry) => !entry.equal)
  || relationshipChecks.some((entry) => entry.missing_parent_rows !== 0 || !entry.restore_equal)
  || report.disposition.difference !== 0;

console.log(JSON.stringify(report, null, 2));
if (failed) process.exitCode = 1;
