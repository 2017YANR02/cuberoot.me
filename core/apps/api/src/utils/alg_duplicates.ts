import { HTTPException } from 'hono/http-exception';
import { duplicateAlgKey, findDuplicateAlgs } from '@cuberoot/shared/alg-notation';
import { withTransaction, type QueryRunner } from '../db/connection.js';

/** Serialize standard and community writes for the same set, including case moves. */
export async function withAlgWrite<T>(puzzle: string, set: string, run: (query: QueryRunner) => Promise<T>): Promise<T> {
  return withTransaction(async query => {
    await query('SELECT pg_advisory_xact_lock(hashtextextended(?, 0))', [JSON.stringify(['alg', puzzle, set])]);
    return run(query);
  });
}

export function assertUniqueCaseAlgs(algs: unknown): void {
  if (!Array.isArray(algs) || algs.some(row => !Array.isArray(row) || row.some(e => !e || typeof e.alg !== 'string'))) {
    throw new HTTPException(400, { message: 'invalid algs' });
  }
  if (algs.some(row => findDuplicateAlgs(row).length > 0)) {
    throw new HTTPException(409, { message: 'duplicate_alg' });
  }
}

/** Use the exact same text rule as the browser. Scope is a case, not the whole library. */
export async function assertNoExistingAlg(
  query: QueryRunner, puzzle: string, set: string, caseName: string, algs: readonly string[],
  options: { submissionId?: number; standardWrite?: boolean } = {},
): Promise<void> {
  const keys = new Set(algs.map(duplicateAlgKey).filter(Boolean));
  const submissions = await query<{ id: number; alg: string }>(
    'SELECT id, alg FROM alg_submissions WHERE puzzle = ? AND set_slug = ? AND case_name = ?',
    [puzzle, set, caseName],
  );
  if (submissions.some(s => Number(s.id) !== options.submissionId && keys.has(duplicateAlgKey(s.alg)))) {
    throw new HTTPException(409, { message: 'duplicate_alg' });
  }
  if (!options.standardWrite) {
    const cases = await query<{ algs: Array<Array<{ alg: string }>> }>(
      'SELECT algs FROM alg_cases WHERE puzzle = ? AND set_slug = ? AND name = ?', [puzzle, set, caseName],
    );
    if (cases.some(c => c.algs.some(row => row.some(e => keys.has(duplicateAlgKey(e.alg)))))) {
      throw new HTTPException(409, { message: 'duplicate_alg' });
    }
  }
}
