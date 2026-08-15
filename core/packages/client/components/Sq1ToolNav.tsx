'use client';

import { useLayoutEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import Link from '@/components/AppLink';
import { tr } from '@/i18n/tr';
import styles from './Sq1ToolNav.module.css';

const TOOLS = [
  { href: '/alg/sq1', zh: '公式库', en: 'Algorithms', exact: true },
  { href: '/alg/sq1/algorithm-trainer', zh: '公式训练', en: 'Algorithm trainer' },
  { href: '/alg/sq1/train', zh: '组合练习', en: 'Pair drill' },
  { href: '/sq1/cs/name', zh: '形状命名', en: 'Shape names' },
  { href: '/alg/sq1/inspect', zh: '打乱检查', en: 'Scramble inspector' },
  { href: '/alg/sq1/visualize', zh: '形状过程', en: 'Shape visualizer' },
  { href: '/alg/sq1/import', zh: '复形导入', en: 'CS importer' },
  { href: '/alg/sq1/count', zh: '奇偶数位', en: 'Parity positions' },
  { href: '/alg/sq1/parity-game', zh: '奇偶游戏', en: 'Parity game' },
  {
    href: '/sim?puzzle=sq1&img_r=y-30x-60&img_dist=6&tool=draw',
    zh: '绘图',
    en: 'Draw',
  },
] as const;

export default function Sq1ToolNav({ contained = false }: { contained?: boolean }) {
  const pathname = usePathname();
  const plainPath = pathname.replace(/^\/zh(?=\/|$)/, '');
  const navRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const nav = navRef.current;
    const active = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !active) return;

    let cancelled = false;
    let frame = 0;
    const reveal = () => {
      if (cancelled) return;
      const navBox = nav.getBoundingClientRect();
      const activeBox = active.getBoundingClientRect();
      const left = nav.scrollLeft + activeBox.left - navBox.left;
      const right = left + activeBox.width;
      if (left < nav.scrollLeft || right > nav.scrollLeft + nav.clientWidth) {
        nav.scrollTo({ left: Math.max(0, left - (nav.clientWidth - activeBox.width) / 2), behavior: 'auto' });
      }
    };
    reveal();
    frame = requestAnimationFrame(reveal);
    void document.fonts?.ready.then(() => {
      if (!cancelled) frame = requestAnimationFrame(reveal);
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [plainPath]);

  return (
    <nav
      ref={navRef}
      className={`${styles.nav}${contained ? ` ${styles.contained}` : ''}`}
      aria-label={tr({ zh: 'SQ1 工具', en: 'Square-1 tools' })}
    >
      {TOOLS.map((tool) => {
        const active = 'exact' in tool && tool.exact
          ? plainPath === tool.href
          : plainPath === tool.href || plainPath.startsWith(`${tool.href}/`);
        return (
          <Link
            key={tool.href}
            href={tool.href}
            className={`${styles.link}${active ? ` ${styles.active}` : ''}`}
            aria-current={active ? 'page' : undefined}
            prefetch={false}
          >
            {tr({ zh: tool.zh, en: tool.en })}
          </Link>
        );
      })}
    </nav>
  );
}
