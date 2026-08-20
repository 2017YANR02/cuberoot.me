'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { ArrowRight, Clock3, Mic2, Plus } from 'lucide-react';
import { parseAsString, useQueryState } from 'nuqs';
import AppLink from '@/components/AppLink';
import BackHome from '@/components/BackHome';
import SearchInput from '@/components/SearchInput';
import { useAuthUser } from '@/lib/auth-store';
import { tr } from '@/i18n/tr';
import { fetchTeacherLiveScripts, type TeacherLiveScript } from '@/lib/teacher-live-scripts-api';

const local = (zh: string, en: string) => tr({ zh, en });

function ScriptLibrary() {
  const user = useAuthUser();
  const [query, setQuery] = useQueryState('q', parseAsString.withDefault(''));
  const [scripts, setScripts] = useState<TeacherLiveScript[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    fetchTeacherLiveScripts().then((items) => { if (active) setScripts(items); }).catch(() => { if (active) setError(tr({ zh: '话术库暂时无法加载。', en: 'The script library could not be loaded.' })); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return scripts.filter((script) => !needle || [script.titleZh, script.titleEn, script.summaryZh, script.summaryEn, script.teacher.nameZh, script.teacher.nameEn].join('\n').toLocaleLowerCase().includes(needle));
  }, [query, scripts]);
  return <main className="scripts-page">
    <div className="scripts-back-row"><BackHome /></div>
    <header className="scripts-hero"><p className="scripts-kicker">{tr({ zh: '教师与机构', en: 'Teachers & schools' })}</p><h1>{tr({ zh: '直播话术库', en: 'Livestream Scripts' })}</h1><p>{tr({ zh: '把一场直播拆成清楚的章节、可直接说的正文和现场提示。老师与机构可以发布自己的版本，开播时直接当提词稿使用。', en: 'Turn a livestream into clear sections, spoken copy, and presenter cues. Teachers and schools can publish their own versions and use them live as teleprompter notes.' })}</p><div className="scripts-actions">{user && <AppLink href="/teachers/scripts/edit" prefetch={false} className="scripts-action"><Plus size={16} />{tr({ zh: '新建话术', en: 'New script' })}</AppLink>}<AppLink href="/teachers/scripts/manage" prefetch={false} className="script-text-action"><Mic2 size={16} />{tr({ zh: user ? '管理我的话术' : '登录后创建', en: user ? 'Manage my scripts' : 'Sign in to create' })}</AppLink><AppLink href="/teachers" className="script-text-action">{tr({ zh: '查看老师与机构', en: 'Browse teachers & schools' })}</AppLink></div></header>
    <div className="scripts-toolbar"><SearchInput value={query} onChange={(value) => { void setQuery(value || null); }} className="directory-search" inputClassName="directory-search-input" placeholder={tr({ zh: '搜索标题、内容简介或作者', en: 'Search titles, summaries, or authors' })} /></div>
    <section className="scripts-list" aria-label={tr({ zh: '公开直播话术', en: 'Public livestream scripts' })}>
      {loading && <p className="scripts-empty">{tr({ zh: '正在加载话术…', en: 'Loading scripts…' })}</p>}
      {!loading && error && <p className="scripts-empty">{error}</p>}
      {!loading && !error && filtered.length === 0 && <p className="scripts-empty">{tr({ zh: '暂时没有符合条件的公开话术。', en: 'There are no matching public scripts yet.' })}</p>}
      {filtered.map((script) => <AppLink key={script.id} href={`/teachers/scripts/${script.id}`} prefetch={false} className="script-list-row"><div><h2>{local(script.titleZh, script.titleEn)}</h2>{local(script.summaryZh, script.summaryEn) && <p className="script-list-summary">{local(script.summaryZh, script.summaryEn)}</p>}<p className="script-list-meta"><span>{local(script.teacher.nameZh, script.teacher.nameEn)}</span><span><Clock3 size={14} />{tr({ zh: `${script.durationMinutes} 分钟`, en: `${script.durationMinutes} min` })}</span><span>{tr({ zh: `${script.content.sections.length} 个章节`, en: `${script.content.sections.length} sections` })}</span></p></div><ArrowRight className="script-list-arrow" size={20} /></AppLink>)}
    </section>
  </main>;
}

export default function Page() { return <Suspense><ScriptLibrary /></Suspense>; }
