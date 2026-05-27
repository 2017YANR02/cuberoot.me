'use client';

/**
 * 3x3 打乱引擎 toggle:WCA 官方版 (cubing.js) ↔ min2phase-rust。
 * 只在用户选中 3x3 时显示;localStorage 持久。默认 WCA。
 */
import { use333Mode } from '@/lib/scramble-333-mode';
import ScrambleModePickerRow from './ScrambleModePickerRow';

interface Props {
  active333: boolean;
  isZh: boolean;
}

export default function Scramble333ModePicker({ active333, isZh }: Props) {
  const [mode, setMode] = use333Mode();
  if (!active333) return null;
  const t = (zh: string, en: string) => (isZh ? zh : en);
  return (
    <ScrambleModePickerRow
      label={t('3x3 引擎', '3x3 engine')}
      value={mode === 'm2p'}
      onChange={(v) => setMode(v ? 'm2p' : 'wca')}
      onLabel="min2phase"
      offLabel="WCA"
      ariaLabel={t('3x3 打乱引擎', '3x3 scramble engine')}
    />
  );
}
