// NOTE: 落地页 Trainer 大卡的装饰性 3D 魔方
// 懒加载 cubing/twisty，无控件，自动慢速播放循环公式
// 加载失败时降级为静态 Lucide Box 图标

import { useEffect, useRef, useState } from 'react';
import { Box } from 'lucide-react';

export default function LandingCubeHero() {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [Ctor, setCtor] = useState<any>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    import('cubing/twisty').then((mod) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const C = (mod as any).TwistyPlayer || (mod as any).default;
      setCtor(() => C);
    }).catch(() => setFailed(true));
  }, []);

  useEffect(() => {
    if (!Ctor || !containerRef.current) return;
    const container = containerRef.current;
    container.innerHTML = '';

    const player = new Ctor({
      puzzle: '3x3x3',
      alg: "S' U' M' y2",
      controlPanel: 'none',
      background: 'none',
      hintFacelets: 'none',
      visualization: 'PG3D',
      tempoScale: 0.6,
    });
    player.style.width = '100%';
    player.style.height = '100%';
    container.appendChild(player);

    // NOTE: 自动播放，循环（播放结束后重启）
    const start = () => { try { player.play(); } catch { /* 已销毁 */ } };
    start();
    // NOTE: 监听 timestamp 到达终点时重置并重播
    const timer = setInterval(() => {
      try {
        const tl = player.timeline;
        if (tl && typeof tl.timestamp === 'number' && typeof tl.maxTimestamp === 'number') {
          if (tl.timestamp >= tl.maxTimestamp - 100) {
            tl.timestamp = 0;
            player.play();
          }
        }
      } catch { /* 忽略 */ }
    }, 500);

    return () => {
      clearInterval(timer);
      container.innerHTML = '';
    };
  }, [Ctor]);

  if (failed) {
    return (
      <div className="cube-hero-fallback">
        <Box size={48} strokeWidth={1.5} />
      </div>
    );
  }

  return <div ref={containerRef} className="cube-hero-slot" />;
}
