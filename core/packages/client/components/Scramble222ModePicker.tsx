'use client';

/**
 * 2x2 打乱口径 toggle:WCA 官方 11 步 ↔ 最优(最短)。
 * 只在用户选中 2x2 时显示;localStorage 持久。默认最优。两者都经 TNoodle 握位模型选最顺手的等价打乱。
 */
import { tr } from '@/i18n/tr';
import { use222Mode } from '@/lib/scramble-222-mode';
import ScrambleModePickerRow from './ScrambleModePickerRow';

interface Props {
  active222: boolean;
  /** 计时器等「项目已由上方图标表明」的场景传 false,省掉「2x2 口径」文字(见 ScrambleSourceBar)。 */
  showLabel?: boolean;
}

export default function Scramble222ModePicker({ active222, showLabel = true }: Props) {
  const [mode, setMode] = use222Mode();
  if (!active222) return null;
  return (
    <ScrambleModePickerRow
      iconEvent={showLabel ? '222' : undefined}
      label={showLabel ? tr({ zh: '口径', en: 'style' }) : undefined}
      value={mode === 'optimal'}
      onChange={(v) => setMode(v ? 'optimal' : 'wca')}
      onLabel={tr({ zh: '最优', en: 'Optimal' })}
      offLabel={tr({ zh: 'WCA 11 步', en: 'WCA 11-move' })}
      ariaLabel={tr({ zh: '2x2 打乱口径', en: '2x2 scramble style' })}
    />
  );
}
