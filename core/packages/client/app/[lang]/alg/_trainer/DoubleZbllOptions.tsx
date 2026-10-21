'use client';
import { HelpCircle } from '@app-foundation/icons/lucide';
import AppLink from '@/components/AppLink';
import BoolToggle from '@/components/BoolToggle';
import { Tooltip } from '@/components/Tooltip';
import { tr } from '@/i18n/tr';
import { useTrainerStore, TimerState } from '@/lib/trainer-store';
import { doubleZbllPllCases } from '@/lib/double-zbll';

/** Double ZBLL preferences and help; offline caching is owned by the training page. */
export default function DoubleZbllOptions({ showPll = true }: { showPll?: boolean }) {
  const timerState = useTrainerStore(s => s.timerState);
  const roomLocked = useTrainerStore(s => !!s.room || s.roomBusy);
  const includePll = useTrainerStore(s => s.doubleZbllIncludePll);
  const setIncludePll = useTrainerStore(s => s.setDoubleZbllIncludePll);
  return (
    <>
      {showPll && <BoolToggle label={tr({ zh: '包含 PLL', en: 'Include PLL' })} value={includePll}
        onChange={setIncludePll} disabled={roomLocked || timerState !== TimerState.NOT_RUNNING || doubleZbllPllCases().length !== 21} />}
      <Tooltip content={tr({ zh: 'ZBLL 打乱方式、分布与极端情况', en: 'ZBLL scramble modes, distributions and extremes' })}>{tip =>
        <AppLink {...tip} href="/alg/double-zbll-about" prefetch={false} className="trainer-double-help"
          aria-label={tr({ zh: 'ZBLL 打乱方式、分布与极端情况', en: 'ZBLL scramble modes, distributions and extremes' })}>
          <HelpCircle size={18} strokeWidth={1.75} aria-hidden />
        </AppLink>
      }</Tooltip>
    </>
  );
}
