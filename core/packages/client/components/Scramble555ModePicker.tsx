'use client';

/**
 * 5x5 打乱模式 toggle:随机状态 ↔ 随机转动。只在用户选中 5x5 时显示;
 * localStorage 持久。默认 random-move(WCA 60 步,cubing.js)。
 */
import { use555Mode } from '@/lib/scramble-555-mode';
import ScrambleModePickerRow from './ScrambleModePickerRow';

interface Props {
  active555: boolean;
  isZh: boolean;
}

export default function Scramble555ModePicker({ active555, isZh }: Props) {
  const [mode, setMode] = use555Mode();
  if (!active555) return null;
  const t = (zh: string, en: string) => (isZh ? zh : en);
  return (
    <ScrambleModePickerRow
      label={t('5x5 打乱', '5x5 scramble')}
      value={mode === 'rs'}
      onChange={(v) => setMode(v ? 'rs' : 'rm')}
      onLabel={t('随机状态', 'random-state')}
      offLabel={t('随机转动', 'random-move')}
      ariaLabel={t('5x5 打乱类型', '5x5 scramble type')}
      helpHref="/scramble/555-about"
      helpTitle={t('什么是随机状态 / 随机转动?', "What's random-state vs random-move?")}
      helpAriaLabel={t('查看 5x5 打乱方法说明', 'About 5x5 scramble methods')}
    />
  );
}
