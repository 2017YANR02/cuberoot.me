import { describe, expect, it } from 'vitest';
import { metricIdsWithDataForEvent } from '@/components/wca-stats/WcaStatView.cells';
import type { MetricPanel } from '@/components/wca-stats/WcaStatView.types';

function metric(id: string, eventTitles: string[]): MetricPanel {
  return {
    id,
    labelEn: id,
    labelZh: id,
    panels: [{
      id: 'ranking',
      labelEn: 'Ranking',
      labelZh: '排名',
      header: [],
      sections: eventTitles.map(title => ({ title, rows: [[1]] })),
    }],
  };
}

describe('WCA metric availability by event', () => {
  const metrics = [
    metric('single', ["Rubik's Cube", '6x6x6 Cube']),
    metric('average', ["Rubik's Cube", '6x6x6 Cube']),
    metric('bao5', ["Rubik's Cube"]),
    metric('median', ["Rubik's Cube", '6x6x6 Cube']),
    metric('worst', ["Rubik's Cube", '6x6x6 Cube']),
    metric('variance', ["Rubik's Cube", '6x6x6 Cube']),
  ];

  it('keeps Mo3 metrics and hides an unavailable Ao5 metric for 6x6', () => {
    expect([...metricIdsWithDataForEvent(metrics, '666')]).toEqual([
      'single', 'average', 'median', 'worst', 'variance',
    ]);
  });

  it('restores BAo5 where that metric has data', () => {
    expect(metricIdsWithDataForEvent(metrics, '333')).toContain('bao5');
  });

  it('recognizes event sections with a suffix', () => {
    expect(metricIdsWithDataForEvent([
      metric('median', ['6x6x6 Cube - 2026']),
    ], '666')).toContain('median');
  });
});
