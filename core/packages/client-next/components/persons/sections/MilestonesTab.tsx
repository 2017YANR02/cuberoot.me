'use client';
// 里程碑 tab:时间轴展示选手成就(首次参赛、第 N 场、显著进步、首次领奖台、首次盲拧、破纪录、大满贯、回归).
// 过滤:不看里程碑(类型多选) + 进步阈值滑杆 + 升降序.
//
// Detection rules adapted from cubing.pro player_milestone.ts (GPL-3.0).
// Reimplemented from scratch in TypeScript for this project's data shape.

import { useMemo, useState } from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { buildMilestones, type MilestoneType } from '../logic/milestones';
import { localizeCompName } from '@/lib/comp-localize';
import { EVENT_ZH, EVENT_EN } from '@/lib/event-constants';
import { EventIcon } from '@/components/EventIcon/EventIcon';
import type { WcaPersonProfile, WcaResultRow, WcaCompetition } from '@/lib/wca-person-api';
import i18n from '@/i18n/i18n-client';

interface Props {
  profile: WcaPersonProfile;
  results: WcaResultRow[] | null;
  comps: WcaCompetition[] | null;
  isZh: boolean;
}

const TYPE_META: Record<MilestoneType, { zh: string; en: string; cls: string }> = {
  first_competition:        { zh: '首次参赛',     en: 'First competition',     cls: 'mt-first'
},
  nth_competition:          { zh: '里程数比赛',   en: 'Nth competition',       cls: 'mt-nth'
},
  significant_improvement:  { zh: '显著进步',     en: 'Improvement',           cls: 'mt-imp'
},
  first_podium:             { zh: '首次领奖台',   en: 'First podium',          cls: 'mt-pod'
},
  first_blind_success:      { zh: '盲拧首成',     en: 'Blind first success',   cls: 'mt-bf'
},
  record_breaker:           { zh: '破纪录',       en: 'Record breaker',        cls: 'mt-rec'
},
  grand_slam:               { zh: '大满贯',       en: 'Grand slam',            cls: 'mt-gs'
},
  comeback:                 { zh: '回归',         en: 'Comeback',              cls: 'mt-cb'
},
};

export default function MilestonesTab({ profile, results, comps, isZh }: Props) {
  const t = (zh: string, en: string) => (isZh ? zh : en);
  const [excluded, setExcluded] = useState<Set<MilestoneType>>(new Set());
  const [threshold, setThreshold] = useState(33);
  const [asc, setAsc] = useState(false);

  const compNameById = useMemo(() => {
    const m = new Map<string, string>();
    if (comps) for (const c of comps) m.set(c.id, c.name);
    return m;
  }, [comps]);

  const milestones = useMemo(() => {
    if (!results || !comps) return null;
    return buildMilestones(profile, results, comps, {
      improvementThreshold: threshold / 100,
      eventZh: EVENT_ZH,
      eventEn: EVENT_EN,
      compName: (id) => localizeCompName(id, compNameById.get(id) ?? id, isZh),
    });
  }, [profile, results, comps, threshold, isZh, compNameById]);

  if (!milestones) return <div className="wp-loading-inline">{t('加载中…', 'Loading…')}</div>;

  const presentTypes = new Set(milestones.map((m) => m.type));
  const filtered = milestones
    .filter((m) => !excluded.has(m.type))
    .sort((a, b) => (asc ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)));

  const toggleExclude = (ty: MilestoneType) => {
    const next = new Set(excluded);
    if (next.has(ty)) next.delete(ty); else next.add(ty);
    setExcluded(next);
  };

  return (
    <div className="wp-milestones">
      <div className="wp-ms-toolbar">
        <span className="wp-ms-count">
          {t(`选手里程碑 共 ${filtered.length} 条`, `${filtered.length} milestones`)}
        </span>
        <button className="wp-ms-order" onClick={() => setAsc((v) => !v)}>
          {asc ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
          <span>{asc ? t('正序', 'Ascending') : t('倒序', 'Descending')}</span>
        </button>
      </div>

      <div className="wp-ms-filters">
        <div className="wp-ms-filter-row">
          <span className="wp-ms-filter-label">{t('不看里程碑', 'Exclude')}:</span>
          {[...presentTypes].map((ty) => (
            <button
              key={ty}
              className={`wp-ms-chip ${TYPE_META[ty].cls} ${excluded.has(ty) ? 'is-off' : ''}`}
              onClick={() => toggleExclude(ty)}
            >{(i18n.language.startsWith('zh') ? TYPE_META[ty].zh : TYPE_META[ty].en)}</button>
          ))}
        </div>
        <div className="wp-ms-filter-row">
          <span className="wp-ms-filter-label">{t('进步阈值', 'Improvement ≥')}:</span>
          <input
            type="range" min={10} max={100}
            value={threshold}
            onChange={(e) => setThreshold(parseInt(e.target.value, 10))}
            className="wp-ms-slider"
          />
          <input
            type="number" min={10} max={100}
            value={threshold}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10);
              if (Number.isFinite(n)) setThreshold(Math.min(100, Math.max(10, n)));
            }}
            className="wp-ms-num"
          />
          <span className="wp-ms-pct">%</span>
        </div>
      </div>

      <ul className="wp-ms-list">
        {filtered.map((m, i) => (
          <li key={`${m.type}-${i}`} className={`wp-ms-item ${TYPE_META[m.type].cls}`}>
            <span className="wp-ms-date">{m.date}</span>
            <div className="wp-ms-body">
              <div className="wp-ms-text">{(i18n.language.startsWith('zh') ? m.zh : m.en)}</div>
              {m.tags.length > 0 && (
                <div className="wp-ms-tags">
                  {m.tags.map((tag, j) => (
                    <span key={j} className={`wp-ms-tag wp-ms-tag-${tag.kind}`}>
                      {tag.kind === 'event' && tag.eventId && (
                        <EventIcon event={tag.eventId} className="wp-event-icon-xs" />
                      )}
                      {tag.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
