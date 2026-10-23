'use client';

import { useMemo, useState } from 'react';
import Link from '@/components/AppLink';
import { ClearButton } from '@/components/ClearButton';
import { CubingIcon } from '@/components/EventIcon/EventIcon';
import { PUZZLE_DISTRIBUTION_COVERAGE, PUZZLE_DISTRIBUTION_COVERAGE_SCOPE } from '@/lib/puzzle-distribution-coverage';
import { tr } from '@/i18n/tr';
import { PRECOMPUTED_EXACT_SUMMARIES } from './precomputed-exact-specs';
import './exact-distribution-coverage.css';

const STATUS_LABELS = {
  exact: { zh: '完整精确分布', en: 'Complete exact distribution' },
  reported: { zh: '公开计数，待独立复核', en: 'Published counts, independent verification pending' },
  partial: { zh: '已有部分结果', en: 'Partial results available' },
  'over-budget': { zh: '超出本机计算预算', en: 'Beyond the local computation budget' },
  'model-incomplete': { zh: '模型或计步待确认', en: 'Model or metric needs verification' },
  equivalent: { zh: '复用等价模型', en: 'Equivalent model available' },
} as const;
type Status = keyof typeof STATUS_LABELS;

export default function ExactDistributionCoverage() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<Status | ''>('');
  const entries = useMemo(() => {
    const search = query.trim().toLowerCase();
    return PUZZLE_DISTRIBUTION_COVERAGE.filter(item => {
      if (status && item.status !== status) return false;
      return !search || [item.id, item.name.zh, item.name.en, item.scope.zh, item.scope.en, item.reason.zh, item.reason.en]
        .some(value => value.toLowerCase().includes(search));
    });
  }, [query, status]);

  return (
    <details className="exact-distribution-coverage" onToggle={event => setOpen(event.currentTarget.open)}>
      <summary>{tr({ zh: '覆盖情况', en: 'Coverage' })} · {PUZZLE_DISTRIBUTION_COVERAGE.length}</summary>
      {open && (
        <div className="exact-distribution-coverage-content">
          <p>{tr({
            zh: '完整分布统计每个状态的最优距离；图下示例是其中有限的可回放状态。未完成项列出当前模型或资源限制。',
            en: 'A complete distribution counts the optimal distance of every state; examples are a bounded set of replayable states. Unfinished entries identify the current model or resource limit.',
          })}</p>
          <p>{tr(PUZZLE_DISTRIBUTION_COVERAGE_SCOPE)}</p>
          <div className="exact-distribution-coverage-controls">
            <div className="exact-distribution-coverage-search">
              <input className="exact-distribution-coverage-query" value={query} onChange={event => setQuery(event.currentTarget.value)}
                placeholder={tr({ zh: '搜索项目', en: 'Search puzzles' })}
                aria-label={tr({ zh: '搜索覆盖项目', en: 'Search coverage entries' })} />
              {query && <ClearButton onClick={() => setQuery('')} />}
            </div>
            <select className="scramble-stats-select" value={status} onChange={event => setStatus(event.currentTarget.value as Status | '')}
              aria-label={tr({ zh: '结果状态', en: 'Result status' })}>
              <option value="">{tr({ zh: '全部进度', en: 'All statuses' })}</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{tr(label)}</option>)}
            </select>
          </div>
          <ul className="exact-distribution-coverage-list">
            {entries.map(item => {
              const exact = PRECOMPUTED_EXACT_SUMMARIES[item.id];
              const godsNumber = exact?.godsNumber ?? item.godsNumber;
              const stateCount = exact?.total.toLocaleString() ?? item.stateCount;
              const metric = exact?.metric ?? item.metric;
              return (
                <li key={item.id}>
                  <div className="exact-distribution-coverage-row">
                    {item.icon && <CubingIcon icon={item.icon} />}
                    {item.href ? <Link href={item.href} prefetch={false}>{tr(item.name)}</Link> : <span>{tr(item.name)}</span>}
                    <span className="exact-distribution-coverage-status">{tr(STATUS_LABELS[item.status])}</span>
                  </div>
                  {(godsNumber !== undefined || stateCount || metric) && (
                    <div className="exact-distribution-coverage-facts">
                      {godsNumber !== undefined && <span>{tr(exact?.subgoal
                        ? { zh: '子目标最大最优步数：{n}', en: 'Maximum optimal sub-goal distance: {n}' }
                        : { zh: '上帝之数：{n}', en: 'God’s number: {n}' }).replace('{n}', String(godsNumber))}</span>}
                      {stateCount && <span>{tr(exact?.quotient
                        ? { zh: '{n} 个陪集', en: '{n} cosets' }
                        : { zh: '{n} 态', en: '{n} states' }).replace('{n}', stateCount)}</span>}
                      {metric && <span>{tr(metric)}</span>}
                    </div>
                  )}
                  <p>{tr(item.scope)} {tr(item.reason)}</p>
                </li>
              );
            })}
          </ul>
          {entries.length === 0 && <p>{tr({ zh: '无匹配项目', en: 'No matching entries' })}</p>}
          <Link href="/dev/solvers" prefetch={false}>{tr({ zh: '求解器能力与来源', en: 'Solver capabilities and sources' })}</Link>
        </div>
      )}
    </details>
  );
}
