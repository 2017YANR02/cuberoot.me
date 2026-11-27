'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight } from '@app-foundation/icons/lucide';
import { tr } from '@/i18n/tr';
import { Demonstration } from './CompleteDemo';
import { buildWhiteUpWalkthrough } from './complete-demo-state';
import { LBL_LESSON_RUNS } from './lesson-runs';
import type { RandomWalkthrough, WalkthroughWorkerReply, WalkthroughWorkerRequest } from './random-walkthrough.worker';

const IGNORE_CASE_CUE = () => {};
export default function Walkthrough({ onPrevious }: { onPrevious: () => void }) {
  const [{ demo, scramble }, setWalkthrough] = useState(() => buildWhiteUpWalkthrough(LBL_LESSON_RUNS[0].scramble));
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const worker = useRef<Worker | null>(null);
  const pending = useRef<number | null>(null);
  const seen = useRef(new Set<string>());
  useEffect(() => () => {
    if (pending.current !== null) window.clearTimeout(pending.current);
    pending.current = null;
    worker.current?.terminate();
    worker.current = null;
  }, []);

  const nextRandomCase = () => {
    if (pending.current !== null) return;
    setLoading(true);
    setFailed(false);
    seen.current.add(scramble);
    const finish = (walkthrough?: RandomWalkthrough) => {
      if (pending.current !== null) window.clearTimeout(pending.current);
      pending.current = null;
      setLoading(false);
      if (walkthrough) {
        seen.current.add(walkthrough.scramble);
        setWalkthrough(walkthrough);
      } else {
        setFailed(true);
      }
    };
    const workerFailed = () => {
      worker.current?.terminate();
      worker.current = null;
      finish();
    };
    try {
      const instance = worker.current ??= new Worker(new URL('./random-walkthrough.worker.ts', import.meta.url), { type: 'module' });
      instance.onmessage = ({ data }: MessageEvent<WalkthroughWorkerReply>) => {
        if (worker.current !== instance || pending.current === null) return;
        if ('walkthrough' in data) finish(data.walkthrough);
        else workerFailed();
      };
      instance.onerror = instance.onmessageerror = () => { if (worker.current === instance) workerFailed(); };
      pending.current = window.setTimeout(workerFailed, 30000);
      instance.postMessage({ exclude: [...seen.current] } satisfies WalkthroughWorkerRequest);
    } catch {
      workerFailed();
    }
  };

  return <>
    <Demonstration key={scramble} stage="walkthrough" demo={demo} onCaseCueChange={IGNORE_CASE_CUE}
      walkthroughCase={{ scramble, onRandomCase: nextRandomCase, loading, failed }} />
    <footer className="course-footer">
      <button className="course-control" type="button" onClick={onPrevious}
        aria-label={tr({ zh: '上一节', en: 'Previous section' })}><ArrowLeft size={17} aria-hidden="true" /></button>
      <button className="course-control" type="button" disabled
        aria-label={tr({ zh: '下一节', en: 'Next section' })}><ArrowRight size={17} aria-hidden="true" /></button>
    </footer>
  </>;
}
