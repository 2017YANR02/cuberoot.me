// Capacity admission for psql imports, using the filesystem containing load.sql.
// Production must keep PostgreSQL data/temp/WAL and the import directory on that
// filesystem. These are conservative estimates, not a filesystem quota: other
// writers and unusual row/index distributions can still consume extra space.
const RESERVE_BYTES = 1024 ** 3;

function identifier(value: string): string {
  if (!/^[a-z_][a-z0-9_]*$/.test(value)) throw new Error(`Invalid import identifier: ${value}`);
  return value;
}

function sourceFile(value: string): string {
  if (!/^[a-z0-9_][a-z0-9_.-]*\.tsv$/.test(value)) throw new Error(`Invalid import file: ${value}`);
  return value;
}

// df -Pk works on the Linux loader and macOS development machines. The numeric
// casts fail closed if either command fails or returns unexpected output.
function diskSnapshot(file?: string): string {
  return `\\set import_available_bytes \`LC_ALL=C df -Pk . | awk 'NR == 2 { printf "%.0f", $4 * 1024 }'\`
SELECT set_config('cuberoot.import_available_bytes', :'import_available_bytes', false);
${file ? `\\set import_source_bytes \`wc -c < ${sourceFile(file)}\`
SELECT set_config('cuberoot.import_source_bytes', :'import_source_bytes', false);
` : ''}`;
}

/** Check room for one temporary heap, its unique key index and index-build work. */
export function stagedCapacityGuard(table: string, file: string): string {
  identifier(table);
  return `${diskSnapshot(file)}DO $capacity$
DECLARE
  available numeric := current_setting('cuberoot.import_available_bytes')::numeric;
  source_bytes numeric := current_setting('cuberoot.import_source_bytes')::numeric;
  required numeric;
BEGIN
  IF available < 0 OR source_bytes < 0 THEN
    RAISE EXCEPTION 'Invalid capacity inputs for ${table}';
  END IF;
  -- Text can expand with tuple headers/alignment. A 75% allowance above the
  -- estimated heap covers the unique key index plus temporary index-build work.
  required := ${RESERVE_BYTES} + CEIL(GREATEST(source_bytes * 2,
    COALESCE(pg_table_size(to_regclass('${table}')), 0)) * 1.75);
  IF available < required THEN
    RAISE EXCEPTION 'Insufficient disk space before staging ${table}: available=%, estimated required=% (includes 1 GiB reserve)', available, required;
  END IF;
END $capacity$;
`;
}

export interface MutationCapacityOptions {
  table: string;
  stage?: string;
  columns?: string[];
  keyColumns?: string[];
  file?: string;
  mode?: 'full' | 'delta';
}

/**
 * With a stage: count actual inserted/changed/deleted keys before touching live
 * rows. Without a stage: reserve for a full DELETE/COPY, retaining old MVCC rows.
 * Three times the estimated new heap/index allocation allows for WAL and index
 * splits. Retained old tuples already occupy disk and are not counted twice.
 */
export function mutationCapacityGuard(options: MutationCapacityOptions): string {
  const table = identifier(options.table);
  if (!options.stage) {
    if (!options.file) throw new Error(`Full import capacity guard needs a file: ${table}`);
    const mode = options.mode ?? 'full';
    return `${diskSnapshot(options.file)}DO $capacity$
DECLARE
  available numeric := current_setting('cuberoot.import_available_bytes')::numeric;
  source_bytes numeric := current_setting('cuberoot.import_source_bytes')::numeric;
  heap_bytes numeric := COALESCE(pg_table_size(to_regclass('${table}')), 0);
  index_bytes numeric := COALESCE(pg_indexes_size(to_regclass('${table}')), 0);
  required numeric;
BEGIN
  IF available < 0 OR source_bytes < 0 THEN
    RAISE EXCEPTION 'Invalid capacity inputs for ${table}';
  END IF;
  -- Existing rows already occupy space. A delta needs new space only for its
  -- source rows; the reserve also allows delete WAL and concurrent activity.
  required := ${RESERVE_BYTES} + CEIL(${mode === 'delta' ? 'source_bytes * 2' : 'GREATEST(source_bytes * 2, heap_bytes)'}
    * (1 + index_bytes / GREATEST(heap_bytes, 1)) * 3);
  IF available < required THEN
    RAISE EXCEPTION 'Insufficient disk space for ${mode} MVCC replacement of ${table}: available=%, estimated required=% (includes 1 GiB reserve)', available, required;
  END IF;
END $capacity$;
`;
  }

  const stage = identifier(options.stage);
  const columns = options.columns?.map(identifier);
  const keys = options.keyColumns?.map(identifier);
  if (!columns?.length || !keys?.length || keys.some(key => !columns.includes(key))) {
    throw new Error(`Staged import capacity guard needs columns containing its keys: ${table}`);
  }
  const values = columns.filter(column => !keys.includes(column));
  const changed = values.length
    ? `ROW(${values.map(column => `s.${column}`).join(', ')}) IS DISTINCT FROM ROW(${values.map(column => `t.${column}`).join(', ')})`
    : 'FALSE';
  return `${diskSnapshot()}DO $capacity$
DECLARE
  available numeric := current_setting('cuberoot.import_available_bytes')::numeric;
  inserted_rows bigint;
  changed_rows bigint;
  deleted_rows bigint;
  target_rows bigint;
  stage_rows bigint;
  row_bytes numeric;
  stage_row_bytes numeric;
  stage_index_row_bytes numeric;
  previous_hashjoin text := current_setting('enable_hashjoin');
  required numeric;
BEGIN
  IF available < 0 THEN RAISE EXCEPTION 'Invalid capacity inputs for ${table}'; END IF;
  -- The key indexes support a merge join. A hash full join spills both large
  -- snapshots to disk before we can admit the mutation (verified with EXPLAIN).
  -- Limit the planner change to this accounting query, then restore the caller.
  PERFORM set_config('enable_hashjoin', 'off', true);
  SELECT
    COUNT(*) FILTER (WHERE t.${keys[0]} IS NULL),
    COUNT(*) FILTER (WHERE s.${keys[0]} IS NOT NULL AND t.${keys[0]} IS NOT NULL AND (${changed})),
    COUNT(*) FILTER (WHERE s.${keys[0]} IS NULL),
    COUNT(t.${keys[0]}), COUNT(s.${keys[0]})
  INTO inserted_rows, changed_rows, deleted_rows, target_rows, stage_rows
  FROM ${stage} s FULL JOIN ${table} t USING (${keys.join(', ')});
  PERFORM set_config('enable_hashjoin', previous_hashjoin, true);
  stage_row_bytes := pg_table_size('${stage}'::regclass)::numeric / GREATEST(stage_rows, 1);
  stage_index_row_bytes := pg_indexes_size('${stage}'::regclass)::numeric / GREATEST(stage_rows, 1);
  row_bytes := GREATEST(
    CASE WHEN target_rows > 0 THEN pg_table_size('${table}'::regclass)::numeric / target_rows ELSE 0 END,
    stage_row_bytes)
    + CASE WHEN target_rows > 0 THEN pg_indexes_size('${table}'::regclass)::numeric / target_rows
      ELSE stage_index_row_bytes * (SELECT COUNT(*) FROM pg_index WHERE indrelid = '${table}'::regclass) END;
  required := ${RESERVE_BYTES} + CEIL((inserted_rows + changed_rows) * row_bytes * 3 + deleted_rows * 128);
  IF available < required THEN
    RAISE EXCEPTION 'Insufficient disk space to refresh ${table}: available=%, estimated required=%, new=%, changed=%, deleted=% (includes 1 GiB reserve)', available, required, inserted_rows, changed_rows, deleted_rows;
  END IF;
END $capacity$;
`;
}
