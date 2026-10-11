'use client';

import { useCallback, useMemo, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useQueryState } from 'nuqs';
import { tr } from '@/i18n/tr';
import { TIMER_TRAINING_HELP } from '@/lib/timer-training-help';
import { resolveTrainingTarget } from '@/lib/timer-training-catalog';
import { timerTrainingHref } from '@/lib/timer-training-location';
import { TrainingHostProvider } from '@/lib/training-host';
import TimerTrainingContent from './TimerTrainingContent';
import TimerTrainingMenu from './TimerTrainingMenu';
// Own the common trainer styles at the workspace boundary so switching lazy
// select/run surfaces cannot render the trainer before its layout is available.
// Standalone trainers continue importing these same styles themselves.
import '@/app/[lang]/alg/_trainer/trainer.css';
import '@/app/[lang]/alg/_trainer/memory.css';
import '@/app/[lang]/alg/alg.css';

/** The timer owns navigation; each training surface retains its existing engine. */
export default function TimerTrainingWorkspace() {
  const [training] = useQueryState('training');
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const target = useMemo(() => training && training !== 'home' ? resolveTrainingTarget(training) : null, [training]);
  const [settingsPortal, setSettingsPortal] = useState<HTMLDivElement | null>(null);
  const practiceSettings = useMemo(() => <TimerTrainingMenu settingsOnly />, []);
  const mapHref = useCallback((href: string) => timerTrainingHref(href, {
    timerPathname: pathname,
    currentSearch: search,
    currentTrainingPath: target?.path,
    acceptsPath: path => !!resolveTrainingTarget(path),
  }), [pathname, search, target?.path]);

  const host = useMemo(() => target ? {
    path: target.path,
    params: target.params,
    mapHref,
    settingsPortal,
    practiceSettings,
  } : null, [target, mapHref, settingsPortal, practiceSettings]);

  return (
    <main className="timer-training-workspace" data-timer-training>
      {/* This non-sticky toolbar must not create a backdrop root: its menu needs
          to blur and cover the training cards outside the toolbar. */}
      <div className="timer-training-workspace__toolbar" data-no-timer>
        <TimerTrainingMenu />
        {target?.kind === 'alg-run' && <div className="timer-training-workspace__settings" ref={setSettingsPortal} />}
      </div>
      {host && target ? (
        <TrainingHostProvider value={host}>
          <div className="timer-training-workspace__content" key={target.path}>
            <TimerTrainingContent target={target} />
          </div>
        </TrainingHostProvider>
      ) : (
        <div className="timer-training-workspace__intro">
          <h1>{tr({ zh: '训练', en: 'Training' })}</h1>
          <p>{training && training !== 'home'
            ? tr({ zh: '未找到这项训练，请重新选择。', en: 'Training not found. Please choose another.' })
            : tr({ zh: '选择项目的公式集或专项训练。', en: 'Choose an algorithm set or a practice mode.' })}</p>
          {TIMER_TRAINING_HELP.paragraphs.map((paragraph, index) => <p key={index}>{tr(paragraph)}</p>)}
        </div>
      )}
    </main>
  );
}
