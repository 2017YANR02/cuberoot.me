// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { exportTimerCstimerJson, exportTimerSolvesCsv, exportSpeedstacks, type Solve } from '@cuberoot/shared/timer';
import { TimerExportSettings } from '@cuberoot/timer-ui';

const solves: Solve[] = ['ok', '+2', 'DNF', 'DNS'].map((penalty, index) => ({
  id: `solve-${index}`, event: '333', ts: 1700000000000 + index * 1000,
  timeMs: 12345, penalty: penalty as Solve['penalty'], scramble: "R U R'", comment: '中文, "note"\nnext',
}));

describe('shared timer export formats', () => {
  it('writes upstream csTimer penalty/time tuples and preserves raw times, comments and DNS', () => {
    const result = exportTimerCstimerJson({ '333': solves, '222': [{ ...solves[0], event: '222' }] });
    expect(result.solveCount).toBe(5); expect(result.sessionCount).toBe(2);
    const output = JSON.parse(result.json);
    const metadata = JSON.parse(output.properties.sessionData);
    const sid = Object.keys(metadata).find(key => metadata[key].opt.scrType === '333')!;
    expect(JSON.parse(output[`session${sid}`])).toEqual([
      [[0, 12345], "R U R'", '中文, "note"\nnext', 1700000000],
      [[2000, 12345], "R U R'", '中文, "note"\nnext', 1700000001],
      [[-1, 12345], "R U R'", '中文, "note"\nnext', 1700000002],
      [[-1, 12345], "R U R'", 'DNS 中文, "note"\nnext', 1700000003],
    ]);
  });

  it('quotes CSV fields and distinguishes raw time from penalties; Speedstacks keeps chronological order', () => {
    const { csv, solveCount } = exportTimerSolvesCsv({ '333': solves });
    expect(solveCount).toBe(4);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('12345,+2,14345,"中文, ""note""\nnext"');
    expect(csv).toContain('12345,DNF,,');
    expect(exportSpeedstacks([...solves].reverse())).toBe('00:12.345\n00:14.345+\nDNF\nDNS\n');
    expect(exportTimerSolvesCsv({}).solveCount).toBe(0);
    expect(exportTimerCstimerJson({}).sessionCount).toBe(0);
    expect(exportSpeedstacks([])).toBe('');
  });

  it('routes all four shared export buttons to their actual format', async () => {
    const container = document.createElement('div'); const root = createRoot(container);
    const onExport = vi.fn();
    try {
      await act(async () => root.render(<TimerExportSettings localize={copy => copy.en} onExport={onExport} />));
      await act(async () => container.querySelectorAll('button').forEach(button => button.click()));
      expect(onExport.mock.calls.flat()).toEqual(['cuberoot', 'cstimer', 'csv', 'speedstacks']);
    } finally { await act(async () => root.unmount()); }
  });
});
