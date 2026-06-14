'use client';
// 选手页「成绩变更」面板 —— 该选手往期成绩被取消 / 修正 / 纪录标记变动时,在此保留旧成绩并标出新成绩。
// 数据源 /v1/wca/result-watch/changes?wcaId=(后台 monitors/wca_past_results.ts diff 写入)。
// 无变更则整块不渲染,避免页面拥挤(同 PersonBestCombos 的「无数据即隐藏」约定)。

import { useEffect, useState } from 'react';
import { EventIcon } from '@/components/EventIcon';
import { eventDisplayName } from '@/lib/wca-events';
import { localizeCompName } from '@/lib/comp-localize';
import {
  fetchResultChanges, canonicalRound, formatChangeFieldValue,
  type ResultChange,
} from '@/lib/result-watch-api';
import { tr } from '@/i18n/tr';

export default function PersonResultChanges({ wcaId, isZh }: { wcaId: string; isZh: boolean }) {
  const [changes, setChanges] = useState<ResultChange[] | null>(null);

  useEffect(() => {
    if (!wcaId) return;
    let done = false;
    const ac = new AbortController();
    fetchResultChanges(wcaId, 100, ac.signal)
      .then((c) => { if (!done) setChanges(c); })
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
  const valueFields = (c.fields ?? []).filter((f) => f.field === 'best' || f.field === 'average');
  const onlyMeta = !removed && valueFields.length === 0;

  return (
    <li className={`wp-rc-row wp-rc-row-${c.changeType}`}>
      <span className={`wp-rc-badge wp-rc-badge-${c.changeType}`}>
        {removed ? tr({ zh: '取消', en: 'Cancelled' }) : tr({ zh: '修正', en: 'Fixed' })}
      </span>
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
          <span className="wp-rc-meta">{tr({ zh: '名次 / 纪录标记变动', en: 'place / record marker changed'
        })}</span>
        ) : (
          valueFields.map((f, i) => (
            <span key={i} className="wp-rc-pair">
              <span className="wp-rc-flabel">
                {f.field === 'best' ? tr({ zh: '单次', en: 'Single'
                }) : tr({ zh: '平均', en: 'Average' })}
              </span>
              <span className="wp-rc-old">{formatChangeFieldValue(f.field, f.old, eventId)}</span>
              <span className="wp-rc-arrow">→</span>
              <span className="wp-rc-new">{formatChangeFieldValue(f.field, f.new, eventId)}</span>
            </span>
          ))
        )}
      </span>
    </li>
  );
}
