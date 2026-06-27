'use client';
// 成绩 tab:按项目 / 按比赛 子切换 + 项目图标条(在按项目模式下).

import { useQueryStates, parseAsString } from 'nuqs';
import { Suspense, lazy, useCallback, useMemo, useState } from 'react';
import { ALL_EVENT_IDS } from '@/lib/event-constants';
import { EventIcon } from '@/components/EventIcon/EventIcon';
import PillToggle from '@/components/PillToggle/PillToggle';
import { AttemptRanksToggle } from './AttemptRanksToggle';
import { EditModeToggle } from './EditModeToggle';
import { useAuthStore } from '@/lib/auth-store';
import { isAdminWcaId } from '@cuberoot/shared/admin';
import type { WcaPersonProfile, WcaResultRow, WcaCompetition } from '@/lib/wca-person-api';
import { mergePersonLive } from '@/lib/person-live-merge';

const ByCompList = lazy(() => import('./ByCompList'));
const ByEventView = lazy(() => import('./ByEventView'));
const CompsTab = lazy(() => import('../CompsTab'));

interface Props {
  profile: WcaPersonProfile;
  results: WcaResultRow[] | null;
  comps: WcaCompetition[] | null;
  liveResults?: WcaResultRow[] | null;
  liveComps?: WcaCompetition[] | null;
  reconLookup: Map<string, number> | null;
  isZh: boolean;
}

type Sub = 'event' | 'comp';

export default function ResultsTab({ profile, results, comps, liveResults, liveComps, reconLookup, isZh }: Props) {
  const t = (zh: string, en: string) => (isZh ? zh : en);
  // 管理员「编辑模式」:开 → 点无复盘成绩进行内编辑;关(默认)→ 和访客一样点击跳 /recon/submit 复盘。
  // (开关 UI 在各视图「全部成绩」标题右侧;admin 判定在子视图内做)
  const [editMode, setEditMode] = useState(false);
  // 「详细成绩」逐把 PR 名次角标的显示开关(默认开;开关 UI 在各视图「全部成绩」标题右侧)。
  const [showAttemptRanks, setShowAttemptRanks] = useState(true);
  // 「按比赛」视图内的子 tab:成绩(逐场详细成绩,默认)/ 赛事(紧凑比赛列表,原赛事 tab 合并进来)。
  const [compView, setCompView] = useState<'results' | 'list'>('results');
  // 比赛视图的工具(# PR 名次 / 编辑模式)由本组件统一渲染,与上方 PillToggle 同一行;
  // ByCompList 自带的工具行不再渲染(不传 onToggle* 回调即隐藏)。
  const myWcaId = useAuthStore((s) => s.user?.wcaId);
  const admin = isAdminWcaId(myWcaId);
  const canEdit = !!myWcaId;
  // 子 tab(按项目 / 按比赛)+ 选中项目均为页内瞬时态 → replace,不堆历史
  const [q, setQ] = useQueryStates(
    { sub: parseAsString, event: parseAsString },
    { history: 'replace', scroll: false },
  );
  // 子视图(按项目 / 按比赛)由「成绩」主 tab 右侧的 PillToggle 写入 ?sub=(见 PersonTabs);
  // 这里只读取以决定渲染哪个视图。
  const rawSub = (q.sub ?? 'event').toLowerCase();
  const sub: Sub = rawSub === 'comp' ? 'comp' : 'event';

  // 官方 + 直播(非官方)合并,按比赛粒度去重(官方已收录的比赛丢弃直播行)。
  // 仅成绩 tab 用;PR 表 / Hero 等仍只见官方 results。
  const merged = useMemo(() => {
    if (!results || !comps) return { results, comps };
    if (!liveResults || liveResults.length === 0) return { results, comps };
    return mergePersonLive(results, comps, liveResults, liveComps ?? []);
  }, [results, comps, liveResults, liveComps]);
  const mResults = merged.results;
  const mComps = merged.comps;

  const eventIds = useMemo(() => {
    const set = new Set<string>();
    if (mResults) for (const r of mResults) set.add(r.event_id);
    return ALL_EVENT_IDS.filter((eid) => set.has(eid));
  }, [mResults]);

  const rawEv = (q.event ?? '').toLowerCase();
  const activeEvent = eventIds.includes(rawEv) ? rawEv : (eventIds[0] ?? '333');
  const setEvent = useCallback((eid: string) => setQ({ event: eid }), [setQ]);

  return (
    <div className="wp-results-tab">
      {sub === 'event' && eventIds.length > 0 && (
        <div className="wp-event-strip wp-event-strip-tabs">
          {eventIds.map((eid) => (
            <button
              key={eid}
              className={`wp-event-tab ${eid === activeEvent ? 'is-active' : ''}`}
              onClick={() => setEvent(eid)}
              title={eid}
            >
              <EventIcon event={eid} className="wp-event-icon-md" />
            </button>
          ))}
        </div>
      )}

      {sub === 'comp' && (
        <div className="wp-comp-subtoggle">
          <PillToggle
            value={compView === 'list'}
            onChange={(v) => setCompView(v ? 'list' : 'results')}
            offLabel={t('成绩', 'Results')}
            onLabel={t('赛事', 'Competitions')}
            ariaLabel={t('比赛视图:成绩或赛事列表', 'Competition view: results or competition list')}
          />
          {compView === 'results' && (
            <span className="wp-section-h-tools">
              <AttemptRanksToggle active={showAttemptRanks} onToggle={() => setShowAttemptRanks((v) => !v)} />
              {canEdit && <EditModeToggle active={editMode} onToggle={() => setEditMode((v) => !v)} propose={!admin} />}
            </span>
          )}
        </div>
      )}

      <Suspense fallback={<div className="wp-loading-inline">{t('加载中…', 'Loading…')}</div>}>
        {sub === 'event' && (
          <ByEventView
            profile={profile}
            results={mResults}
            comps={mComps}
            reconLookup={reconLookup}
            eventId={activeEvent}
            isZh={isZh}
            editMode={editMode}
            onToggleEditMode={() => setEditMode((v) => !v)}
            showAttemptRanks={showAttemptRanks}
            onToggleAttemptRanks={() => setShowAttemptRanks((v) => !v)}
          />
        )}
        {sub === 'comp' && compView === 'results' && (
          <ByCompList wcaId={profile.person.wca_id} personName={profile.person.name} personCountry={profile.person.country_iso2} results={mResults} comps={mComps} reconLookup={reconLookup} isZh={isZh} editMode={editMode} showAttemptRanks={showAttemptRanks} />
        )}
        {sub === 'comp' && compView === 'list' && (
          <CompsTab profile={profile} results={mResults} comps={mComps} isZh={isZh} />
        )}
      </Suspense>
    </div>
  );
}
