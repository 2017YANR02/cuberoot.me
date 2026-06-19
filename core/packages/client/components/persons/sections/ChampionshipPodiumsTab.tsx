'use client';
// 锦标赛领奖台 tab:世界 / 各大洲 / 国家(及多国类型)锦标赛领奖台。
// 数据走后端预计算表(资格内重排名次,见 server person-championship-podiums)。
// 分区顺序:世界 → 各大洲 → 国家;区内按比赛日期倒序分组,组内按项目顺序。

import { Fragment, useEffect, useMemo, useState } from 'react';
import Link from '@/components/AppLink';
import { EventIcon } from '@/components/EventIcon/EventIcon';
import { RecordBadge } from '@/components/RecordBadge/RecordBadge';
import { CompCell } from '@/components/CompCell/CompCell';
import { compLinkProps } from '@/lib/comp-link';
import { formatWcaResult } from '@/lib/wca-format-result';
import { formatDateRangeIso } from '@/lib/wca-date';
import { eventDisplayName } from '@/lib/wca-events';
import { ALL_EVENT_IDS } from '@/lib/event-constants';
import { useT } from '@/hooks/useT';
import { fetchWcaPersonChampionshipPodiums, type ChampionshipPodiumRow, type WcaPersonProfile } from '@/lib/wca-person-api';
import { AttemptsInline } from './RecordsTab';

interface Props {
  profile: WcaPersonProfile;
  isZh: boolean;
}

const CONTINENT_NAME: Record<string, [string, string]> = {
  '_Africa': ['非洲', 'Africa'],
  '_Asia': ['亚洲', 'Asia'],
  '_Europe': ['欧洲', 'Europe'],
  '_North America': ['北美洲', 'North America'],
  '_Oceania': ['大洋洲', 'Oceania'],
  '_South America': ['南美洲', 'South America'],
};

function scopeRank(level: string): number {
  if (level === 'world') return 0;
  if (level.startsWith('_')) return 1;
  return 2;
}

export default function ChampionshipPodiumsTab({ profile, isZh }: Props) {
  const t = useT();
  const lang = (['en', 'zh'] as const)[Number(isZh)];
  const wcaId = profile.person.wca_id;
  const [rows, setRows] = useState<ChampionshipPodiumRow[] | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setRows(null);
    setErr(false);
    fetchWcaPersonChampionshipPodiums(wcaId)
      .then((r) => { if (!cancelled) setRows(r); })
      .catch(() => { if (!cancelled) setErr(true); });
    return () => { cancelled = true; };
  }, [wcaId]);

  // 区(level)→ 比赛(日期倒序)→ 该比赛各项目(项目顺序)。
  const sections = useMemo(() => {
    if (!rows) return [];
    const byLevel = new Map<string, ChampionshipPodiumRow[]>();
    for (const r of rows) {
      const a = byLevel.get(r.level) ?? [];
      a.push(r);
      byLevel.set(r.level, a);
    }
    const out = [...byLevel.entries()].map(([level, lvlRows]) => {
      const byComp = new Map<string, ChampionshipPodiumRow[]>();
      for (const r of lvlRows) {
        const a = byComp.get(r.compId) ?? [];
        a.push(r);
        byComp.set(r.compId, a);
      }
      const comps = [...byComp.entries()].map(([compId, compRows]) => ({
        compId,
        compName: compRows[0]?.compName ?? compId,
        compDate: compRows[0]?.compDate ?? '',
        rows: compRows.slice().sort((a, b) => ALL_EVENT_IDS.indexOf(a.eventId) - ALL_EVENT_IDS.indexOf(b.eventId)),
      }));
      comps.sort((a, b) => b.compDate.localeCompare(a.compDate) || a.compId.localeCompare(b.compId));
      const latest = comps[0]?.compDate ?? '';
      return { level, comps, latest };
    });
    out.sort((a, b) => scopeRank(a.level) - scopeRank(b.level) || b.latest.localeCompare(a.latest));
    return out;
  }, [rows]);

  if (err) return <div className="wp-empty">{t('加载失败', 'Failed to load')}</div>;
  if (!rows) return <div className="wp-loading-inline">{t('加载中…', 'Loading…')}</div>;
  if (sections.length === 0) return <div className="wp-empty">{t('暂无锦标赛领奖台', 'No championship podiums')}</div>;

  const levelLabel = (level: string): string => {
    if (level === 'world') return t('世界', 'World');
    const cont = CONTINENT_NAME[level];
    if (cont) return t(cont[0], cont[1]);
    if (level === 'greater_china') return t('大中华区', 'Greater China');
    if (/^[A-Z]{2}$/.test(level)) {
      try { return new Intl.DisplayNames([lang], { type: 'region' }).of(level) ?? level; } catch { return level; }
    }
    return level;
  };

  // 合并成单表:列头只出现一次且 sticky 悬浮;各档标题(世界/洲际/国家)作表内分组行(同纪录表)。
  return (
    <div className="wp-records wp-records-scroll">
      <table className="wp-bycomp-table wp-podium-table">
        <thead>
          <tr>
            <th>{t('项目', 'Event')}</th>
            <th className="wp-th-narrow">{t('名次', 'Place')}</th>
            <th>{t('单次', 'Single')}</th>
            <th>{t('平均', 'Average')}</th>
            <th className="wp-th-attempts">{t('详细成绩', 'Solves')}</th>
          </tr>
        </thead>
        <tbody>
          {sections.map((sec) => {
            const label = levelLabel(sec.level);
            return (
              <Fragment key={sec.level}>
                <tr className="wp-records-group-row">
                  <th colSpan={5} scope="colgroup">{t(`${label}锦标赛领奖台`, `${label} Championship Podiums`)}</th>
                </tr>
                {sec.comps.map((comp) => (
                  <PodiumCompGroup key={comp.compId} comp={comp} isZh={isZh} />
                ))}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PodiumCompGroup({
  comp, isZh,
}: {
  comp: { compId: string; compName: string; compDate: string; rows: ChampionshipPodiumRow[] };
  isZh: boolean;
}) {
  return (
    <>
      <tr className="wp-podium-comp-row">
        <td colSpan={5}>
          <Link {...compLinkProps(comp.compId, { view: 'result' })} className="wp-bycomp-name">
            <CompCell compId={comp.compId} compName={comp.compName} isZh={isZh} />
          </Link>
          <span className="wp-cell-comp-date">{formatDateRangeIso(comp.compDate, comp.compDate)}</span>
        </td>
      </tr>
      {comp.rows.map((r) => (
        <tr key={`${r.eventId}-${r.level}`}>
          <th scope="row" className="wp-cell-event">
            <span className="wp-rec-event">
              <EventIcon event={r.eventId} className="wp-event-icon" title={eventDisplayName(r.eventId, isZh)} />
            </span>
          </th>
          <td className={`wp-cell-pos wp-podium-place-${r.place}`}>{r.place}</td>
          <td className="wp-cell-result">
            <span className="record-num-cell">
              {formatWcaResult(r.best, r.eventId, 'single')}
              {r.singleRecord && <RecordBadge record={r.singleRecord} variant="inline" />}
            </span>
          </td>
          <td className="wp-cell-result">
            {r.average > 0 && (
              <span className="record-num-cell">
                {formatWcaResult(r.average, r.eventId, 'average')}
                {r.averageRecord && <RecordBadge record={r.averageRecord} variant="inline" />}
              </span>
            )}
          </td>
          <td className="wp-cell-attempts">
            <AttemptsInline attempts={r.attempts} best={r.best} eventId={r.eventId} />
          </td>
        </tr>
      ))}
    </>
  );
}
