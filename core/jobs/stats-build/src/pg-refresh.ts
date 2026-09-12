/** PostgreSQL refreshes for the offline stats importers. Keep live relation OIDs
 * and use MVCC: readers see the previous committed data throughout an import.
 * In particular, never TRUNCATE/rename live tables inside a bulk-load transaction.
 */
import { mutationCapacityGuard, stagedCapacityGuard } from './pg-import-capacity.js';

export interface TableRefresh {
  table: string;
  columns: string[];
  keyColumns: string[];
  file: string;
  expectedRows?: number;
}

function identifier(value: string): string {
  if (!/^[a-z][a-z0-9_]{0,47}$/.test(value)) throw new Error(`Invalid import identifier: ${value}`);
  return value;
}

/** These daily stats importers share a transaction lock, including schema preparation.
 * Fail before touching tables when another import is active. The bounded lock
 * wait applies only to the importer, never to online API queries.
 */
export function importTransactionStart(tag: string): string {
  identifier(tag);
  return `BEGIN;
SET LOCAL lock_timeout = '2s';
DO $import_lock$
BEGIN
  IF NOT pg_try_advisory_xact_lock(1129665108, 1398030676) THEN
    RAISE EXCEPTION 'Another stats import is active; refusing ${tag}';
  END IF;
END $import_lock$;`;
}

/** Caller owns BEGIN/COMMIT and updates import metadata in that same transaction.
 * Stage one table at a time, retaining only its unique key index. Filter before
 * UPDATE so unchanged rows are not even row-locked or rewritten (including WAL).
 * Explicit columns preserve unrelated/default/generated columns on live tables.
 */
export function refreshTable({ table, columns, keyColumns, file, expectedRows }: TableRefresh): string {
  identifier(table);
  columns.forEach(identifier);
  keyColumns.forEach(identifier);
  if (!columns.length || !keyColumns.length || new Set(columns).size !== columns.length
    || new Set(keyColumns).size !== keyColumns.length || keyColumns.some((key) => !columns.includes(key))) {
    throw new Error(`Invalid refresh columns: ${table}`);
  }
  if (!/^[a-z][a-z0-9_]*\.copy\.tsv$/.test(file)) throw new Error(`Invalid import file: ${file}`);
  if (expectedRows !== undefined && (!Number.isSafeInteger(expectedRows) || expectedRows < 0)) {
    throw new Error(`Invalid expected row count: ${table}`);
  }
  const stage = `_refresh_${table}`;
  const cols = columns.join(', ');
  const keys = keyColumns.join(', ');
  const values = columns.map((column) => `incoming.${column}`).join(', ');
  const changedColumns = columns.filter((column) => !keyColumns.includes(column));
  const join = keyColumns.map((key) => `current.${key} = incoming.${key}`).join(' AND ');
  const difference = (left: string, right: string) => `ROW(${changedColumns.map((column) => `${left}.${column}`).join(', ')}) IS DISTINCT FROM ROW(${changedColumns.map((column) => `${right}.${column}`).join(', ')})`;
  const update = changedColumns.length
    ? `UPDATE ${table} AS current SET ${changedColumns.map((column) => `${column} = incoming.${column}`).join(', ')}\nFROM ${stage} AS incoming WHERE ${join} AND ${difference('current', 'incoming')};`
    : '';
  const countGuard = expectedRows === undefined ? '' : `
DO $import_count$
DECLARE actual bigint;
BEGIN
  SELECT count(*) INTO actual FROM ${stage};
  IF actual <> ${expectedRows} THEN
    RAISE EXCEPTION '${table}: expected ${expectedRows} rows, received %', actual;
  END IF;
END $import_count$;
`;
  return `-- Refresh ${table}: committed readers remain available; unchanged rows stay intact.
${stagedCapacityGuard(table, file)}
CREATE TEMP TABLE ${stage} ON COMMIT DROP AS SELECT ${cols} FROM ${table} WITH NO DATA;
\\copy ${stage} (${cols}) FROM '${file}';
ALTER TABLE ${stage} ADD PRIMARY KEY (${keys});
ANALYZE ${stage};
${countGuard}
${mutationCapacityGuard({ table, stage, columns, keyColumns })}
-- Serialize writers without blocking SELECT. Logical keys also work for the
-- monthly snapshots whose lookup index is deliberately non-unique.
LOCK TABLE ${table} IN SHARE ROW EXCLUSIVE MODE;
-- Both sides have key indexes. Use ordered joins for this refresh only, avoiding
-- multi-gigabyte hash spills on the history tables in a low-space installation.
SELECT set_config('cuberoot.refresh_hashjoin', current_setting('enable_hashjoin'), true);
SET LOCAL enable_hashjoin = off;
${update}
INSERT INTO ${table} (${cols})
SELECT ${values} FROM ${stage} AS incoming
LEFT JOIN ${table} AS current ON ${join}
WHERE current.${keyColumns[0]} IS NULL;
DELETE FROM ${table} AS current
WHERE NOT EXISTS (SELECT 1 FROM ${stage} AS incoming WHERE ${join});
DO $import_exact$
BEGIN
  IF (SELECT count(*) FROM ${table}) <> (SELECT count(*) FROM ${stage}) THEN
    RAISE EXCEPTION '${table}: refresh row count mismatch (duplicate live keys)';
  END IF;
END $import_exact$;
SELECT set_config('enable_hashjoin', current_setting('cuberoot.refresh_hashjoin'), true);
-- This table was created in this transaction. PostgreSQL can truncate its files
-- in place now; DROP alone defers physical removal until the whole batch commits.
-- Only the session-local stage is truncated, never an online relation.
TRUNCATE pg_temp.${stage};
DROP TABLE pg_temp.${stage};`;
}
