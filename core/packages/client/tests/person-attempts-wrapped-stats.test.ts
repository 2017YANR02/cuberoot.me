import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { parseHTML } from 'linkedom';
import { describe, expect, it, vi } from 'vitest';
import { AttemptsList, type AttemptsListProps } from '@/components/persons/sections/results/AttemptsList';

vi.mock('@/components/persons/sections/results/AttemptPopover', () => ({
  AttemptPopover: ({ value, reconHref }: { value: number; reconHref: string }) =>
    createElement('button', { 'data-value': value, 'data-recon-href': reconHref }, String(value)),
}));

const attempts = [429, 516, 462, 428, 643, 406, 425, 438, 440, 424, 395, 391, 387, 329, 360, 402, 567, 455, 517, 433, 383, 525, 386];
const props: AttemptsListProps = {
  attempts, best: 329, eventId: '333', compId: 'GuangdongRevivalRival2026', roundTypeId: 'f',
  reconLookup: new Map([['GuangdongRevivalRival2026|333|f|9', { id: 9, stm: 41, tps: 12.46 }]]),
  isZh: false, personId: '2023GENG02', personName: 'Xuanyi Geng', compName: 'Guangdong Revival Rival',
  cols: 5, showReconStats: true,
};

function render(overrides: Partial<AttemptsListProps> = {}) {
  return parseHTML(renderToStaticMarkup(createElement(AttemptsList, { ...props, ...overrides }))).document;
}

describe('wrapped person attempts', () => {
  it('keeps all 23 attempts and attaches the ninth reconstruction to its own solve without empty statistic rows', () => {
    const document = render();
    expect([...document.querySelectorAll('button')].map(el => Number(el.dataset.value))).toEqual(attempts);
    const stacks = document.querySelectorAll('.wp-att-stack');
    expect(stacks.length).toBe(23);
    expect(stacks[8].querySelector('button')?.dataset.reconHref).toBe('/recon/9');
    expect([...stacks[8].querySelectorAll('.wp-att-sub')].map(el => el.textContent)).toEqual(['STM41', 'TPS12.46']);
    expect(document.querySelectorAll('.wp-att-sub').length).toBe(2);
    expect(document.querySelectorAll('.wp-attempts-flow > .wp-att-sub').length).toBe(0);
  });

  it('preserves zero timing values on a later solve and leaves missing metrics absent', () => {
    const document = render({
      showReconStats: false, showTimingStats: true,
      reconLookup: new Map([['GuangdongRevivalRival2026|333|f|23', { id: 23, pickupTime: 0, putdownTime: 0.125 }]]),
    });
    const stats = document.querySelectorAll('.wp-att-stack')[22].querySelectorAll('.wp-att-sub');
    expect([...stats].map(el => el.lastElementChild?.textContent)).toEqual(['0.000', '0.125', '0.125']);
    expect(document.querySelectorAll('.wp-att-sub').length).toBe(3);
  });

  it('hides supplementary statistics when the detail toggle is off', () => {
    const document = render({ showReconStats: false, showTimingStats: false });
    expect(document.querySelectorAll('button').length).toBe(23);
    expect(document.querySelectorAll('.wp-att-sub').length).toBe(0);
  });

  it('keeps the existing aligned STM/TPS rows for a normal five-attempt round', () => {
    const document = render({
      attempts: attempts.slice(0, 5),
      reconLookup: new Map([['GuangdongRevivalRival2026|333|f|4', { id: 4, stm: 41, tps: 12.46 }]]),
    });
    expect(document.querySelectorAll('.wp-att-stack').length).toBe(0);
    expect([...document.querySelectorAll('.wp-att-sub')].map(el => el.textContent))
      .toEqual(['', '', '', '41', '', '', '', '', '12.46', '']);
  });
});
