'use client';

import { Suspense, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { parseAsInteger, parseAsStringEnum, useQueryState } from 'nuqs';
import AppLink from '@/components/AppLink';
import PageBackLink from '@/components/PageBackLink';
import { tr } from '@/i18n/tr';
import { nextQuery, useAuthUser, useIsAdmin, useOwnerKey } from '@/lib/auth-store';
import { fetchMyTeacherDirectory, fetchAdminTeacherDirectoryEntry, type TeacherDirectoryEntry } from '@/lib/teacher-directory-api';
import TeacherDirectoryEditor from '@/components/teacher-directory/TeacherDirectoryEditor';
import { LoadingIndicator } from '@/components/LoadingIndicator';

function PageBackRow() {
  return <div className="teacher-editor-back-row"><PageBackLink fallback="/teachers" /></div>;
}

function TeacherDirectoryEditClient() {
  const pathname = usePathname();
  const user = useAuthUser();
  const ownerKey = useOwnerKey();
  const isAdmin = useIsAdmin();
  const [entryId, setEntryId] = useQueryState('id', parseAsInteger.withOptions({ history: 'replace' }));
  const [visibility] = useQueryState('visibility', parseAsStringEnum(['hidden', 'public']));
  const [kind] = useQueryState('kind', parseAsStringEnum(['teacher', 'organization']));
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
    Promise.all([fetchMyTeacherDirectory(), isAdmin ? fetchAdminTeacherDirectoryEntry(entryId).catch(() => null) : Promise.resolve(null)])
      .then(([mine, adminEntry]) => {
        if (!active) return;
        const entry = mine.find((candidate) => candidate.id === entryId) ?? adminEntry;
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
  if (loading) return <main className="teacher-editor-page"><PageBackRow /><p className="directory-state"><LoadingIndicator>{tr({ zh: '正在加载资料…', en: 'Loading the profile…' })}</LoadingIndicator></p></main>;
  if (entryId === null && kind !== 'organization') return <main className="teacher-editor-page"><PageBackRow /><section className="directory-editor-state"><h1>{tr({ zh: '讲师资料统一通过入驻管理', en: 'Teaching profiles are managed through admission' })}</h1><AppLink href="/platform/teachers/apply" className="directory-primary-button" prefetch={false}>{tr({ zh: '进入讲师入驻', en: 'Open instructor admission' })}</AppLink></section></main>;
  if (notFound) return <main className="teacher-editor-page"><PageBackRow /><div className="directory-editor-state"><h1>{tr({ zh: '找不到可编辑的资料', en: 'This profile is not available to edit' })}</h1><AppLink href="/teachers" className="directory-primary-button">{tr({ zh: '查看名录', en: 'View directory' })}</AppLink></div></main>;
  if (initial?.kind === 'teacher' && !isAdmin) return <main className="teacher-editor-page"><section className="directory-editor-state"><h1>{tr({ zh: '讲师资料在工作台管理', en: 'Manage teaching profiles in the instructor workspace' })}</h1><AppLink href={initial.instructorStatus === 'active' ? '/platform/instructor/profile' : '/platform/teachers/apply'} className="directory-primary-button" prefetch={false}>{initial.instructorStatus === 'active' ? tr({ zh: '管理讲师资料', en: 'Manage instructor profile' }) : tr({ zh: '查看入驻状态', en: 'View admission status' })}</AppLink></section></main>;
  if (deleted) return <main className="teacher-editor-page"><PageBackRow /><div className="directory-editor-state"><h1>{initial?.kind === 'teacher' ? tr({ zh: '讲师资料已隐藏', en: 'Teaching profile hidden' }) : tr({ zh: '资料已删除', en: 'Profile deleted' })}</h1><AppLink href="/teachers" className="directory-primary-button">{tr({ zh: '查看名录', en: 'View directory' })}</AppLink></div></main>;

  return (
    <main className="teacher-editor-page">
      <PageBackRow />
      <header className="teacher-editor-hero">

        <h1>{initial ? tr({ zh: '完善你的教学履历', en: 'Refine your teaching profile' }) : tr({ zh: '建立你的教学主页', en: 'Build your teaching profile' })}</h1>
        <p>{tr({ zh: '这不是一张简单的联系卡。用照片、经历和教学方向，让学员先了解你，再决定是否联系。', en: 'This is more than a contact card. Use photos, experience, and specialties to help students understand you before reaching out.' })}</p>
        {saved && <p className="directory-save-success" role="status">{tr({ zh: '资料已保存。', en: 'Profile saved.' })} <AppLink href={initial?.kind === 'teacher' ? '/platform/teachers/apply' : '/teachers'}>{initial?.kind === 'teacher' ? tr({ zh: '查看讲师状态', en: 'View instructor status' }) : tr({ zh: '查看名录', en: 'View directory' })}</AppLink></p>}
      </header>
      <TeacherDirectoryEditor
        key={initial?.id ?? 'new'}
        initial={initial}
        isAdmin={isAdmin}
        defaultVisible={visibility !== 'hidden'}
        defaultKind="organization"
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
