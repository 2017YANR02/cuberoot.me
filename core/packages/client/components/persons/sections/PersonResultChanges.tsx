'use client';
// 选手页「成绩变更」面板 —— 该选手往期成绩被取消 / 修正 / 纪录标记变动时,在此保留旧成绩并标出新成绩。
// 数据源 /v1/wca/result-watch/changes?wcaId=(后台 monitors/wca_past_results.ts diff 写入)。
// 无变更则整块不渲染,避免页面拥挤(同 PersonBestCombos 的「无数据即隐藏」约定)。

import { memo, useEffect, useMemo, useState } from 'react';
import { parseAsString, useQueryStates } from 'nuqs';
import { resultRowHash, resolveResultRow } from '@/lib/wca-result-anchor';
import { replaceHash } from '@/lib/url_hash';
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
import type { WcaCompetition, WcaResultRow } from '@/lib/wca-person-api';
import { formatDateRangeIso } from '@/lib/wca-date';
import { SolveValue } from './results/SolveValue';
import { buildRowChangeListMap, effectiveAttempts, rowChangeKey } from '@/lib/result-watch-api';
import { summarizeResultChanges } from '@/lib/result-change-summary';

// 本面板=「已生效的成绩更正历史」,只收 approved。待审核(pending)提议另由成绩表行内
// 「待审核」标记展示,绝不在此当作官方更正呈现(否则任何登录用户都能伪造一条假更正)。
function PersonResultChanges({ wcaId, isZh, results, comps }: { wcaId: string; isZh: boolean; results: WcaResultRow[] | null; comps: WcaCompetition[] | null }) {
  // Keep translated labels live even when unrelated parent updates are skipped.
  useLang();
  const [changes, setChanges] = useState<ResultChange[] | null>(null);
  const compById = useMemo(() => new Map((comps ?? []).map(comp => [comp.id, comp])), [comps]);

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
  const currentAttempts = useMemo(() => {
    const map = new Map((results ?? []).map(row => [rowChangeKey(row.competition_id, row.event_id, row.round_type_id), row.attempts]));
    for (const [key, chain] of buildRowChangeListMap(visibleChanges)) {
      map.set(key, effectiveAttempts(chain, map.get(key) ?? []));
    }
    return map;
  }, [results, visibleChanges]);
  if (!changes || !results || changes.length === 0) return null;
  // Group only adjacent entries, retaining the API's change-history order.
  const groups: { key: string; rows: VisibleChange[] }[] = [];
  for (const change of visibleChanges) {
    const fields = displayFields(change, change.competitionId && change.eventId
      ? currentAttempts.get(rowChangeKey(change.competitionId, change.eventId, change.roundTypeId)) : undefined);
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
      key: `penalty-${seconds}`, label: `+${seconds}`, count,
    })),
    { key: 'dnf', label: 'DNF', count: summary.dnf },
    { key: 'cancelled', label: tr({ zh: '未晋级', en: 'Did not advance' }), count: summary.cancelled },
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
        {groups.map(({ rows }) => <CompetitionChanges key={rows[0].change.id} changes={rows} isZh={isZh} comp={compById.get(rows[0].change.competitionId ?? '')} />)}
      </div>
    </section>
  );
}

// The person page resolves profile, results, recons and controls independently.
// Those updates must not rebuild an unchanged result-change list.
export default memo(PersonResultChanges);

function CompetitionChanges({ changes, isZh, comp }: { changes: VisibleChange[]; isZh: boolean; comp?: WcaCompetition }) {
  const c = changes[0].change;
  const eventOrder = [...new Set(changes.map(({ change }) => change.eventId))];
  const roundOrder = (id: string | null) => id ? ['R1', 'R2', 'R3', 'Fi'].indexOf(roundLabel(id)) : 4;
  const ordered = [...changes].sort((a, b) =>
    eventOrder.indexOf(a.change.eventId) - eventOrder.indexOf(b.change.eventId)
    || roundOrder(a.change.roundTypeId) - roundOrder(b.change.roundTypeId));
  const startDate = comp?.start_date || c.compStartDate;
  const name = <CompCell compId={c.competitionId ?? ''} compName={c.compName} isZh={isZh} date={startDate} />;
  return <div className="wp-rc-group">
    {(c.competitionId || c.compName) && <h3 className="wp-rc-comp">
      {c.competitionId
        ? <Link {...compLinkProps(c.competitionId, undefined, isZh ? 'zh' : 'en')}>{name}</Link>
        : name}
      {startDate && <span className="wp-rc-comp-date">{formatDateRangeIso(startDate, comp?.end_date)}</span>}
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
  penalty?: number;
}
interface VisibleChange { change: ResultChange; fields: DisplayField[] }

// All result, attempt and penalty changes share one flat list; unchanged values never enter it.
function displayFields(c: ResultChange, currentAttempts?: number[]): DisplayField[] {
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
      const timed = !['333fm', '333mbf', '333mbo'].includes(c.eventId ?? '');
      const penalty = field === 'attempts' && timed && typeof oldValue === 'number' && oldValue > 0 && typeof newValue === 'number' && newValue > oldValue
        ? newValue - oldValue : field === 'attempt_penalties' && timed && typeof newValue === 'number' ? newValue : 0;
      const finalValue = field === 'attempts' ? newValue : currentAttempts?.[i];
      if (penalty > 0 && penalty % 200 === 0 && typeof finalValue === 'number' && finalValue > 0) {
        fields.push({ key: `${field}-${i}`, label: `#${n}`, field: 'best', old: oldValue, new: finalValue, penalty });
        continue;
      }
      const label = field === 'attempt_penalties'
        ? tr({ zh: `#${n} 罚时`, en: `#${n} penalty` })
        : field === 'attempt_videos'
          ? tr({ zh: `#${n} 视频`, en: `#${n} video` })
          : `#${n}`;
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
  const [, setResultView] = useQueryStates(
    { tab: parseAsString, sub: parseAsString, event: parseAsString },
    { history: 'replace', scroll: false },
  );
  const targetHash = c.competitionId && c.eventId && c.roundTypeId
    ? resultRowHash(c.competitionId, c.eventId, c.roundTypeId) : null;
  const removed = c.changeType === 'removed';
  const eventId = c.eventId || '333';
  const round = c.roundTypeId ? roundLabel(c.roundTypeId) : '';
  const averageRecord = fields.find(f => f.field === 'regional_average_record');
  const average = fields.find(f => f.field === 'average') ?? (averageRecord && c.before && c.after ? {
    field: 'average', label: tr({ zh: '平均', en: 'Average' }), old: c.before.a, new: c.after.a,
  } : undefined);
  const place = fields.find(f => f.field === 'pos');

  return (
    <li className={`wp-rc-row wp-rc-row-${c.changeType}`}>
      {targetHash && <Link
        className="wp-rc-result-link"
        href={`?tab=results&sub=event&event=${encodeURIComponent(eventId)}${targetHash}`}
        prefetch={false}
        aria-label={tr({ zh: `查看${c.compName ?? ''} ${eventDisplayName(eventId, isZh)} ${round}成绩`, en: `View ${c.compName ?? ''} ${eventDisplayName(eventId, isZh)} ${round} results` })}
        onClick={async e => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
          e.preventDefault();
          await setResultView({ tab: 'results', sub: 'event', event: eventId });
          replaceHash(targetHash);
          window.dispatchEvent(new HashChangeEvent('hashchange'));
          // Repeated clicks on the selected card should also return to its row.
          resolveResultRow(targetHash)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }}
      />}

      <div className="wp-rc-context">
        <EventIcon event={eventId} className="wp-rc-evt" />
        <span className="sr-only">{eventDisplayName(eventId, isZh)}</span>
        {round && <span className="wp-rc-round">{round}</span>}
        {average && <ChangePair label={average.label} field={average.field}
          oldValue={average.old} newValue={average.new} eventId={eventId} iso2={c.personIso2} removed={removed} recordChange={averageRecord} placeChange={place} />}
        {place && !average && <ChangePair label={place.label} field={place.field}
          oldValue={place.old} newValue={place.new} eventId={eventId} iso2={c.personIso2} removed={removed} />}
        {c.source === 'manual' && (
          <span className="wp-rc-source">{tr({ zh: '手动', en: 'manual' })}</span>
        )}
      </div>
      {[false, true].map(attempts => {
        const rowFields = fields.filter(f => f !== average && f !== place && !(average && f === averageRecord) && f.key.startsWith('attempt') === attempts);
        return rowFields.length > 0 && <div key={String(attempts)} className="wp-rc-vals">
          {rowFields.map(f => <ChangePair key={f.key} label={f.label} field={f.field}
            oldValue={f.old} newValue={f.new} eventId={eventId} iso2={c.personIso2} removed={removed} penalty={f.penalty} />)}
        </div>;
      })}
      {c.note && <span className="wp-rc-note">{c.note}</span>}
    </li>
  );
}

function ChangeValue({ field, value, eventId, iso2, cancelled = false }: { field: string; value: unknown; eventId: string; iso2?: string | null; cancelled?: boolean }) {
  if (field.startsWith('regional_') && typeof value === 'string' && value) return <RecordBadge record={cancelled ? `${value} cancelled` : value} iso2={iso2} />;
  if (field === 'pos') return <>{Number(value) > 0 ? String(value) : '—'}</>;
  return <>{value == null || value === '' ? '—' : formatChangeFieldValue(field, value, eventId)}</>;
}

function ChangePlace({ value }: { value: unknown }) {
  const place = Number(value);
  if (!Number.isInteger(place) || place <= 0) return null;
  return <span className="wp-rc-place" aria-label={tr({ zh: `第 ${place} 名`, en: `Place ${place}` })}>{place}</span>;
}

function ChangePair({ label, field, oldValue, newValue, eventId, iso2, removed, penalty, recordChange, placeChange }: {
  label: string; field: string; oldValue: unknown; newValue: unknown; eventId: string; iso2?: string | null; removed: boolean;
  penalty?: number;
  recordChange?: DisplayField;
  placeChange?: DisplayField;
}) {
  if (!removed && field === 'best' && newValue === -1 && typeof oldValue === 'number' && oldValue > 0) return <div className="wp-rc-pair">
    <span className="wp-rc-flabel">{label}</span>
    <span className="wp-rc-new">DNF({formatChangeFieldValue('best', oldValue, eventId)})</span>
  </div>;
  if (penalty && typeof newValue === 'number') return <div className="wp-rc-pair">
    <span className="wp-rc-flabel">{label}</span>
    <span className="wp-rc-new"><SolveValue value={newValue} penalty={penalty}
      format={value => formatChangeFieldValue('best', value, eventId)} /></span>
  </div>;
  const recordRemoved = field.startsWith('regional_') && typeof oldValue === 'string' && oldValue !== '' && !newValue;
  return <div className="wp-rc-pair">
    <span className="wp-rc-flabel">{label}</span>
    <div className="wp-rc-comparison">
      <span className={field.startsWith('regional_') ? undefined : 'wp-rc-old'}>
        {placeChange && <ChangePlace value={placeChange.old} />}
        <ChangeValue field={field} value={oldValue} eventId={eventId} iso2={iso2} />
        {recordChange && Boolean(recordChange.old) && <ChangeValue field={recordChange.field} value={recordChange.old} eventId={eventId} iso2={iso2} />}
      </span>
      <span className="wp-rc-arrow" aria-hidden="true">→</span>
      <span className="wp-rc-new">
        {placeChange && <ChangePlace value={placeChange.new} />}
        {removed && !recordRemoved
        ? tr({ zh: '未晋级', en: 'Did not advance' })
        : <ChangeValue field={field} value={recordRemoved ? oldValue : newValue} eventId={eventId} iso2={iso2} cancelled={recordRemoved} />}
        {recordChange && <ChangeValue field={recordChange.field} value={recordChange.new || recordChange.old} eventId={eventId} iso2={iso2} cancelled={!recordChange.new} />}
      </span>
    </div>
  </div>;
}
