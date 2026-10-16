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
import { ReconstructHostContext } from '@cuberoot/timer-ui/reconstruct/ReconstructHost';
import { ReconLineDiagramProvider } from '@/components/ReconLineDiagrams';
import { reconInspectionOrientations, reconWasteBrackets } from '@/lib/recon-alg-utils';

// Only the drawing surface is replaced: state/mask selection, annotations,
// formula matching, links, waste and the actual timer DOM remain production code.
vi.mock('@/components/VisualCube', () => ({
  VisualCube: (props: { view: string; setup?: string; faceletColors?: string }) =>
    createElement('span', { 'data-diagram': props.view, 'data-setup': props.setup, 'data-facelets': props.faceletColors }),
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
      const elements = [...host.querySelectorAll('.sml-line')];
      const rows = elements.map(el => ({
        moves: el.querySelector('.sml-moves')?.textContent ?? '',
        label: el.querySelector('.sml-label')?.textContent ?? '',
        colors: [...el.querySelectorAll('[role="img"]')].map(chip => chip.getAttribute('aria-label')),
        hrefs: [...el.querySelectorAll('a')].map(a => a.getAttribute('href')),
        diagrams: [...el.querySelectorAll('[data-diagram]')].map(diagram => diagram.getAttribute('data-diagram')),
      }));
      if (process.env.RECON_GROUND_TRUTH_CAPTURE_DIR) {
        writeFileSync(join(process.env.RECON_GROUND_TRUTH_CAPTURE_DIR, file), JSON.stringify(rows));
      }
      expect(rows).toEqual(fixture.displayRows);
      let state = applyScramble(3, scramble);
      const stageRows = rows.slice(2);
      state = applyOneToken(state, tokens(rows[1].moves));
      for (const [index, row] of stageRows.entries()) {
        // A correct view type is insufficient if the thumbnail shows the state
        // after this line, or ignores an inspection/display-frame rotation.
        for (const diagram of elements[index + 2].querySelectorAll('[data-setup]')) {
          expect(applyScramble(3, diagram.getAttribute('data-setup')!), file + ' diagram before line ' + index).toEqual(state);
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
      const last = tokens(stageRows.at(-1)!.moves).split(' ').at(-1)!;
      expect(/^[xyz]/.test(last), 'no synthetic rotation after solved').toBe(false);
      expect(rows.slice(0, 3).flatMap(row => row.diagrams)).toEqual([]);
      for (const row of stageRows) {
        expect(row.label).not.toMatch(/\([WYGBOR]{2}(?:\+[WYGBOR]{2})*\)/);
        expect(row.label).not.toMatch(/\(\d+\)/);
        expect(row.label).not.toContain('最优');
        if (/ZBLS|VLS|\bWV\b|\bSV\b/.test(row.label)) expect(row.diagrams).toEqual(['iso']);
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
