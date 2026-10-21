/** One resident analyzer per variant; checkpoints belong to the exact current input. */
import { open, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { appendUniqueById, exists, fileSize, ids, lines, openAnalyzerSession } from './common.js';

export type AnalyzerChunksOptions = {
  binary: string; input: string; output: string; log: string; env: NodeJS.ProcessEnv;
  label: string; master: string; target: string; chunkSize: number; maxChunks: number;
  args?: string[];
};

async function requireCompleteTail(path: string) {
  const size = await fileSize(path);
  if (size <= 0) return;
  const file = await open(path, 'r');
  const tail = Buffer.alloc(1);
  try { await file.read(tail, 0, 1, size - 1); } finally { await file.close(); }
  if (tail[0] !== 10) throw new Error(`Incomplete final CSV/input row; preserve and review ${path}`);
}

function inputRows(source: string): Map<string, string> {
  const result = new Map<string, string>();
  for (const row of source.split('\n').filter(Boolean)) {
    const comma = row.indexOf(',');
    if (comma <= 0 || result.has(row.slice(0, comma))) throw new Error('Invalid or duplicate analyzer input ID');
    result.set(row.slice(0, comma), row);
  }
  return result;
}

/** Validate the complete CSV before committing any row to the accumulated dataset. */
export async function validateAnalyzerOutput(input: string, output: string) {
  await requireCompleteTail(input);
  await requireCompleteTail(output);
  const expected = inputRows(await readFile(input, 'utf8'));
  let columns = 0;
  for await (const row of lines(output)) {
    if (!columns) {
      const header = row.split(',');
      if (header[0] !== 'id' || header.length < 2 || new Set(header).size !== header.length) throw new Error(`Invalid analyzer header: ${output}`);
      columns = header.length;
      continue;
    }
    const fields = row.split(',');
    if (fields.length !== columns || !expected.delete(fields[0]) || fields.slice(1).some(value => !/^\d+$/.test(value))) {
      throw new Error(`Invalid, duplicate or unexpected analyzer result: ${output}`);
    }
  }
  if (!columns || expected.size) throw new Error(`Incomplete analyzer results: ${output}; missing ${expected.size}`);
}

export async function syncAnalyzerChunks(options: AnalyzerChunksOptions): Promise<number> {
  const { binary, input, output, log, env, label, master, target, chunkSize, maxChunks } = options;
  const sidecars = [`${output}.checkpoint`, `${output}.checkpoint.meta`, output];
  await requireCompleteTail(target);
  let have = await ids(target, true);
  const pending = await exists(sidecars[0]) || await exists(sidecars[1]);
  let previous = new Map<string, string>();
  if (pending) {
    await requireCompleteTail(input);
    previous = inputRows(await readFile(input, 'utf8'));
    const unmatched = new Map(previous);
    for await (const row of lines(master)) {
      const id = row.slice(0, row.indexOf(','));
      if (!unmatched.has(id)) continue;
      if (unmatched.get(id) !== row) throw new Error(`Checkpoint scramble changed in master: ${id}`);
      unmatched.delete(id);
    }
    if (unmatched.size) throw new Error('Checkpoint contains IDs absent from the master corpus');
  } else if (await exists(output)) {
    throw new Error(`Unverified analyzer output without a checkpoint; preserve and review ${output}`);
  }
  const clearCommitted = async () => {
    for (const file of sidecars) if (await exists(file)) await unlink(file);
  };
  let session: Awaited<ReturnType<typeof openAnalyzerSession>> | undefined;
  let added = 0;
  const runInput = async () => {
    session ??= await openAnalyzerSession(binary, log, env, label, options.args ?? []);
    console.log(`[${label}] resident analyzer PID ${session.pid}`);
    await session.run(input, output);
    await validateAnalyzerOutput(input, output);
    if (await fileSize(target) > 0) {
      const firstLine = async (path: string) => { for await (const row of lines(path)) return row; };
      if (await firstLine(target) !== await firstLine(output)) throw new Error(`Analyzer CSV schema differs from saved dataset: ${target}`);
    }
    added += await appendUniqueById(target, output, true, true);
    // The merged data is durable before deleting its recovery evidence.
    const file = await open(target, 'r');
    try { await file.sync(); } finally { await file.close(); }
    await clearCommitted();
  };
  try {
    if (pending) {
      if ([...previous.keys()].some(id => !have.has(id))) await runInput();
      else await clearCommitted(); // interrupted after merge, before cleanup
      have = await ids(target, true);
    }
    const missing: string[] = [];
    for await (const row of lines(master)) {
      const comma = row.indexOf(',');
      if (comma > 0 && !have.has(row.slice(0, comma))) missing.push(row);
    }
    if (!missing.length) { console.log(`[${label}] 已最新 (${have.size} 条)`); return added; }
    console.log(`[${label}] 待补 ${missing.length} 条，chunk=${chunkSize}`);
    let chunks = 0;
    for (let i = 0; i < missing.length; i += chunkSize) {
      const temporary = `${input}.next`;
      await writeFile(temporary, `${missing.slice(i, i + chunkSize).join('\n')}\n`);
      await rename(temporary, input);
      await runInput();
      chunks++;
      if (maxChunks && chunks >= maxChunks) break;
    }
    console.log(`[${label}] 已补 ${added} 条`);
    return added;
  } finally {
    if (session) {
      // On error abort the owned process; successful batches close without reloading tables.
      try { await session.close(); } catch (error) { await session.abort(); throw error; }
    }
  }
}
