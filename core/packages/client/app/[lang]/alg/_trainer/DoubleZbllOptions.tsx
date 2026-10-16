'use client';
import { HelpCircle } from 'lucide-react';
import AppLink from '@/components/AppLink';
import BoolToggle from '@/components/BoolToggle';
import { Tooltip } from '@/components/Tooltip';
import { tr } from '@/i18n/tr';
import { useTrainerStore, TimerState } from '@/lib/trainer-store';
import { doubleZbllPllCases } from '@/lib/double-zbll';

/** Double ZBLL preferences and help; offline caching is owned by the training page. */
export default function DoubleZbllOptions() {
  const timerState = useTrainerStore(s => s.timerState);
  const includePll = useTrainerStore(s => s.doubleZbllIncludePll);
  const setIncludePll = useTrainerStore(s => s.setDoubleZbllIncludePll);
  return (
    <>
      <BoolToggle label={tr({ zh: '包含 PLL', en: 'Include PLL' })} value={includePll}
        onChange={setIncludePll} disabled={timerState !== TimerState.NOT_RUNNING || doubleZbllPllCases().length !== 21} />
      <Tooltip content={tr({ zh: '双底原理与对称去重', en: 'Double ZBLL symmetry explained' })}>{tip =>
        <AppLink {...tip} href="/alg/double-zbll-about" prefetch={false} className="trainer-double-help"
          aria-label={tr({ zh: '双底原理与对称去重', en: 'Double ZBLL symmetry explained' })}>
          <HelpCircle size={18} strokeWidth={1.75} aria-hidden />
        </AppLink>
      }</Tooltip>
    </>
  );
}
