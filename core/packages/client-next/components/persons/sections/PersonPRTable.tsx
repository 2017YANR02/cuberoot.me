'use client';
// 选手 PR 表:每个项目 single / average × (世界排名/洲际/地区) + 领奖台计数.
// 切换 当前 / 历史最佳排名 (历史从 server 拉 historical_ranks_snapshot 衍生数据).
// 复选框:显示排名 / 显示领奖台.

import { useEffect, useMemo, useState } from 'react';
import Link from '@/components/AppLink';
import { ArrowUpRight } from 'lucide-react';
import { ALL_EVENT_IDS } from '@/lib/event-constants';
import { EventIcon } from '@/components/EventIcon/EventIcon';
import { formatWcaResult } from '@/lib/wca-format-result';
import { fetchPersonBestRanks, fetchPersonSor, type WcaPersonProfile, type WcaResultRow, type PersonBestRanksResponse, type PersonSorResponse, type SorMetricCell, type SorMetricBest } from '@/lib/wca-person-api';
import { countryName } from '@/lib/country-name';
import { countPodiumByEvent } from '../logic/podium';

// WCA 大洲 id(continentId,带前缀 _)→ 本地化短名,供 SoCR 的 scope 标签用.
const CONTINENT_NAME: Record<string, { zh: string; en: string; zhHant: string }> = {
  '_Africa': { zh: '非洲', en: 'Africa', zhHant: '非洲' },
  '_Asia': { zh: '亚洲', en: 'Asia', zhHant: '亞洲' },
  '_Europe': { zh: '欧洲', en: 'Europe', zhHant: '歐洲' },
  '_North America': { zh: '北美', en: 'N. America', zhHant: '北美' },
  '_Oceania': { zh: '大洋洲', en: 'Oceania', zhHant: '大洋洲' },
  '_South America': { zh: '南美', en: 'S. America', zhHant: '南美' },
};
import i18n from "@/i18n/i18n-client";

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
  const t = (zh: string, en: string, zhHant?: string) => i18n.language === 'zh-Hant' ? (zhHant ?? zh) : (isZh ? zh : en);
  const [mode, setMode] = useState<Mode>('current');
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
  const showPodium = mode === 'current'; // 历史最佳排名 模式不显示领奖台

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
        <div className="wp-empty">{t('暂无成绩', 'No results yet', "暫無成績")}</div>
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
          >{t('当前', 'Current', "當前")}</button>
          <button
            className={`wp-toggle-btn ${mode === 'historical' ? 'is-active' : ''}`}
            onClick={() => setMode('historical')}
          >{t('历史最佳排名', 'Historical Best', "歷史最佳排名")}</button>
        </div>
      </div>

      {mode === 'historical' && histLoading && (
        <div className="wp-loading-inline">{t('加载历史排名…', 'Loading historical ranks…', "載入歷史排名…")}</div>
      )}
      {mode === 'historical' && histError && (
        <div className="wp-error-inline">{t('历史排名加载失败', 'Failed to load historical ranks', "歷史排名載入失敗")}: {histError}</div>
      )}

      <div className="wp-table-scroll">
        <table className="wp-pr-table">
          <thead>
            <tr>
              <th rowSpan={2} className="wp-th-event">{t('项目', 'Event', "項目")}</th>
              <th colSpan={4} className="wp-th-group">{t('单次', 'Single', "單次")}</th>
              <th colSpan={4} className="wp-th-group">{t('平均', 'Average')}</th>
              {showPodium && <th colSpan={3} className="wp-th-group wp-th-podium">{t('领奖台', 'Podium', "領獎臺")}</th>}
            </tr>
            <tr>
              <th>{t('世界', 'World')}</th>
              <th>{t('洲际', 'Continent', "洲際")}</th>
              <th>{t('地区', 'Country', "地區")}</th>
              <th>{t('成绩', 'Result', "成績")}</th>
              <th>{t('成绩', 'Result', "成績")}</th>
              <th>{t('世界', 'World')}</th>
              <th>{t('洲际', 'Continent', "洲際")}</th>
              <th>{t('地区', 'Country', "地區")}</th>
              {showPodium && <th className="wp-th-medal" title={t('金牌', 'Gold')}>🥇</th>}
              {showPodium && <th className="wp-th-medal" title={t('银牌', 'Silver', "銀牌")}>🥈</th>}
              {showPodium && <th className="wp-th-medal" title={t('铜牌', 'Bronze', "銅牌")}>🥉</th>}
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
                  <td><RankCell r={sRank.world} /></td>
                  <td><RankCell r={sRank.continent} /></td>
                  <td><RankCell r={sRank.country} /></td>
                  <td className="wp-cell-result">{sValue === null ? '—' : formatWcaResult(sValue, eid, 'single')}</td>
                  <td className="wp-cell-result">{aValue === null ? '—' : formatWcaResult(aValue, eid, 'average')}</td>
                  <td><RankCell r={aRank.world} /></td>
                  <td><RankCell r={aRank.continent} /></td>
                  <td><RankCell r={aRank.country} /></td>
                  {showPodium && <td className="wp-cell-podium-n">{pod?.gold ? pod.gold : <span className="wp-podium-zero">—</span>}</td>}
                  {showPodium && <td className="wp-cell-podium-n">{pod?.silver ? pod.silver : <span className="wp-podium-zero">—</span>}</td>}
                  {showPodium && <td className="wp-cell-podium-n">{pod?.bronze ? pod.bronze : <span className="wp-podium-zero">—</span>}</td>}
                </tr>
              );
            })}
          </tbody>
          <PersonSorSummary wcaId={profile.person.wca_id} isZh={isZh} showPodium={showPodium} countryIso2={profile.person.country_iso2} />
        </table>
      </div>
    </section>
  );
}

// 全项目名次和(Sum of Ranks)摘要 — PR 表底部附加 tbody,三个独立指标各一行:
//   SoWR = Σ世界名次(按世界排) / SoCR = Σ洲际名次(按本洲排) / SoNR = Σ国家名次(按本国排).
//   每行 单次 / 平均 各显示「和值 + 该 scope 名次」+ 历史最佳小字.
//   SoCR 数据未填充(socr=null)时该行显示占位(— 本洲名 —),不误显.
// 数据 lazy fetch;整块无数据时不渲染,不破坏页面.
function PersonSorSummary({ wcaId, isZh, showPodium, countryIso2 }: { wcaId: string; isZh: boolean; showPodium: boolean; countryIso2: string }) {
  const t = (zh: string, en: string, zhHant?: string) => i18n.language === 'zh-Hant' ? (zhHant ?? zh) : (isZh ? zh : en);
  const [sor, setSor] = useState<PersonSorResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSor(null);
    fetchPersonSor(wcaId)
      .then((j) => { if (!cancelled) setSor(j); })
      .catch(() => { /* 端点未上线 / 选手无 SOR:静默隐藏 */ });
    return () => { cancelled = true; };
  }, [wcaId]);

  if (!sor || (!sor.single && !sor.average && !sor.bestSingle && !sor.bestAverage)) return null;

  const colCount = 1 + 4 + 4 + (showPodium ? 3 : 0);
  const cont = CONTINENT_NAME[sor.continentId];
  const continentLabel = cont ? t(cont.zh, cont.en, cont.zhHant) : t('本洲', 'Continent', '本洲');
  const countryLabel = countryIso2 ? countryName(countryIso2, isZh) : t('本国', 'Country', '本國');
  const yy = (year: number) => `'${String(year).padStart(4, '0').slice(2)}`;

  // 指标行标签后缀挂该 scope 的具体地名(洲/国),让「在哪排名」一目了然;名次本身落对齐列.
  const METRICS: { key: 'sowr' | 'socr' | 'sonr'; abbr: string; label: string }[] = [
    { key: 'sowr', abbr: 'SoWR', label: t('世界名次和', 'Sum of World Ranks', '世界名次和') },
    { key: 'socr', abbr: 'SoCR', label: t('洲际名次和', 'Sum of Continent Ranks', '洲際名次和') + (cont ? ` · ${continentLabel}` : '') },
    { key: 'sonr', abbr: 'SoNR', label: t('国家名次和', 'Sum of National Ranks', '國家名次和') + (countryIso2 ? ` · ${countryLabel}` : '') },
  ];
  const scopeCol = (key: 'sowr' | 'socr' | 'sonr') => key === 'sowr' ? 'world' : key === 'socr' ? 'continent' : 'country';

  // 名次格:只在该指标对应的 scope 列填名次(SoWR→世界 / SoCR→洲际 / SoNR→地区),与上方逐项名次同列对齐;其余列空.
  const rankTd = (col: 'world' | 'continent' | 'country', key: 'sowr' | 'socr' | 'sonr', cur: SorMetricCell | null | undefined, best: SorMetricBest | null | undefined) => {
    if (scopeCol(key) !== col) return <td className="wp-sor-blank" />;
    return (
      <td className="wp-sor-rcell">
        {cur ? <RankCell r={cur.rank} /> : <span className="wp-rank wp-rank-tier-mute">—</span>}
        {best && best.rank > 0 && <span className="wp-sor-best-rk">{t('历', 'best', '歷')} #{best.rank}{best.year ? ` ${yy(best.year)}` : ''}</span>}
      </td>
    );
  };
  // 和值格(落「成绩」列,与逐项成绩同列):Σ 值 + 历史最佳和值小字.
  const sumTd = (cur: SorMetricCell | null | undefined, best: SorMetricBest | null | undefined) => (
    <td className="wp-cell-result wp-sor-scell">
      {cur ? <span className="wp-sor-sum">{cur.total}</span> : <span className="wp-sor-smute">—</span>}
      {best && best.total != null && <span className="wp-sor-best-sum">{best.total}</span>}
    </td>
  );

  return (
    <tbody className="wp-sor-tbody">
      <tr className="wp-sor-section">
        <th colSpan={colCount}>
          <Link href="/wca/all-results?events=all" className="wp-sor-title" title={t('全项目名次和 (Sum of Ranks)', 'Sum of Ranks', '全項目名次和 (Sum of Ranks)')}>
            <span className="wp-sor-sigma">Σ</span>
            {t('全项目名次和', 'Sum of Ranks', '全項目名次和')}
            <ArrowUpRight size={13} />
          </Link>
          <span className="wp-sor-scope">{t('现役 17 项', '17 events', '現役 17 項')}</span>
        </th>
      </tr>
      {METRICS.map((m) => {
        const sCur = sor.single?.[m.key]; const aCur = sor.average?.[m.key];
        const sBest = sor.bestSingle?.[m.key]; const aBest = sor.bestAverage?.[m.key];
        return (
          <tr key={m.key} className="wp-sor-row">
            <th scope="row" className="wp-cell-event wp-sor-rowlabel">
              <span className="wp-sor-abbr">{m.abbr}</span>
              <span className="wp-sor-mlabel">{m.label}</span>
            </th>
            {rankTd('world', m.key, sCur, sBest)}
            {rankTd('continent', m.key, sCur, sBest)}
            {rankTd('country', m.key, sCur, sBest)}
            {sumTd(sCur, sBest)}
            {sumTd(aCur, aBest)}
            {rankTd('world', m.key, aCur, aBest)}
            {rankTd('continent', m.key, aCur, aBest)}
            {rankTd('country', m.key, aCur, aBest)}
            {showPodium && <><td className="wp-sor-blank" /><td className="wp-sor-blank" /><td className="wp-sor-blank" /></>}
          </tr>
        );
      })}
    </tbody>
  );
}

