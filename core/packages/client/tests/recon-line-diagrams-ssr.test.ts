import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { ReconLineDiagramProvider } from '@/components/ReconLineDiagrams';
import { VisualCube } from '@/components/VisualCube';
import { reconLineSetups } from '@/lib/recon-alg-utils';
import { applyScramble } from '@cuberoot/shared/timer/reconstruct/state';

vi.mock('@cuberoot/timer-ui', () => ({ TimerRoomDialog: () => null }));

// Public recon 2796: the waste annotation spans the last F2L and ZBLL rows.
const scramble = "F' L' B R' B2 U L2 B2 U2 F2 D R D L F' U L B'";
const solution = [
  "x' z' // insp",
  "r' F R2 r' U r D F2 // W xxcross (RB+OB)",
  "(U' U' U') R' U R // GO",
  "U' R (U R' // GR",
  "R U) R' U R U2' R' U // ZBLL-S+67",
].join('\n');

const renderLastLayer = (text: string) => renderToStaticMarkup(createElement(ReconLineDiagramProvider, {
  scramble, text, enabled: true, children: diagramAt => diagramAt(4),
}));

it('server-renders the exact 2796 ZBLL state despite a cross-line waste annotation', () => {
  const html = renderLastLayer(solution);
  expect(html).toContain('<svg');
  expect(html).toBe(renderLastLayer(solution.replace('(U R\'', 'U R\'').replace('R U)', 'R U')));
});

it('retains every turn across annotation boundaries and expands completed repeats', () => {
  expect(reconLineSetups('F', "(R\nU)2 // pair\n\nR' // OLL")).toEqual([
    'F', 'F R', 'F R U R U', 'F R U R U', "F R U R U R'",
  ]);
  const setups = reconLineSetups(scramble, solution);
  expect(setups[4]).toBe(`${scramble} x' z' r' F R2 r' U r D F2 U' U' U' R' U R U' R U R'`);
  const solved = applyScramble(3, setups[5]);
  expect(['U', 'R', 'F', 'D', 'L', 'B'].map(face => solved[face as keyof typeof solved].join('')))
    .toEqual(['D', 'F', 'R', 'U', 'B', 'L'].map(color => color.repeat(9)));
});

it.each([false, true])('isolates malformed local diagrams during SSR (custom renderer=%s)', custom => {
  const html = renderToStaticMarkup(createElement('article', null,
    'Reconstruction text', createElement(VisualCube, {
      setup: 'R (U', view: 'iso', local: true, interactive: custom,
      ...(custom ? { viewportRotations: [] } : {}),
    }),
  ));
  expect(html).toContain('Reconstruction text');
  expect(html).not.toContain('<svg');
  expect(html).not.toContain('<img');
});
