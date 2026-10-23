import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import data from '@/app/[lang]/scramble/stats/_data/precomputed-exact-puzzles.json';
import downloads from '@/app/[lang]/scramble/stats/_data/exact-puzzle-downloads.json';
import publication from '@/app/[lang]/scramble/stats/_data/exact-puzzle-publication.json';
import { PRECOMPUTED_EXACT_SPECS } from '@/app/[lang]/scramble/stats/_components/precomputed-exact-specs';
import { ENUM_SPECS } from '@/app/[lang]/scramble/stats/_components/enumerated-specs';
import { PUBLISHED_EXACT_SPECS } from '@/app/[lang]/scramble/stats/_components/published-exact-specs';
import { PUZZLE_DISTRIBUTION_COVERAGE } from '@/lib/puzzle-distribution-coverage';
import { renderScramblePreviewSvg } from '@/components/scramble-preview-svg';
import { legacyReplay } from '../scripts/legacy-exact-offline.mts';
import { validateRouxWitness, type RouxDistributionEvent } from '../scripts/roux-goal-exact-distributions.mts';
import { validateFmcSubgoalWitness, type FmcDistributionEvent } from '../scripts/fmc-goal-exact-distributions.mts';

const selectedEvents = process.env.EXACT_PREVIEW_EVENTS?.split(',');

describe('precomputed exact distribution preview boundary', () => {
  afterEach(() => vi.restoreAllMocks());
  it(`renders ${selectedEvents?.join(', ') ?? 'every published'} witness through the UI dispatcher without solver tables`, async () => {
    const warnings = vi.spyOn(console, 'warn');
    if (selectedEvents) expect(Object.keys(data.puzzles)).toEqual(expect.arrayContaining(selectedEvents));
    for (const [event, dataset] of Object.entries(data.puzzles)) {
      if (selectedEvents && !selectedEvents.includes(event)) continue;
      const spec = PRECOMPUTED_EXACT_SPECS[event];
      expect(ENUM_SPECS[event]).toBe(spec);
      expect(spec.source.kind).toBe('js');
      if (spec.source.kind !== 'js') throw new Error('Expected a static exact distribution');
      const examples = spec.source.examplesByLength();
      const bin = (depth: number) => examples instanceof Map ? examples.get(depth) : examples[depth];
      expect(bin(0)).toEqual(dataset.examples.filter(sample => sample.depth === 0).map(sample => sample.scramble));
      expect(Object.values(spec.source.counts).reduce((sum, count) => sum + count, 0)).toBe(dataset.total);
      expect(Math.max(...Object.keys(spec.source.counts).map(Number))).toBe(dataset.godsNumber);
      if (dataset.deepestExamplesComplete) expect(bin(dataset.godsNumber)?.length).toBe(dataset.histogram[dataset.godsNumber]);
      const options = { event: spec.previewEvent ?? event, puzzleDescription: spec.puzzleDescription };
      const goalSvgs = dataset.examples.filter(sample => sample.depth === 0)
        .map(sample => renderScramblePreviewSvg({ ...options, scramble: sample.scramble }));
      expect(goalSvgs, event).not.toContain(null);
      for (const sample of dataset.examples) {
        const svg = renderScramblePreviewSvg({ ...options, scramble: sample.scramble });
        expect(svg, `${event}/${sample.depth}`).not.toBeNull();
        expect(svg).not.toMatch(/undefined|NaN/);
        expect(spec.solutionForScramble?.(sample.scramble)).toBe(sample.solution);
        // Pyramorphix deliberately displays 2×2 coordinates: restoring its
        // physical shape need not restore the four indistinguishable pieces
        // of the coordinate cube. Its wrong physical-model links stay disabled.
        if (legacyReplay[event]) {
          expect(legacyReplay[event](`${sample.scramble} ${sample.solution}`), `${event}/${sample.depth} independent replay`)
            .toEqual(legacyReplay[event](''));
        } else if (event === 'htr-dr' || event === 'fr-htr') {
          const verified = await validateFmcSubgoalWitness(event as FmcDistributionEvent, sample.scramble, sample.solution, sample.depth);
          expect(verified.goalReached).toBe(true);
        } else if (event.startsWith('roux-') || event === 'lsemu-qtm') {
          const verified = await validateRouxWitness(event as RouxDistributionEvent, sample.scramble, sample.solution, sample.depth);
          expect(verified.goalReached).toBe(true);
        } else if (event === 'dino' || event === 'dino-mirror') {
          // Dino's anchor frame is quotiented by rotations. The exporter checks
          // original/mirrored colour order independently; the rendered net must
          // have six monochrome faces, but need not match a fixed-frame SVG.
          const restored = renderScramblePreviewSvg({ ...options, scramble: `${sample.scramble} ${sample.solution}` });
          const fills = [...restored!.matchAll(/<path [^>]*fill="([^"]+)"/g)].map(match => match[1]);
          expect(fills).toHaveLength(24);
          for (let face = 0; face < 6; face++) expect(new Set(fills.slice(face * 4, face * 4 + 4)).size).toBe(1);
          expect(new Set(fills).size).toBe(6);
        } else if (!event.startsWith('pyramorphix')) {
          const restored = renderScramblePreviewSvg({ ...options, scramble: `${sample.scramble} ${sample.solution}` });
          expect(goalSvgs, `${event}/${sample.depth} restored SVG`).toContain(restored);
        }
      }
    }
    expect(warnings).not.toHaveBeenCalled();
  });

  it('keeps both Pyramorphix metrics on explicit coordinate previews', () => {
    for (const event of ['pyramorphix', 'pyramorphix-qtm']) {
      const spec = PRECOMPUTED_EXACT_SPECS[event];
      expect(spec.puzzleDescription).toBeUndefined();
      expect(spec.previewEvent).toBe('222');
      expect(spec.exampleLink).toBeNull();
      expect(spec.previewLabel?.zh).toContain('坐标');
    }
  });

  it('renders zero-move Super Floppy and Bicube states without requesting distance tables', () => {
    for (const event of ['sfl', 'bic']) {
      const svg = renderScramblePreviewSvg({ event, scramble: '' });
      expect(svg).not.toBeNull();
      expect(svg).not.toMatch(/undefined|NaN/);
    }
  });

  it('retains published exact counts without claiming exported state witnesses', () => {
    const expected: Record<string, { total: number; god: number; deepest: number; sha256?: string }> = {
      '15p-exact': { total: 10_461_394_944_000, god: 80, deepest: 17 },
      'sq1-twist': { total: 435_891_456_000, god: 13, deepest: 157_452_752 },
      'sq1-face': { total: 11_958_666_854_400, god: 31, deepest: 376 },
      '233-htm-exact': { total: 406_425_600, god: 18, deepest: 28 },
      '233-qtm-exact': { total: 406_425_600, god: 19, deepest: 264 },
      'skewb-ultimate-exact': { total: 100_776_960, god: 14, deepest: 1 },
      'redi-published': { total: 1_571_364_748_800, god: 19, deepest: 332 },
      'bic-qtm-exact': { total: 1_108_800, god: 35, deepest: 5 },
      // SHA-256 fixtures come from independently parsed published tables, in depth order.
      'cm2-neutral-htm': { total: 6_912, god: 8, deepest: 768, sha256: 'f5d33be745e6f6492768abd61cbccb67c13d0ef990cfce077ddb712ebd66d4d6' },
      'cm2-neutral-qtm': { total: 6_912, god: 9, deepest: 204, sha256: '977a0bf859bc6a28d5436bdd84688767a87d26a000709575f5c75e1251ef6b0b' },
      'cm3-neutral-qtm': { total: 6_879_707_136, god: 15, deepest: 761_436, sha256: 'eed3784583b64aa447acad9bb025c7a95bf0e9b2a1f2a9f45c7c61206a7d1cca' },
      '223-qtm-exact': { total: 241_920, god: 15, deepest: 792, sha256: '102e832f62ca38a5dd22100c19c57c11fa90e9c0f4cb90f7cdbd8104cd70715c' },
      'gear-single-exact': { total: 41_472, god: 12, deepest: 6, sha256: '5153d3ca6b0223f23bd7a29fa5f4e5a04aa3b43a3e95dfc7f1b27129badd0437' },
      'sfl-qtm-exact': { total: 3_041_280, god: 16, deepest: 65, sha256: '5c86c9f119d13dd97536726cbc9a52a95f64f034a2d87654287219d2618c7e89' },
      'rubiks-ufo-ftm-exact': { total: 39_916_800, god: 14, deepest: 120, sha256: '7bb2e4de46822692fed3d10fa5636c892b44627eb6e590a72ce0c3a6117ea274' },
      'rubiks-ufo-stm-exact': { total: 39_916_800, god: 16, deepest: 19_660, sha256: '4436d6b38172d9ce5a0f0b0fa870d30725da9566440596c8c79fec1135b2080f' },
      'netblock-ufo-ftm-exact': { total: 33_362_904, god: 15, deepest: 6_338, sha256: 'a6388953443d061cf9ce2b88318fb93bf09d922c4385fdfd56e039f4a731fcc2' },
      'netblock-ufo-qtm-exact': { total: 33_362_904, god: 16, deepest: 162, sha256: '4e9f92d2b76468da0d7bd5e73b61fac64725b596de325e9e94522a773148af02' },
    };
    for (const [event, baseline] of Object.entries(expected)) {
      const spec = PUBLISHED_EXACT_SPECS[event];
      expect(ENUM_SPECS[event]).toBe(spec);
      if (spec.source.kind !== 'js') throw new Error('Expected a static published table');
      expect(Object.values(spec.source.counts).reduce((sum, count) => sum + count, 0)).toBe(baseline.total);
      expect(Object.keys(spec.source.counts).map(Number)).toEqual(Array.from({ length: baseline.god + 1 }, (_, depth) => depth));
      expect(spec.source.counts[String(baseline.god)]).toBe(baseline.deepest);
      expect(spec.source.counts['0']).toBe(1);
      if (baseline.sha256) {
        expect(createHash('sha256').update(JSON.stringify(Object.values(spec.source.counts))).digest('hex')).toBe(baseline.sha256);
      }
      expect(spec.sourceStatus).toBe(event === 'redi-published' ? 'published-unverified' : undefined);
      expect(spec.source.examplesAvailable).toBe(false);
      expect(spec.source.examplesByLength()).toEqual({});
      expect(spec.source.downloadBin).toBeNull();
      expect(spec.downloads).toBeUndefined();
      expect(spec.exampleLink).toBeNull();
      expect(spec.previewEvent).toBeUndefined();
    }
  });

  it('keeps the project UFO model separate from physical UFO distributions', () => {
    const spec = PRECOMPUTED_EXACT_SPECS.ufo;
    expect(data.puzzles.ufo.total).toBe(60_480);
    expect(spec.seriesName.zh).toBe('项目 UFO 模型');
    expect(spec.spaceLabel.zh).toContain('项目模型');
    expect(spec.previewLabel?.zh).toContain('尚未核验');
    expect(data.puzzles.ufo.scope.zh).toContain('尚未核验');
    expect(spec.exampleLink).toBeNull();
    expect(PUZZLE_DISTRIBUTION_COVERAGE.find(entry => entry.id === 'ufo')?.status).toBe('model-incomplete');
    for (const event of ['rubiks-ufo-ftm-exact', 'rubiks-ufo-stm-exact', 'netblock-ufo-ftm-exact', 'netblock-ufo-qtm-exact']) {
      const published = PUBLISHED_EXACT_SPECS[event];
      expect(PUZZLE_DISTRIBUTION_COVERAGE.find(entry => entry.id === event)?.status).toBe('exact');
      expect(published.previewEvent).toBeUndefined();
      expect(published.puzzleDescription).toBeUndefined();
      expect(published.exampleLink).toBeNull();
      if (event.startsWith('netblock-')) expect(published.spaceLabel.zh).toContain('等价类');
    }
  });

  it('requires a matching publication receipt before exposing production state downloads', () => {
    const manifest = downloads as typeof downloads & { inventorySha256?: string };
    const receipt = publication.published as { inventorySha256: string } | null;
    const inventorySha256 = createHash('sha256').update(JSON.stringify(manifest.puzzles)).digest('hex');
    expect(manifest.inventorySha256).toBe(inventorySha256);
    if (receipt) expect(receipt.inventorySha256).toBe(inventorySha256);
    if (process.env.NODE_ENV !== 'development' && !receipt) {
      for (const spec of Object.values(PRECOMPUTED_EXACT_SPECS)) expect(spec.downloads).toBeUndefined();
    }
  });
});
