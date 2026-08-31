import {
  TIMER_SESSION_UI_COPY,
  timerSessionClearConfirmation,
  timerSessionDeleteConfirmation,
} from '@cuberoot/shared/timer';
import type { TimerSessionSwitcherLabels } from '@cuberoot/timer-ui';

import type { SupportedLanguage } from './copy';

/** Mobile language adapter over the same bilingual session copy Web consumes. */
export function timerSessionSwitcherLabels(
  language: SupportedLanguage,
): TimerSessionSwitcherLabels {
  return {
    session: TIMER_SESSION_UI_COPY.session[language],
    sessions: TIMER_SESSION_UI_COPY.sessions[language],
    switchSession: TIMER_SESSION_UI_COPY.switchSession[language],
    newSession: TIMER_SESSION_UI_COPY.newSession[language],
    newSessionDefault: TIMER_SESSION_UI_COPY.newSessionDefault[language],
    sessionName: TIMER_SESSION_UI_COPY.sessionName[language],
    newSessionName: TIMER_SESSION_UI_COPY.newSessionName[language],
    clear: TIMER_SESSION_UI_COPY.clear[language],
    confirm: TIMER_SESSION_UI_COPY.confirm[language],
    confirmRename: TIMER_SESSION_UI_COPY.confirmRename[language],
    rename: TIMER_SESSION_UI_COPY.rename[language],
    renameSession: TIMER_SESSION_UI_COPY.renameSession[language],
    clearSolves: TIMER_SESSION_UI_COPY.clearSolves[language],
    clearSessionSolves: TIMER_SESSION_UI_COPY.clearSessionSolves[language],
    keepOneSession: TIMER_SESSION_UI_COPY.keepOneSession[language],
    deleteSession: TIMER_SESSION_UI_COPY.deleteSession[language],
    create: TIMER_SESSION_UI_COPY.create[language],
    createSession: TIMER_SESSION_UI_COPY.createSession[language],
    operationFailed: TIMER_SESSION_UI_COPY.operationFailed[language],
    clearConfirmation: (name) => timerSessionClearConfirmation(name)[language],
    deleteConfirmation: (name) => timerSessionDeleteConfirmation(name)[language],
  };
}
