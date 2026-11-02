import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { once } from 'node:events';
import { createInterface } from 'node:readline';

export const FLAT_COLUMNS = 'event_id, is_avg, value, wca_id, person_country_id, comp_id, comp_date, attempts, round_type_id, format_id, record_tag';
export const PERSON_COLUMNS = 'wca_id, comp_id, comp_date, event_id, round_type_id, format_id, pos, best, average, attempts, single_record, average_record';
const HEADER = '# wca-row-fingerprints 1';
const EMPTY = '0:0:0';
export type RowDigest = { count: number; a: bigint; b: bigint };
export type RowDigests = Map<string, RowDigest>;
export interface StoredCompetition { hash: bigint | null; flat: string; person: string }

export function addRow(digests: RowDigests, id: string, row: string) {
  const hash = createHash('md5').update(row).digest('hex');
  const entry = digests.get(id) ?? { count: 0, a: 0n, b: 0n };
  entry.count++;
  entry.a += BigInt('0x' + hash.slice(0, 15));
  entry.b += BigInt('0x' + hash.slice(16, 31));
  digests.set(id, entry);
}
export function signature(digest?: RowDigest): string {
  return digest ? `${digest.count}:${digest.a}:${digest.b}` : EMPTY;
}

export async function digestFile(path: string, compColumn: number): Promise<RowDigests> {
  const digests: RowDigests = new Map();
  for await (const line of createInterface({ input: createReadStream(path), crlfDelay: Infinity })) {
    addRow(digests, line.split('\t')[compColumn]!, line);
  }
  return digests;
}

export function parseFingerprintSnapshot(text: string): Map<string, StoredCompetition> {
  const lines = text.trimEnd().split('\n');
  if (lines.shift() !== HEADER) throw new Error('Missing/unsupported fingerprint snapshot; refusing full-import fallback');
  if (lines.pop() !== '# end') throw new Error('Incomplete fingerprint snapshot');
  const rows = new Map<string, StoredCompetition>();
  for (const line of lines) {
    const [id, hash, flat, person, ...extra] = line.split('\t');
    if (!id || !/^[A-Za-z0-9_]+$/.test(id) || rows.has(id) || extra.length
      || !/^(\d+|-)$/.test(hash ?? '') || !/^\d+:\d+:\d+$/.test(flat ?? '') || !/^\d+:\d+:\d+$/.test(person ?? '')) {
      throw new Error('Invalid/duplicate fingerprint snapshot row');
    }
    rows.set(id, { hash: hash === '-' ? null : BigInt(hash!), flat: flat!, person: person! });
  }
  if (!rows.size) throw new Error('Empty fingerprint snapshot; bootstrap must be explicit');
  return rows;
}

export function planIncremental(previous: Map<string, StoredCompetition>, flat: RowDigests, person: RowDigests) {
  const ids = new Set([...flat.keys(), ...person.keys()]);
  const changed = new Set<string>();
  const hashes = new Map<string, bigint>();
  for (const id of ids) {
    const f = signature(flat.get(id)), p = signature(person.get(id));
    const old = previous.get(id);
    const equal = (old?.flat ?? EMPTY) === f && (old?.person ?? EMPTY) === p;
    if (!equal) changed.add(id);
    // Snapshot labels are opaque. Preserve them when actual contents are equal,
    // irrespective of which algorithm originally produced the stored label.
    let hash = equal && old?.hash != null ? old.hash
      : BigInt('0x' + createHash('sha256').update(`${f}|${p}`).digest('hex').slice(0, 15));
    if (!equal && hash === old?.hash) hash ^= 1n;
    hashes.set(id, hash);
  }
  for (const [id, old] of previous) if (!ids.has(id) && (old.flat !== EMPTY || old.person !== EMPTY)) changed.add(id);
  return { changed, hashes };
}

/** Stream the existing builder output; only delta files leave the CI runner. */
export async function extractDelta(source: string, target: string, compColumn: number, changed: Set<string>) {
  const output = createWriteStream(target);
  const finished = once(output, 'finish');
  let count = 0;
  try {
    for await (const line of createInterface({ input: createReadStream(source), crlfDelay: Infinity })) {
      if (!changed.has(line.split('\t')[compColumn]!)) continue;
      if (!output.write(line + '\n')) await once(output, 'drain');
      count++;
    }
    output.end();
    await finished;
    await unlink(source);
    return count;
  } catch (error) { output.destroy(); void finished.catch(() => {}); throw error; }
}

// COPY TEXT encoding matches the builder. Include all business columns, not
// generated ids. Count + two 60-bit sums preserve duplicate multiplicity without
// sorting/materializing a second large table. This is the same path every day.
function copyText(column: string): string {
  const value = column === 'is_avg' ? "CASE WHEN is_avg THEN 't' ELSE 'f' END" : `${column}::text`;
  return `COALESCE(replace(replace(replace(replace(${value}, chr(92), chr(92)||chr(92)), chr(9), chr(92)||'t'), chr(10), chr(92)||'n'), chr(13), chr(92)||'r'), chr(92)||'N')`;
}
function aggregate(table: string, columns: string) {
  return `SELECT comp_id, count(*)::text || ':' || sum(('x'||substr(d,1,15))::bit(60)::bigint)::text || ':' || sum(('x'||substr(d,17,15))::bit(60)::bigint)::text AS signature
FROM (SELECT comp_id, md5(concat_ws(chr(9), ${columns.split(', ').map(copyText).join(', ')})) AS d FROM ${table}) rows
GROUP BY comp_id`;
}
export function fingerprintSnapshotSql(): string {
  return `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '10min';
SET LOCAL work_mem = '16MB';
SET LOCAL max_parallel_workers_per_gather = 0;
SET LOCAL DateStyle = 'ISO, YMD';
DO $$ BEGIN IF NOT pg_try_advisory_xact_lock(1129665108,1398030676) THEN RAISE EXCEPTION 'Stats import active'; END IF; END $$;
SELECT '${HEADER}';
WITH f AS (${aggregate('wca_results_flat', FLAT_COLUMNS)}),
p AS (${aggregate('wca_person_results', PERSON_COLUMNS)}),
ids AS (SELECT comp_id FROM f UNION SELECT comp_id FROM p UNION SELECT comp_id FROM wca_comp_updated_at)
SELECT ids.comp_id, COALESCE(m.content_hash::text, '-'), COALESCE(f.signature, '${EMPTY}'), COALESCE(p.signature, '${EMPTY}')
FROM ids LEFT JOIN f USING(comp_id) LEFT JOIN p USING(comp_id) LEFT JOIN wca_comp_updated_at m USING(comp_id)
ORDER BY ids.comp_id;
SELECT '# end';
COMMIT;
`;
}
if (process.argv.includes('--snapshot-sql')) process.stdout.write(fingerprintSnapshotSql());
