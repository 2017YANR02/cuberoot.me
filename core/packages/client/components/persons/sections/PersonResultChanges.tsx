'use client';
// 选手页「成绩变更」面板 —— 该选手往期成绩被取消 / 修正 / 纪录标记变动时,在此保留旧成绩并标出新成绩。
// 数据源 /v1/wca/result-watch/changes?wcaId=(后台 monitors/wca_past_results.ts diff 写入)。
// 无变更则整块不渲染,避免页面拥挤(同 PersonBestCombos 的「无数据即隐藏」约定)。

import { useEffect, useState } from 'react';
import { EventIcon } from '@/components/EventIcon';
import { eventDisplayName } from '@/lib/wca-events';
import { CompCell } from '@/components/CompCell/CompCell';
import { RecordBadge } from '@/components/RecordBadge';
import Link from '@/components/AppLink';
import { compLinkProps } from '@/lib/comp-link';
import {
  fetchResultChanges, canonicalRound, formatChangeFieldValue, isApprovedChange,
  type ResultChange, type ResultChangeField,
} from '@/lib/result-watch-api';
import { tr } from '@/i18n/tr';

// 本面板=「已生效的成绩更正历史」,只收 approved。待审核(pending)提议另由成绩表行内
// 「待审核」标记展示,绝不在此当作官方更正呈现(否则任何登录用户都能伪造一条假更正)。
export default function PersonResultChanges({ wcaId, isZh }: { wcaId: string; isZh: boolean }) {
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

  if (!changes || changes.length === 0) return null;
  // Group only adjacent entries, retaining the API's change-history order.
  const groups: { key: string; rows: VisibleChange[] }[] = [];
  for (const change of changes) {
    const fields = displayFields(change);
    if (fields.length === 0) continue;
    const row = { change, fields };
    const key = change.competitionId || change.compName || `change-${change.id}`;
    const previous = groups.at(-1);
    if (previous?.key === key) previous.rows.push(row);
    else groups.push({ key, rows: [row] });
  }
  if (groups.length === 0) return null;

  return (
    <section className="wp-card wp-rc-card">
      <div className="wp-rc-head">
        <h2 className="wp-rc-title">{tr({ zh: '成绩变更', en: 'Result changes'
        })}</h2>
      </div>
      <div className="wp-rc-groups">
        {groups.map(({ rows }) => <CompetitionChanges key={rows[0].change.id} changes={rows} isZh={isZh} />)}
      </div>
    </section>
  );
}

function CompetitionChanges({ changes, isZh }: { changes: VisibleChange[]; isZh: boolean }) {
  const c = changes[0].change;
  const name = <CompCell compId={c.competitionId ?? ''} compName={c.compName} isZh={isZh} date={null} />;
  return <div className="wp-rc-group">
    {(c.competitionId || c.compName) && <h3 className="wp-rc-comp">
      {c.competitionId
        ? <Link {...compLinkProps(c.competitionId, undefined, isZh ? 'zh' : 'en')}>{name}</Link>
        : name}
    </h3>}
    <ul className="wp-rc-list">
      {changes.map(({ change, fields }) => <ChangeRow key={change.id} c={change} fields={fields} isZh={isZh} />)}
    </ul>
  </div>;
}

// 摘要里展开的字段及其标签(可读顺序:成绩 → 名次 → 纪录标记)。
const SUMMARY_FIELDS = [
  { field: 'best', before: 'b', zh: '最佳单次', en: 'Best single' },
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
  const fields: DisplayField[] = [];
  for (const cfg of SUMMARY_FIELDS) {
    const f = c.changeType === 'removed'
      ? { field: cfg.field, old: c.before?.[cfg.before], new: null }
      : c.fields?.find(f => f.field === cfg.field);
    if (f && (f.old || null) !== (f.new || null)) {
      fields.push({ ...f, key: cfg.field, label: tr({ zh: cfg.zh, en: cfg.en }) });
    }
  }
  if (c.changeType === 'removed') {
    return fields.length ? fields : [{ key: 'result', field: 'result', label: tr({ zh: '成绩', en: 'Result' }), old: null, new: null }];
  }
  for (const field of ['attempts', 'attempt_penalties', 'attempt_videos'] as const) {
    const f = c.fields?.find(f => f.field === field);
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
        ? tr({ zh: `第 ${n} 次罚时`, en: `Attempt ${n} penalty` })
        : field === 'attempt_videos'
          ? tr({ zh: `第 ${n} 次视频`, en: `Attempt ${n} video` })
          : tr({ zh: `第 ${n} 次`, en: `Attempt ${n}` });
      fields.push({
        key: `${field}-${i}`, label,
        field: field === 'attempts' ? 'best' : field === 'attempt_penalties' ? 'attempt_penalty' : 'attempt_video',
        old: oldValue, new: newValue,
      });
    }
  }
  return fields;
}

function roundLabel(roundTypeId: string | null): string {
  switch (canonicalRound(roundTypeId)) {
    case 'f': return tr({ zh: '决赛', en: 'Final'
    });
    case '1': return tr({ zh: '一轮', en: 'Round 1'
    });
    case '2': return tr({ zh: '二轮', en: 'Round 2'
    });
    case '3': return tr({ zh: '三轮', en: 'Round 3'
    });
    default: return roundTypeId || '';
  }
}

function ChangeRow({ c, fields, isZh }: { c: ResultChange; fields: DisplayField[]; isZh: boolean }) {
  const removed = c.changeType === 'removed';
  const eventId = c.eventId || '333';
  const round = roundLabel(c.roundTypeId);

  return (
    <li className={`wp-rc-row wp-rc-row-${c.changeType}`}>
      <div className="wp-rc-context">
        <EventIcon event={eventId} className="wp-rc-evt" />
        <span className="wp-rc-event">{eventDisplayName(eventId, isZh)}</span>
        {round && <span className="wp-rc-round">{round}</span>}
        <span className={`wp-rc-badge wp-rc-badge-${c.changeType}`}>
          {removed ? tr({ zh: '取消', en: 'Cancelled' }) : tr({ zh: '修正', en: 'Fixed' })}
        </span>
        {c.source === 'manual' && (
          <span className="wp-rc-source">{tr({ zh: '手动', en: 'manual' })}</span>
        )}
      </div>
      <div className="wp-rc-vals">
        {fields.map(f => <ChangePair key={f.key} label={f.label} field={f.field}
          oldValue={f.old} newValue={f.new} eventId={eventId} iso2={c.personIso2} removed={removed} />)}
      </div>
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
