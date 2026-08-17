'use client';

import { Suspense, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { parseAsInteger, useQueryState } from 'nuqs';
import AppLink from '@/components/AppLink';
import BackHome from '@/components/BackHome';
import { tr } from '@/i18n/tr';
import { nextQuery, useAuthUser, useIsAdmin, useOwnerKey } from '@/lib/auth-store';
import { fetchMyTeacherDirectory, fetchTeacherDirectory, type TeacherDirectoryEntry } from '@/lib/teacher-directory-api';
import TeacherDirectoryEditor from '../TeacherDirectoryEditor';

function PageBackRow() {
  return <div className="teacher-editor-back-row"><BackHome /></div>;
}

function TeacherDirectoryEditClient() {
  const pathname = usePathname();
  const user = useAuthUser();
  const ownerKey = useOwnerKey();
  const isAdmin = useIsAdmin();
  const [entryId, setEntryId] = useQueryState('id', parseAsInteger.withOptions({ history: 'replace' }));
  const [initial, setInitial] = useState<TeacherDirectoryEntry | null>(null);
  const [loading, setLoading] = useState(entryId !== null);
  const [notFound, setNotFound] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deleted, setDeleted] = useState(false);

  useEffect(() => {
    if (!ownerKey || entryId === null) {
      setLoading(false);
      setInitial(null);
      return;
    }
    let active = true;
    setLoading(true);
    setNotFound(false);
    Promise.all([fetchMyTeacherDirectory(), isAdmin ? fetchTeacherDirectory() : Promise.resolve([])])
      .then(([mine, publicEntries]) => {
        if (!active) return;
        const entry = [...mine, ...publicEntries].find((candidate) => candidate.id === entryId);
        const canEdit = entry && (isAdmin || entry.ownerKey === ownerKey);
        setInitial(canEdit ? entry : null);
        setNotFound(!canEdit);
      })
      .catch(() => { if (active) setNotFound(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [entryId, isAdmin, ownerKey]);

  if (!user) {
    return <main className="teacher-editor-page"><PageBackRow /><div className="directory-editor-state"><p className="directory-kicker">{tr({ zh: '创建教学资料', en: 'Create a teaching profile' })}</p><h1>{tr({ zh: '先登录，再完善你的资料', en: 'Sign in to build your profile' })}</h1><p>{tr({ zh: '资料将保存在你的账号下，可以随时修改照片、履历和联系方式。', en: 'Your photos, teaching history, and contact details stay editable from your account.' })}</p><AppLink href={`/account${nextQuery(pathname)}`} prefetch={false} className="directory-primary-button">{tr({ zh: '登录', en: 'Sign in' })}</AppLink></div></main>;
  }
  if (loading) return <main className="teacher-editor-page"><PageBackRow /><p className="directory-state">{tr({ zh: '正在加载资料…', en: 'Loading the profile…' })}</p></main>;
  if (notFound) return <main className="teacher-editor-page"><PageBackRow /><div className="directory-editor-state"><h1>{tr({ zh: '找不到可编辑的资料', en: 'This profile is not available to edit' })}</h1><AppLink href="/teachers" className="directory-primary-button">{tr({ zh: '查看名录', en: 'View directory' })}</AppLink></div></main>;
  if (deleted) return <main className="teacher-editor-page"><PageBackRow /><div className="directory-editor-state"><h1>{tr({ zh: '资料已删除', en: 'Profile deleted' })}</h1><AppLink href="/teachers" className="directory-primary-button">{tr({ zh: '查看名录', en: 'View directory' })}</AppLink></div></main>;

  return (
    <main className="teacher-editor-page">
      <PageBackRow />
      <header className="teacher-editor-hero">
        <p className="directory-kicker">{initial ? tr({ zh: '修改资料', en: 'Edit profile' }) : tr({ zh: '加入名录', en: 'Join the directory' })}</p>
        <h1>{initial ? tr({ zh: '完善你的教学履历', en: 'Refine your teaching profile' }) : tr({ zh: '建立你的教学主页', en: 'Build your teaching profile' })}</h1>
        <p>{tr({ zh: '这不是一张简单的联系卡。用照片、经历和教学方向，让学员先了解你，再决定是否联系。', en: 'This is more than a contact card. Use photos, experience, and specialties to help students understand you before reaching out.' })}</p>
        {saved && <p className="directory-save-success" role="status">{tr({ zh: '资料已保存。', en: 'Profile saved.' })} <AppLink href="/teachers">{tr({ zh: '查看名录', en: 'View directory' })}</AppLink></p>}
      </header>
      <TeacherDirectoryEditor
        key={initial?.id ?? 'new'}
        initial={initial}
        isAdmin={isAdmin}
        onSaved={(entry) => {
          setInitial(entry);
          setSaved(true);
          void setEntryId(entry.id);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onDeleted={() => setDeleted(true)}
      />
    </main>
  );
}

export default function TeacherDirectoryEditPage() {
  return <Suspense><TeacherDirectoryEditClient /></Suspense>;
}
