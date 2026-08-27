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

export function wcaTeacherRelationKey(studentWcaId: string, eventId: string): string {
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
  ready: boolean;
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
  const [resolvedLookupKey, setResolvedLookupKey] = useState('');
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
      setResolvedLookupKey(`${idsKey}|${eventsKey}`);
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
          wcaTeacherRelationKey(teacher.studentWcaId, teacher.eventId),
          teacher,
        ])));
        setLoadState('ready');
        setResolvedLookupKey(`${idsKey}|${eventsKey}`);
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
    setTeachers((current) => new Map(current).set(wcaTeacherRelationKey(studentWcaId, eventId), teacher));
  }, []);

  const remove = useCallback(async (studentWcaId: string, eventId: string) => {
    await removeWcaTeacher(studentWcaId, eventId);
    setTeachers((current) => {
      const next = new Map(current);
      next.delete(wcaTeacherRelationKey(studentWcaId, eventId));
      return next;
    });
  }, []);

  return {
    teachers,
    loading: loadState === 'loading',
    ready: loadState === 'ready' && resolvedLookupKey === `${idsKey}|${eventsKey}`,
    loadFailed: loadState === 'error',
    userWcaId: user?.wcaId ?? '',
    isAdmin,
    canSelfAssign: !!user?.wcaId && activeMembership,
    save,
    remove,
  };
}

export function WcaTeacherColumnHeader({ className }: { className?: string } = {}) {
  return (
    <th className={className} title={tr({
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

export function WcaTeacherCell({ studentWcaId, eventIds, editableEventIds = eventIds, defaultEditEventId, directory, isZh, showEventNames = false, emptyLabel = '—', editorOnly = false }: {
  studentWcaId: string;
  eventIds: readonly string[];
  editableEventIds?: readonly string[];
  defaultEditEventId?: string;
  directory: WcaTeacherDirectory;
  isZh: boolean;
  showEventNames?: boolean;
  emptyLabel?: string;
  editorOnly?: boolean;
}) {
  const eventIdsKey = eventIds.join(',');
  const normalizedEventIds = useMemo(
    () => [...new Set(eventIdsKey.split(',').filter(Boolean))],
    [eventIdsKey],
  );
  const editableEventIdsKey = editableEventIds.join(',');
  const normalizedEditableEventIds = useMemo(
    () => [...new Set(editableEventIdsKey.split(',').filter(Boolean))],
    [editableEventIdsKey],
  );
  const availableEventSet = useMemo(() => new Set(normalizedEditableEventIds), [normalizedEditableEventIds]);
  const relations = normalizedEventIds.flatMap((eventId) => {
    const teacher = directory.teachers.get(wcaTeacherRelationKey(studentWcaId, eventId));
    return teacher ? [{ eventId, teacher }] : [];
  });
  const [editing, setEditing] = useState(false);
  const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(
    () => new Set((defaultEditEventId ? [defaultEditEventId] : normalizedEditableEventIds).slice(0, 1)),
  );
  const [selected, setSelected] = useState<WcaPersonLite | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const editableRelations = normalizedEditableEventIds.flatMap((eventId) => {
    const teacher = directory.teachers.get(wcaTeacherRelationKey(studentWcaId, eventId));
    return teacher ? [{ eventId, teacher }] : [];
  });
  const hasOwnRelation = editableRelations.some(({ teacher: relation }) => relation.teacherWcaId === directory.userWcaId);
  const teacherDataReady = directory.ready && !directory.loadFailed;
  const canOpenEditor = teacherDataReady && (directory.isAdmin || directory.canSelfAssign || hasOwnRelation);
  const isMultiDisplay = normalizedEventIds.length > 1;
  const isMultiEditor = normalizedEditableEventIds.length > 1;
  const selectedIds = normalizedEditableEventIds.filter((eventId) => selectedEventIds.has(eventId));
  const selectedRelations = selectedIds.flatMap((eventId) => {
    const relation = directory.teachers.get(wcaTeacherRelationKey(studentWcaId, eventId));
    return relation ? [{ eventId, relation }] : [];
  });
  const selfAssignableIds = selectedIds.filter(
    (eventId) => !directory.teachers.has(wcaTeacherRelationKey(studentWcaId, eventId)),
  );
  const removableIds = selectedIds.filter((eventId) => {
    const relation = directory.teachers.get(wcaTeacherRelationKey(studentWcaId, eventId));
    return !!relation && (directory.isAdmin || relation.teacherWcaId === directory.userWcaId);
  });
  const singleSelectedTeacher = selectedIds.length === 1 ? selectedRelations[0]?.relation : undefined;

  useEffect(() => {
    if (!editing) return;
    setError('');
  }, [editing]);

  const run = async (operation: () => Promise<void>, closeOnSuccess = false) => {
    setSaving(true);
    setError('');
    try {
      await operation();
      if (closeOnSuccess || !isMultiEditor) setEditing(false);
    } catch (caught) {
      setError(teacherErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  };

  const selfAssign = () => void run(
    () => Promise.all(selfAssignableIds.map((eventId) => directory.save(studentWcaId, eventId))).then(() => undefined),
    isMultiEditor,
  );
  const remove = () => void run(
    () => Promise.all(removableIds.map((eventId) => directory.remove(studentWcaId, eventId))).then(() => undefined),
    isMultiEditor,
  );
  const changeAdminTeacher = (teacher: WcaPersonLite | null) => {
    if (teacher) {
      setSelected(teacher);
      return;
    }

    const selectedTeacherId = selected?.id;
    const matchingEventIds = selectedTeacherId
      ? selectedIds.filter((eventId) => (
        directory.teachers.get(wcaTeacherRelationKey(studentWcaId, eventId))?.teacherWcaId === selectedTeacherId
      ))
      : [];

    if (matchingEventIds.length > 0 && !saving) {
      void run(
        () => Promise.all(matchingEventIds.map((eventId) => directory.remove(studentWcaId, eventId))).then(() => undefined),
        true,
      );
      return;
    }

    setSelected(null);
  };
  const saveAdmin = () => {
    if (selected && selectedIds.length > 0) {
      void run(
        () => Promise.all(selectedIds.map((eventId) => directory.save(studentWcaId, eventId, selected.id))).then(() => undefined),
        true,
      );
    }
  };
  const openEditor = (eventId = defaultEditEventId ?? normalizedEditableEventIds[0] ?? '') => {
    setSelectedEventIds(new Set(eventId ? [eventId] : []));
    const relation = eventId
      ? directory.teachers.get(wcaTeacherRelationKey(studentWcaId, eventId))
      : undefined;
    setSelected(relation ? { id: relation.teacherWcaId, name: relation.teacherName, country_iso2: '' } : null);
    setError('');
    setEditing(true);
  };
  const toggleEvent = (eventId: string) => {
    setSelectedEventIds((current) => {
      const next = new Set(current);
      if (next.has(eventId)) next.delete(eventId);
      else next.add(eventId);
      return next;
    });
  };

  return (
    <div className="wca-teacher-cell">
      {!editorOnly && (
        <span className={`wca-teacher-value${isMultiDisplay ? ' wca-teacher-value-multi' : ''}`}>
          {relations.length > 0
            ? relations.map(({ eventId, teacher: relation }) => (
              <span key={eventId} className="wca-teacher-relation">
                {(isMultiDisplay || showEventNames) && <EventIcon event={eventId} title={eventDisplayName(eventId, isZh)} />}
                {showEventNames && <span className="wca-teacher-event-name">{eventDisplayName(eventId, isZh)}:</span>}
                <PersonLink wcaId={relation.teacherWcaId} name={relation.teacherName} isZh={isZh} />
              </span>
            ))
            : <span className="wca-teacher-empty">{emptyLabel}</span>}
        </span>
      )}
      {editorOnly && canOpenEditor ? (
        <button type="button" className="wca-teacher-action" onClick={() => openEditor()}>
          {tr({ zh: '编辑', en: 'Edit' })}
        </button>
      ) : !editorOnly && directory.isAdmin && teacherDataReady ? (
        <button type="button" className="wca-teacher-action" onClick={() => openEditor()}>
          {relations.length > 0 ? tr({ zh: '编辑', en: 'Edit' }) : tr({ zh: '填写', en: 'Add' })}
        </button>
      ) : !editorOnly && isMultiEditor && canOpenEditor ? (
        <button type="button" className="wca-teacher-action" onClick={() => openEditor()}>
          {tr({ zh: '管理', en: 'Manage' })}
        </button>
      ) : !editorOnly && teacherDataReady && !singleSelectedTeacher && directory.canSelfAssign ? (
        <button type="button" className="wca-teacher-action" disabled={saving} onClick={selfAssign}>
          {saving ? tr({ zh: '保存中…', en: 'Saving…' }) : tr({ zh: '登记自己', en: 'Add myself' })}
        </button>
      ) : !editorOnly && teacherDataReady && singleSelectedTeacher?.teacherWcaId === directory.userWcaId ? (
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
            <div className="wca-teacher-dialog-heading">
              <h2 id={`teacher-title-${studentWcaId}`}>{tr({ zh: '填写老师', en: 'Set teacher' })}</h2>
              {directory.isAdmin && (
                <WcaPersonPicker
                  value={selected}
                  onChange={changeAdminTeacher}
                  isZh={isZh}
                  placeholder={tr({ zh: '姓名或 WCA ID', en: 'Name or WCA ID' })}
                />
              )}
            </div>
            {isMultiEditor && (
              <WcaEventSelector
                availableEvents={availableEventSet}
                selectedEvents={selectedEventIds}
                onToggle={toggleEvent}
                isZh={isZh}
                onlyAvailable
              />
            )}
            {!isMultiEditor && selectedIds[0] && (
              <p className="wca-teacher-dialog-event">
                <EventIcon event={selectedIds[0]} />
                <span>{eventDisplayName(selectedIds[0], isZh)}</span>
              </p>
            )}
            {error && <p className="wca-teacher-dialog-error" role="alert">{error}</p>}
            <div className="wca-teacher-dialog-actions">
              {directory.isAdmin && (
                <button type="button" className="wca-teacher-dialog-action wca-teacher-dialog-primary" disabled={!selected || selectedIds.length === 0 || saving} onClick={saveAdmin}>
                  {saving ? tr({ zh: '保存中…', en: 'Saving…' }) : tr({ zh: '保存', en: 'Save' })}
                </button>
              )}
              {!directory.isAdmin && directory.canSelfAssign && (
                <button type="button" className="wca-teacher-dialog-action wca-teacher-dialog-primary" disabled={selfAssignableIds.length === 0 || saving} onClick={selfAssign}>
                  {saving ? tr({ zh: '保存中…', en: 'Saving…' }) : tr({ zh: '登记自己', en: 'Add myself' })}
                </button>
              )}
              {!directory.isAdmin && removableIds.length > 0 && (
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
