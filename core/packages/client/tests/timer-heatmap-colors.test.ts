// @vitest-environment jsdom
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import type { Solve } from '@cuberoot/shared/timer';
import { TimerPracticeHeatmap } from '@cuberoot/timer-ui';

it('keeps inactive dates transparent and maps activity to four contribution levels', () => {
  const solves: Solve[] = [1, 6, 16, 51].flatMap((count, day) =>
    Array.from({ length: count }, (_, index) => ({
      id: `${day}-${index}`, event: '333', penalty: 'ok',
      timeMs: 10000, scramble: 'R U', ts: new Date(2026, 0, day + 1, 12).getTime(),
    })));
  const host = document.createElement('div');
  host.innerHTML = renderToStaticMarkup(createElement(TimerPracticeHeatmap, { solves, year: 2026, isZh: false }));
  const cells = [...host.querySelectorAll('.tc-heatmap-cell:not(.tc-heatmap-cell-out)')];
  expect(cells).toHaveLength(365);
  expect(cells.filter(cell => cell.getAttribute('fill') === 'transparent')).toHaveLength(361);
  for (let level = 1; level <= 4; level++) {
    expect(cells.filter(cell => cell.getAttribute('fill') === `var(--heatmap-level-${level})`)).toHaveLength(1);
  }
  expect(host.querySelectorAll('.tc-heatmap-swatch')).toHaveLength(5);
  expect(host.querySelector('.tc-heatmap-grid svg')).not.toBeNull();
});
