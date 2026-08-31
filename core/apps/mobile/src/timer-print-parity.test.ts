import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { Solve } from '@cuberoot/shared/timer';
import { TimerPrintDocument } from '@cuberoot/timer-ui';

const solves: Solve[] = [
  {
    id: 'solve-1',
    timeMs: 12_345,
    penalty: 'ok',
    scramble: "R U R' U'",
    event: '333',
    ts: Date.UTC(2026, 7, 29, 17, 0, 0),
    comment: 'First solve',
  },
  {
    id: 'solve-2',
    timeMs: 15_000,
    penalty: '+2',
    scramble: 'F2 L2 D2 B2',
    event: '333',
    ts: Date.UTC(2026, 7, 30, 17, 0, 0),
    comment: 'Second\nline',
  },
  {
    id: 'solve-3',
    timeMs: 18_000,
    penalty: 'DNF',
    scramble: 'U2 R2 F2 D2',
    event: '333',
    ts: Date.UTC(2026, 7, 30, 18, 0, 0),
  },
];

function render(language: 'en' | 'zh'): string {
  return renderToStaticMarkup(createElement(TimerPrintDocument, {
    currentResult: 'DNF',
    currentScramble: 'U2 R2 F2 D2',
    event: '333',
    generatedAt: Date.UTC(2026, 7, 30, 19, 0, 0),
    language,
    solves,
  }));
}

describe('shared timer print document', () => {
  it('renders deterministic English and Chinese reports with every solve field', () => {
    const english = render('en');
    const chinese = render('zh');

    expect(english).toContain('Cube Timer: 3×3');
    expect(english).toContain('Summary');
    expect(english).toContain('Results');
    expect(english).toContain('Current ao1000');
    expect(english).toContain('First solve');
    expect(english).toContain('Second\nline');
    expect(english).toContain("R U R&#x27; U&#x27;");
    expect(english).toContain('17.00 (+2)');
    expect(english).toContain('DNF');

    expect(chinese).toContain('魔方计时器: 三阶');
    expect(chinese).toContain('统计摘要');
    expect(chinese).toContain('成绩明细');
    expect(chinese).toContain('当前 ao1000');
    expect(chinese).toContain('备注');

    expect(english).toContain('F2 L2 D2 B2');
    expect(english).toContain('U2 R2 F2 D2');
    expect(chinese).toContain('F2 L2 D2 B2');
    expect(chinese).toContain('U2 R2 F2 D2');
    const englishRows = english.match(/timer-print-table-body[\s\S]*<\/div><\/div>/)?.[0] ?? '';
    expect(englishRows.match(/class="timer-print-row"/g)).toHaveLength(3);
    expect(englishRows.indexOf('U2 R2 F2 D2')).toBeLessThan(englishRows.indexOf('F2 L2 D2 B2'));
    expect(englishRows.indexOf('F2 L2 D2 B2')).toBeLessThan(englishRows.indexOf("R U R&#x27; U&#x27;"));
  });

  it('preserves FMC, MBLD, DNS and +2 result semantics and handles an empty event', () => {
    const base = {
      currentResult: '0.00',
      currentScramble: '',
      generatedAt: Date.UTC(2026, 7, 30, 19, 0, 0),
      language: 'en' as const,
    };
    const fmc = renderToStaticMarkup(createElement(TimerPrintDocument, {
      ...base,
      event: '333fm',
      solves: [{
        id: 'fmc', timeMs: 28_000, penalty: 'ok', scramble: 'FMC', event: '333fm', ts: 1,
      }],
    }));
    const mbld = renderToStaticMarkup(createElement(TimerPrintDocument, {
      ...base,
      event: '333mbld',
      solves: [{
        id: 'mbld',
        timeMs: 3_480_000,
        penalty: '+2',
        scramble: 'MBLD',
        event: '333mbld',
        ts: 2,
        mbld: { solved: 11, attempted: 13 },
      }],
    }));
    const dns = renderToStaticMarkup(createElement(TimerPrintDocument, {
      ...base,
      event: '333',
      solves: [{
        id: 'dns', timeMs: 0, penalty: 'DNS', scramble: '', event: '333', ts: 3,
      }],
    }));
    const empty = renderToStaticMarkup(createElement(TimerPrintDocument, {
      ...base,
      event: '333',
      solves: [],
    }));

    expect(fmc).toContain('class="timer-print-result">28</span>');
    expect(mbld).toContain('11/13 58:02 (+2)');
    expect(dns).toContain('class="timer-print-result">DNS</span>');
    expect(dns).toContain('class="timer-print-scramble">-</span>');
    expect(empty).toContain('No solves in this event.');
    expect(empty).not.toContain('timer-print-table');
  });

  it('chunks long reports into independently laid out A4 row groups', () => {
    const longReport = renderToStaticMarkup(createElement(TimerPrintDocument, {
      currentResult: '12.34',
      currentScramble: "R U R' U'",
      event: '333',
      generatedAt: Date.UTC(2026, 7, 30, 19, 0, 0),
      language: 'en',
      solves: Array.from({ length: 7 }, (_, index) => ({
        ...solves[0],
        id: `paged-${index}`,
        ts: solves[0].ts + index,
      })),
    }));

    expect(longReport.match(/timer-print-page-group--paged/g)).toHaveLength(2);
    expect(longReport.match(/role="columnheader"/g)).toHaveLength(10);
  });

  it('keeps Mobile native code limited to print transport', () => {
    const mobile = readFileSync('src/App.tsx', 'utf8');
    const android = readFileSync('android/app/src/main/java/me/cuberoot/app/TimerPrintPlugin.java', 'utf8');
    const ios = readFileSync('ios/App/App/SceneDelegate.swift', 'utf8');

    expect(mobile).toContain('<TimerPrintController');
    expect(android).toContain('createPrintDocumentAdapter');
    expect(ios).toContain('webView.viewPrintFormatter()');
    expect(android).not.toContain('<html');
    expect(ios).not.toContain('<html');
  });
});
