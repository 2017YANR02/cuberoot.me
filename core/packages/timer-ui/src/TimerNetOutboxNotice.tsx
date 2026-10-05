'use client';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { NET_RECORDING_SAVE_COPY, type NetRecordingOutbox } from '@cuberoot/shared/timer';
import { TimerInfoToast } from './TimerInfoToast';

/** Recovery lives above timer mode changes so pending work also resumes from Solo/history. */
export function TimerNetOutboxNotice({ outbox, language, suppressed, viewportBottomInset, onSaved }: {
  outbox: NetRecordingOutbox; language: 'en' | 'zh'; suppressed?: boolean; viewportBottomInset?: number; onSaved?(): void;
}) {
  const state = useSyncExternalStore(outbox.subscribe, outbox.getSnapshot, outbox.getSnapshot);
  const onSavedRef = useRef(onSaved); onSavedRef.current = onSaved;
  useEffect(() => { if (state.saved > 0) onSavedRef.current?.(); }, [state.saved]);
  useEffect(() => {
    const retry = () => { if (!document.hidden) void outbox.retry(); };
    retry();
    const interval = window.setInterval(retry, 10_000);
    window.addEventListener('online', retry); document.addEventListener('visibilitychange', retry);
    return () => { window.clearInterval(interval); window.removeEventListener('online', retry); document.removeEventListener('visibilitychange', retry); };
  }, [outbox]);
  if (suppressed || (!state.pending && !state.volatile && !state.blocked)) return null;
  const rejectedOnly = state.pending > 0 && state.pending === state.rejected && !state.volatile && !state.blocked;
  const message = state.volatile ? NET_RECORDING_SAVE_COPY.volatile : state.blocked ? NET_RECORDING_SAVE_COPY.blocked : rejectedOnly ? NET_RECORDING_SAVE_COPY.rejected : NET_RECORDING_SAVE_COPY.message;
  return <TimerInfoToast durationMs={null} message={message[language]} viewportBottomInset={viewportBottomInset}
    undoLabel={(rejectedOnly ? NET_RECORDING_SAVE_COPY.acknowledge : NET_RECORDING_SAVE_COPY.retry)[language]}
    actionBusy={state.busy} actionDisabled={state.busy} onDismiss={() => undefined}
    onUndo={() => { void (rejectedOnly ? outbox.acknowledgeRejected() : outbox.retry()); }} />;
}
