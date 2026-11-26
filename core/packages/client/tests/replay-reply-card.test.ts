// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import ReplayReplyCard from '@/components/ReplayReplyCard';
import type { ReplayReply } from '@/lib/assistant-conversations';

vi.mock('@/hooks/useT', () => ({useT: () => (zh: string) => zh}));

it('preserves partial retest rows without inventing a median or a recurring target', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const node = document.body.appendChild(document.createElement('div'));
  const root = createRoot(node);
  const report: ReplayReply = {afterPractice: true, summary: {
    method: 'CFOP', penalty: 'ok', timeMs: 9569, stm: null, tps: null,
    focus: {label: 'F1', goal: 'recognitionMs'},
    stages: [{label: 'F1', stepMs: 1764, recognitionMs: 1004, executionMs: 760, turns: 8, cumulativeMs: 2578}],
    evidence: {observationNote: '同类样本不足', excluded: ['PLL'], training: {drills: [], retest: {
      name: 'W+', metric: '专项总用时', before: ['1.100', 'DNF'], after: [], beforeMs: null, afterMs: null,
      beforeValid: 1, afterValid: 0, extra: 0, manual: true,
    }}},
  }};
  try {
    await act(() => root.render(createElement(ReplayReplyCard, {report, children: '原始依据'})));
    expect(node.textContent).toContain('练前 2/5，练后 0/5');
    expect(node.querySelector('.rr-median')?.textContent).toContain('—');
    expect(node.textContent).toContain('1.100 · DNF');
    expect(node.textContent).not.toContain('用时缩短');
    const analysis = [...node.querySelectorAll('button')].find(button => button.textContent === '本局分析')!;
    await act(() => analysis.click());
    expect(node.textContent).toContain('同类样本不足');
    expect(node.textContent).toContain('1.004 秒');
    expect(node.textContent).toContain('排除：PLL');
    expect(node.textContent).not.toContain('超过慢速门槛');
    expect(node.querySelector('.rr-median')).toBeNull();
  } finally {
    await act(() => root.unmount());
    node.remove();
    vi.unstubAllGlobals();
  }
});
