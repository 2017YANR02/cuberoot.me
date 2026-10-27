'use client';
// 选手页「成绩变更」面板 —— 该选手往期成绩被取消 / 修正 / 纪录标记变动时,在此保留旧成绩并标出新成绩。
// 数据源 /v1/wca/result-watch/changes?wcaId=(后台 monitors/wca_past_results.ts diff 写入)。
// 无变更则整块不渲染,避免页面拥挤(同 PersonBestCombos 的「无数据即隐藏」约定)。

import { memo, useEffect, useMemo, useState } from 'react';
import { EventIcon } from '@/components/EventIcon';
import { eventDisplayName } from '@/lib/wca-events';
import { CompCell } from '@/components/CompCell/CompCell';
import { RecordBadge } from '@/components/RecordBadge';
import Link from '@/components/AppLink';
import { compLinkProps } from '@/lib/comp-link';
import { roundLabel } from '@/lib/wca-round-meta';
import {
  fetchResultChanges, formatChangeFieldValue, isApprovedChange, isReplacedResultRemoval,
  type ResultChange, type ResultChangeField,
} from '@/lib/result-watch-api';
import { tr, useLang } from '@/i18n/tr';
import type { WcaResultRow } from '@/lib/wca-person-api';
import { summarizeResultChanges } from '@/lib/result-change-summary';

// 本面板=「已生效的成绩更正历史」,只收 approved。待审核(pending)提议另由成绩表行内
// 「待审核」标记展示,绝不在此当作官方更正呈现(否则任何登录用户都能伪造一条假更正)。
function PersonResultChanges({ wcaId, isZh, results }: { wcaId: string; isZh: boolean; results: WcaResultRow[] | null }) {
  // Keep translated labels live even when unrelated parent updates are skipped.
  useLang();
  const [changes, setChanges] = useState<ResultChange[] | null>(null);

  useEffect(() => {
    if (!wcaId) return;
    let done = false;
    const ac = new AbortController();
    fetchResultChanges(wcaId, 100, ac.signal)
      .then((c) => { if (!done) setChanges(c.filter(isApprovedChange)); })
      .catch(() => { /* 端点未上线 / 无数据:视同无变更,整块隐藏 */ });
    return () => { done = true; ac.abort(); };
  }, [wcaId]);

  const visibleChanges = useMemo(() => (changes ?? []).filter(change =>
    !isReplacedResultRemoval(change, results ?? [])), [changes, results]);
  const summary = useMemo(() => summarizeResultChanges(visibleChanges), [visibleChanges]);
  if (!changes || !results || changes.length === 0) return null;
  // Group only adjacent entries, retaining the API's change-history order.
  const groups: { key: string; rows: VisibleChange[] }[] = [];
  for (const change of visibleChanges) {
    const fields = displayFields(change);
    if (fields.length === 0) continue;
    const row = { change, fields };
    const key = change.competitionId || change.compName || `change-${change.id}`;
    const previous = groups.at(-1);
    if (previous?.key === key) previous.rows.push(row);
    else groups.push({ key, rows: [row] });
  }
  if (groups.length === 0) return null;
  const chartRows = [
    ...(summary.penalties.length ? summary.penalties : [[2, 0]]).map(([seconds, count]) => ({
      key: `penalty-${seconds}`, label: tr({ zh: `+${seconds} 秒`, en: `+${seconds}s` }), count,
    })),
    { key: 'dnf', label: 'DNF', count: summary.dnf },
    { key: 'cancelled', label: tr({ zh: '取消', en: 'Cancelled' }), count: summary.cancelled },
  ];
  const chartMax = Math.max(1, ...chartRows.map(row => row.count));

  return (
    <section className="wp-card wp-rc-card">
      <div className="wp-rc-head">
        <h2 className="wp-rc-title">{tr({ zh: '成绩变更', en: 'Result changes'
        })}</h2>
      </div>
      <dl className="wp-rc-chart" aria-label={tr({ zh: '以下成绩变更，按把统计', en: 'Result changes below, counted per attempt' })}>
        {chartRows.map(row => <div className="wp-rc-chart-row" key={row.key}>
          <dt>{row.label}</dt>
          <dd>
            <span className="wp-rc-chart-track" aria-hidden="true">
              <span className="wp-rc-chart-bar" style={{ width: `${row.count / chartMax * 100}%` }} />
            </span>
            <span className="wp-rc-chart-count">{tr({ zh: `${row.count} 把`, en: `${row.count}` })}</span>
          </dd>
        </div>)}
      </dl>
      <div className="wp-rc-groups">
        {groups.map(({ rows }) => <CompetitionChanges key={rows[0].change.id} changes={rows} isZh={isZh} />)}
      </div>
    </section>
  );
}

// The person page resolves profile, results, recons and controls independently.
// Those updates must not rebuild an unchanged result-change list.
export default memo(PersonResultChanges);

function CompetitionChanges({ changes, isZh }: { changes: VisibleChange[]; isZh: boolean }) {
  const c = changes[0].change;
  const eventOrder = [...new Set(changes.map(({ change }) => change.eventId))];
  const roundOrder = (id: string | null) => id ? ['R1', 'R2', 'R3', 'Fi'].indexOf(roundLabel(id)) : 4;
  const ordered = [...changes].sort((a, b) =>
    eventOrder.indexOf(a.change.eventId) - eventOrder.indexOf(b.change.eventId)
    || roundOrder(a.change.roundTypeId) - roundOrder(b.change.roundTypeId));
  const name = <CompCell compId={c.competitionId ?? ''} compName={c.compName} isZh={isZh} date={null} />;
  return <div className="wp-rc-group">
    {(c.competitionId || c.compName) && <h3 className="wp-rc-comp">
      {c.competitionId
        ? <Link {...compLinkProps(c.competitionId, undefined, isZh ? 'zh' : 'en')}>{name}</Link>
        : name}
    </h3>}
    <ul className="wp-rc-list">
      {ordered.map(({ change, fields }) => <ChangeRow key={change.id} c={change} fields={fields} isZh={isZh} />)}
    </ul>
  </div>;
}

// 摘要里展开的字段及其标签(可读顺序:成绩 → 名次 → 纪录标记)。
const SUMMARY_FIELDS = [
  { field: 'average', before: 'a', zh: '平均', en: 'Average' },
  { field: 'pos', before: 'p', zh: '名次', en: 'Place' },
  { field: 'regional_single_record', before: 'rs', zh: '单次纪录', en: 'Single record' },
  { field: 'regional_average_record', before: 'ra', zh: '平均纪录', en: 'Average record' },
] as const;

interface DisplayField extends ResultChangeField {
  key: string;
  label: string;
}
interface VisibleChange { change: ResultChange; fields: DisplayField[] }

// All result, attempt and penalty changes share one flat list; unchanged values never enter it.
function displayFields(c: ResultChange): DisplayField[] {
  // A removed round needs one summary, not a cancellation for every attempt.
  if (c.changeType === 'removed') {
    const average = c.before?.a;
    return [{
      key: 'result', field: average ? 'average' : 'result',
      label: average ? tr({ zh: '平均', en: 'Average' }) : tr({ zh: '成绩', en: 'Result' }),
      old: average || null, new: null,
    }];
  }
  const fields: DisplayField[] = [];
  for (const cfg of SUMMARY_FIELDS) {
    const f = c.fields?.find(f => f.field === cfg.field);
    if (f && (f.old || null) !== (f.new || null)) {
      fields.push({ ...f, key: cfg.field, label: tr({ zh: cfg.zh, en: cfg.en }) });
    }
  }
  for (const field of ['attempts', 'attempt_penalties', 'attempt_videos'] as const) {
    const f = c.fields?.find(f => f.field === field)
        ?? (field === 'attempts' && c.before && c.after ? { old: c.before.at, new: c.after.at } : undefined);
    if (!f) continue;
    const oldValues: unknown[] = Array.isArray(f.old) ? f.old : [];
    const newValues: unknown[] = Array.isArray(f.new) ? f.new : [];
    for (let i = 0; i < Math.max(oldValues.length, newValues.length); i++) {
      const oldValue = oldValues[i] ?? null;
      const newValue = newValues[i] ?? null;
      // Zero/missing means no result, penalty or video, rather than a change to show.
      if ((oldValue || null) === (newValue || null)) continue;
      const n = i + 1;
      const label = field === 'attempt_penalties'
        ? tr({ zh: `第 ${n} 把罚时`, en: `Attempt ${n} penalty` })
        : field === 'attempt_videos'
          ? tr({ zh: `第 ${n} 把视频`, en: `Attempt ${n} video` })
          : tr({ zh: `第 ${n} 把`, en: `Attempt ${n}` });
      fields.push({
        key: `${field}-${i}`, label,
        field: field === 'attempts' ? 'best' : field === 'attempt_penalties' ? 'attempt_penalty' : 'attempt_video',
        old: oldValue, new: newValue,
      });
    }
  }
  // Legacy manual entries may contain only a summary, with no attempt index to identify.
  const hasAttempts = c.fields?.some(f => f.field === 'attempts' && (Array.isArray(f.old) || Array.isArray(f.new)))
    || (c.before?.at?.length && c.after?.at?.length);
  const best = c.fields?.find(f => f.field === 'best');
  if (!hasAttempts && best && (best.old || null) !== (best.new || null)) {
    fields.push({ ...best, key: 'best', label: tr({ zh: '单次成绩', en: 'Single result' }) });
  }
  return fields;
}

function ChangeRow({ c, fields, isZh }: { c: ResultChange; fields: DisplayField[]; isZh: boolean }) {
  const removed = c.changeType === 'removed';
  const eventId = c.eventId || '333';
  const round = c.roundTypeId ? roundLabel(c.roundTypeId) : '';
  const average = fields.find(f => f.field === 'average');

  return (
    <li className={`wp-rc-row wp-rc-row-${c.changeType}`}>
      <div className="wp-rc-context">
        <EventIcon event={eventId} className="wp-rc-evt" />
        <span className="sr-only">{eventDisplayName(eventId, isZh)}</span>
        {round && <span className="wp-rc-round">{round}</span>}
        {average && <ChangePair label={average.label} field={average.field}
          oldValue={average.old} newValue={average.new} eventId={eventId} iso2={c.personIso2} removed={removed} />}
        <span className={`wp-rc-badge wp-rc-badge-${c.changeType}`}>
          {removed ? tr({ zh: '取消', en: 'Cancelled' }) : tr({ zh: '修正', en: 'Fixed' })}
        </span>
        {c.source === 'manual' && (
          <span className="wp-rc-source">{tr({ zh: '手动', en: 'manual' })}</span>
        )}
      </div>
      {[false, true].map(attempts => {
        const rowFields = fields.filter(f => f !== average && f.key.startsWith('attempt') === attempts);
        return rowFields.length > 0 && <div key={String(attempts)} className="wp-rc-vals">
          {rowFields.map(f => <ChangePair key={f.key} label={f.label} field={f.field}
            oldValue={f.old} newValue={f.new} eventId={eventId} iso2={c.personIso2} removed={removed} />)}
        </div>;
      })}
      {c.note && <span className="wp-rc-note">{c.note}</span>}
    </li>
  );
}

function ChangeValue({ field, value, eventId, iso2, cancelled = false }: { field: string; value: unknown; eventId: string; iso2?: string | null; cancelled?: boolean }) {
  if (field.startsWith('regional_') && typeof value === 'string' && value) return <RecordBadge record={cancelled ? `${value} cancelled` : value} iso2={iso2} />;
  return <>{value == null || value === '' ? '—' : formatChangeFieldValue(field, value, eventId)}</>;
}

function ChangePair({ label, field, oldValue, newValue, eventId, iso2, removed }: {
  label: string; field: string; oldValue: unknown; newValue: unknown; eventId: string; iso2?: string | null; removed: boolean;
}) {
  const recordRemoved = field.startsWith('regional_') && typeof oldValue === 'string' && oldValue !== '' && !newValue;
  return <div className="wp-rc-pair">
    <span className="wp-rc-flabel">{label}</span>
    <div className="wp-rc-comparison">
      <span className={field.startsWith('regional_') ? undefined : 'wp-rc-old'}><ChangeValue field={field} value={oldValue} eventId={eventId} iso2={iso2} /></span>
      <span className="wp-rc-arrow" aria-hidden="true">→</span>
      <span className="wp-rc-new">{removed && !recordRemoved
        ? tr({ zh: '已取消', en: 'Cancelled' })
        : <ChangeValue field={field} value={recordRemoved ? oldValue : newValue} eventId={eventId} iso2={iso2} cancelled={recordRemoved} />}</span>
    </div>
  </div>;
}
