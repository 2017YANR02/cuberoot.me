import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { prepareAlgCatalog } from '@/lib/alg-catalog';
import { alignAlgFile, commonCaseSetup } from '@/lib/alg_case_alignment';
import { caseThumbPlan } from '@/lib/alg_thumb_plan';
import { canonicalize3x3AlgFile, type AlgFile, type AlgPuzzle } from '@cuberoot/shared/alg';
import { POST } from '@/app/api/recon/revalidate/route';
import { revalidateTag } from 'next/cache';

vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }));
const files = JSON.parse(readFileSync(new URL('./fixtures/alg-case-alignment.json', import.meta.url), 'utf8')) as AlgFile[];

describe('catalog cover parity', () => {
  // Every set in the existing cross-puzzle fixture contributes its actual cover.
  for (const file of files) {
    it(`${file.puzzle}/${file.set} preserves the canonical cover without aligning a whole set`, async () => {
      const source = canonicalize3x3AlgFile({ ...file, cases: file.cases.slice(0, 1) });
      const original = JSON.stringify(source);
      const snapshot = await prepareAlgCatalog({
        puzzle: file.puzzle as AlgPuzzle, order: [file.set],
        sets: [{ slug: file.set, count: file.cases.length, first: source.cases[0] }],
      });
      const expected = (await alignAlgFile(source)).cases[0];
      const row = snapshot.sets[0];
      expect(row.count).toBe(file.cases.length);
      expect(row.thumbnailSetup).toBe(commonCaseSetup(file.puzzle as AlgPuzzle, file.set, expected));
      const plan = (c: typeof expected, setup: string | undefined) => caseThumbPlan({
        puzzle: file.puzzle as AlgPuzzle, set: file.set, sticker: c.sticker,
        alg: c.algs.flat()[0]?.alg ?? c.standard ?? '', setup,
      });
      const oldPlan = plan(expected, commonCaseSetup(file.puzzle as AlgPuzzle, file.set, expected));
      const newPlan = plan(row.first!, row.thumbnailSetup);
      // Cube renderers ignore the solution when a forward setup is supplied.
      if (oldPlan.renderer === 'visualcube' && newPlan.renderer === 'visualcube') {
        expect({ ...newPlan, algorithm: '' }).toEqual({ ...oldPlan, algorithm: '' });
      } else expect(newPlan).toEqual(oldPlan);
      expect(JSON.stringify(source)).toBe(original);
    }, 20_000);
  }
  it('keeps empty sets and ordering', async () => {
    const snapshot = { puzzle: '3x3' as const, order: ['cross', 'empty'], sets: [{ slug: 'empty', count: 0, first: null }] };
    expect(await prepareAlgCatalog(snapshot)).toEqual(snapshot);
  });
  it('invalidates catalog HTML only for authenticated valid requests', async () => {
    vi.stubEnv('RECON_REVALIDATE_SECRET', 'catalog-test');
    vi.mocked(revalidateTag).mockClear();
    const send = (body: unknown, secret = 'catalog-test') => POST(new Request('https://example.test/api/recon/revalidate', {
      method: 'POST', headers: { Authorization: `Bearer ${secret}` }, body: JSON.stringify(body),
    }));
    expect((await send({ kind: 'alg' }, 'wrong')).status).toBe(401);
    expect((await send({ kind: 'alg', id: '../timer' })).status).toBe(400);
    expect(revalidateTag).not.toHaveBeenCalled();
    expect((await send({ kind: 'alg' })).status).toBe(200);
    expect(revalidateTag).toHaveBeenCalledWith('alg-catalog', { expire: 0 });
    vi.unstubAllEnvs();
  });
});
