'use client';

/** Web persistence adapter for the shared five-client session control. */

import type { EventId } from '@cuberoot/shared/timer';
import {
  TimerSessionSwitcher as SharedTimerSessionSwitcher,
  timerSessionSwitcherLabels,
  type TimerSessionSwitcherHost,
} from '@cuberoot/timer-ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';

import {
  clearSession,
  createAndActivateSession,
  deleteSession,
  getSessionSnapshot,
  renameSession,
  setActiveSession,
} from '../_lib/storage/db';

interface Props {
  query?: string;
  onQueryChange?(query: string): void;
  isZh: boolean;
  event: EventId;
  open: boolean;
  onOpenChange(open: boolean): void;
  /** Called after an active-data mutation; id is present only when active changed. */
  onSessionsChanged: (activeSessionId?: string) => void;
}

export default function SessionSwitcher({
  query = '', onQueryChange,
  event,
  isZh,
  onOpenChange,
  onSessionsChanged,
  open,
}: Props) {
  const [state, setState] = useState(getSessionSnapshot);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInput = useRef<HTMLInputElement>(null);
  useEffect(() => { if (searchOpen) searchInput.current?.focus(); }, [searchOpen]);
  const labels = useMemo(
    () => ({ ...timerSessionSwitcherLabels((['en', 'zh'] as const)[Number(isZh)]),
      newSession: isZh ? '新建' : 'New' }),
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
      inlineActions
      hideActions={searchOpen}
      trailing={onQueryChange && <div className={`tsession-search${searchOpen ? ' is-open' : ''}`}>
        <div className="tsession-search-field" inert={!searchOpen}>
        <input ref={searchInput} type="search" value={query} tabIndex={searchOpen ? 0 : -1}
          onChange={event => onQueryChange(event.target.value)}
          placeholder={isZh ? '时间、打乱、注释' : 'Time, scramble, comment'}
          aria-label={isZh ? '搜索成绩' : 'Search solves'} />
        </div>
        {/* allow-manual-search: Only opens or closes the input; onChange updates results while typing. */}
        <button type="button" className="tsession-icon-btn" aria-expanded={searchOpen}
          aria-label={isZh ? '搜索成绩' : 'Search solves'}
          onClick={() => { setSearchOpen(!searchOpen); if (searchOpen) onQueryChange(''); }}>
          <Search size={16} aria-hidden="true" />
        </button>
      </div>}
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
