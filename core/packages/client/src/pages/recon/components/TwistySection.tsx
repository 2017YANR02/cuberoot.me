import { useState, useRef, useEffect, useCallback, type MutableRefObject } from 'react';
import { useTranslation } from 'react-i18next';

/** Twisty 播放器区域——动态导入 cubing 库，用构造函数 API 创建（对齐 legacy） */
export default function TwistySection({
  puzzle, scramble, alg, playerRef,
}: {
  puzzle: string;
  scramble: string;
  alg: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  playerRef?: MutableRefObject<any>;
}) {
  const { t } = useTranslation();
  // NOTE: 动画默认显示（对齐原版——原版默认展开 twisty-player）
  const [visible, setVisible] = useState(true);
  // NOTE: 用 state 而非 ref 存构造函数——确保 import 完成后触发重渲染
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [Ctor, setCtor] = useState<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // NOTE: 点击后切换显示/隐藏
  const handleToggle = useCallback(() => {
    setVisible(v => !v);
  }, []);

  // NOTE: 自动加载 cubing 库——import 完成后 setCtor 触发重渲染
  useEffect(() => {
    if (visible && !Ctor) {
      import('cubing/twisty').then((mod) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const C = (mod as any).TwistyPlayer || (mod as any).default;
        setCtor(() => C); // NOTE: 用函数式 setState，避免 React 尝试调用构造函数
      }).catch(err => console.warn('Failed to load cubing library:', err));
    }
  }, [visible, Ctor]);

  // NOTE: 构造函数就绪后，用 new TwistyPlayer({...}) 创建（与 legacy 一致）
  useEffect(() => {
    if (!visible || !Ctor || !containerRef.current) return;
    const container = containerRef.current;
    // NOTE: 清空旧的 player
    container.innerHTML = '';
    // NOTE: 使用构造函数 API——setAttribute 方式无法正确初始化 alg 模型，播放按钮不响应
    // NOTE: 不设置 background:'none'——保留默认棋盘格背景（与 legacy 一致）
    const player = new Ctor({
      puzzle,
      experimentalSetupAlg: scramble,
      alg,
      controlPanel: 'bottom-row',
    });
    player.style.width = '100%';
    player.style.maxWidth = '400px';
    player.style.margin = '12px 0';
    // NOTE: light colorScheme 让 scrubber 轨道右侧渲染为白色（对齐 legacy 图2样式）
    player.style.colorScheme = 'light';
    container.appendChild(player);
    // NOTE: 暴露 player 引用给光标跟随功能
    if (playerRef) {
      playerRef.current = player;
    }
    return () => { 
      if (playerRef) playerRef.current = null; 
    };
  }, [visible, Ctor, puzzle, scramble, alg, playerRef]);

  return (
    <div className="detail-section">
      <button className="recon-btn" onClick={handleToggle} type="button">
        {visible ? t('recon.hideAnim') : t('recon.viewAnim')}
      </button>
      {visible && <div ref={containerRef} className="detail-twisty-container" />}
    </div>
  );
}
