'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { EyeOff, Plus } from 'lucide-react';
import AppLink from '@/components/AppLink';
import BackHome from '@/components/BackHome';
import { nextQuery, useAuthUser } from '@/lib/auth-store';
import { tr } from '@/i18n/tr';
import { fetchMyTeacherDirectory, type TeacherDirectoryEntry } from '@/lib/teacher-directory-api';
import { deleteTeacherLiveScript, fetchMyTeacherLiveScripts, type TeacherLiveScript } from '@/lib/teacher-live-scripts-api';

const local = (zh: string, en: string) => tr({ zh, en });

export default function Page() {
  const pathname = usePathname();
  const user = useAuthUser();
  const [entries, setEntries] = useState<TeacherDirectoryEntry[]>([]);
  const [scripts, setScripts] = useState<TeacherLiveScript[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let active = true;
    Promise.all([fetchMyTeacherDirectory(), fetchMyTeacherLiveScripts()]).then(([profiles, items]) => { if (active) { setEntries(profiles); setScripts(items); } }).catch(() => { if (active) setError(tr({ zh: '你的话术暂时无法加载。', en: 'Your scripts could not be loaded.' })); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user]);
  const scriptsByEntry = useMemo(() => {
    const map = new Map<number, TeacherLiveScript[]>();
    for (const script of scripts) map.set(script.teacherEntryId, [...(map.get(script.teacherEntryId) ?? []), script]);
    return map;
  }, [scripts]);
  const remove = async (script: TeacherLiveScript) => {
    if (!window.confirm(tr({ zh: `确定删除《${local(script.titleZh, script.titleEn)}》吗？`, en: `Delete “${local(script.titleZh, script.titleEn)}”?` }))) return;
    try { await deleteTeacherLiveScript(script.id); setScripts((items) => items.filter((item) => item.id !== script.id)); }
    catch { setError(tr({ zh: '删除失败，请稍后重试。', en: 'Delete failed. Please try again.' })); }
  };
  return <main className="scripts-page">
    <div className="scripts-back-row"><BackHome /></div>
    <header className="scripts-hero"><p className="scripts-kicker">{tr({ zh: '作者后台', en: 'Creator workspace' })}</p><h1>{tr({ zh: '管理直播话术', en: 'Manage Scripts' })}</h1><p>{tr({ zh: '话术跟随老师或机构主页归档。资料隐藏时，其话术也不会出现在公开库，但仍可在这里继续编辑。', en: 'Scripts are grouped under a teacher or school profile. When a profile is hidden, its scripts stay out of the public library but remain editable here.' })}</p><div className="scripts-actions">{user && entries.length > 0 && <AppLink href="/teachers/scripts/edit" prefetch={false} className="scripts-action"><Plus size={16} />{tr({ zh: '新建话术', en: 'New script' })}</AppLink>}<AppLink href="/teachers/scripts" className="script-text-action">{tr({ zh: '查看公开话术库', en: 'View public library' })}</AppLink></div></header>
    {!user && <section className="scripts-empty"><p>{tr({ zh: '登录后才能创建和管理自己的直播话术。', en: 'Sign in to create and manage your livestream scripts.' })}</p><AppLink href={`/account${nextQuery(pathname)}`} className="script-text-action">{tr({ zh: '登录', en: 'Sign in' })}</AppLink></section>}
    {user && loading && <p className="scripts-empty">{tr({ zh: '正在加载…', en: 'Loading…' })}</p>}
    {user && error && <p className="scripts-empty">{error}</p>}
    {user && !loading && entries.length === 0 && <section className="scripts-empty"><p>{tr({ zh: '请先建立一个老师或机构主页，再为它创建话术。', en: 'Create a teacher or school profile before adding a script.' })}</p><AppLink href="/teachers/edit" prefetch={false} className="script-text-action">{tr({ zh: '建立教学主页', en: 'Build a profile' })}</AppLink></section>}
    {entries.map((entry) => <section className="manage-profile-group" key={entry.id}><header className="manage-profile-head"><h2>{local(entry.nameZh, entry.nameEn)}</h2><span>{entry.isVisible ? tr({ zh: '主页公开', en: 'Public profile' }) : <><EyeOff size={13} /> {tr({ zh: '主页仅自己可见', en: 'Private profile' })}</>}</span><AppLink href={`/teachers/scripts/edit?teacher=${entry.id}`} prefetch={false} className="script-text-action"><Plus size={14} />{tr({ zh: '为此主页新建', en: 'New for this profile' })}</AppLink></header>
      {(scriptsByEntry.get(entry.id) ?? []).length === 0 ? <p className="scripts-empty">{tr({ zh: '还没有话术。', en: 'No scripts yet.' })}</p> : (scriptsByEntry.get(entry.id) ?? []).map((script) => <div className="manage-script-row" key={script.id}><div><h3>{local(script.titleZh, script.titleEn)}</h3><p>{script.isVisible ? tr({ zh: '话术设为公开', en: 'Script is public' }) : tr({ zh: '话术仅自己可见', en: 'Script is private' })}　{tr({ zh: `${script.content.sections.length} 个章节`, en: `${script.content.sections.length} sections` })}</p></div><div className="manage-script-actions"><AppLink href={`/teachers/scripts/${script.id}`} prefetch={false} className="script-text-action">{tr({ zh: '预览', en: 'Preview' })}</AppLink><AppLink href={`/teachers/scripts/edit?id=${script.id}`} prefetch={false} className="script-text-action">{tr({ zh: '编辑', en: 'Edit' })}</AppLink><button type="button" onClick={() => { void remove(script); }}>{tr({ zh: '删除', en: 'Delete' })}</button></div></div>)}
    </section>)}
  </main>;
}
