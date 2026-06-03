'use client';
// 选手 PR 表:每个项目 single / average × (世界排名/洲际/地区) + 领奖台计数.
// 切换 当前 / 历史最佳排名 (历史从 server 拉 historical_ranks_snapshot 衍生数据).
// 复选框:显示排名 / 显示领奖台.

import { useEffect, useMemo, useState } from 'react';
import { ALL_EVENT_IDS } from '@/lib/event-constants';
import { EventIcon } from '@/components/EventIcon/EventIcon';
import { formatWcaResult } from '@/lib/wca-format-result';
import { fetchPersonBestRanks, type WcaPersonProfile, type WcaResultRow, type PersonBestRanksResponse } from '@/lib/wca-person-api';
import { countPodiumByEvent } from '../logic/podium';

interface Props {
  profile: WcaPersonProfile;
  results: WcaResultRow[] | null;
  isZh: boolean;
}

type Mode = 'current' | 'historical';

function rankTier(r: number | null | undefined): string {
  if (!r || r <= 0) return 'wp-rank-tier-mute';
  if (r <= 3) return 'wp-rank-tier-1';
  if (r <= 10) return 'wp-rank-tier-2';
  if (r <= 100) return 'wp-rank-tier-3';
  return 'wp-rank-tier-4';
}

function RankCell({ r }: { r: number | null | undefined }) {
  if (r === null || r === undefined || r <= 0) return <span className="wp-rank wp-rank-tier-mute">—</span>;
  return <span className={`wp-rank ${rankTier(r)}`}>{r}</span>;
}

export default function PersonPRTable({ profile, results, isZh }: Props) {
  const t = (zh: string, en: string) => (isZh ? zh : en);
  const [mode, setMode] = useState<Mode>('current');
  const [showRanks, setShowRanks] = useState(true);
  const [showPodium, setShowPodium] = useState(true);
  const [hist, setHist] = useState<PersonBestRanksResponse | null>(null);
  const [histLoading, setHistLoading] = useState(false);
  const [histError, setHistError] = useState<string | null>(null);

  // lazy load 历史最佳排名 数据
  useEffect(() => {
    if (mode !== 'historical' || hist || histLoading) return;
    setHistLoading(true);
    fetchPersonBestRanks(profile.person.wca_id)
      .then((j) => { setHist(j); setHistError(null); })
      .catch((e) => setHistError(String(e?.message ?? e)))
      .finally(() => setHistLoading(false));
  }, [mode, hist, histLoading, profile.person.wca_id]);

  const podium = useMemo(() => results ? countPodiumByEvent(results) : new Map(), [results]);

  // 用哪些项目? 当前模式 = profile.personal_records 有 PR 的项目;历史 = 同集合并 ∪ hist.events.
  const eventIds = useMemo(() => {
    const set = new Set<string>();
    for (const eid of ALL_EVENT_IDS) {
      if (profile.personal_records[eid]) set.add(eid);
    }
    if (mode === 'historical' && hist) {
      for (const eid of Object.keys(hist.events)) set.add(eid);
    }
    return ALL_EVENT_IDS.filter((eid) => set.has(eid));
  }, [profile, hist, mode]);

  if (eventIds.length === 0) {
    return (
      <section className="wp-card">
        <div className="wp-empty">{t('暂无成绩', 'No results yet')}</div>
      </section>
    );
  }

  return (
    <section className="wp-card wp-pr-card">
      <div className="wp-pr-toolbar">
        <div className="wp-toggle-group">
          <button
            className={`wp-toggle-btn ${mode === 'current' ? 'is-active' : ''}`}
            onClick={() => setMode('current')}
          >{t('当前', 'Current')}</button>
          <button
            className={`wp-toggle-btn ${mode === 'historical' ? 'is-active' : ''}`}
            onClick={() => setMode('historical')}
          >{t('历史最佳排名', 'Historical Best')}</button>
        </div>
      </div>

      {mode === 'historical' && histLoading && (
        <div className="wp-loading-inline">{t('加载历史排名…', 'Loading historical ranks…')}</div>
      )}
      {mode === 'historical' && histError && (
        <div className="wp-error-inline">{t('历史排名加载失败', 'Failed to load historical ranks')}: {histError}</div>
      )}

      <div className="wp-table-scroll">
        <table className="wp-pr-table">
          <thead>
            <tr>
              <th rowSpan={2} className="wp-th-event">{t('项目', 'Event')}</th>
              <th colSpan={showRanks ? 4 : 1} className="wp-th-group">{t('单次', 'Single')}</th>
              <th colSpan={showRanks ? 4 : 1} className="wp-th-group">{t('平均', 'Average')}</th>
              {showPodium && <th colSpan={3} className="wp-th-group wp-th-podium">{t('领奖台', 'Podium')}</th>}
            </tr>
            <tr>
              {showRanks && <th>{t('世界', 'World')}</th>}
              {showRanks && <th>{t('洲际', 'Continent')}</th>}
              {showRanks && <th>{t('地区', 'Country')}</th>}
              <th>{t('成绩', 'Result')}</th>
              <th>{t('成绩', 'Result')}</th>
              {showRanks && <th>{t('世界', 'World')}</th>}
              {showRanks && <th>{t('洲际', 'Continent')}</th>}
              {showRanks && <th>{t('地区', 'Country')}</th>}
              {showPodium && <th className="wp-th-medal" title={t('金牌', 'Gold')}>🥇</th>}
              {showPodium && <th className="wp-th-medal" title={t('银牌', 'Silver')}>🥈</th>}
              {showPodium && <th className="wp-th-medal" title={t('铜牌', 'Bronze')}>🥉</th>}
            </tr>
          </thead>
          <tbody>
            {eventIds.map((eid) => {
              const cur = profile.personal_records[eid];
              const histEv = hist?.events[eid];
              const showHist = mode === 'historical';

              const sRank = showHist
                ? { world: histEv?.single?.world?.rank ?? null, continent: histEv?.single?.continent?.rank ?? null, country: histEv?.single?.country?.rank ?? null }
                : { world: cur?.single?.world_rank ?? null, continent: cur?.single?.continent_rank ?? null, country: cur?.single?.country_rank ?? null };
              const aRank = showHist
                ? { world: histEv?.average?.world?.rank ?? null, continent: histEv?.average?.continent?.rank ?? null, country: histEv?.average?.country?.rank ?? null }
                : { world: cur?.average?.world_rank ?? null, continent: cur?.average?.continent_rank ?? null, country: cur?.average?.country_rank ?? null };

              const sValue = showHist
                ? (histEv?.single?.world?.value ?? histEv?.single?.country?.value ?? null)
                : (cur?.single?.best ?? null);
              const aValue = showHist
                ? (histEv?.average?.world?.value ?? histEv?.average?.country?.value ?? null)
                : (cur?.average?.best ?? null);

              const pod = podium.get(eid);

              return (
                <tr key={eid}>
                  <th scope="row" className="wp-cell-event">
                    <span className="wp-event-inner">
                      <EventIcon event={eid} className="wp-event-icon" />
                    </span>
                  </th>
                  {showRanks && <td><RankCell r={sRank.world} /></td>}
                  {showRanks && <td><RankCell r={sRank.continent} /></td>}
                  {showRanks && <td><RankCell r={sRank.country} /></td>}
                  <td className="wp-cell-result">{sValue === null ? '—' : formatWcaResult(sValue, eid, 'single')}</td>
                  <td className="wp-cell-result">{aValue === null ? '—' : formatWcaResult(aValue, eid, 'average')}</td>
                  {showRanks && <td><RankCell r={aRank.world} /></td>}
                  {showRanks && <td><RankCell r={aRank.continent} /></td>}
                  {showRanks && <td><RankCell r={aRank.country} /></td>}
                  {showPodium && <td className="wp-cell-podium-n">{pod?.gold ? pod.gold : <span className="wp-podium-zero">—</span>}</td>}
                  {showPodium && <td className="wp-cell-podium-n">{pod?.silver ? pod.silver : <span className="wp-podium-zero">—</span>}</td>}
                  {showPodium && <td className="wp-cell-podium-n">{pod?.bronze ? pod.bronze : <span className="wp-podium-zero">—</span>}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="wp-pr-footer">
        <label className="wp-checkbox">
          <input type="checkbox" checked={showRanks} onChange={(e) => setShowRanks(e.target.checked)} />
          <span>{t('显示排名', 'Show ranks')}</span>
        </label>
        <label className="wp-checkbox">
          <input type="checkbox" checked={showPodium} onChange={(e) => setShowPodium(e.target.checked)} />
          <span>{t('显示领奖台', 'Show podium')}</span>
        </label>
      </div>
    </section>
  );
}

