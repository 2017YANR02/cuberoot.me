// guard-registry: tracked at /dev/guards (app/[lang]/dev/guards/_guards.ts)
// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { configureAlgFileLoader, type AlgFile } from '@cuberoot/shared/alg';
import { decodeGyroTrack } from '@cuberoot/shared/smart-cube/gyro-track';
import { buildCoreTrack } from '@cuberoot/shared/timer/reconstruct/core-track';
import { normalizeSolve, initialPoseRotation } from '@cuberoot/shared/timer/reconstruct/gyro-orient';
import { computeStageSegments } from '@cuberoot/shared/timer/reconstruct/stage-segments';
import { computeStepMetrics } from '@cuberoot/shared/timer/reconstruct/step-metrics';
import { computeF2lSlots } from '@cuberoot/shared/timer/reconstruct/f2l-slots';
import { buildReconText } from '@cuberoot/shared/timer/reconstruct/recon-text';
import { correctReconFromLibrary } from '@cuberoot/shared/timer/reconstruct/library-correction';
import { applyScramble } from '@cuberoot/shared/timer/reconstruct/state';
import { applyOneToken } from '@cuberoot/shared/timer/reconstruct/apply-token';
import { isCross, isSolved } from '@cuberoot/shared/timer/reconstruct/cfop-detect';
import StepMoveList from '@cuberoot/timer-ui/reconstruct/StepMoveList';
import { projectReconNotation } from '@cuberoot/timer-ui/reconstruct/report-presentation';
import { reconstructedTrack } from '@cuberoot/timer-ui/reconstruct/playback-track';
import { ReconstructHostContext } from '@cuberoot/timer-ui/reconstruct/ReconstructHost';
import { cubeThumbParams } from '@/lib/alg_thumb_plan';
import { CUBE_ORIENTATIONS, orientedFaceColors } from '@cuberoot/shared/timer';
import { ReconLineDiagramProvider } from '@/components/ReconLineDiagrams';
import { reconInspectionOrientations, reconWasteBrackets } from '@/lib/recon-alg-utils';

// Only the drawing surface is replaced: state/mask selection, annotations,
// formula matching, links, waste and the actual timer DOM remain production code.
vi.mock('@/components/VisualCube', () => ({
  VisualCube: (props: { view: string; setup?: string; faceletColors?: string; mask?: string; scheme?: string; hideGreySides?: boolean }) =>
    createElement('span', { 'data-diagram': ['oll', 'pll'].includes(props.view) ? 'plan' : props.view, 'data-view': props.view, 'data-setup': props.setup, 'data-facelets': props.faceletColors, 'data-mask': props.mask, 'data-scheme': props.scheme, 'data-hide-grey': props.hideGreySides }),
}));
const jobs = vi.hoisted(() => [] as Promise<unknown>[]);
vi.mock('@/lib/recon-f2l-links', async original => {
  const module = await original<typeof import('@/lib/recon-f2l-links')>();
  return { ...module, reconF2lAnnotations: (...args: Parameters<typeof module.reconF2lAnnotations>) => {
    const job = module.reconF2lAnnotations(...args); jobs.push(job); return job;
  } };
});
import { isApprovedFixture } from '@/lib/recon-test-history.server';

const dir = join(import.meta.dirname, 'fixtures/recon-workbook');
const libraries = JSON.parse(readFileSync(join(dir, 'libraries.json'), 'utf8')) as Record<string, AlgFile>;
configureAlgFileLoader(async (_, set) => {
  if (!libraries[set]) throw new Error('Missing frozen library: ' + set);
  return libraries[set];
});
afterAll(() => configureAlgFileLoader(null));
const samples = readdirSync(dir).filter(name => name.endsWith('.json') && name !== 'libraries.json');
const tokens = (text: string) => (text.match(/[RUFLDBrufldbxyzMSE]w?(?:2'?|')?/g) ?? []).join(' ');

describe('ground truth: real timer records through the final display', () => {
  for (const file of samples) {
    const fixture = JSON.parse(readFileSync(join(dir, file), 'utf8'));
    it.skipIf(!isApprovedFixture(fixture))(file, async () => {
    // The approved recording and notation stay untouched. The 2026-10-27 UI
    // contract adds an isometric preview to Cross rows previously left blank.
    // This is the only display field allowed to differ from that snapshot.
    const expectedRows = fixture.displayRows.map((row: { label: string; diagrams: string[] }) =>
      /\b(?:ps)?x*cross\b/i.test(row.label) && row.diagrams.length === 0
        ? { ...row, diagrams: ['iso'] } : row);
    const { scramble, moves, timeMs: totalMs, model: brand, gyro } = fixture.recording;
    const before = JSON.stringify(fixture.recording);
    const samples = decodeGyroTrack(gyro);
    const view = normalizeSolve(scramble, moves, { preferredRotation: initialPoseRotation(samples, brand), measuredGrip: true });
    const segs = computeStageSegments(scramble, moves, totalMs)!;
    const raw = await buildReconText({ scramble: view.scramble, moves: view.moves, totalMs, segs,
      metrics: computeStepMetrics(scramble, moves, totalMs), slots: computeF2lSlots(scramble, moves, totalMs, segs),
      core: buildCoreTrack(samples, { brand, moves }), physical: { scramble, moves }, viewRotation: view.rotation });
    const rawBefore = JSON.stringify(raw);
    const corrected = await correctReconFromLibrary(raw, async set => {
      if (!libraries[set]) throw new Error('Missing frozen library: ' + set);
      return libraries[set];
    });
    const correctedBefore = JSON.stringify(corrected);
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    jobs.length = 0;
    try {
      await act(async () => root.render(createElement(ReconstructHostContext.Provider, { value: {
        localize: text => text.en, recordGyro: false, writeClipboardText: async () => {}, replayUrl: () => '',
        wasteBrackets: reconWasteBrackets,
        inspectionColors: moves => reconInspectionOrientations(moves + ' // insp')[0]?.colors,
        LineDiagramProvider: ReconLineDiagramProvider,
        renderCaseLink: (href, children, className) => createElement('a', { href, className }, children),
      } }, createElement(StepMoveList, { recon: corrected, reference: null, slotReference: null }))));
      await act(async () => {
        await vi.waitFor(() => expect(jobs.length).toBeGreaterThan(0));
        await Promise.all(jobs);
      });
      const readRows = () => [...host.querySelectorAll('.sml-line')].map(el => ({
        moves: el.querySelector('.sml-moves')?.textContent ?? '',
        label: el.querySelector('.sml-label')?.textContent ?? '',
        colors: [...el.querySelectorAll('[role="img"]')].map(chip => chip.getAttribute('aria-label')),
        hrefs: [...el.querySelectorAll('a')].map(a => a.getAttribute('href')),
        diagrams: [...el.querySelectorAll('[data-diagram]')].map(diagram => diagram.getAttribute('data-diagram')),
      }));
      // Exact library-case links may settle after the independent F2L lookup.
      // Flush React between retries and compare the final DOM, never an
      // intermediate render with a missing asynchronous case link.
      try {
        await vi.waitFor(async () => {
          await act(async () => { await Promise.all(jobs); });
          expect(readRows()).toEqual(expectedRows);
        }, { timeout: 5000 });
      } finally {
        if (process.env.RECON_GROUND_TRUTH_CAPTURE_DIR) {
          writeFileSync(join(process.env.RECON_GROUND_TRUTH_CAPTURE_DIR, file), JSON.stringify(readRows()));
        }
      }
      const elements = [...host.querySelectorAll('.sml-line')];
      const rows = readRows();
      expect(rows).toEqual(expectedRows);
      let state = applyScramble(3, scramble);
      const stageRows = rows.slice(2);
      state = applyOneToken(state, tokens(rows[1].moves));
      for (const [index, row] of stageRows.entries()) {
        // A correct view type is insufficient if the thumbnail shows the state
        // after this line, or ignores an inspection/display-frame rotation.
        for (const diagram of elements[index + 2].querySelectorAll('[data-setup]')) {
          const rebased = applyScramble(3, diagram.getAttribute('data-setup')!);
          if (/\b(?:ps)?x*cross\b/i.test(row.label)) {
            // Cross uses the physical pre-line setup directly. Library images
            // below rebase sticker identities before applying their masks.
            expect(rebased, file + ' cross diagram before line ' + index).toEqual(state);
            continue;
          }
          const restored = Object.fromEntries((['U', 'R', 'F', 'D', 'L', 'B'] as const).map(face =>
            [face, rebased[face].map(color => state[color][4])],
          ));
          expect(restored, file + ' diagram before line ' + index).toEqual(state);
        }
        state = applyOneToken(state, tokens(row.moves));
        const line = corrected.lines[index];
        if (line?.kind === 'cross' || line?.kind === 'f2l') {
          expect(state.D[4], file + ' ' + line.key).toBe(raw.crossColor);
          expect(isCross(state), file + ' ' + line.key).toBe(true);
          expect(tokens(row.moves).split(' ').some(move => /^z/.test(move))).toBe(false);
        }
      }
      expect(isSolved(state), file + ' final DOM must solve').toBe(true);
      const shown = projectReconNotation(corrected, 'cfop').shownRecon!;
      const playback = reconstructedTrack(shown.lines, moves);
      expect(playback, file + ' simplified playback must retain complete encoder coverage').not.toBeNull();
      expect(playback!.map(move => move.m)).toEqual(shown.lines.flatMap(line => line.moves));
      expect(isSolved(applyOneToken(applyScramble(3, scramble),
        [shown.inspection, ...playback!.map(move => move.m)].join(' '))), file + ' simplified playback must solve').toBe(true);
      const last = tokens(stageRows.at(-1)!.moves).split(' ').at(-1)!;
      expect(/^[xyz]/.test(last), 'no synthetic rotation after solved').toBe(false);
      expect(rows.slice(0, 2).flatMap(row => row.diagrams)).toEqual([]);
      for (const row of stageRows) {
        expect(row.label).not.toMatch(/\([WYGBOR]{2}(?:\+[WYGBOR]{2})*\)/);
        expect(row.label).not.toMatch(/\(\d+\)/);
        expect(row.label).not.toContain('最优');
        if (/\b(?:ps)?x*cross\b/i.test(row.label)) expect(row.diagrams).toEqual(['iso']);
        else if (/ZBLS|VLS|\bWV\b|\bSV\b/.test(row.label)) expect(row.diagrams).toEqual(['iso']);
        else if (/OLL|PLL|COLL|ZBLL|ELL|1LLL/.test(row.label)) {
          expect(row.diagrams).toEqual(['plan']);
          expect(row.hrefs.some(href => /^\/alg\/3x3\/[^/]+\/[^/]+$/.test(href ?? ''))).toBe(true);
        }
      }
      expect(JSON.stringify(raw)).toBe(rawBefore);
      expect(JSON.stringify(corrected)).toBe(correctedBefore);
      expect(JSON.stringify(fixture.recording)).toBe(before);
    } finally {
      await act(async () => root.unmount());
      host.remove();
    }
  });
  }
});

// Synthetic mask checks do not enroll any real recording into ground truth.
it('recon diagrams reuse library masks in every holding orientation', async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement('div');
  const root = createRoot(host);
  try {
    for (const set of ['oll', 'ollcp', 'coll', 'pll', 'zbll', 'zbls', 'wv', 'vls', 'sv']) {
      for (const { value: grip } of CUBE_ORIENTATIONS) {
        const scramble = `R U R' ${grip}`;
        await act(async () => root.render(createElement(ReconLineDiagramProvider, {
          scramble, text: `U // ${set.toUpperCase()}`, enabled: true,
          children: diagramAt => diagramAt(0),
        })));
        const diagram = host.querySelector('[data-diagram]')!;
        const expected = cubeThumbParams('3x3', set, libraries[set]?.cases[0]?.sticker ?? { kind: 'raw', tag: '', attrs: {} });
        expect(diagram.getAttribute('data-mask'), set).toBe(expected.mask ?? null);
        expect(diagram.getAttribute('data-view'), set).toBe(['zbls', 'wv', 'vls', 'sv'].includes(set) ? 'iso' : expected.view);
        expect(diagram.getAttribute('data-hide-grey'), set).toBe(expected.hideGreySides === undefined ? null : String(expected.hideGreySides));
        const actual = applyScramble(3, scramble);
        const rebased = applyScramble(3, diagram.getAttribute('data-setup')!);
        const colors = orientedFaceColors(grip);
        for (const face of ['U', 'R', 'F', 'D', 'L', 'B'] as const) {
          expect(rebased[face][4]).toBe(face);
          expect(rebased[face].map(color => colors[color])).toEqual(actual[face]);
        }
        if (set === 'oll') expect(diagram.getAttribute('data-scheme')!.split(',').slice(1)).toEqual(Array(5).fill('404040'));
      }
    }
  } finally { await act(async () => root.unmount()); }
});

it.each(["u'", "Uw'"])('preserves a measured wide cross gesture (%s) instead of moving it into inspection', wide => {
  const moves = ["R'", "B'", 'F', 'L', 'R2', wide];
  const recon = {
    scramble: "R U' F U2 F2 L' B' U' B2 U2 R' B2 R U' L' D' L2 F2",
    inspection: 'x2',
    lines: [{ kind: 'cross', key: 'cross', moves, label: 'W cross', fromIdx: 0, toIdx: 5,
      recognitionMs: null, executionMs: null, stepMs: null }],
    text: `x2 // insp\n${moves.join(' ')} // W cross`,
  } as NonNullable<Parameters<typeof projectReconNotation>[0]>;
  const result = projectReconNotation(recon, 'cfop');
  expect(result.inspection).toBe('x2');
  expect(result.lines[0].moves).toEqual(["R'", "B'", 'F', 'L', 'R2', "u'"]);
  expect(recon.lines[0].moves).toEqual(["R'", "B'", 'F', 'L', 'R2', wide]);
  expect(result.normalized).toBe(false);
});
