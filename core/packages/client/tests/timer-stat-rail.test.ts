// @vitest-environment jsdom
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TimerStatRail } from '@cuberoot/timer-ui';

describe('shared timer statistics entry copy', () => {
  const summary = { count: 6, solved: 5, mean: '12.34', best: '9.87', mo3: '11.23', ao5: '12.00', ao12: '—' };
  it.each(['en', 'zh'] as const)('owns the same compact row labels and values in %s', (language) => {
    const host = document.createElement('div');
    host.innerHTML = renderToStaticMarkup(createElement(TimerStatRail, { language, summary }));
    expect([...host.querySelectorAll('.shell-stat')].map(row => [
      row.querySelector('.shell-stat-lbl')?.textContent ?? '',
      row.querySelector('.shell-stat-val')?.textContent,
    ])).toEqual([
      ['', '5/6'], ['mean', '12.34'], ['best', '9.87'],
      ['mo3', '11.23'], ['ao5', '12.00'], ['ao12', '—'],
    ]);
    expect(host.querySelector('button')?.title).toBe(
      { en: 'Open times and statistics', zh: '打开成绩与统计' }[language],
    );
  });

  it.each(['en', 'zh'] as const)('shows only the shared empty entry in %s', (language) => {
    const host = document.createElement('div');
    host.innerHTML = renderToStaticMarkup(createElement(TimerStatRail, {
      language, summary: { ...summary, count: 0, solved: 0 },
    }));
    expect(host.textContent).toBe({ en: 'Times', zh: '成绩' }[language]);
    expect(host.querySelectorAll('.shell-stat')).toHaveLength(1);
  });

  it('retains the statistics entry when every solve is DNF', () => {
    const host = document.createElement('div');
    host.innerHTML = renderToStaticMarkup(createElement(TimerStatRail, {
      language: 'zh', summary: { ...summary, solved: 0, mean: 'DNF', best: 'DNF' },
    }));
    expect(host.querySelector('.shell-stat-val')?.textContent).toBe('0/6');
    expect(host.querySelectorAll('.shell-stat')).toHaveLength(6);
  });
});
