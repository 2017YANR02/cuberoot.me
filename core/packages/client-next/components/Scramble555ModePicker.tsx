'use client';

/**
 * 5x5 打乱模式 toggle:随机状态 ↔ 随机转动。只在用户选中 5x5 时显示;
 * localStorage 持久。默认 random-move(WCA 60 步,cubing.js)。
 *
 * - 随机转动 (default,toggle off): cubing.js WCA-spec 60 步
 * - 随机状态           (toggle on):  cube555 daemon,平均 ~70 步,真随机态
 *
 * 切换会清掉 /scramble/gen 的 555 pool(在 cubingScramble.ts 监听 mode-change
 * 事件实现),下一次 Generate 用新模式重新填池。
 */
import Link from 'next/link';
import { HelpCircle } from 'lucide-react';
import { use555Mode } from '@/lib/scramble-555-mode';
import PillToggle from './PillToggle/PillToggle';

interface Props {
  /** 当前选中事件里是否有 5x5;不是的话整个 picker 不渲染 */
  active555: boolean;
  isZh: boolean;
}

export default function Scramble555ModePicker({ active555, isZh }: Props) {
  const [mode, setMode] = use555Mode();
  if (!active555) return null;
  const t = (zh: string, en: string) => (isZh ? zh : en);
  return (
    <div className="gen-555-mode-row">
      <span className="gen-555-mode-label">{t('5x5 打乱', '5x5 scramble')}</span>
      <PillToggle
        value={mode === 'rs'}
        onChange={(v) => setMode(v ? 'rs' : 'rm')}
        onLabel={t('随机状态', 'random-state')}
        offLabel={t('随机转动', 'random-move')}
        ariaLabel={t('5x5 打乱类型', '5x5 scramble type')}
      />
      <Link
        href="/scramble/555-about"
        className="gen-555-mode-info"
        title={t('什么是随机状态 / 随机转动?', "What's random-state vs random-move?")}
        aria-label={t('查看 5x5 打乱方法说明', 'About 5x5 scramble methods')}
      >
        <HelpCircle size={16} />
      </Link>
    </div>
  );
}
