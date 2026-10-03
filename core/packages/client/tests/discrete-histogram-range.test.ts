// @vitest-environment jsdom
import { createElement, type ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import DiscreteHistogram, { type HistSeries } from '@/app/[lang]/scramble/stats/_components/DiscreteHistogram';

const empirical: HistSeries = {
  name: 'WCA', fillColors: [],
  counts: { 12: 3, 13: 15, 14: 223, 15: 2871, 16: 35931, 17: 360626, 18: 907791, 19: 45471 },
};
const theory: HistSeries = {
  name: 'Theory', fillColors: [], outline: true,
  counts: { 0: 1, 12: 1, 19: 2, 20: 6 },
};

function render(props: ComponentProps<typeof DiscreteHistogram>) {
  const host = document.createElement('div');
  host.innerHTML = renderToStaticMarkup(createElement(DiscreteHistogram, props));
  return host;
}

function ticks(host: HTMLElement) {
  return [...host.querySelectorAll('svg text[font-size="12"]')].map(n => Number(n.textContent));
}

describe('discrete histogram data range', () => {
  it('focuses the WCA sample range with or without a theoretical outline', () => {
    const expected = [12, 13, 14, 15, 16, 17, 18, 19];
    expect(ticks(render({ series: [empirical] }))).toEqual(expected);
    expect(ticks(render({ series: [empirical, theory] }))).toEqual(expected);
  });

  it('restores theoretical tails on a logarithmic axis and in a theory-only view', () => {
    const expected = Array.from({ length: 21 }, (_, i) => i);
    expect(ticks(render({ series: [empirical, theory], logY: true }))).toEqual(expected);
    expect(ticks(render({ series: [{ ...theory, outline: false }] }))).toEqual(expected);
  });

  it('removes zero-count edges but retains integer spacing and every nonzero solid series', () => {
    expect(ticks(render({ series: [
      { name: 'A', fillColors: [], counts: { 0: 0, 3: 1, 5: 2, 9: 0 } },
      { name: 'B', fillColors: [], counts: { 6: 1 } },
    ] }))).toEqual([3, 4, 5, 6]);
  });

  it('keeps full CDF probability and the clipped theoretical prefix', () => {
    const host = render({ series: [empirical, theory], chartMode: 'cdf' });
    const bars = [...host.querySelectorAll('rect[stroke-dasharray="3,2.5"]')];
    // Full theoretical CDF: P(d <= 12) = 2/10, P(d <= 19) = 4/10.
    expect(Number(bars[0].getAttribute('height'))).toBe(316 * 0.2);
    expect(Number(bars.at(-1)?.getAttribute('height'))).toBe(316 * 0.4);
    expect(host.querySelector('.scramble-hist-total')?.textContent).toContain('1,352,931');
  });

  it('shows no data instead of a fictitious zero bin for empty or all-zero series', () => {
    const emptyCounts: Record<string, number>[] = [{}, { 0: 0, 20: 0 }];
    for (const counts of emptyCounts) {
      const host = render({ series: [{ name: 'Empty', fillColors: [], counts }] });
      expect(host.querySelector('svg')).toBeNull();
      expect(host.querySelector('.scramble-hist-empty')?.textContent).toBe('No data');
    }
  });
});
