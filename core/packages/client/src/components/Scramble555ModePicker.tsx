/**
 * 5x5 打乱类型切换 chip 对。只在用户选中 5x5 时显示;localStorage 持久。
 *
 * - random-state: 走 cube555 daemon(server-side Java),平均 ~70 步,真随机态
 * - random-move : cubing.js WCA-spec 60 步随机转动
 *
 * 切换会清掉 /scramble/gen 的 555 pool(在 cubingScramble.ts 监听 mode-change
 * 事件实现),下一次 Generate 用新模式重新填池。
 */
import { use555Mode } from '../utils/scramble_555_mode';

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
      <button
        type="button"
        className={`gen-count-chip${mode === 'rs' ? ' is-active' : ''}`}
        onClick={() => setMode('rs')}
        title={t('真随机状态 ~70 步(求解 + 逆转)', 'random-state ~70 moves (solve + invert)')}
      >
        {t('随机状态', 'random-state')}
      </button>
      <button
        type="button"
        className={`gen-count-chip${mode === 'rm' ? ' is-active' : ''}`}
        onClick={() => setMode('rm')}
        title={t('WCA 60 步随机转动', 'WCA-spec 60 random moves')}
      >
        {t('随机转动 60', 'random-move 60')}
      </button>
    </div>
  );
}
