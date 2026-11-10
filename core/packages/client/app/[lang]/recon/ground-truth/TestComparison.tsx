'use client';

import { useState } from 'react';
import MoreToggle from '@/components/MoreToggle';
import { InfoTooltip } from '@/components/InfoTooltip/InfoTooltip';
import { tr } from '@/i18n/tr';
import type { ReconIntakeCase, ReconSnapshot, ReconTestCase, ReconTestRun, ReconTestRow, ReconTestStatus } from '@cuberoot/shared/recon-ground-truth';

export type RegressionComparison = { sample: ReconTestCase; result?: ReconTestCase; run?: ReconTestRun };
const statuses: Record<ReconTestStatus, { zh: string; en: string }> = {
  passed: { zh: '通过', en: 'Passed' }, failed: { zh: '失败', en: 'Failed' },
  running: { zh: '检查中', en: 'Running' }, 'not-run': { zh: '未运行', en: 'Not run' },
  interrupted: { zh: '已中断', en: 'Interrupted' },
};
export const snapshotText = (snapshot: ReconSnapshot) => [snapshot.inspection + ' // inspection',
  ...snapshot.lines.map(line => `${line.moves.join(' ')} // ${line.label ?? ''} [${line.fromIdx + 1}–${line.toIdx + 1}]`)].join('\n');
const rowText = (rows: ReconTestRow[]) => rows.map(row => `${row.moves}${row.label ? '  ' + row.label : ''}${row.colors.length ? ' [' + row.colors.join(' / ') + ']' : ''}`).join('\n');

export default function TestComparison({ regression, item }: { regression: RegressionComparison; item?: ReconIntakeCase }) {
  const [source, setSource] = useState('regression');
  const individual = source === 'individual' && !!item;
  const expected = individual ? item.expected ?? item.input.observed : regression.result?.expected ?? regression.sample.expected;
  const actual = individual ? item.latestRun?.actual : regression.result?.actual;
  const status = (individual ? item.latestRun?.status : regression.result?.status) ?? 'not-run';
  const errors = (individual ? item.latestRun?.errors : regression.result?.errors) ?? [];
  // Compare the full records, including colors, links, diagrams and step boundaries.
  // Text formatting must never hide a difference in the underlying test evidence.
  const identical = actual != null && JSON.stringify(expected) === JSON.stringify(actual);
  const format = (value: ReconSnapshot | ReconTestRow[]) => Array.isArray(value) ? rowText(value) : snapshotText(value);
  const timestamp = individual ? item.latestRun?.createdAt : regression.run?.startedAt;
  const commit = individual ? item.latestRun?.commit : regression.run?.commit;
  const fingerprint = individual ? item.latestRun?.fingerprint : regression.run?.fingerprint;
  const expectedLabel = individual && !item.expected
    ? tr({ zh: '收录快照（未确认）', en: 'Intake snapshot (unconfirmed)' })
    : tr({ zh: '预期', en: 'Expected' });
  return <details className="gt-case-disclosure">
    <MoreToggle as="summary">{tr({ zh: '测试对照', en: 'Test comparison' })}</MoreToggle>
    <div className="gt-review-summary">
      {item ? <select className="gt-filter-select" aria-label={tr({ zh: '测试记录', en: 'Test record' })} value={source} onChange={event => setSource(event.target.value)}>
        <option value="regression">{tr({ zh: '全量回归', en: 'Regression' })}</option>
        <option value="individual">{tr({ zh: '单样本测试', en: 'Individual test' })}</option>
      </select> : <span>{tr({ zh: '全量回归', en: 'Regression' })}</span>}
      <span data-result={status}>{tr(statuses[status])}</span>
      <InfoTooltip ariaLabel={tr({ zh: '测试详情', en: 'Test details' })} content={[
        timestamp && new Date(timestamp).toLocaleString(),
        individual && item.latestRun && 'v' + item.latestRun.revision,
        commit, fingerprint,
        tr({ zh: '单样本测试与全量回归可能来自不同代码版本；播放器使用当前代码。', en: 'Individual tests and regression runs may use different code versions. Playback uses current code.' }),
      ].filter(Boolean).join('\n')} />
    </div>
    {identical ? <><p>{tr({ zh: '预期与输出一致', en: 'Expected and actual match' })}{individual && !item.expected && ' · ' + expectedLabel}</p><pre>{format(expected)}</pre></>
      : <div className="gt-text-compare"><div><h3>{expectedLabel}</h3><pre>{format(expected)}</pre></div>
        <div><h3>{tr({ zh: '实际', en: 'Actual' })}</h3><pre>{actual == null ? tr({ zh: '本次无输出', en: 'No output in this run' }) : format(actual)}</pre></div></div>}
    {errors.length > 0 && <pre className="gt-run-errors">{errors.join('\n\n')}</pre>}
  </details>;
}
