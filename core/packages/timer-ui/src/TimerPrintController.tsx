'use client';

import {
  TIMER_PRINT_DOCUMENT_COPY,
  timerEventPickerName,
  type EventId,
  type Solve,
} from '@cuberoot/shared/timer';
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactPortal,
} from 'react';
import { createPortal } from 'react-dom';

import { TimerPrintDocument } from './TimerPrintDocument';

export interface TimerPrintControllerHandle {
  print(): void;
}

export interface TimerPrintControllerProps {
  currentResult: string;
  currentScramble: string;
  currentScrambleSource?: string;
  event: EventId;
  language: 'en' | 'zh';
  onError?: () => void;
  sessionName?: string;
  solves: readonly Solve[];
  transport: (title: string) => Promise<void> | void;
}

interface TimerPrintSnapshot extends TimerPrintControllerProps {
  generatedAt: number;
  solves: Solve[];
}

function nextAnimationFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

/**
 * Shared print lifecycle for Web, Android and iOS. The expensive report only
 * exists after a user request; it is frozen, portaled to body, allowed to lay
 * out, then handed to the host's thin print transport.
 */
export const TimerPrintController = forwardRef<
  TimerPrintControllerHandle,
  TimerPrintControllerProps
>(function TimerPrintController(props, ref): ReactPortal | null {
  const latestRef = useRef(props);
  const printingRef = useRef(false);
  const [snapshot, setSnapshot] = useState<TimerPrintSnapshot | null>(null);
  latestRef.current = props;

  useImperativeHandle(ref, () => ({
    print() {
      if (printingRef.current) return;
      printingRef.current = true;
      const latest = latestRef.current;
      setSnapshot({
        ...latest,
        generatedAt: Date.now(),
        solves: latest.solves.map((solve) => ({ ...solve })),
      });
    },
  }), []);

  useEffect(() => {
    if (!snapshot) return;
    let cancelled = false;
    const body = document.body;

    const run = async () => {
      body.classList.add('timer-printing');
      await nextAnimationFrame();
      await nextAnimationFrame();
      await document.fonts?.ready;
      await nextAnimationFrame();
      if (cancelled) return;

      const copy = TIMER_PRINT_DOCUMENT_COPY[snapshot.language];
      const title = `${copy.timer} · ${timerEventPickerName(snapshot.event, snapshot.language)}`;
      await snapshot.transport(title);
    };

    void run()
      .catch(() => snapshot.onError?.())
      .finally(() => {
        body.classList.remove('timer-printing');
        printingRef.current = false;
        if (!cancelled) setSnapshot(null);
      });

    return () => {
      cancelled = true;
      body.classList.remove('timer-printing');
      printingRef.current = false;
    };
  }, [snapshot]);

  if (!snapshot || typeof document === 'undefined') return null;
  return createPortal(
    <div className="timer-print-portal">
      <TimerPrintDocument
        currentResult={snapshot.currentResult}
        currentScramble={snapshot.currentScramble}
        currentScrambleSource={snapshot.currentScrambleSource}
        event={snapshot.event}
        generatedAt={snapshot.generatedAt}
        language={snapshot.language}
        sessionName={snapshot.sessionName}
        solves={snapshot.solves}
      />
    </div>,
    document.body,
  );
});
