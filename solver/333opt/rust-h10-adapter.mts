/** Protocol boundary for the independently validated, shared-table Rust batch engine. */
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { verifyOpt10Release } from '../experiments/cube48opt-rust/opt10-release.mts';
import { zbllOfficialReviewPath } from '../experiments/cube48opt-rust/opt10-zbll-policy.mts';

/** Dual-bottom setups wrap the bottom layer in x2 ... x2. Rust accepts
 * face turns only: conjugate the enclosed moves, retaining the exact frame.
 * Reject unbalanced/other rotations instead of silently changing the state. */
export function rustScramble(scramble: string): string {
  let flipped = false;
  const faces: Record<string, string> = { U: 'D', D: 'U', F: 'B', B: 'F', R: 'R', L: 'L' };
  const result: string[] = [];
  for (const token of scramble.trim().split(/\s+/).filter(Boolean)) {
    if (token === 'x2') { flipped = !flipped; continue; }
    if (!/^[URFDLB](?:2|')?$/.test(token)) throw Error(`Unsupported Rust setup move: ${token}`);
    result.push((flipped ? faces[token[0]] : token[0]) + token.slice(1));
  }
  if (flipped) throw Error('Unbalanced setup rotation');
  return result.join(' ');
}

export function rustCsv(line: string): string {
  const row = JSON.parse(line);
  if (!/^\d+$/.test(row.id) || row.cancelled !== false || !Number.isInteger(row.length) || row.length < 0 || row.length > 20
      || typeof row.solution !== 'string' || !/^(?:[URFDLB](?:2|')?(?:\s+|$))*$/.test(row.solution)
      || (row.solution.trim() ? row.solution.trim().split(/\s+/).length : 0) !== row.length)
    throw Error('Invalid/incomplete Rust H10 result');
  return `${row.id},${row.length},${row.solution.trim()}`;
}

export function rustConfiguration(root: string, table: string, threads: number) {
  const research = resolve(root, 'solver/experiments/cube48opt-rust');
  const binary = resolve(research, 'target/zbll/release/cube48opt-research');
  const acceptancePath = resolve(root, '.tmp/double-zbll-symmetry-v2/rust-h10-acceptance.json');
  const acceptance = JSON.parse(readFileSync(acceptancePath, 'utf8'));
  const sha256 = createHash('sha256').update(readFileSync(binary)).digest('hex');
  if (!Number.isInteger(threads) || threads < 1 || threads > 18 || acceptance.passed !== true || acceptance.binarySha256 !== sha256
      || acceptance.table !== table || !acceptance.report)
    throw Error('Rust H10 executable/thread configuration has not passed the ZBLL acceptance benchmark');
  return { binary, sha256, acceptancePath, args: [resolve(research, 'guard.mts'), 'double-zbll-batch', binary, 'solve-h10', table, '8', '20', '0'],
    env: { CUBEOPT_BACKEND: 'h10', CUBEOPT_SOLVE_THREADS: String(threads) } };
}

export function opt10Configuration(root: string, threads: number) {
  const research = resolve(root, 'solver/experiments/cube48opt-rust');
  const release = verifyOpt10Release();
  const binary = release.executable;
  const table = resolve(root, '.tmp/cubeopt-reverse/opt10-generated-v2/cuberoot-opt10.dat');
  const small = resolve(root, '.tmp/cubeopt-reverse/opt9-generated/small-memory.bin');
  const acceptancePath = zbllOfficialReviewPath;
  const acceptance = JSON.parse(readFileSync(acceptancePath,'utf8'));
  const sha256 = release.manifest.executable.sha256;
  if (!Number.isInteger(threads) || threads < 1 || threads > 18
      || acceptance.executableSha256 !== sha256 || acceptance.table?.path !== table
      || statSync(table).size !== 31_130_911_744 || statSync(small).size !== 818_008)
    throw Error('Rust Opt10 release or thread configuration differs from the reviewed artifacts');
  return { binary, sha256, table, acceptancePath, release:release.manifest.id,
    args:[resolve(research,'guard.mts'),'double-zbll-opt10-batch',binary,'solve-opt10',small,table,'8','20','0'],
    env:{CUBEOPT_BACKEND:'opt10',CUBEOPT_SOLVE_THREADS:'1',CUBEOPT_SEARCH_THREADS:String(threads),
      CUBEOPT_ZBLL_REVIEW:zbllOfficialReviewPath} };
}
