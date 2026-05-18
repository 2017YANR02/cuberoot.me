/**
 * 5x5 打乱模式 toggle:随机状态 ↔ 随机转动 60。只在用户选中 5x5 时显示;
 * localStorage 持久。
 *
 * - 随机状态 (default,toggle on): cube555 daemon,平均 ~70 步,真随机态
 * - 随机转动 60         (toggle off): cubing.js WCA-spec 60 步
 *
 * 切换会清掉 /scramble/gen 的 555 pool(在 cubingScramble.ts 监听 mode-change
 * 事件实现),下一次 Generate 用新模式重新填池。
 */
import { use555Mode } from '../utils/scramble_555_mode';
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
        offLabel={t('随机转动 60', 'random-move 60')}
        ariaLabel={t('5x5 打乱类型', '5x5 scramble type')}
      />
    </div>
  );
}
