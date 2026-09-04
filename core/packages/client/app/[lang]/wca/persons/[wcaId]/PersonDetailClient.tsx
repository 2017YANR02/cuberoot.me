'use client';
// /wca/persons/[wcaId] — WCA person detail page (client shell).
// Hero + PR table + 5 tabs (results / comps / events / milestones / cities).
// Ported from packages/client-vite/src/pages/wca_stats/persons/PersonDetailPage.tsx.
//
// The wcaId space is unbounded so this route ships as ONE prerendered static
// shell (see page.tsx) reused for every id via a next.config rewrite. The real
// id therefore can't come from useParams (the rendered route is the sentinel);
// read it from the browser URL client-side instead.

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { parseAsStringEnum, useQueryState } from 'nuqs';
import {
  fetchWcaPerson, fetchWcaPersonResults, fetchWcaPersonCompetitions, fetchWcaPersonLiveResults,
  fetchWcaPersonFormer, fetchWcaPersonAvatar,
  type WcaPersonProfile, type WcaResultRow, type WcaCompetition, type WcaFormerIdentity,
} from '@/lib/wca-person-api';
import { loadFlagData } from '@/lib/country-flags';
import { listRecons } from '@/lib/recon-api';
import { buildReconAttemptMap, type ReconAttemptInfo } from '@/lib/recon-attempt-lookup';
import { displayCuberName } from '@/lib/cuber-name-display';
import PersonHero from '@/components/persons/sections/PersonHero';
import PersonUpcomingComps from '@/components/persons/sections/PersonUpcomingComps';
import PersonPRTable from '@/components/persons/sections/PersonPRTable';
import PersonPbTable from '@/components/persons/sections/PersonPbTable';
import PersonStudents from '@/components/persons/sections/PersonStudents';
import PersonBestCombos from '@/components/persons/sections/PersonBestCombos';
import PersonResultChanges from '@/components/persons/sections/PersonResultChanges';
import PersonTabs from '@/components/persons/sections/PersonTabs';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import '@/components/persons/persons.css';
import '@/components/persons/persons-misc.css';
import '@/components/wca-results/attempts-grid.css';
import { useT } from "@/hooks/useT";

export default function PersonDetailClient() {
  const pathname = usePathname();
  const [wcaId, setWcaId] = useState('');
  useEffect(() => {
    // URL is /<lang>/wca/persons/<wcaId>; the rendered route is the sentinel
    // shell (one static page reused for every id), so derive the real id from
    // the browser path. usePathname() is the dep so this re-runs on soft
    // navigation between two person ids — the sentinel route never remounts, so
    // an empty dep array would keep showing the previous person.
    const m = window.location.pathname.match(/\/persons\/([^/?#]+)/);
    setWcaId(m ? decodeURIComponent(m[1]) : '');
  }, [pathname]);
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const t = useT();

  const [profile, setProfile] = useState<WcaPersonProfile | null>(null);
  const [results, setResults] = useState<WcaResultRow[] | null>(null);
  const [comps, setComps] = useState<WcaCompetition[] | null>(null);
  // 直播·非官方成绩(官方尚未收录的近期比赛)— 单独持有,只下发给成绩 tab
  const [liveResults, setLiveResults] = useState<WcaResultRow[] | null>(null);
  const [liveComps, setLiveComps] = useState<WcaCompetition[] | null>(null);
  const [reconLookup, setReconLookup] = useState<Map<string, ReconAttemptInfo> | null>(null);
  const [former, setFormer] = useState<WcaFormerIdentity[]>([]);
  const [error, setError] = useState<string | null>(null);
  // 「废止项」口径开关:Σ 名次和行(PR 表底部)与「最优项目组合」共用一份状态
  const [inclCancelled, setInclCancelled] = useState(false);
  const [pbVisibilityControl, setPbVisibilityControl] = useState<{
    value: boolean;
    disabled: boolean;
    onChange: (value: boolean) => void;
  } | null>(null);
  // PR / 历史最佳排名 / PB 是整张表的视图切换:进 URL 以支持返回 / 前进和直链;无参数默认 PR。
  const [resultView, setResultView] = useQueryState(
    'records',
    parseAsStringEnum<'pr' | 'historical' | 'pb'>(['pr', 'historical', 'pb'])
      .withDefault('pr')
      .withOptions({ history: 'push' }),
  );
  // 自家库 + 官网两条路都断了才会有 error;重试按钮 bump 它重跑整个加载 effect
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!wcaId) return; // wait until the id is resolved from the URL
    setProfile(null); setResults(null); setComps(null); setError(null);
    setLiveResults(null); setLiveComps(null); setFormer([]);
    let cancelled = false;
    // persons: false —— person_countries.json 是全站最大的一张表(gzip 1.3MB / 解开 5.3MB /
    // 29 万 key,实测跨洋 3.1s + 手机上几百 ms 主线程),而它只喂 personFlagIso2,本页整棵
    // 组件树(hero / PR 表 / 组合卡 / 7 个 tab)一处都不用 —— 魔友表的国旗走 person-misc 自带的
    // iso2,比赛国旗走 compFlagIso2。只拉 comp_countries + comp_names_zh(~170KB)。
    loadFlagData({ persons: false }).catch(() => { /* fallback to en */ });
    // 三个源现在都是「自家库先出、官网后台补」(见 wca-person-api 头注):
    // 首屏不再依赖 WCA 官网可达性,而 onFresh 回调保住成绩公示当天的自愈 ——
    // 直播·非官方行在官方收录后会被服务端删掉,只认库里那份会让那场比赛短暂整场消失。
    fetchWcaPerson(wcaId, (p) => { if (!cancelled) setProfile(p); })
      .then((p) => { if (!cancelled) setProfile(p); })
      .catch((e) => { if (!cancelled) setError(String(e?.message ?? e)); });
    fetchWcaPersonResults(wcaId, (r) => { if (!cancelled) setResults(r); })
      .then((r) => { if (!cancelled) setResults(r); })
      .catch(() => { /* keep degraded UI */ });
    fetchWcaPersonCompetitions(wcaId, (c) => { if (!cancelled) setComps(c); })
      .then((c) => { if (!cancelled) setComps(c); })
      .catch(() => { /* keep degraded UI */ });
    fetchWcaPersonLiveResults(wcaId)
      .then((j) => { if (!cancelled) { setLiveResults(j.results); setLiveComps(j.comps); } })
      .catch(() => { /* 直播补充缺失不影响官方成绩 */ });
    listRecons(wcaId)
      .then((all) => { if (!cancelled) setReconLookup(buildReconAttemptMap(all)); })
      .catch(() => { /* keep degraded UI */ });
    fetchWcaPersonFormer(wcaId)
      .then((f) => { if (!cancelled) setFormer(f); })
      .catch(() => { /* 曾用名缺失不影响主信息 */ });
    // 头像单独取:官方 dump 里没有头像,库拼出的 profile 也就没有。页面先用首字母占位渲染,
    // 这个请求(服务器侧缓存)回来再补;官网增强若先到,profile 自带头像,这里就不覆盖了。
    fetchWcaPersonAvatar(wcaId)
      .then(({ url, thumbUrl }) => {
        if (cancelled || (!url && !thumbUrl)) return;
        setProfile((prev) => (
          !prev || prev.person.avatar?.url || prev.person.avatar?.thumb_url
            ? prev
            : { ...prev, person: { ...prev.person, avatar: { url: url ?? undefined, thumb_url: thumbUrl ?? undefined } } }
        ));
      })
      .catch(() => { /* 没头像就用首字母占位 */ });
    return () => { cancelled = true; };
  }, [wcaId, reloadKey]);

  const personTitle = profile ? displayCuberName(profile.person.name, isZh) : '';
  useDocumentTitle(personTitle, personTitle);

  if (error) {
    return (
      <div className="wp-page">
        <main className="wp-main">
          <div className="wp-error">
          <p>{t('加载失败', 'Failed to load')}: {error}</p>
          <p className="wp-error-hint">{t(
            '本站的成绩库与 WCA 官网都没取到数据。',
            'Neither our own results database nor the WCA website returned any data.',
          )}</p>
          <button type="button" className="wp-error-retry" onClick={() => setReloadKey(k => k + 1)}>
            {t('重试', 'Retry')}
          </button>
        </div>
        </main>
      </div>
    );
  }
  if (!profile) {
    return (
      <div className="wp-page">
        <main className="wp-main">
          <div className="wp-loading">{t('加载中…', 'Loading…')}</div>
        </main>
      </div>
    );
  }

  return (
    <div className="wp-page">
      <main className="wp-main">
        <PersonHero
          profile={profile}
          results={results}
          comps={comps}
          former={former}
          isZh={isZh}
          resultView={resultView}
          onResultViewChange={(view) => { void setResultView(view); }}
          inclCancelled={inclCancelled}
          onInclCancelledChange={setInclCancelled}
          pbVisibilityControl={pbVisibilityControl}
        />
        {resultView === 'pb' ? (
          <PersonPbTable
            key={profile.person.wca_id}
            wcaId={profile.person.wca_id}
            isZh={isZh}
            onVisibilityControlChange={setPbVisibilityControl}
          />
        ) : (
          <>
            <PersonUpcomingComps wcaId={profile.person.wca_id} isZh={isZh} />
            <PersonStudents
              teacherWcaId={profile.person.wca_id}
              teacherCountryIso2={profile.person.country_iso2}
              isZh={isZh}
            />
            <PersonPRTable
              profile={profile}
              results={results}
              isZh={isZh}
              inclCancelled={inclCancelled}
              mode={resultView === 'historical' ? 'historical' : 'current'}
            />
            <PersonBestCombos wcaId={profile.person.wca_id} isZh={isZh} inclCancelled={inclCancelled} />
            <PersonResultChanges wcaId={profile.person.wca_id} isZh={isZh} />
            <PersonTabs profile={profile} results={results} comps={comps} liveResults={liveResults} liveComps={liveComps} reconLookup={reconLookup} isZh={isZh} />
          </>
        )}
      </main>
    </div>
  );
}
