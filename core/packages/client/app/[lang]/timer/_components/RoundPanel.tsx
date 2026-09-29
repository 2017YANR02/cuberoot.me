'use client';
import { TimerRoundPanel, type RoundPanelProps } from '@cuberoot/timer-ui';
import { tr, useLang } from '@/i18n/tr';
export default function RoundPanel(props: Omit<RoundPanelProps, 'localize'>) {
  useLang();
  return <TimerRoundPanel {...props} localize={tr} />;
}