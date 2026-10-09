'use client';

import { useState } from 'react';
import AppLink from '@/components/AppLink';
import BoolToggle from '@/components/BoolToggle';
import { CompPicker } from '@/components/CompPicker';
import type { CalendarPrefs } from '@/lib/calendar-store';
import { tr, useLang } from '@/i18n/tr';
import type { CalendarCompetition } from '../_lib/competitions';

interface Props {
  wcaId: string;
  competitions: CalendarCompetition[];
  loading: boolean;
  incomplete: boolean;
  prefs: CalendarPrefs;
  onPrefs: (patch: Partial<CalendarPrefs>) => void;
  onRefresh: () => void;
  onPick: (competition: CalendarCompetition) => void;
}

export default function CompetitionCalendars(p: Props) {
  const isZh = useLang() === 'zh';
  const [search, setSearch] = useState('');
  const personal = p.competitions.filter((c) => c.source === 'attended' || c.source === 'registered' || c.source === 'followed')
    .sort((a, b) => Number(a.source === 'attended') - Number(b.source === 'attended')
      || (a.source === 'attended' ? b.start_date.localeCompare(a.start_date) : a.start_date.localeCompare(b.start_date)));
  return (
    <section className="cal-side-block cal-wca-calendars">
      <div className="cal-side-head"><span>{tr({ zh: 'WCA 比赛', en: 'WCA competitions' })}</span></div>
      {!p.wcaId ? <AppLink className="cal-link-btn" href="/account" prefetch={false}>{tr({ zh: '绑定 WCA，显示我的比赛', en: 'Link WCA to show my competitions' })}</AppLink> : <>
        <BoolToggle value={p.prefs.showWca} onChange={(showWca) => p.onPrefs({ showWca })} label={tr({ zh: '我参加和报名的比赛', en: 'My competitions' })} />
        <BoolToggle value={p.prefs.showFollowed} onChange={(showFollowed) => p.onPrefs({ showFollowed })} label={tr({ zh: '关注的未来比赛', en: 'Following' })} />
        <BoolToggle value={p.prefs.showUpcoming} onChange={(showUpcoming) => p.onPrefs({ showUpcoming })} label={tr({ zh: '全部未来比赛', en: 'All upcoming' })} />
        <CompPicker value={search} onChange={setSearch} isZh={isZh} restrictComps={personal} placeholder={tr({ zh: '查找我的比赛', en: 'Find my competition' })} onPick={(c) => { const found = personal.find((x) => x.id === c.id); if (found) p.onPick(found); setSearch(''); }} />
        {p.loading && <p className="cal-hint" role="status">{tr({ zh: '正在同步比赛…', en: 'Loading competitions…' })}</p>}
        {!p.loading && <p className="cal-hint">{tr({ zh: `${personal.filter((c) => c.source === 'attended').length} 场已参赛，${personal.filter((c) => c.source === 'registered').length} 场已报名`, en: `${personal.filter((c) => c.source === 'attended').length} attended, ${personal.filter((c) => c.source === 'registered').length} registered` })}</p>}
        {p.incomplete && <p className="cal-hint" role="status">{tr({ zh: '部分来源暂不可用，当前列表可能不完整。', en: 'Some sources are unavailable. This list may be incomplete.' })}</p>}
        <p className="cal-hint">{tr({ zh: '公开报名名单可能延迟更新，不含尚未公开的待审核报名。关注不代表报名。', en: 'Public registration lists may update with a delay and exclude unpublished pending registrations. Following is not registration.' })}</p>
        <button type="button" className="cal-link-btn" disabled={p.loading} onClick={p.onRefresh}>{tr({ zh: '刷新比赛', en: 'Refresh competitions' })}</button>
      </>}
      <AppLink className="cal-link-btn" href="/wca/comp" prefetch={false}>{tr({ zh: '查找与关注未来比赛', en: 'Find & follow competitions' })}</AppLink>
    </section>
  );
}
