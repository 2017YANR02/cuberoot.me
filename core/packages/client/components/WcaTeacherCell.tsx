'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { isAdminWcaId } from '@cuberoot/shared/admin';
import type { WcaPersonLite } from '@/lib/wca-api';
import { EventIcon } from '@/components/EventIcon';
import PersonLink from '@/components/PersonLink';
import WcaEventSelector from '@/components/WcaEventSelector';
import { WcaPersonPicker } from '@/components/WcaPersonPicker';
import { useAuthUser } from '@/lib/auth-store';
import { getMyMembership } from '@/lib/membership-api';
import {
  listWcaTeachers,
  removeWcaTeacher,
  setWcaTeacher,
  type WcaTeacher,
} from '@/lib/wca-teachers-api';
import { eventDisplayName } from '@/lib/wca-events';
import { tr } from '@/i18n/tr';
import './wca-teacher-cell.css';

const LOOKUP_CHUNK_SIZE = 100;

function teacherRelationKey(studentWcaId: string, eventId: string): string {
  return `${studentWcaId}:${eventId}`;
}

function teacherErrorMessage(caught: unknown): string {
  const message = caught instanceof Error ? caught.message : '';
  const known: Record<string, { zh: string; en: string }> = {
    'active membership required': { zh: '只有有效会员可以登记自己', en: 'An active membership is required' },
    'teacher already set': { zh: '这位选手在该项目已有老师，不能直接覆盖', en: 'This cuber already has a teacher for this event' },
    'a person cannot be their own teacher': { zh: '不能把选手本人设为老师', en: 'A cuber cannot be their own teacher' },
    'student not found': { zh: '未找到这位选手', en: 'Cuber not found' },
    'teacher not found': { zh: '未找到这位老师', en: 'Teacher not found' },
  };
  return tr(known[message] ?? { zh: '保存失败，请稍后重试', en: 'Save failed. Please try again.' });
}

export interface WcaTeacherDirectory {
  teachers: ReadonlyMap<string, WcaTeacher>;
  loading: boolean;
  loadFailed: boolean;
  userWcaId: string;
  isAdmin: boolean;
  canSelfAssign: boolean;
  save: (studentWcaId: string, eventId: string, teacherWcaId?: string) => Promise<void>;
  remove: (studentWcaId: string, eventId: string) => Promise<void>;
}

export function useWcaTeachers(studentWcaIds: string[], eventIds: string[]): WcaTeacherDirectory {
  const user = useAuthUser();
  const isAdmin = isAdminWcaId(user?.wcaId);
  const [teachers, setTeachers] = useState<Map<string, WcaTeacher>>(() => new Map());
  const [loadState, setLoadState] = useState<'ready' | 'loading' | 'error'>('ready');
  const [activeMembership, setActiveMembership] = useState(false);
  const idsKey = useMemo(
    () => [...new Set(studentWcaIds.filter(Boolean))].sort().join(','),
    [studentWcaIds],
  );
  const eventsKey = useMemo(
    () => [...new Set(eventIds.filter(Boolean))].sort().join(','),
    [eventIds],
  );

  useEffect(() => {
    const ids = idsKey ? idsKey.split(',') : [];
    const events = eventsKey ? eventsKey.split(',') : [];
    let cancelled = false;
    if (ids.length === 0 || events.length === 0) {
      setTeachers(new Map());
      setLoadState('ready');
      return;
    }
    setLoadState('loading');
    const requests: Promise<WcaTeacher[]>[] = [];
    for (let i = 0; i < ids.length; i += LOOKUP_CHUNK_SIZE) {
      requests.push(listWcaTeachers(ids.slice(i, i + LOOKUP_CHUNK_SIZE), events));
    }
    Promise.all(requests)
      .then((groups) => {
        if (cancelled) return;
        setTeachers(new Map(groups.flat().map((teacher) => [
          teacherRelationKey(teacher.studentWcaId, teacher.eventId),
          teacher,
        ])));
        setLoadState('ready');
      })
      .catch(() => {
        if (!cancelled) {
          setTeachers(new Map());
          setLoadState('error');
        }
      });
    return () => { cancelled = true; };
  }, [idsKey, eventsKey]);

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

  const save = useCallback(async (studentWcaId: string, eventId: string, teacherWcaId?: string) => {
    const teacher = await setWcaTeacher(studentWcaId, eventId, teacherWcaId);
    setTeachers((current) => new Map(current).set(teacherRelationKey(studentWcaId, eventId), teacher));
  }, []);

  const remove = useCallback(async (studentWcaId: string, eventId: string) => {
    await removeWcaTeacher(studentWcaId, eventId);
    setTeachers((current) => {
      const next = new Map(current);
      next.delete(teacherRelationKey(studentWcaId, eventId));
      return next;
    });
  }, []);

  return {
    teachers,
    loading: loadState === 'loading',
    loadFailed: loadState === 'error',
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
      zh: '每个项目分别登记；老师本人须为有效会员，管理员可代填',
      en: 'Teachers can self-register per event with an active membership; admins can edit any entry',
    })}>
      {tr({ zh: '老师', en: 'Teacher' })}
    </th>
  );
}

export function WcaTeacherNote() {
  return (
    <p className="wca-teacher-note">
      {tr({
        zh: '老师按项目分别登记。有效会员可登记自己；管理员可代填。',
        en: 'Teachers are registered separately for each event. Active members can add themselves; admins can edit on their behalf.',
      })}
    </p>
  );
}

export function WcaTeacherCell({ studentWcaId, eventIds, directory, isZh, showEventNames = false, emptyLabel = '—' }: {
  studentWcaId: string;
  eventIds: readonly string[];
  directory: WcaTeacherDirectory;
  isZh: boolean;
  showEventNames?: boolean;
  emptyLabel?: string;
}) {
  const eventIdsKey = eventIds.join(',');
  const normalizedEventIds = useMemo(
    () => [...new Set(eventIdsKey.split(',').filter(Boolean))],
    [eventIdsKey],
  );
  const availableEventSet = useMemo(() => new Set(normalizedEventIds), [normalizedEventIds]);
  const relations = normalizedEventIds.flatMap((eventId) => {
    const teacher = directory.teachers.get(teacherRelationKey(studentWcaId, eventId));
    return teacher ? [{ eventId, teacher }] : [];
  });
  const [editing, setEditing] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState(normalizedEventIds[0] ?? '');
  const [selected, setSelected] = useState<WcaPersonLite | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const activeEventId = normalizedEventIds.includes(selectedEventId)
    ? selectedEventId
    : (normalizedEventIds[0] ?? '');
  const teacher = activeEventId
    ? directory.teachers.get(teacherRelationKey(studentWcaId, activeEventId))
    : undefined;
  const isOwnRelation = !!teacher && teacher.teacherWcaId === directory.userWcaId;
  const hasOwnRelation = relations.some(({ teacher: relation }) => relation.teacherWcaId === directory.userWcaId);
  const teacherDataReady = !directory.loading && !directory.loadFailed;
  const canOpenEditor = teacherDataReady && (directory.isAdmin || directory.canSelfAssign || hasOwnRelation);
  const isMultiEvent = normalizedEventIds.length > 1;

  useEffect(() => {
    if (!editing) return;
    setSelected(teacher ? { id: teacher.teacherWcaId, name: teacher.teacherName, country_iso2: '' } : null);
    setError('');
  }, [editing, activeEventId, teacher]);

  const run = async (operation: () => Promise<void>) => {
    setSaving(true);
    setError('');
    try {
      await operation();
      if (!isMultiEvent) setEditing(false);
    } catch (caught) {
      setError(teacherErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  };

  const selfAssign = () => void run(() => directory.save(studentWcaId, activeEventId));
  const remove = () => void run(() => directory.remove(studentWcaId, activeEventId));
  const saveAdmin = () => {
    if (selected) void run(() => directory.save(studentWcaId, activeEventId, selected.id));
  };
  const openEditor = (eventId = normalizedEventIds[0] ?? '') => {
    setSelectedEventId(eventId);
    setEditing(true);
  };

  return (
    <div className="wca-teacher-cell">
      <span className={`wca-teacher-value${isMultiEvent ? ' wca-teacher-value-multi' : ''}`}>
        {relations.length > 0
          ? relations.map(({ eventId, teacher: relation }) => (
            <span key={eventId} className="wca-teacher-relation">
              {(isMultiEvent || showEventNames) && <EventIcon event={eventId} title={eventDisplayName(eventId, isZh)} />}
              {showEventNames && <span className="wca-teacher-event-name">{eventDisplayName(eventId, isZh)}:</span>}
              <PersonLink wcaId={relation.teacherWcaId} name={relation.teacherName} isZh={isZh} />
            </span>
          ))
          : <span className="wca-teacher-empty">{emptyLabel}</span>}
      </span>
      {directory.isAdmin && teacherDataReady ? (
        <button type="button" className="wca-teacher-action" onClick={() => openEditor()}>
          {relations.length > 0 ? tr({ zh: '编辑', en: 'Edit' }) : tr({ zh: '填写', en: 'Add' })}
        </button>
      ) : isMultiEvent && canOpenEditor ? (
        <button type="button" className="wca-teacher-action" onClick={() => openEditor()}>
          {tr({ zh: '管理', en: 'Manage' })}
        </button>
      ) : teacherDataReady && !teacher && directory.canSelfAssign ? (
        <button type="button" className="wca-teacher-action" disabled={saving} onClick={selfAssign}>
          {saving ? tr({ zh: '保存中…', en: 'Saving…' }) : tr({ zh: '登记自己', en: 'Add myself' })}
        </button>
      ) : teacherDataReady && isOwnRelation ? (
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
            {isMultiEvent && (
              <WcaEventSelector
                availableEvents={availableEventSet}
                selectedEvent={activeEventId}
                onSelect={setSelectedEventId}
                isZh={isZh}
                onlyAvailable
              />
            )}
            {!isMultiEvent && activeEventId && (
              <p className="wca-teacher-dialog-event">
                <EventIcon event={activeEventId} />
                <span>{eventDisplayName(activeEventId, isZh)}</span>
              </p>
            )}
            {teacher && (
              <p className="wca-teacher-dialog-current">
                {tr({ zh: '当前老师：', en: 'Current teacher: ' })}
                <PersonLink wcaId={teacher.teacherWcaId} name={teacher.teacherName} isZh={isZh} />
              </p>
            )}
            {directory.isAdmin && (
              <WcaPersonPicker
                value={selected}
                onChange={setSelected}
                isZh={isZh}
                placeholder={tr({ zh: '搜索老师姓名或 WCA ID', en: 'Search teacher name or WCA ID' })}
              />
            )}
            {error && <p className="wca-teacher-dialog-error" role="alert">{error}</p>}
            <div className="wca-teacher-dialog-actions">
              {directory.isAdmin && (
                <button type="button" className="wca-teacher-dialog-action wca-teacher-dialog-primary" disabled={!selected || saving} onClick={saveAdmin}>
                  {saving ? tr({ zh: '保存中…', en: 'Saving…' }) : tr({ zh: '保存', en: 'Save' })}
                </button>
              )}
              {!directory.isAdmin && !teacher && directory.canSelfAssign && (
                <button type="button" className="wca-teacher-dialog-action wca-teacher-dialog-primary" disabled={saving} onClick={selfAssign}>
                  {saving ? tr({ zh: '保存中…', en: 'Saving…' }) : tr({ zh: '登记自己', en: 'Add myself' })}
                </button>
              )}
              {teacher && (directory.isAdmin || isOwnRelation) && (
                <button type="button" className="wca-teacher-dialog-action wca-teacher-dialog-remove" disabled={saving} onClick={remove}>
                  {tr({ zh: '移除', en: 'Remove' })}
                </button>
              )}
              <button type="button" className="wca-teacher-dialog-action wca-teacher-dialog-cancel" disabled={saving} onClick={() => setEditing(false)}>
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
