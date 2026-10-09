import { describe, expect, it, vi } from 'vitest';
import { NATIVE_PUZZLES, NATIVE_PUZZLE_IDS, generateNativePuzzleScramble } from '@cuberoot/puzzle-solvers/native-puzzles';
import { parseNativePuzzleAlg } from '@cuberoot/puzzle-solvers/native-puzzle-model';
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
  it('keeps simulator catalog IDs unique while adding all four shared definitions', () => {
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
        id, label: eventDisplayName(id, isZh), iconClass: undefined, textLabel: NATIVE_PUZZLES[id].textLabel,
      });
      expect(eventDisplayName(id, isZh)).toBe(NATIVE_PUZZLES[id][isZh ? 'zh' : 'en']);
    }
    expect(nativeScramblePracticeHint(id)).toEqual({
      zh: `练习打乱：${NATIVE_PUZZLES[id].scrambleLength} 步随机转动。`,
      en: `Practice scramble: ${NATIVE_PUZZLES[id].scrambleLength} random moves.`,
    });
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
    const fullNotation = spec.layers === 1
      ? `[${base}, ${next}] (${base} ${base}')2 // comment\n${next}`
      : `[${base}, ${next}w] (2${base} 2${base}')2 // comment\n${next}w`;
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
      // Seven rows put all four nets below the sheet's maximum image-column
      // cap. Include the existing 4pt padding on each side when checking shape.
      expect((width + 8) / (height + 8)).toBeCloseTo(nativePuzzleSvgAspect(id), 10);
    }
  });
});
