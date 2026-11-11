/** Decode only at the TSV boundary; line-oriented solver inputs stay single-line. */
import { createWriteStream } from 'node:fs';
import { appendFile, rename, rm } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { decodeWcaTsvField } from '../../core/jobs/scramble-stats-build/src/wca_tsv.mjs';
import { exists, lines } from './common.js';

export function puzzleScrambleFromTsv(raw: string): string {
  const decoded = decodeWcaTsvField(raw);
  // Unknown/double-escaped sequences are invalid notation, not permission to
  // decode twice or discard arbitrary characters from the official scramble.
  if (/[\\\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(decoded)) throw Error('Unsupported escape/control character in puzzle scramble');
  return decoded.replace(/[\r\n\t]+/g, ' ').trim();
}

type Repair = { before: string; after: string };
async function rewrite(file: string, transform: (row: string) => string | null): Promise<number> {
  if (!await exists(file)) return 0;
  const temporary = `${file}.${process.pid}.next`;
  let changed = 0;
  async function* output() {
    for await (const row of lines(file)) {
      const next = transform(row);
      if (next !== row) changed++;
      if (next !== null) yield `${next}\n`;
    }
  }
  try {
    await pipeline(Readable.from(output()), createWriteStream(temporary, { flags: 'wx' }));
    if (changed) await rename(temporary, file);
    return changed;
  } finally { await rm(temporary, { force: true }); }
}

/** Reset only parse-error sentinels whose original input has an evidenced repair. */
export async function repairPuzzleCorpus(file: string, repairs: Map<string, Repair>, results: string[]): Promise<void> {
  if (!repairs.size) return;
  await appendFile(`${file}.input-repairs.jsonl`, [...repairs].map(([id, r]) => JSON.stringify({ at: new Date().toISOString(), id, ...r }) + '\n').join(''));
  // Invalidate before rewriting input: a crash cannot leave corrected input
  // permanently hidden behind the old "done" ID. Successful rows and M remain.
  for (const result of results) await rewrite(result, row => {
    const [id, value] = row.split(',', 2);
    return repairs.has(id) && value === '-' ? null : row;
  });
  await rewrite(file, row => {
    const comma = row.indexOf(','), id = row.slice(0, comma), repair = repairs.get(id);
    if (!repair) return row;
    if (row.slice(comma + 1) !== repair.before) throw Error(`Puzzle corpus changed during repair: ${id}`);
    return `${id},${repair.after}`;
  });
}

export async function puzzleInputFailures(file: string): Promise<number> {
  if (!await exists(file)) return 0;
  let count = 0;
  for await (const row of lines(file)) if (/^\d+,-(?:,|$)/.test(row)) count++;
  return count;
}
