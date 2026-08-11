'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { isAdminWcaId } from '@cuberoot/shared/admin';
import type { WcaPersonLite } from '@/lib/wca-api';
import PersonLink from '@/components/PersonLink';
import { WcaPersonPicker } from '@/components/WcaPersonPicker';
import { useAuthUser } from '@/lib/auth-store';
import { getMyMembership } from '@/lib/membership-api';
import {
  listWcaTeachers,
  removeWcaTeacher,
  setWcaTeacher,
  type WcaTeacher,
} from '@/lib/wca-teachers-api';
import { tr } from '@/i18n/tr';
import './wca-teacher-cell.css';

const LOOKUP_CHUNK_SIZE = 100;

function teacherErrorMessage(caught: unknown): string {
  const message = caught instanceof Error ? caught.message : '';
  const known: Record<string, { zh: string; en: string }> = {
    'active membership required': { zh: '只有有效会员可以登记自己', en: 'An active membership is required' },
    'teacher already set': { zh: '这位选手已有老师，不能直接覆盖', en: 'This cuber already has a teacher' },
    'a person cannot be their own teacher': { zh: '不能把选手本人设为老师', en: 'A cuber cannot be their own teacher' },
    'student not found': { zh: '未找到这位选手', en: 'Cuber not found' },
    'teacher not found': { zh: '未找到这位老师', en: 'Teacher not found' },
  };
  return tr(known[message] ?? { zh: '保存失败，请稍后重试', en: 'Save failed. Please try again.' });
}

export interface WcaTeacherDirectory {
  teachers: ReadonlyMap<string, WcaTeacher>;
  userWcaId: string;
  isAdmin: boolean;
  canSelfAssign: boolean;
  save: (studentWcaId: string, teacherWcaId?: string) => Promise<void>;
  remove: (studentWcaId: string) => Promise<void>;
}

export function useWcaTeachers(studentWcaIds: string[]): WcaTeacherDirectory {
  const user = useAuthUser();
  const isAdmin = isAdminWcaId(user?.wcaId);
  const [teachers, setTeachers] = useState<Map<string, WcaTeacher>>(() => new Map());
  const [activeMembership, setActiveMembership] = useState(false);
  const idsKey = useMemo(
    () => [...new Set(studentWcaIds.filter(Boolean))].sort().join(','),
    [studentWcaIds],
  );

  useEffect(() => {
    const ids = idsKey ? idsKey.split(',') : [];
    let cancelled = false;
    if (ids.length === 0) {
      setTeachers(new Map());
      return;
    }
    const requests: Promise<WcaTeacher[]>[] = [];
    for (let i = 0; i < ids.length; i += LOOKUP_CHUNK_SIZE) {
      requests.push(listWcaTeachers(ids.slice(i, i + LOOKUP_CHUNK_SIZE)));
    }
    Promise.all(requests)
      .then((groups) => {
        if (cancelled) return;
        setTeachers(new Map(groups.flat().map((teacher) => [teacher.studentWcaId, teacher])));
      })
      .catch(() => {
        if (!cancelled) setTeachers(new Map());
      });
    return () => { cancelled = true; };
  }, [idsKey]);

  useEffect(() => {
    let cancelled = false;
    if (!user?.wcaId || isAdmin) {
      setActiveMembership(false);
      return;
    }
    getMyMembership()
      .then(({ membership }) => { if (!cancelled) setActiveMembership(!!membership?.active); })
      .catch(() => { if (!cancelled) setActiveMembership(false); });
    return () => { cancelled = true; };
  }, [user?.wcaId, isAdmin]);

  const save = useCallback(async (studentWcaId: string, teacherWcaId?: string) => {
    const teacher = await setWcaTeacher(studentWcaId, teacherWcaId);
    setTeachers((current) => new Map(current).set(studentWcaId, teacher));
  }, []);

  const remove = useCallback(async (studentWcaId: string) => {
    await removeWcaTeacher(studentWcaId);
    setTeachers((current) => {
      const next = new Map(current);
      next.delete(studentWcaId);
      return next;
    });
  }, []);

  return {
    teachers,
    userWcaId: user?.wcaId ?? '',
    isAdmin,
    canSelfAssign: !!user?.wcaId && activeMembership,
    save,
    remove,
  };
}

export function WcaTeacherColumnHeader() {
  return (
    <th title={tr({
      zh: '老师本人可在有效会员期内登记；管理员可代填',
      en: 'Teachers can self-register with an active membership; admins can edit any entry',
    })}>
      {tr({ zh: '老师', en: 'Teacher' })}
    </th>
  );
}

export function WcaTeacherNote() {
  return (
    <p className="wca-teacher-note">
      {tr({
        zh: '老师信息由老师本人登记，有效会员可填写；管理员可代填。',
        en: 'Teacher information is self-reported by the teacher. Active members can add it; admins can edit it on their behalf.',
      })}
    </p>
  );
}

export function WcaTeacherCell({ studentWcaId, directory, isZh }: {
  studentWcaId: string;
  directory: WcaTeacherDirectory;
  isZh: boolean;
}) {
  const teacher = directory.teachers.get(studentWcaId);
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<WcaPersonLite | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const isOwnRelation = !!teacher && teacher.teacherWcaId === directory.userWcaId;

  useEffect(() => {
    if (!editing) return;
    setSelected(teacher ? { id: teacher.teacherWcaId, name: teacher.teacherName, country_iso2: '' } : null);
    setError('');
  }, [editing, teacher]);

  const run = async (operation: () => Promise<void>) => {
    setSaving(true);
    setError('');
    try {
      await operation();
      setEditing(false);
    } catch (caught) {
      setError(teacherErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  };

  const selfAssign = () => void run(() => directory.save(studentWcaId));
  const remove = () => void run(() => directory.remove(studentWcaId));
  const saveAdmin = () => {
    if (selected) void run(() => directory.save(studentWcaId, selected.id));
  };

  return (
    <div className="wca-teacher-cell">
      <span className="wca-teacher-value">
        {teacher
          ? <PersonLink wcaId={teacher.teacherWcaId} name={teacher.teacherName} isZh={isZh} />
          : <span className="wca-teacher-empty">—</span>}
      </span>
      {directory.isAdmin ? (
        <button type="button" className="wca-teacher-action" onClick={() => setEditing(true)}>
          {teacher ? tr({ zh: '编辑', en: 'Edit' }) : tr({ zh: '填写', en: 'Add' })}
        </button>
      ) : !teacher && directory.canSelfAssign ? (
        <button type="button" className="wca-teacher-action" disabled={saving} onClick={selfAssign}>
          {saving ? tr({ zh: '保存中…', en: 'Saving…' }) : tr({ zh: '登记自己', en: 'Add myself' })}
        </button>
      ) : isOwnRelation ? (
        <button type="button" className="wca-teacher-action" disabled={saving} onClick={remove}>
          {saving ? tr({ zh: '撤销中…', en: 'Removing…' }) : tr({ zh: '撤销', en: 'Remove' })}
        </button>
      ) : null}
      {error && !editing && <span className="wca-teacher-error" role="alert">{error}</span>}
      {editing && typeof document !== 'undefined' && createPortal(
        <div className="wca-teacher-dialog-layer">
          <dialog
            className="wca-teacher-dialog"
            open
            aria-modal="true"
            aria-labelledby={`teacher-title-${studentWcaId}`}
            onKeyDown={(event) => { if (event.key === 'Escape' && !saving) setEditing(false); }}
          >
            <h2 id={`teacher-title-${studentWcaId}`}>{tr({ zh: '填写老师', en: 'Set teacher' })}</h2>
            <WcaPersonPicker
              value={selected}
              onChange={setSelected}
              isZh={isZh}
              placeholder={tr({ zh: '搜索老师姓名或 WCA ID', en: 'Search teacher name or WCA ID' })}
            />
            {error && <p className="wca-teacher-dialog-error" role="alert">{error}</p>}
            <div className="wca-teacher-dialog-actions">
              <button type="button" className="wca-teacher-dialog-primary" disabled={!selected || saving} onClick={saveAdmin}>
                {saving ? tr({ zh: '保存中…', en: 'Saving…' }) : tr({ zh: '保存', en: 'Save' })}
              </button>
              {teacher && (
                <button type="button" className="wca-teacher-dialog-remove" disabled={saving} onClick={remove}>
                  {tr({ zh: '移除', en: 'Remove' })}
                </button>
              )}
              <button type="button" className="wca-teacher-dialog-cancel" disabled={saving} onClick={() => setEditing(false)}>
                {tr({ zh: '取消', en: 'Cancel' })}
              </button>
            </div>
          </dialog>
        </div>,
        document.body,
      )}
    </div>
  );
}
