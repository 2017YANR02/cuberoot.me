'use client';

/** Web persistence adapter for the shared Web/Android/iOS session control. */

import {
  TIMER_SESSION_UI_COPY,
  timerSessionClearConfirmation,
  timerSessionDeleteConfirmation,
  type EventId,
  type TimerSessionMeta,
} from '@cuberoot/shared/timer';
import {
  TimerSessionSwitcher as SharedTimerSessionSwitcher,
  type TimerSessionSwitcherHost,
  type TimerSessionSwitcherLabels,
} from '@cuberoot/timer-ui';
import { useCallback, useMemo, useState } from 'react';

import { tr } from '@/i18n/tr';
import {
  clearSession,
  createAndActivateSession,
  deleteSession,
  getActiveSessionId,
  listSessions,
  renameSession,
  setActiveSession,
} from '../_lib/storage/db';

interface Props {
  isZh: boolean;
  event: EventId;
  /** Called after an active-data mutation; id is present only when active changed. */
  onSessionsChanged: (activeSessionId?: string) => void;
}

function readSessionState(): { sessions: TimerSessionMeta[]; activeSessionId: string } {
  return { sessions: listSessions(), activeSessionId: getActiveSessionId() };
}

function sharedLabels(): TimerSessionSwitcherLabels {
  return {
    session: tr(TIMER_SESSION_UI_COPY.session),
    sessions: tr(TIMER_SESSION_UI_COPY.sessions),
    switchSession: tr(TIMER_SESSION_UI_COPY.switchSession),
    newSession: tr(TIMER_SESSION_UI_COPY.newSession),
    newSessionDefault: tr(TIMER_SESSION_UI_COPY.newSessionDefault),
    sessionName: tr(TIMER_SESSION_UI_COPY.sessionName),
    newSessionName: tr(TIMER_SESSION_UI_COPY.newSessionName),
    clear: tr(TIMER_SESSION_UI_COPY.clear),
    confirm: tr(TIMER_SESSION_UI_COPY.confirm),
    confirmRename: tr(TIMER_SESSION_UI_COPY.confirmRename),
    rename: tr(TIMER_SESSION_UI_COPY.rename),
    renameSession: tr(TIMER_SESSION_UI_COPY.renameSession),
    clearSolves: tr(TIMER_SESSION_UI_COPY.clearSolves),
    clearSessionSolves: tr(TIMER_SESSION_UI_COPY.clearSessionSolves),
    keepOneSession: tr(TIMER_SESSION_UI_COPY.keepOneSession),
    deleteSession: tr(TIMER_SESSION_UI_COPY.deleteSession),
    create: tr(TIMER_SESSION_UI_COPY.create),
    createSession: tr(TIMER_SESSION_UI_COPY.createSession),
    operationFailed: tr(TIMER_SESSION_UI_COPY.operationFailed),
    clearConfirmation: (name) => tr(timerSessionClearConfirmation(name)),
    deleteConfirmation: (name) => tr(timerSessionDeleteConfirmation(name)),
  };
}

export default function SessionSwitcher({ event, isZh, onSessionsChanged }: Props) {
  const [state, setState] = useState(readSessionState);
  const labels = useMemo(sharedLabels, [isZh]);
  const refresh = useCallback(() => setState(readSessionState()), []);

  const host = useMemo<TimerSessionSwitcherHost>(() => ({
    activate: async (sessionId) => {
      setActiveSession(sessionId);
      refresh();
      onSessionsChanged(sessionId);
    },
    create: async (name, sessionEvent) => {
      const sessionId = createAndActivateSession(name, sessionEvent);
      refresh();
      onSessionsChanged(sessionId);
    },
    rename: async (sessionId, name) => {
      renameSession(sessionId, name);
      refresh();
      onSessionsChanged();
    },
    clear: async (sessionId) => {
      clearSession(sessionId);
      refresh();
      if (sessionId === state.activeSessionId) onSessionsChanged();
    },
    delete: async (sessionId) => {
      const changedActive = sessionId === state.activeSessionId;
      const activeSessionId = deleteSession(sessionId);
      refresh();
      if (changedActive && activeSessionId) onSessionsChanged(activeSessionId);
    },
  }), [onSessionsChanged, refresh, state.activeSessionId]);

  return (
    <SharedTimerSessionSwitcher
      activeSessionId={state.activeSessionId}
      event={event}
      host={host}
      labels={labels}
      sessions={state.sessions}
    />
  );
}
