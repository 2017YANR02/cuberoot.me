'use client';

/**
 * /timer — speed-cubing timer (Next.js port shell).
 *
 * The Vite source at packages/client/src/pages/timer/TimerPage.tsx is 1634 lines and
 * recursively imports ~135 sub-files: bluetooth drivers (gan v3/v4, giiker, gocube, moyu,
 * qiyi), stackmat decoder, scramble engines (kociemba, NxN, BLD, drill, training,
 * 1300+ alg cases), audio (metronome, voice), IndexedDB storage with export/import,
 * 26 modal components, charts (histogram, trend, heatmap, scatter, hour), reconstruction,
 * solver hints, share encode/decode, share/paste import, multistage timing, etc.
 *
 * Porting this realistically requires its own session (or porting in waves by feature).
 * This shell renders a placeholder + link back to the Vite site.
 */

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import LangToggle from '@/components/LangToggle';
import ThemeToggle from '@/components/ThemeToggle';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

export default function TimerPage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  useDocumentTitle('计时器', 'Timer');

  return (
    <div style={{ minHeight: '100vh', padding: 24, fontFamily: 'ui-sans-serif, system-ui' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
        <h1 style={{ flex: 1, fontSize: 22, margin: 0 }}>{isZh ? '计时器' : 'Timer'}</h1>
        <LangToggle variant="inline" />
        <ThemeToggle />
      </header>
      <section style={{ maxWidth: 640, lineHeight: 1.7, color: 'var(--foreground)' }}>
        <p>
          {isZh
            ? '速拧计时器尚未移植到 Next.js 站点。原 Vite 实现 (1634 行 + 130 多个子文件) 涵盖蓝牙智能魔方驱动、Stackmat 解码、kociemba/NxN/BLD/drill 打乱引擎、音频提示音、IndexedDB 解法存储、26 个对话框、统计图表、解法重构等模块,需要单独的会话或分阶段移植。'
            : 'The speed-cubing timer has not been ported to the Next.js site yet. The original Vite implementation (1634 lines + 130+ sub-files) covers Bluetooth smart-cube drivers, Stackmat decoding, kociemba/NxN/BLD/drill scramble engines, audio cues, IndexedDB solve storage, 26 modal dialogs, statistics charts, and reconstruction — porting realistically needs its own session or wave-by-wave migration.'}
        </p>
        <p>
          {isZh ? '暂时请使用 Vite 站点的 ' : 'Use the Vite site meanwhile: '}
          <a
            href="https://cuberoot.me/timer"
            style={{ color: 'var(--accent)', textDecoration: 'underline' }}
          >
            cuberoot.me/timer
          </a>
        </p>
        <p>
          <Link href="/" style={{ color: 'var(--accent)' }}>
            ← {isZh ? '返回首页' : 'Back to home'}
          </Link>
        </p>
      </section>
    </div>
  );
}
