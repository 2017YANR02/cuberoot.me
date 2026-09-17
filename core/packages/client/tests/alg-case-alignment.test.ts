import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import type { AlgFile, AlgPuzzle } from '@cuberoot/shared/alg';
import { is3x3TopLayerSet } from '@cuberoot/shared/alg';
import { loadAlg, alignAlgFile, alignCaseEntry, caseAlgIssue, caseCoepEntry, commonCaseSetup, sourceCaseAlg } from '@/lib/alg_case_alignment';
import { allTargets, scanCases } from '@/lib/alg_validation_scan';
import { validateStoredAlgCase } from '@/lib/alg_validation';
import { caseViewAlg, caseViewSetup, CASE_VIEW_ANGLES } from '@/lib/alg_display';
import { algHtmlText } from '@/lib/alg_html';
import { normalizeAlg } from '@/lib/alg_normalize';
import { algSheetFromCases } from '@/lib/alg_pdf/from_cases';
import { ohAlgsForCase } from '@/lib/alg_oh_hand';
import { caseThumbPlan } from '@/lib/alg_thumb_plan';
import { reorderCaseAlgs, rotateCaseClockwise } from '@/lib/alg_sets_api';
import baseline from './fixtures/alg-case-alignment-baseline.json';
import relocations from './fixtures/alg-case-relocations.json';

// Full public API snapshot, 2026-09-16. Include the two non-catalog BLD sets.
// Read at runtime instead of inferring a multi-megabyte literal TypeScript type.
const files = JSON.parse(readFileSync(new URL('./fixtures/alg-case-alignment.json', import.meta.url), 'utf8')) as AlgFile[];
const loaded = new Map<string, AlgFile>();

beforeAll(() => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const parts = new URL(url, 'https://api.cuberoot.me').pathname.split('/');
    const set = parts.pop();
    const puzzle = parts.pop();
    const file = files.find(f => f.puzzle === puzzle && f.set === set);
    return new Response(JSON.stringify(file), { status: file ? 200 : 404 });
  }));
});
afterAll(() => vi.unstubAllGlobals());

describe('one public case state for every algorithm set', () => {
  it('uses verified AUF instead of stacking starting grips on EG1 S-1 alternatives', async () => {
    const file = files.find(f => f.puzzle === '2x2' && f.set === 'eg1')!;
    const c = file.cases.find(c => c.id === 41)!;
    const original = JSON.stringify(c);
    const aligned = await alignAlgFile({ ...file, cases: [c] });
    expect(aligned.cases[0].algs[0].slice(5).map(e => e.alg)).toEqual([
      "U' B U' R2 F2 U' F",
      "U R' F R2 U R' F' U' R U' R' U",
      "L' U' L U' F' L' U L2 F L' U2",
      "U L' U L2 F L' F' U' L F' L' U",
    ]);
    for (const entry of aligned.cases[0].algs[0]) {
      expect(caseAlgIssue(entry)).toBeUndefined();
      expect((await validateStoredAlgCase(c.setup, entry.alg, c.sticker, '2x2', 'eg1')).ok).toBe(true);
    }
    const rich = { ...c.algs[0][5], algHtml: "<em>z2</em> y U2 <s>B</s> U' R2 F2 U' F" };
    const entry = await alignCaseEntry('2x2', 'eg1', c, rich);
    expect(entry.alg).toBe("U' B U' R2 F2 U' F");
    expect(algHtmlText(entry.algHtml!)).toBe(entry.alg);
    expect(entry.algHtml).toContain('<s>B</s>');
    expect(sourceCaseAlg(entry)).toBe(rich.alg);
    expect(JSON.stringify(c)).toBe(original);
  });

  it('covers every registered goal and every database set, without sampling', () => {
    expect(files).toHaveLength(71);
    expect(files.reduce((n, f) => n + f.cases.flatMap(c => c.algs.flat()).length, 0)).toBe(24633);
    expect(allTargets().map(t => `${t.puzzle}/${t.set}`).sort())
      .toEqual(files.map(f => `${f.puzzle}/${f.set}`).sort());
  });

  it.each(files.map(file => ({ key: `${file.puzzle}/${file.set}`, file })))('$key: every accepted row solves the public state', async ({ key, file }) => {
    const puzzle = file.puzzle as AlgPuzzle;
    const aligned = await loadAlg(puzzle, file.set);
    loaded.set(key, aligned);
    const expected = baseline[key as keyof typeof baseline];
    let total = 0;
    let adjusted = 0;
    const unmatched: string[] = [];
    const angles = is3x3TopLayerSet(puzzle, file.set) ? CASE_VIEW_ANGLES : ['default'] as const;
    for (const c of aligned.cases) {
      const coep = caseCoepEntry(c);
      if (coep) {
        expect((await validateStoredAlgCase(c.setup, coep.alg, c.sticker, puzzle, file.set)).ok,
          `${key} ${c.name} COEP`).toBe(!caseAlgIssue(coep));
      }
      for (const [oi, entries] of c.algs.entries()) {
        const setup = commonCaseSetup(puzzle, file.set, c, oi);
        for (const [ai, entry] of entries.entries()) {
          total++;
          adjusted += Number(sourceCaseAlg(entry) !== entry.alg);
          const id = `${c.id}:${oi}:${ai}`;
          expect(entry.setup, id).toBe(setup);
          if (caseAlgIssue(entry)) {
            unmatched.push(id);
            expect((await validateStoredAlgCase(setup, entry.alg, c.sticker, puzzle, file.set)).ok, id).toBe(false);
            continue;
          }
          if (entry.algHtml) {
            expect(normalizeAlg(puzzle, algHtmlText(entry.algHtml)), id).toBe(normalizeAlg(puzzle, entry.alg));
          }
          for (const angle of angles) {
            const displayedSetup = caseViewSetup(setup, angle);
            const displayedAlg = caseViewAlg(entry.alg, angle);
            const result = await validateStoredAlgCase(displayedSetup, displayedAlg, c.sticker, puzzle, file.set);
            expect(result.ok, `${key} ${id} ${angle}: ${result.reason}`).toBe(true);
          }
        }
      }
    }
    // Exact exception identities are reviewable; accepting extra bad rows or
    // silently dropping source rows cannot turn this test green.
    expect({ total, adjusted, unmatched }).toEqual(expected);
    // Every set remains printable even when a source alternative is unresolved.
    const sheet = algSheetFromCases({ puzzle, set: file.set, cases: aligned.cases, title: key, filename: key, allOris: true, maxAlgs: Infinity });
    expect(sheet.cases).toHaveLength(aligned.cases.reduce((n, c) => n + c.algs.length, 0));
    expect(sheet.cases.reduce((n, c) => n + c.algs.length, 0)).toBe(total - unmatched.length);
  });

  it('S-: renders the missing U in plain text, rich text and PDF; scan rejects the raw mismatch', async () => {
    const source = files.find(f => f.puzzle === '3x3' && f.set === 'oll')!;
    const raw = source.cases.find(c => c.id === 3931)!;
    const original = JSON.stringify(raw);
    expect(await scanCases('3x3', 'oll', [raw])).toHaveLength(2);
    const aligned = loaded.get('3x3/oll') ?? await alignAlgFile(source);
    const c = aligned.cases.find(c => c.id === 3931)!;
    expect(c.algs[0][0].alg).toBe("U R U2' R' U' R U' R'");
    expect(algHtmlText(c.algs[0][0].algHtml!)).toBe(c.algs[0][0].alg);
    expect(c.setup).toBe("R U R' U R U2' R' U'");
    expect(await scanCases('3x3', 'oll', [c])).toEqual([]);
    const sheet = algSheetFromCases({ puzzle: '3x3', set: 'oll', cases: [c], title: '', filename: '' });
    expect(sheet.cases[0].setup).toBe(c.setup);
    expect(sheet.cases[0].thumb?.setup).toBe(c.setup);
    expect(sheet.cases[0].algs[0]).toBe(c.algs[0][0].alg);
    expect(JSON.stringify(raw)).toBe(original);
  });

  it('keeps unresolved owner source rows visible as failures and omits them from PDF without blocking valid rows', async () => {
    const oll = loaded.get('3x3/oll')!;
    const t = oll.cases.find(c => c.id === 3929)!;
    expect(caseAlgIssue(t.algs[0][3])).toBeDefined();
    const failures = await scanCases('3x3', 'oll', [t]);
    expect(failures.map(f => f.algIdx)).toEqual([3, 9]);
    expect(failures[1].reason).toContain('Duplicate algorithm');
    const sheet = algSheetFromCases({ puzzle: '3x3', set: 'oll', cases: [t], title: '', filename: '', maxAlgs: 99 });
    expect(sheet.cases[0].algs).toEqual(t.algs[0].filter(e => !caseAlgIssue(e)).map(e => e.alg));
    expect(sheet.subtitle).toContain('1 unverified algorithms omitted');
  });

  it('does not report all passed when a COEP solution or an optimal scramble differs from the picture', async () => {
    const source = loaded.get('3x3/oll')!.cases.find(c => c.id === 3931)!;
    const c = { ...source, meta: { ...source.meta!,
      coep: { alg: 'R', scramble: 'R' }, optimal: { stm: { len: 1, scramble: 'R' } },
    } };
    const failures = await scanCases('3x3', 'oll', [c]);
    expect(failures).toHaveLength(3);
    expect(failures.map(f => f.alg)).toEqual(['STM: R', 'COEP: R', 'COEP: R']);
  });

  it('also aligns every right-hand OLL/PLL alternative to the target case', async () => {
    const errors: string[] = [];
    for (const set of ['oll', 'pll']) {
      const file = loaded.get(`3x3/${set}`)!;
      for (const c of file.cases) for (const entry of ohAlgsForCase(c, file.cases, 0, 'right')) {
        if (caseAlgIssue(entry)) { errors.push(`${set}:${c.id}`); continue; }
        expect((await validateStoredAlgCase(c.setup, entry.alg, c.sticker, '3x3', set)).ok, c.name).toBe(true);
      }
    }
    expect(errors).toEqual(['oll:3929', 'oll:3930']);
  });

  it('T and L misplaced source algorithms each uniquely belong to the other case; moving retains both', async () => {
    const source = files.find(f => f.puzzle === '3x3' && f.set === 'oll')!;
    const t = source.cases.find(c => c.id === 3929)!;
    const l = source.cases.find(c => c.id === 3930)!;
    for (const [from, to] of [[t, l], [l, t]]) {
      const matches: number[] = [];
      for (const c of source.cases) {
        if (!caseAlgIssue(await alignCaseEntry('3x3', 'oll', c, from.algs[0][3]))) matches.push(c.id!);
      }
      expect(matches).toEqual([to.id]);
    }
    const swapped = structuredClone(source);
    swapped.cases.find(c => c.id === t.id)!.algs[0][3] = l.algs[0][3];
    swapped.cases.find(c => c.id === l.id)!.algs[0][3] = t.algs[0][3];
    expect(swapped.cases.flatMap(c => c.algs.flat()).length).toBe(462);
    const prepared = await alignAlgFile(swapped);
    const failures = await scanCases('3x3', 'oll', prepared.cases.filter(c => c.id === t.id || c.id === l.id));
    // The historical fixture still contains one separate parenthesis-only duplicate.
    expect(failures.map(f => ({ caseId: f.caseObj.id, index: f.algIdx }))).toEqual([{ caseId: 3929, index: 9 }]);
    expect(failures[0].reason).toContain('Duplicate algorithm');
  });

  it('all 13 applied relocations retain the source metadata and solve the destination state', async () => {
    expect(relocations).toHaveLength(13);
    for (const move of relocations) {
      const file = loaded.get(`${move.puzzle}/${move.set}`)!;
      const target = file.cases.find(c => c.id === move.targetId)!;
      const original = files.find(f => f.puzzle === move.puzzle && f.set === move.set)!
        .cases.find(c => c.id === move.sourceId)!.algs[0][move.sourceIndex];
      expect(original).toEqual(move.sourceEntry);
      for (const [key, value] of Object.entries(original)) {
        if (!['alg', 'setup', 'algHtml'].includes(key)) expect(move.entry[key as keyof typeof move.entry]).toEqual(value);
      }
      expect((await validateStoredAlgCase(target.setup, move.entry.alg, target.sticker, move.puzzle, move.set)).ok,
        `${move.sourceName} → ${move.targetName}`).toBe(true);
    }
  });

  it('reordering presentation rows preserves original source text and private metadata in the write payload', async () => {
    const source = files.find(f => f.puzzle === '3x3' && f.set === 'oll')!.cases.find(c => c.id === 3931)!;
    const c = loaded.get('3x3/oll')!.cases.find(c => c.id === source.id)!;
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(source)));
    await reorderCaseAlgs('3x3', 'oll', c, [c.algs[0].toReversed()]);
    const body = JSON.parse(String(fetchMock.mock.calls.at(-1)?.[1]?.body));
    expect(body.setup).toBe(source.setup);
    expect(body.algs).toEqual([source.algs[0].toReversed()]);
  });

  it('admin rotation persists each quarter turn, preserves every source row and returns after four clicks', async () => {
    let file = loaded.get('3x3/oll')!;
    const initial = file.cases.find(c => c.id === 3931)!;
    const raw = files.find(f => f.puzzle === '3x3' && f.set === 'oll')!.cases.find(c => c.id === 3931)!;
    let c = initial;
    const fetchMock = vi.mocked(fetch);
    const setups = ["R U R' U R U2' R'", "R U R' U R U2' R' U", "R U R' U R U2' R' U2", initial.setup];
    for (const [index, setup] of setups.entries()) {
      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ cases: [raw] })));
      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(raw)));
      file = await rotateCaseClockwise(file, c);
      c = file.cases.find(x => x.id === c.id)!;
      const body = JSON.parse(String(fetchMock.mock.calls.at(-1)?.[1]?.body));
      expect(body.setup).toBe(setup);
      expect(body.algs).toEqual(raw.algs);
      expect(c.setup).toBe(setup);
      expect(await scanCases('3x3', 'oll', [c])).toEqual([]);
      for (const entry of c.algs.flat()) {
        expect(entry.alg).not.toMatch(/\bU(?:2'?|')?\s+U(?:2'?|')?(?:\s|$)/);
        if (entry.algHtml) expect(normalizeAlg('3x3', algHtmlText(entry.algHtml))).toBe(normalizeAlg('3x3', entry.alg));
      }
      if (index === 0) expect(c.algs[0][0].alg).toBe("R U2' R' U' R U' R'");
      // A fresh load has exactly the same state and solutions as the saved view.
      const reloaded = await alignAlgFile({ ...file, cases: [{ ...raw, setup: body.setup }] });
      expect(reloaded.cases[0].algs.map(es => es.map(e => e.alg))).toEqual(c.algs.map(es => es.map(e => e.alg)));
    }
    expect(c.algs.map(es => es.map(e => e.alg))).toEqual(initial.algs.map(es => es.map(e => e.alg)));
    expect(initial.setup).toBe("R U R' U R U2' R' U'");
    // Saving from a temporary view angle commits the picture the admin sees.
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ cases: [raw] })));
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(raw)));
    const fromPreview = await rotateCaseClockwise(file, c, 'u2');
    expect(fromPreview.cases.find(x => x.id === c.id)!.setup).toBe("R U R' U R U2' R' U2");
  });

  it('rotating CMLL never writes the runtime OH merge back into the source collection', async () => {
    const file = loaded.get('3x3/cmll')!;
    const raw = files.find(f => f.puzzle === '3x3' && f.set === 'cmll')!;
    const c = file.cases.find(c => c.name === 'O Adjacent')!;
    const stored = raw.cases.find(x => x.id === c.id)!;
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(raw)));
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(stored)));
    const result = await rotateCaseClockwise(file, c);
    const body = JSON.parse(String(fetchMock.mock.calls.at(-1)?.[1]?.body));
    expect(body.algs).toEqual(stored.algs);
    expect(result.cases.find(x => x.id === c.id)!.algs.flat()).toHaveLength(c.algs.flat().length);
    expect(result.cases.find(x => x.id === c.id)!.algs.map(es => es.map(e => e.tags)))
      .toEqual(c.algs.map(es => es.map(e => e.tags)));
  });

  it('a rejected rotation leaves the case and its source unchanged', async () => {
    const file = loaded.get('3x3/oll')!;
    const c = file.cases.find(c => c.id === 3931)!;
    const before = JSON.stringify(file);
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ cases: [c] })));
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 }));
    await expect(rotateCaseClockwise(file, c)).rejects.toThrow();
    expect(JSON.stringify(file)).toBe(before);
  });

  it('uses generated FTO and Megaminx images when the canonical setup is available', () => {
    for (const puzzle of ['fto', 'megaminx'] as const) {
      const plan = caseThumbPlan({ puzzle, set: puzzle === 'fto' ? 'tcp' : 'full-pll',
        setup: '', alg: '', sticker: { kind: 'raw', tag: `lowcubes-${puzzle}`, attrs: { image: 'unrelated.png' } } });
      expect(plan.renderer).toBe(puzzle === 'fto' ? 'inline-svg' : 'sr');
    }
  });
});
