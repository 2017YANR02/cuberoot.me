'use client';
// 选手页「成绩变更」面板 —— 该选手往期成绩被取消 / 修正 / 纪录标记变动时,在此保留旧成绩并标出新成绩。
// 数据源 /v1/wca/result-watch/changes?wcaId=(后台 monitors/wca_past_results.ts diff 写入)。
// 无变更则整块不渲染,避免页面拥挤(同 PersonBestCombos 的「无数据即隐藏」约定)。

import { useEffect, useState } from 'react';
import { EventIcon } from '@/components/EventIcon';
import { eventDisplayName } from '@/lib/wca-events';
import { localizeCompName } from '@/lib/comp-localize';
import {
  fetchResultChanges, canonicalRound, formatChangeFieldValue, isApprovedChange,
  type ResultChange,
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

  return (
    <section className="wp-card wp-rc-card">
      <div className="wp-rc-head">
        <h2 className="wp-rc-title">{tr({ zh: '成绩变更', en: 'Result changes'
        })}</h2>
      </div>
      <p className="wp-rc-sub">{tr({
        zh: '该选手的往期成绩曾被取消或修正;新成绩已在页面其余处更新,旧成绩在此保留。',
        en: 'Past results that were later cancelled or corrected; new marks are reflected elsewhere on the page, the old marks are kept here.'
    })}</p>
      <ul className="wp-rc-list">
        {changes.map((c) => <ChangeRow key={c.id} c={c} isZh={isZh} />)}
      </ul>
    </section>
  );
}

// 摘要里展开的字段及其标签(可读顺序:成绩 → 名次 → 纪录标记)。
const SUMMARY_FIELDS = [
  { field: 'best', zh: '单次', en: 'Single' },
  { field: 'average', zh: '平均', en: 'Average' },
  { field: 'pos', zh: '名次', en: 'Place' },
  { field: 'regional_single_record', zh: '单次纪录', en: 'Single record' },
  { field: 'regional_average_record', zh: '平均纪录', en: 'Average record' },
] as const;

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

function ChangeRow({ c, isZh }: { c: ResultChange; isZh: boolean }) {
  const removed = c.changeType === 'removed';
  const eventId = c.eventId || '333';
  const round = roundLabel(c.roundTypeId);
  const comp = c.compName ? localizeCompName(c.competitionId ?? '', c.compName, isZh) : (c.competitionId ?? '');
  // 标量字段(成绩 / 名次 / 纪录标记)展开成「标签 + 旧→新」。
  const scalar = SUMMARY_FIELDS
    .map((cfg) => ({ cfg, f: (c.fields ?? []).find((x) => x.field === cfg.field) }))
    .filter((x): x is { cfg: typeof SUMMARY_FIELDS[number]; f: NonNullable<typeof x.f> } => !!x.f);
  // 罚时标注(第N把 +M)+ 纯把数改判(罕见,成绩/罚时未覆盖时才单列)。
  const penF = (c.fields ?? []).find((x) => x.field === 'attempt_penalties');
  const attF = (c.fields ?? []).find((x) => x.field === 'attempts');
  const showAttempts = !!attF && scalar.length === 0 && !penF;
  const onlyMeta = !removed && scalar.length === 0 && !penF && !showAttempts;

  return (
    <li className={`wp-rc-row wp-rc-row-${c.changeType}`}>
      <span className={`wp-rc-badge wp-rc-badge-${c.changeType}`}>
        {removed ? tr({ zh: '取消', en: 'Cancelled' }) : tr({ zh: '修正', en: 'Fixed' })}
      </span>
      {c.source === 'manual' && (
        <span className="wp-rc-source">{tr({ zh: '手动', en: 'manual' })}</span>
      )}
      <EventIcon event={eventId} className="wp-rc-evt" />
      <span className="wp-rc-ctx">
        <span className="wp-rc-event">{eventDisplayName(eventId, isZh)}</span>
        {round && <span className="wp-rc-round">{round}</span>}
        {comp && <span className="wp-rc-comp">{comp}</span>}
      </span>
      <span className="wp-rc-vals">
        {removed && c.before ? (
          <>
            <span className="wp-rc-old">
              {formatChangeFieldValue('best', c.before.b, eventId)}
              {c.before.a > 0 ? ` / ${formatChangeFieldValue('average', c.before.a, eventId)}` : ''}
            </span>
            <span className="wp-rc-gone">{tr({ zh: '已移除', en: 'removed' })}</span>
          </>
        ) : onlyMeta ? (
          <span className="wp-rc-meta">{tr({ zh: '成绩明细修正', en: 'result details corrected'
        })}</span>
        ) : (
          <>
            {scalar.map(({ cfg, f }, i) => (
              <span key={`s${i}`} className="wp-rc-pair">
                <span className="wp-rc-flabel">{tr({ zh: cfg.zh, en: cfg.en })}</span>
                <span className="wp-rc-old">{formatChangeFieldValue(cfg.field, f.old, eventId)}</span>
                <span className="wp-rc-arrow">→</span>
                <span className="wp-rc-new">{formatChangeFieldValue(cfg.field, f.new, eventId)}</span>
              </span>
            ))}
            {penF && (
              <span className="wp-rc-pair">
                <span className="wp-rc-flabel">{tr({ zh: '罚时', en: 'Penalty' })}</span>
                <span className="wp-rc-new">{formatChangeFieldValue('attempt_penalties', penF.new, eventId)}</span>
              </span>
            )}
            {showAttempts && attF && (
              <span className="wp-rc-pair">
                <span className="wp-rc-flabel">{tr({ zh: '把数', en: 'Solves' })}</span>
                <span className="wp-rc-old">{formatChangeFieldValue('attempts', attF.old, eventId)}</span>
                <span className="wp-rc-arrow">→</span>
                <span className="wp-rc-new">{formatChangeFieldValue('attempts', attF.new, eventId)}</span>
              </span>
            )}
          </>
        )}
      </span>
      {c.note && <span className="wp-rc-note">{c.note}</span>}
    </li>
  );
}
