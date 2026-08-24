import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  applyClockMoves,
  clockStateFromAlg,
  isClockSolved,
  parseClockMoves,
} from '@cuberoot/puzzle-solvers/clock';
import { describe, expect, it } from 'vitest';
import { processClockBlock } from '../src/clock_analyzer.mts';

const SCRAMBLES = new Map([
  ['101', 'UR2+ y2 DL3-'],
  ['102', 'UR3+ DR2- DL1+ UL4- U2+ R1- D3+ L2- ALL5+ y2 U1- R2+ D3- L4+ ALL6+'],
]);

function verifyCsv(csvPath: string): void {
  const lines = readFileSync(csvPath, 'utf8').trim().split('\n');
  expect(lines[0]).toBe('id,clock,soln');
  expect(lines).toHaveLength(SCRAMBLES.size + 1);
  for (const line of lines.slice(1)) {
    const [id, lengthText, solution = ''] = line.split(',');
    const scramble = SCRAMBLES.get(id);
    expect(scramble, `unknown id ${id}`).toBeDefined();
    const start = clockStateFromAlg(scramble!);
    const moves = parseClockMoves(solution);
    expect(moves).toHaveLength(Number(lengthText));
    expect(isClockSolved(applyClockMoves(start, moves))).toBe(true);
  }
}

describe('Clock analyzer runtime contract', () => {
  it('emits valid solutions in single-thread and worker modes', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'cuberoot-clock-analyzer-'));
    try {
      for (const threads of [1, 2] as const) {
        const blockPath = join(tempRoot, `clock-${threads}.txt`);
        writeFileSync(blockPath, [...SCRAMBLES].map(([id, scramble]) => `${id},${scramble}`).join('\n'));
        const result = await processClockBlock(blockPath, { emitSolution: true, threads });
        expect(result.mode).toBe(threads === 1 ? 'single' : 'worker');
        verifyCsv(result.outPath);
      }
    } finally {
      rmSync(tempRoot, { force: true, recursive: true });
    }
  }, 60_000);
});
