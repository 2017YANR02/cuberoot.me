'use client';

/**
 * 3x3 打乱引擎 toggle:WCA 官方版 (cubing.js) ↔ min2phase-rust。
 * 只在用户选中 3x3 时显示;localStorage 持久。默认 WCA。
 *
 * - WCA (default,toggle off): cubing.js,Lucas Garron 的 TS 实现
 * - min2phase   (toggle on):  cs0x7f Kociemba 的 Rust port,~10× 快,同算法家族
 *
 * 切换会清掉 333 / 333ft pool(在 cubingScramble.ts 监听 mode-change),
 * 下一次 Generate 用新引擎重新填池。
 */
import { use333Mode } from '@/lib/scramble-333-mode';
import PillToggle from './PillToggle/PillToggle';

interface Props {
  /** 当前选中事件里是否有 3x3;不是的话整个 picker 不渲染 */
  active333: boolean;
  isZh: boolean;
}

export default function Scramble333ModePicker({ active333, isZh }: Props) {
  const [mode, setMode] = use333Mode();
  if (!active333) return null;
  const t = (zh: string, en: string) => (isZh ? zh : en);
  return (
    <div className="gen-555-mode-row">
      <span className="gen-555-mode-label">{t('3x3 引擎', '3x3 engine')}</span>
      <PillToggle
        value={mode === 'm2p'}
        onChange={(v) => setMode(v ? 'm2p' : 'wca')}
        onLabel="min2phase"
        offLabel="WCA"
        ariaLabel={t('3x3 打乱引擎', '3x3 scramble engine')}
      />
    </div>
  );
}
