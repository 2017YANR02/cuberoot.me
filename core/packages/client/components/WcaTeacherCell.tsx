'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { isAdminWcaId } from '@cuberoot/shared/admin';
import { loadPersonsIndex } from '@cuberoot/shared/persons-index';
import type { WcaPersonLite } from '@/lib/wca-api';
import { EventIcon } from '@/components/EventIcon';
import PersonLink from '@/components/PersonLink';
import WcaEventSelector from '@/components/WcaEventSelector';
import { WcaPersonPicker } from '@/components/WcaPersonPicker';
import { CountryInput } from '@/components/CountryInput/CountryInput';
import { useAuthUser } from '@/lib/auth-store';
import { getMyMembership } from '@/lib/membership-api';
import {
  createWcaNamedStudent,
  listWcaTeachers,
  removeWcaNamedStudent,
  removeWcaTeacher,
  setWcaTeacher,
  updateWcaNamedStudent,
  type WcaNamedStudent,
  type WcaTeacher,
} from '@/lib/wca-teachers-api';
import { eventDisplayName } from '@/lib/wca-events';
import { tr } from '@/i18n/tr';
import { ALL_EVENT_IDS } from '@/lib/event-constants';
import { fetchWcaPersonResults } from '@/lib/wca-person-api';
import { displayCuberName } from '@/lib/cuber-name-display';
import './wca-teacher-cell.css';

const LOOKUP_CHUNK_SIZE = 100;
const MAX_BATCH_STUDENTS = 100;
const MAX_NAMED_STUDENT_NAME_LENGTH = 160;

interface BatchStudentMatch {
  inputName: string;
  candidates: WcaPersonLite[];
  selected: WcaPersonLite | null;
}

interface BatchUndoSnapshot {
  teacherWcaId: string;
  wcaAdded: Array<{ studentWcaId: string; eventId: string }>;
  namedCreated: Array<{ id: string }>;
  namedUpdated: WcaNamedStudent[];
  namedRemoved: WcaNamedStudent[];
}

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
    'invalid country': { zh: '请选择有效国籍', en: 'Select a valid nationality' },
    'student already exists': { zh: '这位学生已在名单中，可直接修改', en: 'This student is already on the roster and can be updated' },
  };
  return tr(known[message] ?? { zh: '保存失败，请稍后重试', en: 'Save failed. Please try again.' });
}

function normalizeRosterName(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

function parseBatchStudentNames(value: string): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  for (const line of value.split(/\r?\n/)) {
    const name = line.replace(/\s+/g, ' ').trim();
    const normalized = normalizeRosterName(name);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    names.push(name);
  }
  return names;
}

function wcaPersonNameKeys(rawName: string): Set<string> {
  return new Set([
    normalizeRosterName(rawName),
    normalizeRosterName(displayCuberName(rawName, false)),
    normalizeRosterName(displayCuberName(rawName, true)),
  ].filter(Boolean));
}

async function matchBatchStudentNames(names: readonly string[]): Promise<BatchStudentMatch[]> {
  const index = await loadPersonsIndex();
  const targetKeys = new Set(names.map(normalizeRosterName));
  const candidatesByKey = new Map<string, WcaPersonLite[]>();

  for (const [wcaId, rawName, iso2] of index.records) {
    const matchingKeys = new Set([normalizeRosterName(wcaId), ...wcaPersonNameKeys(rawName)]);
    for (const key of matchingKeys) {
      if (!targetKeys.has(key)) continue;
      const candidates = candidatesByKey.get(key) ?? [];
      candidates.push({ id: wcaId, name: rawName, country_iso2: iso2 });
      candidatesByKey.set(key, candidates);
    }
  }

  return names.map((inputName) => {
    const candidates = candidatesByKey.get(normalizeRosterName(inputName)) ?? [];
    return {
      inputName,
      candidates,
      selected: candidates.length === 1 ? candidates[0] : null,
    };
  });
}

function hasBatchUndoActions(snapshot: BatchUndoSnapshot): boolean {
  return snapshot.wcaAdded.length > 0
    || snapshot.namedCreated.length > 0
    || snapshot.namedUpdated.length > 0
    || snapshot.namedRemoved.length > 0;
}

function batchUndoStorageKey(teacherWcaId: string): string {
  return `wca-teacher-batch-undo:${teacherWcaId}`;
}

function readBatchUndo(teacherWcaId: string): BatchUndoSnapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.sessionStorage.getItem(batchUndoStorageKey(teacherWcaId));
    if (!value) return null;
    const snapshot = JSON.parse(value) as BatchUndoSnapshot;
    return snapshot.teacherWcaId === teacherWcaId && hasBatchUndoActions(snapshot) ? snapshot : null;
  } catch {
    return null;
  }
}

function sameEvents(left: readonly string[], right: ReadonlySet<string>): boolean {
  return left.length === right.size && left.every((eventId) => right.has(eventId));
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

export function canAddWcaTeacherStudent(
  teacherWcaId: string,
  directory: Pick<WcaTeacherDirectory, 'ready' | 'loadFailed' | 'userWcaId' | 'isAdmin' | 'canSelfAssign'>,
): boolean {
  return directory.ready
    && !directory.loadFailed
    && (directory.isAdmin || (directory.canSelfAssign && directory.userWcaId === teacherWcaId));
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

export function WcaStudentAdder({
  teacherWcaId,
  teacherCountryIso2,
  existingWcaStudentEvents,
  existingNamedStudents,
  directory,
  isZh,
  onSaved,
}: {
  teacherWcaId: string;
  teacherCountryIso2: string;
  existingWcaStudentEvents: ReadonlyMap<string, readonly string[]>;
  existingNamedStudents: readonly WcaNamedStudent[];
  directory: WcaTeacherDirectory;
  isZh: boolean;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<WcaPersonLite | null>(null);
  const [namedStudentName, setNamedStudentName] = useState('');
  const [namedStudentCountryIso2, setNamedStudentCountryIso2] = useState(() => teacherCountryIso2.toLowerCase());
  const [availableEventIds, setAvailableEventIds] = useState<string[]>([]);
  const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(() => new Set());
  const [showAllEvents, setShowAllEvents] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [batchEditing, setBatchEditing] = useState(false);
  const [batchNamesText, setBatchNamesText] = useState('');
  const [batchCountryIso2, setBatchCountryIso2] = useState(() => teacherCountryIso2.toLowerCase());
  const [batchEventIds, setBatchEventIds] = useState<Set<string>>(() => new Set());
  const [batchMatches, setBatchMatches] = useState<BatchStudentMatch[] | null>(null);
  const [batchMatching, setBatchMatching] = useState(false);
  const [batchSaving, setBatchSaving] = useState(false);
  const [batchRemoveConfirmed, setBatchRemoveConfirmed] = useState(false);
  const [batchError, setBatchError] = useState('');
  const [batchUndo, setBatchUndo] = useState<BatchUndoSnapshot | null>(null);
  const [batchUndoing, setBatchUndoing] = useState(false);
  const canAdd = canAddWcaTeacherStudent(teacherWcaId, directory);
  const existingWcaEventIds = selectedStudent
    ? existingWcaStudentEvents.get(selectedStudent.id) ?? []
    : [];
  const normalizedNamedStudentName = normalizeRosterName(namedStudentName);
  const existingNamedStudent = normalizedNamedStudentName
    ? existingNamedStudents.find((student) => normalizeRosterName(student.studentName) === normalizedNamedStudentName)
    : undefined;
  const isExistingStudent = existingWcaEventIds.length > 0 || !!existingNamedStudent;
  const changed = selectedStudent
    ? !sameEvents(existingWcaEventIds, selectedEventIds)
    : existingNamedStudent
      ? !sameEvents(existingNamedStudent.eventIds, selectedEventIds)
        || existingNamedStudent.countryIso2.toLowerCase() !== namedStudentCountryIso2.toLowerCase()
        || existingNamedStudent.studentName.replace(/\s+/g, ' ').trim() !== namedStudentName.replace(/\s+/g, ' ').trim()
      : true;
  const visibleEventSet = useMemo(() => new Set(showAllEvents
    ? ALL_EVENT_IDS
    : [...availableEventIds, ...selectedEventIds]), [availableEventIds, selectedEventIds, showAllEvents]);
  const hasOtherEvents = availableEventIds.length > 0 && availableEventIds.length < ALL_EVENT_IDS.length;
  const titleId = `add-student-title-${teacherWcaId}`;
  const batchTitleId = `batch-add-student-title-${teacherWcaId}`;
  const batchStudentNames = useMemo(() => parseBatchStudentNames(batchNamesText), [batchNamesText]);
  const batchExistingNamedStudents = useMemo(() => {
    const pastedNames = new Set(batchStudentNames.map(normalizeRosterName));
    return existingNamedStudents.filter((student) => pastedNames.has(normalizeRosterName(student.studentName)));
  }, [batchStudentNames, existingNamedStudents]);
  const batchExistingCount = batchExistingNamedStudents.length;
  const batchNameTooLong = batchStudentNames.some((name) => name.length > MAX_NAMED_STUDENT_NAME_LENGTH);
  const batchAutoMatchCount = batchMatches?.filter((match) => match.candidates.length === 1).length ?? 0;
  const batchUnmatchedCount = batchMatches?.filter((match) => match.candidates.length === 0).length ?? 0;
  const batchAmbiguousCount = batchMatches?.filter((match) => match.candidates.length > 1).length ?? 0;
  const batchUnresolvedCount = batchMatches?.filter((match) => match.candidates.length > 1 && !match.selected).length ?? 0;

  useEffect(() => {
    setBatchUndo(readBatchUndo(teacherWcaId));
  }, [teacherWcaId]);

  useEffect(() => {
    let cancelled = false;
    setAvailableEventIds([]);
    setSelectedEventIds(new Set(existingWcaStudentEvents.get(selectedStudent?.id ?? '') ?? []));
    setShowAllEvents(false);
    setError('');
    if (!selectedStudent) {
      setLoadingEvents(false);
      return;
    }
    if (selectedStudent.id === teacherWcaId) {
      setLoadingEvents(false);
      setError(tr({ zh: '不能把老师本人添加为学生', en: 'A teacher cannot be added as their own student' }));
      return;
    }
    setLoadingEvents(true);
    fetchWcaPersonResults(selectedStudent.id)
      .then((results) => {
        if (cancelled) return;
        const competedEvents = new Set(results.map((result) => result.event_id));
        const nextAvailableEventIds = ALL_EVENT_IDS.filter((eventId) => competedEvents.has(eventId));
        setAvailableEventIds(nextAvailableEventIds);
        setShowAllEvents(nextAvailableEventIds.length === 0);
        if (!existingWcaStudentEvents.has(selectedStudent.id) && nextAvailableEventIds.length === 1) {
          setSelectedEventIds(new Set(nextAvailableEventIds));
        }
      })
      .catch(() => {
        if (cancelled) return;
        setShowAllEvents(true);
        setError(tr({
          zh: '无法读取参赛项目，仍可从全部项目中选择',
          en: 'Competition events could not be loaded. You can still choose from all events.',
        }));
      })
      .finally(() => { if (!cancelled) setLoadingEvents(false); });
    return () => { cancelled = true; };
  }, [existingWcaStudentEvents, selectedStudent, teacherWcaId]);

  if (!canAdd) return null;

  const close = () => {
    setEditing(false);
    setSelectedStudent(null);
    setNamedStudentName('');
    setNamedStudentCountryIso2(teacherCountryIso2.toLowerCase());
    setAvailableEventIds([]);
    setSelectedEventIds(new Set());
    setShowAllEvents(false);
    setError('');
  };
  const toggleEvent = (eventId: string) => {
    setSelectedEventIds((current) => {
      const next = new Set(current);
      if (next.has(eventId)) next.delete(eventId);
      else next.add(eventId);
      return next;
    });
  };
  const closeBatch = () => {
    setBatchEditing(false);
    setBatchNamesText('');
    setBatchCountryIso2(teacherCountryIso2.toLowerCase());
    setBatchEventIds(new Set());
    setBatchMatches(null);
    setBatchRemoveConfirmed(false);
    setBatchError('');
  };
  const toggleBatchEvent = (eventId: string) => {
    setBatchEventIds((current) => {
      const next = new Set(current);
      if (next.has(eventId)) next.delete(eventId);
      else next.add(eventId);
      return next;
    });
  };
  const persistBatchUndo = (snapshot: BatchUndoSnapshot | null) => {
    setBatchUndo(snapshot);
    try {
      if (snapshot && hasBatchUndoActions(snapshot)) {
        window.sessionStorage.setItem(batchUndoStorageKey(teacherWcaId), JSON.stringify(snapshot));
      } else {
        window.sessionStorage.removeItem(batchUndoStorageKey(teacherWcaId));
      }
    } catch {
      // Undo remains available for this page session even when browser storage is unavailable.
    }
  };
  const prepareBatchMatches = async () => {
    if (batchMatching || batchStudentNames.length === 0 || batchStudentNames.length > MAX_BATCH_STUDENTS || batchNameTooLong) return;
    setBatchMatching(true);
    setBatchError('');
    try {
      setBatchMatches(await matchBatchStudentNames(batchStudentNames));
    } catch {
      setBatchError(tr({
        zh: '无法读取 WCA 选手名单，请稍后重试',
        en: 'The WCA person index could not be loaded. Please try again.',
      }));
    } finally {
      setBatchMatching(false);
    }
  };
  const saveBatch = async () => {
    if (batchSaving
      || !batchMatches
      || batchUnresolvedCount > 0
      || batchStudentNames.length === 0
      || (batchUnmatchedCount > 0 && !batchCountryIso2)
      || batchEventIds.size === 0) return;
    if (batchStudentNames.length > MAX_BATCH_STUDENTS) {
      setBatchError(tr({
        zh: `一次最多添加 ${MAX_BATCH_STUDENTS} 名学生`,
        en: `Add no more than ${MAX_BATCH_STUDENTS} students at a time`,
      }));
      return;
    }
    if (batchNameTooLong) {
      setBatchError(tr({
        zh: `每个姓名不能超过 ${MAX_NAMED_STUDENT_NAME_LENGTH} 个字符`,
        en: `Each name must be no longer than ${MAX_NAMED_STUDENT_NAME_LENGTH} characters`,
      }));
      return;
    }

    setBatchSaving(true);
    setBatchError('');
    const existingByName = new Map(existingNamedStudents.map((student) => [
      normalizeRosterName(student.studentName),
      student,
    ]));
    const failedNames: string[] = [];
    const defaultEventIds = [...batchEventIds];
    const workingWcaEvents = new Map<string, Set<string>>();
    let undoSnapshot: BatchUndoSnapshot = {
      teacherWcaId,
      wcaAdded: [],
      namedCreated: [],
      namedUpdated: [],
      namedRemoved: [],
    };
    let savedCount = 0;

    const recordUndo = (next: BatchUndoSnapshot) => {
      undoSnapshot = next;
      persistBatchUndo(next);
    };

    for (const match of batchMatches) {
      const studentName = match.inputName;
      try {
        const existing = existingByName.get(normalizeRosterName(studentName));
        if (match.selected) {
          if (match.selected.id === teacherWcaId) {
            throw new Error('teacher cannot be their own student');
          }
          let existingEvents = workingWcaEvents.get(match.selected.id);
          if (!existingEvents) {
            existingEvents = new Set(existingWcaStudentEvents.get(match.selected.id) ?? []);
            workingWcaEvents.set(match.selected.id, existingEvents);
          }
          for (const eventId of defaultEventIds) {
            if (existingEvents.has(eventId)) continue;
            await directory.save(match.selected.id, eventId, directory.isAdmin ? teacherWcaId : undefined);
            existingEvents.add(eventId);
            recordUndo({
              ...undoSnapshot,
              wcaAdded: [...undoSnapshot.wcaAdded, { studentWcaId: match.selected.id, eventId }],
            });
          }
          if (existing) {
            await removeWcaNamedStudent(teacherWcaId, existing.id);
            recordUndo({ ...undoSnapshot, namedRemoved: [...undoSnapshot.namedRemoved, existing] });
          }
        } else if (existing) {
          const mergedEventIds = new Set([...existing.eventIds, ...defaultEventIds]);
          if (!sameEvents(existing.eventIds, mergedEventIds)) {
            await updateWcaNamedStudent(
              teacherWcaId,
              existing.id,
              existing.studentName,
              existing.countryIso2,
              [...mergedEventIds],
            );
            recordUndo({ ...undoSnapshot, namedUpdated: [...undoSnapshot.namedUpdated, existing] });
          }
        } else {
          const created = await createWcaNamedStudent(teacherWcaId, studentName, batchCountryIso2, defaultEventIds);
          recordUndo({ ...undoSnapshot, namedCreated: [...undoSnapshot.namedCreated, { id: created.id }] });
        }
        savedCount += 1;
      } catch {
        failedNames.push(studentName);
      }
    }

    if (savedCount > 0) onSaved();
    setBatchSaving(false);
    if (failedNames.length > 0) {
      setBatchNamesText(failedNames.join('\n'));
      setBatchMatches(null);
      setBatchError(tr({
        zh: `已保存 ${savedCount} 人，另有 ${failedNames.length} 人失败，请重试`,
        en: `${savedCount} saved; ${failedNames.length} failed. Please try again.`,
      }));
      return;
    }
    closeBatch();
  };
  const removePastedNamedStudents = async () => {
    if (batchSaving || batchExistingNamedStudents.length === 0) return;
    if (!batchRemoveConfirmed) {
      setBatchRemoveConfirmed(true);
      setBatchError('');
      return;
    }

    setBatchSaving(true);
    setBatchError('');
    const failedNames: string[] = [];
    let removedCount = 0;
    let undoSnapshot: BatchUndoSnapshot = {
      teacherWcaId,
      wcaAdded: [],
      namedCreated: [],
      namedUpdated: [],
      namedRemoved: [],
    };
    for (const student of batchExistingNamedStudents) {
      try {
        await removeWcaNamedStudent(teacherWcaId, student.id);
        removedCount += 1;
        undoSnapshot = {
          ...undoSnapshot,
          namedRemoved: [...undoSnapshot.namedRemoved, student],
        };
        persistBatchUndo(undoSnapshot);
      } catch {
        failedNames.push(student.studentName);
      }
    }
    if (removedCount > 0) onSaved();
    setBatchSaving(false);
    if (failedNames.length > 0) {
      setBatchNamesText(failedNames.join('\n'));
      setBatchRemoveConfirmed(false);
      setBatchError(tr({
        zh: `已撤回 ${removedCount} 人，另有 ${failedNames.length} 人失败，请重试`,
        en: `${removedCount} removed; ${failedNames.length} failed. Please try again.`,
      }));
      return;
    }
    closeBatch();
  };
  const undoLastBatch = async () => {
    if (!batchUndo || batchUndoing) return;
    setBatchUndoing(true);
    setBatchError('');
    let remaining: BatchUndoSnapshot = {
      ...batchUndo,
      wcaAdded: [...batchUndo.wcaAdded],
      namedCreated: [...batchUndo.namedCreated],
      namedUpdated: [...batchUndo.namedUpdated],
      namedRemoved: [...batchUndo.namedRemoved],
    };
    const storeRemaining = () => persistBatchUndo(hasBatchUndoActions(remaining) ? remaining : null);
    try {
      while (remaining.wcaAdded.length > 0) {
        const relation = remaining.wcaAdded.at(-1)!;
        await directory.remove(relation.studentWcaId, relation.eventId);
        remaining = { ...remaining, wcaAdded: remaining.wcaAdded.slice(0, -1) };
        storeRemaining();
      }
      while (remaining.namedCreated.length > 0) {
        const student = remaining.namedCreated.at(-1)!;
        await removeWcaNamedStudent(teacherWcaId, student.id);
        remaining = { ...remaining, namedCreated: remaining.namedCreated.slice(0, -1) };
        storeRemaining();
      }
      while (remaining.namedUpdated.length > 0) {
        const student = remaining.namedUpdated.at(-1)!;
        await updateWcaNamedStudent(
          teacherWcaId,
          student.id,
          student.studentName,
          student.countryIso2,
          student.eventIds,
        );
        remaining = { ...remaining, namedUpdated: remaining.namedUpdated.slice(0, -1) };
        storeRemaining();
      }
      while (remaining.namedRemoved.length > 0) {
        const student = remaining.namedRemoved.at(-1)!;
        await createWcaNamedStudent(
          teacherWcaId,
          student.studentName,
          student.countryIso2,
          student.eventIds,
        );
        remaining = { ...remaining, namedRemoved: remaining.namedRemoved.slice(0, -1) };
        storeRemaining();
      }
      onSaved();
    } catch {
      onSaved();
      setBatchEditing(true);
      setBatchError(tr({
        zh: '只撤销了部分变更，请再次点击撤销继续',
        en: 'Only part of the batch was undone. Select undo again to continue.',
      }));
    } finally {
      setBatchUndoing(false);
    }
  };
  const save = async () => {
    const freeTextName = namedStudentName.replace(/\s+/g, ' ').trim();
    if ((!selectedStudent && (!freeTextName || !namedStudentCountryIso2)) || selectedEventIds.size === 0 || saving) return;
    setSaving(true);
    setError('');
    try {
      if (selectedStudent) {
        const teacherId = directory.isAdmin ? teacherWcaId : undefined;
        const previousEventIds = new Set(existingWcaEventIds);
        await Promise.all([
          ...[...selectedEventIds]
            .filter((eventId) => !previousEventIds.has(eventId))
            .map((eventId) => directory.save(selectedStudent.id, eventId, teacherId)),
          ...existingWcaEventIds
            .filter((eventId) => !selectedEventIds.has(eventId))
            .map((eventId) => directory.remove(selectedStudent.id, eventId)),
        ]);
      } else if (existingNamedStudent) {
        await updateWcaNamedStudent(
          teacherWcaId,
          existingNamedStudent.id,
          freeTextName,
          namedStudentCountryIso2,
          [...selectedEventIds],
        );
      } else {
        await createWcaNamedStudent(teacherWcaId, freeTextName, namedStudentCountryIso2, [...selectedEventIds]);
      }
      onSaved();
      close();
    } catch (caught) {
      setError(teacherErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <span className="wca-student-add-actions">
        <button
          type="button"
          className="wca-teacher-action wca-student-add-action"
          aria-label={tr({ zh: '添加学生', en: 'Add student' })}
          onClick={() => {
            setNamedStudentCountryIso2(teacherCountryIso2.toLowerCase());
            setEditing(true);
          }}
        >
          +
        </button>
        <button
          type="button"
          className="wca-teacher-action wca-student-batch-add-action"
          onClick={() => {
            setBatchCountryIso2(teacherCountryIso2.toLowerCase());
            setBatchError('');
            setBatchEditing(true);
          }}
        >
          {tr({ zh: '批量', en: 'Batch' })}
        </button>
        {batchUndo && (
          <button
            type="button"
            className="wca-teacher-action wca-student-batch-undo-action"
            disabled={batchUndoing}
            onClick={() => void undoLastBatch()}
          >
            {batchUndoing
              ? tr({ zh: '撤销中…', en: 'Undoing…' })
              : tr({ zh: '撤销', en: 'Undo' })}
          </button>
        )}
      </span>
      {editing && typeof document !== 'undefined' && createPortal(
        <div className="wca-teacher-dialog-layer">
          <dialog
            className="wca-teacher-dialog"
            open
            aria-modal="true"
            aria-labelledby={titleId}
            onKeyDown={(event) => { if (event.key === 'Escape' && !saving) close(); }}
          >
            <div className="wca-teacher-dialog-heading">
              <h2 id={titleId}>{isExistingStudent
                ? tr({ zh: '修改学生', en: 'Edit student' })
                : tr({ zh: '添加学生', en: 'Add student' })}</h2>
              <WcaPersonPicker
                value={selectedStudent}
                onChange={(student) => {
                  setSelectedStudent(student);
                  setNamedStudentName('');
                  setSelectedEventIds(new Set(student ? existingWcaStudentEvents.get(student.id) ?? [] : []));
                  setShowAllEvents(false);
                  setError('');
                }}
                onQueryChange={(value) => {
                  setNamedStudentName(value);
                  const duplicate = existingNamedStudents.find((student) => (
                    normalizeRosterName(student.studentName) === normalizeRosterName(value)
                  ));
                  setNamedStudentCountryIso2(
                    duplicate?.countryIso2.toLowerCase() ?? teacherCountryIso2.toLowerCase(),
                  );
                  setSelectedEventIds(new Set(duplicate?.eventIds ?? []));
                  setShowAllEvents(!!value.trim());
                  setError('');
                }}
                allowFreeText
                isZh={isZh}
                placeholder={tr({ zh: '姓名或 WCA ID', en: 'Name or WCA ID' })}
              />
            </div>
            {!selectedStudent && namedStudentName.trim() && (
              <>
                <label className="wca-named-student-country">
                  <span>{tr({ zh: '国籍（必填）', en: 'Nationality (required)' })}</span>
                  <CountryInput
                    value={namedStudentCountryIso2}
                    onChange={setNamedStudentCountryIso2}
                    placeholder={tr({ zh: '选择国籍', en: 'Select nationality' })}
                  />
                </label>
                {!namedStudentCountryIso2 && (
                  <p className="wca-teacher-dialog-error wca-teacher-dialog-validation-error" role="status">
                    {tr({ zh: '请选择国籍后保存', en: 'Select a nationality before saving' })}
                  </p>
                )}
              </>
            )}
            {isExistingStudent && (
              <p className="wca-teacher-dialog-status" role="status">
                {tr({
                  zh: '该学生已在名单中，可在这里修改国籍或授课项目',
                  en: 'This student is already on the roster. You can update their nationality or taught events here.',
                })}
              </p>
            )}
            {selectedStudent && loadingEvents && (
              <p className="wca-teacher-dialog-status">{tr({ zh: '正在读取项目…', en: 'Loading events…' })}</p>
            )}
            {(selectedStudent || namedStudentName.trim()) && !loadingEvents && (
              <>
                <WcaEventSelector
                  availableEvents={visibleEventSet}
                  selectedEvents={selectedEventIds}
                  onToggle={toggleEvent}
                  isZh={isZh}
                  onlyAvailable
                />
                {hasOtherEvents && (
                  <button
                    type="button"
                    className="wca-teacher-action"
                    aria-expanded={showAllEvents}
                    onClick={() => setShowAllEvents((current) => !current)}
                  >
                    {showAllEvents
                      ? tr({ zh: '只看参赛项目', en: 'Show competition events only' })
                      : tr({ zh: '更多项目', en: 'More events' })}
                  </button>
                )}
              </>
            )}
            {(selectedStudent || namedStudentName.trim()) && !loadingEvents && selectedEventIds.size === 0 && (
              <p className="wca-teacher-dialog-error wca-teacher-dialog-validation-error" role="status">
                {tr({ zh: '请选择至少一个授课项目后保存', en: 'Select at least one taught event before saving' })}
              </p>
            )}
            {error && <p className="wca-teacher-dialog-error" role="alert">{error}</p>}
            <div className="wca-teacher-dialog-actions">
              <button
                type="button"
                className="wca-teacher-dialog-action wca-teacher-dialog-primary"
                disabled={(!selectedStudent && (!namedStudentName.trim() || !namedStudentCountryIso2)) || selectedEventIds.size === 0 || loadingEvents || saving || (isExistingStudent && !changed)}
                onClick={() => void save()}
              >
                {saving
                  ? tr({ zh: '保存中…', en: 'Saving…' })
                  : isExistingStudent
                    ? tr({ zh: '保存修改', en: 'Save changes' })
                    : tr({ zh: '保存', en: 'Save' })}
              </button>
              <button type="button" className="wca-teacher-dialog-action wca-teacher-dialog-cancel" disabled={saving} onClick={close}>
                {tr({ zh: '取消', en: 'Cancel' })}
              </button>
            </div>
          </dialog>
        </div>,
        document.body,
      )}
      {batchEditing && typeof document !== 'undefined' && createPortal(
        <div className="wca-teacher-dialog-layer">
          <dialog
            className="wca-teacher-dialog wca-student-batch-dialog"
            open
            aria-modal="true"
            aria-labelledby={batchTitleId}
            onKeyDown={(event) => { if (event.key === 'Escape' && !batchSaving) closeBatch(); }}
          >
            <div className="wca-teacher-dialog-heading">
              <h2 id={batchTitleId}>{tr({ zh: '批量添加学生', en: 'Add students in bulk' })}</h2>
            </div>
            <label className="wca-student-batch-names">
              <span>{tr({ zh: '学生名单', en: 'Student list' })}</span>
              <textarea
                className="wca-student-batch-input"
                value={batchNamesText}
                rows={4}
                maxLength={20_000}
                placeholder={tr({ zh: '一行一个姓名', en: 'One name per line' })}
                onChange={(event) => {
                  setBatchNamesText(event.target.value);
                  setBatchMatches(null);
                  setBatchRemoveConfirmed(false);
                  setBatchError('');
                }}
              />
            </label>
            <p className="wca-teacher-dialog-status">
              {batchMatches
                ? tr({
                  zh: `自动对应 WCA ID ${batchAutoMatchCount} 人，未参赛 ${batchUnmatchedCount} 人，重名 ${batchAmbiguousCount} 人`,
                  en: `${batchAutoMatchCount} matched automatically, ${batchUnmatchedCount} not competed, ${batchAmbiguousCount} duplicate-name matches`,
                })
                : batchStudentNames.length > 0
                ? tr({
                  zh: `已识别 ${batchStudentNames.length} 人${batchExistingCount > 0 ? `，名单中已有 ${batchExistingCount} 人` : ''}`,
                  en: `${batchStudentNames.length} recognized${batchExistingCount > 0 ? `; ${batchExistingCount} already exist in the roster` : ''}`,
                })
                : tr({
                  zh: `空行和重复姓名会自动忽略，一次最多 ${MAX_BATCH_STUDENTS} 人`,
                  en: `Blank and duplicate lines are ignored; up to ${MAX_BATCH_STUDENTS} students at a time`,
                })}
            </p>
            {batchMatches && batchUnmatchedCount > 0 && (
              <p className="wca-student-batch-unmatched" role="status">
                <span>{tr({ zh: '按未参赛保存：', en: 'Save as not competed: ' })}</span>
                {batchMatches
                  .filter((match) => match.candidates.length === 0)
                  .map((match) => match.inputName)
                  .join(tr({ zh: '、', en: ', ' }))}
              </p>
            )}
            {batchMatches && batchAmbiguousCount > 0 && (
              <div className="wca-student-batch-ambiguous">
                <p className="wca-teacher-dialog-field-label">
                  {tr({ zh: '以下姓名有重名，请选择正确的 WCA 选手', en: 'Choose the correct WCA person for each duplicate name' })}
                </p>
                {batchMatches.map((match, index) => match.candidates.length > 1 && (
                  <div className="wca-student-batch-match" key={match.inputName}>
                    <span>{match.inputName}</span>
                    <WcaPersonPicker
                      key={`${match.inputName}-${match.selected?.id ?? 'unresolved'}`}
                      value={match.selected}
                      onChange={(person) => setBatchMatches((current) => current?.map((entry, entryIndex) => (
                        entryIndex === index ? { ...entry, selected: person } : entry
                      )) ?? null)}
                      staticCubers={match.candidates}
                      defaultQuery={match.inputName}
                      isZh={isZh}
                      placeholder={tr({ zh: '选择 WCA 选手', en: 'Choose a WCA person' })}
                    />
                  </div>
                ))}
              </div>
            )}
            {batchStudentNames.length > MAX_BATCH_STUDENTS && (
              <p className="wca-teacher-dialog-error wca-teacher-dialog-validation-error" role="status">
                {tr({
                  zh: `一次最多添加 ${MAX_BATCH_STUDENTS} 名学生，请删减后保存`,
                  en: `Add no more than ${MAX_BATCH_STUDENTS} students at a time`,
                })}
              </p>
            )}
            {batchNameTooLong && (
              <p className="wca-teacher-dialog-error wca-teacher-dialog-validation-error" role="status">
                {tr({
                  zh: `每个姓名不能超过 ${MAX_NAMED_STUDENT_NAME_LENGTH} 个字符`,
                  en: `Each name must be no longer than ${MAX_NAMED_STUDENT_NAME_LENGTH} characters`,
                })}
              </p>
            )}
            {(!batchMatches || batchUnmatchedCount > 0) && (
              <>
                <label className="wca-named-student-country">
                  <span>{tr({ zh: '未参赛学生默认国籍（必填）', en: 'Default nationality for non-competitors (required)' })}</span>
                  <CountryInput
                    value={batchCountryIso2}
                    onChange={setBatchCountryIso2}
                    placeholder={tr({ zh: '选择默认国籍', en: 'Select default nationality' })}
                  />
                </label>
                {!batchCountryIso2 && (
                  <p className="wca-teacher-dialog-error wca-teacher-dialog-validation-error" role="status">
                    {tr({ zh: '请选择默认国籍后保存', en: 'Select a default nationality before saving' })}
                  </p>
                )}
              </>
            )}
            <p className="wca-teacher-dialog-field-label">
              {tr({ zh: '默认项目（必选）', en: 'Default events (required)' })}
            </p>
            <WcaEventSelector
              availableEvents={new Set(ALL_EVENT_IDS)}
              selectedEvents={batchEventIds}
              onToggle={toggleBatchEvent}
              isZh={isZh}
              onlyAvailable
            />
            {batchEventIds.size === 0 && (
              <p className="wca-teacher-dialog-error wca-teacher-dialog-validation-error" role="status">
                {tr({ zh: '请选择至少一个默认项目后保存', en: 'Select at least one default event before saving' })}
              </p>
            )}
            {batchError && <p className="wca-teacher-dialog-error" role="alert">{batchError}</p>}
            <div className="wca-teacher-dialog-actions">
              {!batchMatches && batchExistingCount > 0 && (
                <button
                  type="button"
                  className="wca-teacher-dialog-action wca-teacher-dialog-remove"
                  disabled={batchSaving || batchMatching}
                  onClick={() => void removePastedNamedStudents()}
                >
                  {batchSaving
                    ? tr({ zh: '撤回中…', en: 'Removing…' })
                    : batchRemoveConfirmed
                      ? tr({ zh: `确认撤回 ${batchExistingCount} 人`, en: `Confirm removal of ${batchExistingCount}` })
                      : tr({ zh: '撤回这份旧名单', en: 'Remove this previous list' })}
                </button>
              )}
              <button
                type="button"
                className="wca-teacher-dialog-action wca-teacher-dialog-primary"
                disabled={batchStudentNames.length === 0
                  || batchStudentNames.length > MAX_BATCH_STUDENTS
                  || batchNameTooLong
                  || batchMatching
                  || batchSaving
                  || (!!batchMatches && batchUnresolvedCount > 0)
                  || (!!batchMatches && batchUnmatchedCount > 0 && !batchCountryIso2)
                  || (!!batchMatches && batchEventIds.size === 0)}
                onClick={() => void (batchMatches ? saveBatch() : prepareBatchMatches())}
              >
                {batchMatching
                  ? tr({ zh: '匹配中…', en: 'Matching…' })
                  : batchSaving
                    ? tr({ zh: '保存中…', en: 'Saving…' })
                    : batchMatches
                      ? tr({ zh: '确认保存', en: 'Confirm and save' })
                      : tr({ zh: '匹配 WCA 选手', en: 'Match WCA people' })}
              </button>
              <button type="button" className="wca-teacher-dialog-action wca-teacher-dialog-cancel" disabled={batchSaving} onClick={closeBatch}>
                {tr({ zh: '取消', en: 'Cancel' })}
              </button>
            </div>
          </dialog>
        </div>,
        document.body,
      )}
    </>
  );
}

export function WcaNamedStudentCell({ student, teacherWcaId, directory, isZh, onSaved }: {
  student: WcaNamedStudent;
  teacherWcaId: string;
  directory: WcaTeacherDirectory;
  isZh: boolean;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<WcaPersonLite | null>(null);
  const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(() => new Set(student.eventIds));
  const [competedEventIds, setCompetedEventIds] = useState<Set<string>>(() => new Set());
  const [competitionEventState, setCompetitionEventState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [countryIso2, setCountryIso2] = useState(() => student.countryIso2?.toLowerCase() ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const canManage = directory.isAdmin || directory.userWcaId === teacherWcaId;
  const selectedTeacherSelf = selectedStudent?.id === teacherWcaId;
  const canSave = selectedEventIds.size > 0
    && !selectedTeacherSelf
    && (!!selectedStudent || !!countryIso2);
  const notCompetedEventIds = useMemo(() => new Set(
    ALL_EVENT_IDS.filter((eventId) => !competedEventIds.has(eventId)),
  ), [competedEventIds]);
  const titleId = `named-student-title-${student.id}`;

  useEffect(() => {
    let cancelled = false;
    if (!selectedStudent) {
      setCompetedEventIds(new Set());
      setCompetitionEventState('idle');
      return;
    }
    setCompetitionEventState('loading');
    fetchWcaPersonResults(selectedStudent.id)
      .then((results) => {
        if (cancelled) return;
        setCompetedEventIds(new Set(results.map((result) => result.event_id)));
        setCompetitionEventState('ready');
      })
      .catch(() => {
        if (cancelled) return;
        setCompetedEventIds(new Set());
        setCompetitionEventState('error');
      });
    return () => { cancelled = true; };
  }, [selectedStudent]);

  if (!canManage) return null;

  const open = () => {
    setSelectedStudent(null);
    setSelectedEventIds(new Set(student.eventIds));
    setCountryIso2(student.countryIso2?.toLowerCase() ?? '');
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
  const save = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    setError('');
    try {
      if (selectedStudent) {
        for (const eventId of selectedEventIds) {
          await directory.save(selectedStudent.id, eventId, directory.isAdmin ? teacherWcaId : undefined);
        }
        await removeWcaNamedStudent(teacherWcaId, student.id);
      } else {
        await updateWcaNamedStudent(teacherWcaId, student.id, student.studentName, countryIso2, [...selectedEventIds]);
      }
      setEditing(false);
      onSaved();
    } catch (caught) {
      setError(teacherErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  };
  const remove = async () => {
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      await removeWcaNamedStudent(teacherWcaId, student.id);
      setEditing(false);
      onSaved();
    } catch (caught) {
      setError(teacherErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="wca-teacher-cell">
      <button type="button" className="wca-teacher-action" onClick={open}>
        {tr({ zh: '编辑', en: 'Edit' })}
      </button>
      {editing && typeof document !== 'undefined' && createPortal(
        <div className="wca-teacher-dialog-layer">
          <dialog
            className="wca-teacher-dialog"
            open
            aria-modal="true"
            aria-labelledby={titleId}
            onKeyDown={(event) => { if (event.key === 'Escape' && !saving) setEditing(false); }}
          >
            <div className="wca-teacher-dialog-heading">
              <h2 id={titleId}>{tr({ zh: '编辑学生', en: 'Edit student' })}</h2>
              <div className="wca-named-student-picker">
                <WcaPersonPicker
                  value={selectedStudent}
                  onChange={(person) => {
                    setSelectedStudent(person);
                    setError(person?.id === teacherWcaId
                      ? tr({ zh: '不能把老师本人添加为学生', en: 'A teacher cannot be added as their own student' })
                      : '');
                  }}
                  defaultQuery={student.studentName}
                  autoOpen
                  isZh={isZh}
                  placeholder={tr({ zh: '姓名或 WCA ID', en: 'Name or WCA ID' })}
                />
              </div>
            </div>
            {!selectedStudent && (
              <>
                <label className="wca-named-student-country">
                  <span>{tr({ zh: '国籍（必填）', en: 'Nationality (required)' })}</span>
                  <CountryInput
                    value={countryIso2}
                    onChange={setCountryIso2}
                    placeholder={tr({ zh: '选择国籍', en: 'Select nationality' })}
                  />
                </label>
                {!countryIso2 && (
                  <p className="wca-teacher-dialog-error wca-teacher-dialog-validation-error" role="status">
                    {tr({ zh: '请选择国籍后保存', en: 'Select a nationality before saving' })}
                  </p>
                )}
              </>
            )}
            {!selectedStudent && (
              <p className="wca-teacher-dialog-status" role="status">
                {tr({
                  zh: '选择 WCA 选手后，可区分已参赛和未参赛项目',
                  en: 'Choose a WCA person to distinguish competed and not-competed events.',
                })}
              </p>
            )}
            {selectedStudent && competitionEventState === 'loading' && (
              <p className="wca-teacher-dialog-status" role="status">
                {tr({ zh: '正在读取参赛项目…', en: 'Loading competition events…' })}
              </p>
            )}
            {selectedStudent && competitionEventState === 'error' && (
              <p className="wca-teacher-dialog-error" role="status">
                {tr({
                  zh: '无法读取参赛项目，暂时按全部项目显示',
                  en: 'Competition events could not be loaded. Showing all events together.',
                })}
              </p>
            )}
            {selectedStudent && competitionEventState === 'ready' ? (
              <>
                <p className="wca-teacher-dialog-field-label">
                  {tr({ zh: '已参加比赛', en: 'Competed events' })}
                </p>
                {competedEventIds.size > 0 ? (
                  <WcaEventSelector
                    availableEvents={competedEventIds}
                    selectedEvents={selectedEventIds}
                    onToggle={toggleEvent}
                    isZh={isZh}
                    onlyAvailable
                  />
                ) : (
                  <p className="wca-teacher-dialog-status">
                    {tr({ zh: '暂无参赛项目', en: 'No competed events' })}
                  </p>
                )}
                <p className="wca-teacher-dialog-field-label">
                  {tr({ zh: '未参加比赛', en: 'Not-competed events' })}
                </p>
                <WcaEventSelector
                  availableEvents={notCompetedEventIds}
                  selectedEvents={selectedEventIds}
                  onToggle={toggleEvent}
                  isZh={isZh}
                  onlyAvailable
                />
              </>
            ) : (
              <WcaEventSelector
                availableEvents={new Set(ALL_EVENT_IDS)}
                selectedEvents={selectedEventIds}
                onToggle={toggleEvent}
                isZh={isZh}
                onlyAvailable
              />
            )}
            {selectedEventIds.size === 0 && (
              <p className="wca-teacher-dialog-error wca-teacher-dialog-validation-error" role="status">
                {tr({ zh: '请选择至少一个授课项目后保存', en: 'Select at least one taught event before saving' })}
              </p>
            )}
            {error && <p className="wca-teacher-dialog-error" role="alert">{error}</p>}
            <div className="wca-teacher-dialog-actions">
              <button
                type="button"
                className="wca-teacher-dialog-action wca-teacher-dialog-primary"
                disabled={!canSave || saving}
                onClick={() => void save()}
              >
                {saving ? tr({ zh: '保存中…', en: 'Saving…' }) : tr({ zh: '保存', en: 'Save' })}
              </button>
              <button
                type="button"
                className="wca-teacher-dialog-action wca-teacher-dialog-remove"
                disabled={saving}
                onClick={() => void remove()}
              >
                {tr({ zh: '删除', en: 'Delete' })}
              </button>
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

export function WcaTeacherCell({ studentWcaId, eventIds, editableEventIds = eventIds, defaultEditEventId, directory, isZh, showEventNames = false, emptyLabel = '—', editorOnly = false, managedTeacherWcaId }: {
  studentWcaId: string;
  eventIds: readonly string[];
  editableEventIds?: readonly string[];
  defaultEditEventId?: string;
  directory: WcaTeacherDirectory;
  isZh: boolean;
  showEventNames?: boolean;
  emptyLabel?: string;
  editorOnly?: boolean;
  managedTeacherWcaId?: string;
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
  const managedRelationEventIds = normalizedEditableEventIds.filter((eventId) => (
    directory.teachers.get(wcaTeacherRelationKey(studentWcaId, eventId))?.teacherWcaId === managedTeacherWcaId
  ));
  const availableEventSet = useMemo(() => new Set(normalizedEditableEventIds.filter((eventId) => {
    if (!managedTeacherWcaId || directory.isAdmin) return true;
    const relation = directory.teachers.get(wcaTeacherRelationKey(studentWcaId, eventId));
    if (!directory.canSelfAssign) return relation?.teacherWcaId === managedTeacherWcaId;
    return !relation || relation.teacherWcaId === managedTeacherWcaId;
  })), [directory.canSelfAssign, directory.isAdmin, directory.teachers, managedTeacherWcaId, normalizedEditableEventIds, studentWcaId]);
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
  const canManageTeacherStudents = !!managedTeacherWcaId && (
    directory.isAdmin
    || (directory.userWcaId === managedTeacherWcaId && (directory.canSelfAssign || managedRelationEventIds.length > 0))
  );
  const canOpenEditor = teacherDataReady && (managedTeacherWcaId
    ? canManageTeacherStudents
    : (directory.isAdmin || directory.canSelfAssign || hasOwnRelation));
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
  const managedSelectionChanged = !!managedTeacherWcaId && (
    managedRelationEventIds.length !== selectedIds.length
    || managedRelationEventIds.some((eventId) => !selectedEventIds.has(eventId))
  );

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
  const saveManagedTeacherStudents = () => {
    if (!managedTeacherWcaId || !managedSelectionChanged) return;
    const eventIdsToSave = selectedIds.filter((eventId) => (
      directory.teachers.get(wcaTeacherRelationKey(studentWcaId, eventId))?.teacherWcaId !== managedTeacherWcaId
    ));
    const eventIdsToRemove = managedRelationEventIds.filter((eventId) => !selectedEventIds.has(eventId));
    void run(
      () => Promise.all([
        ...eventIdsToSave.map((eventId) => directory.save(studentWcaId, eventId, managedTeacherWcaId)),
        ...eventIdsToRemove.map((eventId) => directory.remove(studentWcaId, eventId)),
      ]).then(() => undefined),
      true,
    );
  };
  const openEditor = (eventId = defaultEditEventId ?? normalizedEditableEventIds[0] ?? '') => {
    if (managedTeacherWcaId) {
      setSelectedEventIds(new Set(managedRelationEventIds));
      setSelected(null);
      setError('');
      setEditing(true);
      return;
    }
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
              <h2 id={`teacher-title-${studentWcaId}`}>
                {managedTeacherWcaId
                  ? tr({ zh: '编辑学生', en: 'Edit student' })
                  : tr({ zh: '填写老师', en: 'Set teacher' })}
              </h2>
              {directory.isAdmin && !managedTeacherWcaId && (
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
              {managedTeacherWcaId && (
                <button type="button" className="wca-teacher-dialog-action wca-teacher-dialog-primary" disabled={!managedSelectionChanged || saving} onClick={saveManagedTeacherStudents}>
                  {saving ? tr({ zh: '保存中…', en: 'Saving…' }) : tr({ zh: '保存', en: 'Save' })}
                </button>
              )}
              {directory.isAdmin && !managedTeacherWcaId && (
                <button type="button" className="wca-teacher-dialog-action wca-teacher-dialog-primary" disabled={!selected || selectedIds.length === 0 || saving} onClick={saveAdmin}>
                  {saving ? tr({ zh: '保存中…', en: 'Saving…' }) : tr({ zh: '保存', en: 'Save' })}
                </button>
              )}
              {!managedTeacherWcaId && !directory.isAdmin && directory.canSelfAssign && (
                <button type="button" className="wca-teacher-dialog-action wca-teacher-dialog-primary" disabled={selfAssignableIds.length === 0 || saving} onClick={selfAssign}>
                  {saving ? tr({ zh: '保存中…', en: 'Saving…' }) : tr({ zh: '登记自己', en: 'Add myself' })}
                </button>
              )}
              {!managedTeacherWcaId && !directory.isAdmin && removableIds.length > 0 && (
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
