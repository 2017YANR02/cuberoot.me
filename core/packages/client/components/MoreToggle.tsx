'use client';

import SharedMoreToggle, { type ButtonProps, type SummaryProps } from '@cuberoot/timer-ui/MoreToggle';
import { tr } from '@/i18n/tr';

/** Website labels; native semantics and chevrons are shared with timer surfaces. */
export default function MoreToggle(props: ButtonProps | SummaryProps) {
  if (props.as === 'summary') return <SharedMoreToggle {...props} />;
  return <SharedMoreToggle {...props}>{props.children ?? (props['aria-label'] ? null : props.expanded
    ? tr({ zh: '收起', en: 'Show less' }) : tr({ zh: '更多', en: 'More' }))}</SharedMoreToggle>;
}
