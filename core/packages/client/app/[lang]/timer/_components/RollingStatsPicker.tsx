'use client';

import { TimerRollingStatsPicker } from '@cuberoot/timer-ui';

import { tr } from '@/i18n/tr';
import { updateSettings, useSettings } from '../_lib/settings';
import type { RollingStatKey } from '../_lib/rolling_stats';

interface Props {
  className?: string;
  triggerColumns: RollingStatKey[];
  variant?: 'header' | 'row';
}

export default function RollingStatsPicker({
  className,
  triggerColumns,
  variant = 'header',
}: Props) {
  const settings = useSettings();

  return (
    <TimerRollingStatsPicker
      className={className}
      columns={settings.statsRollingColumns}
      labels={{
        changeColumn: current => tr({
          zh: `更改统计列，当前 ${current}`,
          en: `Change stats column, currently ${current}`,
        }),
        clear: tr({ zh: '清除', en: 'Clear' }),
        customPlaceholder: tr({ zh: '自定义 ao', en: 'Custom ao' }),
        customSize: tr({ zh: '自定义 ao 大小', en: 'Custom ao size' }),
        replace: tr({ zh: '替换', en: 'Replace' }),
      }}
      onColumnsChange={statsRollingColumns => updateSettings({ statsRollingColumns })}
      triggerColumns={triggerColumns}
      variant={variant}
    />
  );
}
