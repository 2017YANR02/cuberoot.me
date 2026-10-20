import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { Move } from 'cubing/alg';
import { NATIVE_PUZZLES, NATIVE_PUZZLE_IDS, generateNativePuzzleScramble, nativePuzzleMoves } from '@cuberoot/puzzle-solvers/native-puzzles';
import { nativePuzzleKPuzzle, parseNativePuzzleAlg } from '@cuberoot/puzzle-solvers/native-puzzle-model';
import { nativePuzzleSvgAspect, renderNativePuzzleSvg } from '@cuberoot/puzzle-render-core/native-puzzle-svg';
import { PG_DEF_BY_ID, PG_IDS, PG_PUZZLES } from '@/app/[lang]/sim/pgCatalog';
import { scrambleEventPickerGroups } from '@/app/[lang]/scramble/gen/_event-picker';
import { generateTnoodlePdf } from '@/app/[lang]/scramble/gen/_tnoodle-pdf';
import { eventHasScramblePreview, renderScramblePreviewSvg } from '@/components/scramble-preview-svg';
import { CSTIMER_EVENT_IDS } from '@/lib/cstimer-scramble';
import { embedSvg } from '@/lib/pdf-svg';
import { eventDisplayName, isWcaEvent } from '@/lib/wca-events';
import {
  NATIVE_SCRAMBLE_APPEND,
  NATIVE_SCRAMBLE_EVENT_IDS,
  isNativeScrambleEvent,
  nativeScramble,
  nativeScramblePracticeHint,
} from '@/lib/native-scramble';

// Exercise real PDF layout/dispatch in Node. Font loading and the final browser
// SVG painting are separate adapters; this test records the actual SVG and box
// that the PDF page hands to them, without fetching fonts or inventing a DOM.
vi.mock('@/lib/pdf-fonts', () => ({
  FONT_MONO: 'courier', FONT_SANS: 'helvetica', FONT_CJK: 'helvetica',
  loadPdfFonts: vi.fn(async () => {}), ensureCjkFont: vi.fn(async () => {}),
}));
vi.mock('@/lib/pdf-svg', () => ({
  svgStringToElement: (outerHTML: string) => ({ outerHTML, tagName: 'svg' }),
  embedSvg: vi.fn(async () => {}),
}));

function randomFromSeed(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

describe('native puzzle client integration', () => {
  it('keeps simulator catalog IDs unique for every shared definition', () => {
    expect(new Set(PG_PUZZLES.map(({ id }) => id)).size).toBe(PG_PUZZLES.length);
    for (const id of NATIVE_PUZZLE_IDS) {
      expect(PG_IDS.has(id)).toBe(true);
      expect(PG_DEF_BY_ID[id]).toBe(NATIVE_PUZZLES[id].description);
      expect(PG_PUZZLES.find((entry) => entry.id === id)).toMatchObject({
        zh: NATIVE_PUZZLES[id].zh,
        en: NATIVE_PUZZLES[id].en,
        icon: `puzzle-${id}`,
        textLabel: NATIVE_PUZZLES[id].textLabel,
      });
    }
  });

  it.each(NATIVE_PUZZLE_IDS)('exposes %s through the shared competition, batch and paste picker registry', (id) => {
    expect(isNativeScrambleEvent(id)).toBe(true);
    expect(NATIVE_SCRAMBLE_EVENT_IDS.has(id)).toBe(true);
    expect(CSTIMER_EVENT_IDS.has(id)).toBe(false);
    expect(isWcaEvent(id)).toBe(false);
    for (const isZh of [true, false]) {
      const groups = scrambleEventPickerGroups([...NATIVE_SCRAMBLE_EVENT_IDS], NATIVE_SCRAMBLE_APPEND, isZh);
      expect(groups.find((group) => group.id === 'other')?.items.find((item) => item.id === id)).toEqual({
        id, label: eventDisplayName(id, isZh), iconClass: `puzzle-${id}`, textLabel: undefined,
      });
      expect(eventDisplayName(id, isZh)).toBe(NATIVE_PUZZLES[id][isZh ? 'zh' : 'en']);
    }
    expect(nativeScramblePracticeHint(id)).toEqual({
      zh: `练习打乱：${NATIVE_PUZZLES[id].scrambleLength} 步随机转动。`,
      en: `Practice scramble: ${NATIVE_PUZZLES[id].scrambleLength} random moves.`,
    });
  });

  // Captured from main before generalizing the old face/corner generator.
  // Keep established seeded sessions reproducible when new axis types are added.
  it.each([
    ['superz', 'c2f0ce6aee5cc08742e87068e32be99ad584a6d88adbb8558843bc09f0addfeb'],
    ['cube3dino', 'c05c6b35e1367248b2de39aaabe45831d4306ea05c1ce15199ffabe07ffac9b9'],
    ['dogic', 'abf39fba0adf932a5de71bafad60e79d6ed4d9dac36095c40d185e6a0059b5c1'],
    ['octahedron4', 'ac2e1fd7333897df183c073d7dba4df615ef8f1732cc14f32c89f81132433249'],
    ['dinoskewb', '643c6a92307dcc4649c77e793f9a058f3605aef03fd07c79c607908c7504c83c'],
    ['lattice', '03a0407dd689bb40e6dd67e24e29b6903ac9bd261dd0ed94a339244029007272'],
    ['hyperx', '4231dd813c4e399d07ca19ab483687d8eac901f1eb0b0c94a0fecc2c6ff49e73'],
    ['latticex', '29b953c2c135e4b886a0391727fbc45dee13c9d1a5db9ed97a7a1ac8b60afc24'],
    ['masterbrilic', '3ef2cbdad44f885ff9ea29790f29daa0a52f4802521c59ca1c2de5e6da2c1b9f'],
    ['masterftov2', 'f1824e60a9e65bff679e01589f5c7e3cb02def9b5b478cd65edb088e4890cc77'],
    ['quadx', '61e448182a5e212ff5ccd3bfc8b758ca601283e80a7198d7e6213bb0347c7311'],
    ['dinoocta', 'f1824e60a9e65bff679e01589f5c7e3cb02def9b5b478cd65edb088e4890cc77'],
    ['fto5', '9dd543232606018256c1a3068cac5e00eeb51f6435ecec64fe2f6443fbcc82aa'],
    ['eto', '39e6483f42b8318ba62c2a041c56738b81cedf99403a444cc22951ed124e8591'],
    ['radiocrystal', '62edb8c2c929bf641cbf7600913b4d01d2502928bfb664ea2dd8127fbc5aa03e'],
  ] as const)('preserves pre-mixed-axis seeded %s scrambles', (id, expectedHash) => {
    const scrambles = [0, 1, 42, 424242, 0xffffffff]
      .map((seed) => generateNativePuzzleScramble(id, randomFromSeed(seed))).join('\n');
    expect(createHash('sha256').update(scrambles).digest('hex')).toBe(expectedHash);
  });

  it.each(NATIVE_PUZZLE_IDS)('uses the same bounded %s generator with deterministic and invalid random sources', async (id) => {
    for (const seed of [1, 42, 0xabcdef]) {
      const expected = generateNativePuzzleScramble(id, randomFromSeed(seed));
      expect(await nativeScramble(id, randomFromSeed(seed))).toBe(expected);
      expect(await nativeScramble(id, randomFromSeed(seed))).toBe(expected);
      expect(expected.split(/\s+/).length).toBe(NATIVE_PUZZLES[id].scrambleLength);
      expect(() => parseNativePuzzleAlg(id, expected)).not.toThrow();
    }
    for (const value of [-1, 1, Infinity, NaN]) {
      await expect(nativeScramble(id, () => value)).rejects.toThrow('[0, 1)');
    }
  });

  it.each(NATIVE_PUZZLE_IDS)('renders solved and full-notation %s previews through the canonical web/PDF dispatcher', async (id) => {
    expect(eventHasScramblePreview(id)).toBe(true);
    const spec = NATIVE_PUZZLES[id];
    const base = spec.axes[0][0];
    const next = spec.axes[1][0];
    // Mixed-axis puzzles have different layer counts per axis, and polyhedral
    // wide turns use ranges. Exercise every actual button spelling plus syntax
    // expansion without inventing unsupported face-wide or third-layer moves.
    const allMoves = nativePuzzleMoves(id).map(({ move }) => move).join(' ');
    const fullNotation = `[${base}, ${next}] (${base} ${base}')2 // comment\n${allMoves}`;
    const random = await nativeScramble(id, randomFromSeed(2026));
    for (const scramble of ['', random, fullNotation]) {
      const svg = renderScramblePreviewSvg({ event: id, scramble });
      expect(svg).toBe(renderNativePuzzleSvg(id, scramble));
      expect(svg).toMatch(/^<svg\b/);
      expect(svg?.match(/<polygon\b/g)).toHaveLength(spec.visibleFacelets);
      const [, width, height] = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg!)!;
      expect(Number(width) / Number(height)).toBe(nativePuzzleSvgAspect(id));
      expect(svg).not.toContain('undefined');
      expect(svg).not.toContain('NaN');
    }
    expect(renderScramblePreviewSvg({ event: id, scramble: random }))
      .not.toBe(renderScramblePreviewSvg({ event: id, scramble: '' }));
  });

  it.each(['quadx', 'eto'] as const)('never spends a %s scramble step on a full-circle identity', (id) => {
    const puzzle = nativePuzzleKPuzzle(id);
    for (const random of [() => 0, () => 0.999999, randomFromSeed(2026)]) {
      const scramble = generateNativePuzzleScramble(id, random);
      for (const token of scramble.split(/\s+/)) {
        expect(Math.abs(new Move(token).amount), token).toBe(1);
        expect(puzzle.moveToTransformation(token).repetitionOrder(), token).toBe(2);
      }
    }
  });

  it.each(['cube2heli', 'cube3heli'] as const)('mixes real face and edge turns in %s practice scrambles without full-circle edge moves', (id) => {
    const puzzle = nativePuzzleKPuzzle(id);
    for (const random of [() => 0, () => 0.999999, randomFromSeed(2026)]) {
      const moves = [...parseNativePuzzleAlg(id, generateNativePuzzleScramble(id, random)).childAlgNodes()] as Move[];
      expect(moves).toHaveLength(NATIVE_PUZZLES[id].scrambleLength);
      for (const [index, move] of moves.entries()) {
        const family = move.family.replace(/w$/, '');
        expect(family.length).toBe(index % 2 === 0 ? 1 : 2);
        if (family.length === 2) expect(Math.abs(move.amount)).toBe(1);
        expect(puzzle.moveToTransformation(move).isIdentityTransformation()).toBe(false);
      }
    }
  });

  it.each(NATIVE_PUZZLE_IDS)('rejects illegal or unbounded %s input instead of showing a false solved preview', (id) => {
    const base = NATIVE_PUZZLES[id].axes[0][0];
    const invalid = [
      `${base} INVALID`,
      `${base}1000000`,
      `(${base})1000000`,
      '()2147483647',
      `${'('.repeat(40)}${base}${')'.repeat(40)}`,
      ' '.repeat(16_385),
    ];
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      for (const scramble of invalid) {
        expect(() => parseNativePuzzleAlg(id, scramble)).toThrow();
        expect(renderScramblePreviewSvg({ event: id, scramble })).toBeNull();
      }
    } finally {
      warning.mockRestore();
    }
  });

  it.each(NATIVE_PUZZLE_IDS)('hands every %s PDF row its canonical unfolded SVG and matching aspect', async (id) => {
    const embed = vi.mocked(embedSvg);
    embed.mockClear();
    const scramble = await nativeScramble(id, randomFromSeed(10));
    const expectedSvg = renderNativePuzzleSvg(id, scramble);
    const blob = await generateTnoodlePdf([{
      event: id, roundIdx: 0, groupIdx: 0, format: 'a',
      attempts: Array.from({ length: 7 }, (_, index) => ({
        label: String(index + 1), scramble, isExtra: false,
      })),
    }], {
      competitionTitle: 'Native puzzles', generatorTag: 'CubeRoot', isZh: false, showPreview: true,
    });
    expect(blob.type).toBe('application/pdf');
    expect((await blob.arrayBuffer()).byteLength).toBeGreaterThan(0);
    expect(embed).toHaveBeenCalledTimes(7);
    for (const [, element, , , width, height] of embed.mock.calls) {
      expect(element.outerHTML).toBe(expectedSvg);
      // Seven rows put these nets below the sheet's maximum image-column
      // cap. Include the existing 4pt padding on each side when checking shape.
      expect((width + 8) / (height + 8)).toBeCloseTo(nativePuzzleSvgAspect(id), 10);
    }
  });
});
