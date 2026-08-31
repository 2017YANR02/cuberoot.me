'use client';

import AppLink from '@/components/AppLink';
import { tr } from '@/i18n/tr';
import {
  TimerMoreMenu,
  type TimerMoreMenuItem,
  type TimerMoreMenuLinkRenderProps,
} from '@cuberoot/timer-ui';

export type MoreMenuItem = TimerMoreMenuItem;

interface Props {
  items: readonly MoreMenuItem[];
}

/** Next routing adapter; all menu UI/interaction lives in timer-ui. */
export default function MoreMenu({ items }: Props) {
  const triggerLabel = tr({ zh: '更多', en: 'More' });
  const renderLink = (props: TimerMoreMenuLinkRenderProps) => (
    <AppLink {...props} prefetch={false} />
  );

  return (
    <TimerMoreMenu
      items={items}
      renderLink={renderLink}
      triggerClassName="tb-btn"
      triggerLabel={triggerLabel}
    />
  );
}
