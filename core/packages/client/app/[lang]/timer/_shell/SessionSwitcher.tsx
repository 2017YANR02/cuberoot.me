'use client';

/** Web persistence adapter for the shared five-client session control. */

import type { EventId } from '@cuberoot/shared/timer';
import {
  TimerSessionSwitcher as SharedTimerSessionSwitcher,
  timerSessionSwitcherLabels,
  type TimerSessionSwitcherHost,
} from '@cuberoot/timer-ui';
import { useCallback, useMemo, useState } from 'react';

import {
  clearSession,
  createAndActivateSession,
  deleteSession,
  getSessionSnapshot,
  renameSession,
  setActiveSession,
} from '../_lib/storage/db';

interface Props {
  isZh: boolean;
  event: EventId;
  open: boolean;
  onOpenChange(open: boolean): void;
  /** Called after an active-data mutation; id is present only when active changed. */
  onSessionsChanged: (activeSessionId?: string) => void;
}

export default function SessionSwitcher({
  event,
  isZh,
  onOpenChange,
  onSessionsChanged,
  open,
}: Props) {
  const [state, setState] = useState(getSessionSnapshot);
  const labels = useMemo(
    () => timerSessionSwitcherLabels((['en', 'zh'] as const)[Number(isZh)]),
    [isZh],
  );
  const refresh = useCallback(() => setState(getSessionSnapshot()), []);

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
      onOpenChange={(nextOpen) => onOpenChange(nextOpen)}
      open={open}
      sessions={state.sessions}
    />
  );
}
