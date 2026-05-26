'use client';

/**
 * /scramble/analyzer — stub. The full Vite implementation walks a 3x3 scramble
 * through every CFOP first-stage variant (cross / xcross / xxcross / xxxcross
 * × std / EO / pair / pseudo / pseudo_pair) via a Web Worker that owns the
 * legacy speedcubedb cube model + dictionaries.
 *
 * Deferred because:
 *   - 966-line analyzer.worker.ts uses Vite-specific
 *     `new Worker(new URL('./worker/analyzer.worker.ts', import.meta.url))`
 *     pattern. Next 16's path resolution for this differs (see HANDOFF.md
 *     yellow-light #3); needs reworking + verification.
 *   - Imports `randomScrambleForEvent` from utils/scramble which is a thin
 *     shim over the timer subagent's nxnxn / others scramble code (not yet
 *     ported into client-next/lib/).
 *   - Imports TwistySection (cubing.js TwistyPlayer wrapper) which is not yet
 *     in client-next/components/.
 *   - The legacy obfuscated `boohoo/hs/zbh.js` data files must NOT be
 *     modified (see CLAUDE memory `project_analyze_route`); they need to be
 *     copied verbatim to client-next/public/ and reachable via importScripts.
 *
 * Source: packages/client/src/pages/analyze/{AnalyzePage.tsx,
 * analyze_worker_client.ts, worker/analyzer.worker.ts, analyze.css}.
 */

import Link from 'next/link';
import { HelpCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import LangToggle from '@/components/LangToggle';
import ThemeToggle from '@/components/ThemeToggle';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

export default function AnalyzePage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  useDocumentTitle('打乱分析', 'Scramble Analyzer');

  return (
    <div style={{ padding: 16, maxWidth: 720, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 8 }}>
        <LangToggle variant="inline" />
        <ThemeToggle />
      </div>

      <h1 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {isZh ? '打乱分析器' : 'Scramble Analyzer'}
      </h1>

      <p style={{ opacity: 0.7 }}>
        {isZh
          ? '迁移中: CFOP 第一阶段全空间分析(cross / xcross / xxcross / xxxcross × std / EO / pair / pseudo)。Vite 版本仍可用,见 '
          : 'Migration in progress: CFOP first-stage full-space analyzer (cross / xcross / xxcross / xxxcross × std / EO / pair / pseudo). Vite version still works, see '}
        <a href="https://cuberoot.me/scramble/analyzer" target="_blank" rel="noopener noreferrer">cuberoot.me/scramble/analyzer</a>
        {isZh ? '。' : '.'}
      </p>

      <p style={{ opacity: 0.5, fontSize: '0.85rem' }}>
        {isZh
          ? '阻塞点: Vite Worker URL 模式、obfuscated boohoo/hs/zbh.js 数据文件、TwistySection 组件 — 见 HANDOFF.md 黄灯 #3。'
          : 'Blockers: Vite Worker URL pattern, obfuscated boohoo/hs/zbh.js data files, TwistySection component — see HANDOFF.md yellow-light #3.'}
      </p>
    </div>
  );
}
