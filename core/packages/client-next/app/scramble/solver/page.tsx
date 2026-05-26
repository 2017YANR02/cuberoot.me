'use client';

/**
 * /scramble/solver — stub. Port of cs0x7f/cubeopt-wasm UI (optimal 3x3 solver).
 *
 * Deferred because of cross-subagent ownership + cross-origin isolation gotchas:
 *
 * 1. Imports `KociembaWorker from '../../timer/scramble/kociemba/kociemba.worker.ts?worker'`
 *    (Vite worker-suffix syntax) and the kociemba cube helpers. The
 *    kociemba/* tree is owned by the timer subagent and not yet ported into
 *    client-next.
 * 2. Imports `CubingPreview` from /timer/cube/ — same timer-subagent gate.
 * 3. Imports `InteractiveCubeNet` from /visualcube/ — not yet ported.
 * 4. Uses cubeopt-wasm, an upstream wasm module requiring SharedArrayBuffer
 *    (COOP/COEP cross-origin isolated context). next.config.ts already sets
 *    the global headers, but the wasm-worker.js + .mjs/.wasm assets need to
 *    be copied to client-next/public/cubeopt/ and verified to load from
 *    Turbopack's static asset serving. See HANDOFF.md yellow-light #2.
 * 5. The original wasm-worker.js protocol (select solver / generate table /
 *    upload table / start solve) should be kept verbatim; do NOT rewrite it.
 *
 * Source: packages/client/src/pages/scramble/solver/ScrambleSolverPage.tsx
 * (988 lines) + facelet.ts.
 */

import { useTranslation } from 'react-i18next';
import LangToggle from '@/components/LangToggle';
import ThemeToggle from '@/components/ThemeToggle';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

export default function ScrambleSolverPage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  useDocumentTitle('求解器', 'Solver');

  return (
    <div style={{ padding: 16, maxWidth: 720, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 8 }}>
        <LangToggle variant="inline" />
        <ThemeToggle />
      </div>

      <h1>{isZh ? '最优解求解器' : 'Optimal Solver'}</h1>

      <p style={{ opacity: 0.7 }}>
        {isZh
          ? '迁移中: 基于 cubeopt-wasm 的 3x3 最优解,需 SharedArrayBuffer + cross-origin isolation。Vite 版本仍可用: '
          : 'Migration in progress: cubeopt-wasm based 3x3 optimal solver, requires SharedArrayBuffer + cross-origin isolation. Vite version still live at: '}
        <a href="https://cuberoot.me/scramble/solver" target="_blank" rel="noopener noreferrer">cuberoot.me/scramble/solver</a>
      </p>

      <p style={{ opacity: 0.5, fontSize: '0.85rem' }}>
        {isZh
          ? '阻塞点: 跨 subagent 共享代码 (kociemba worker / CubingPreview / InteractiveCubeNet), cubeopt-wasm 资源迁移 — 见 HANDOFF.md 黄灯 #2。'
          : 'Blockers: cross-subagent shared code (kociemba worker / CubingPreview / InteractiveCubeNet), cubeopt-wasm asset migration — see HANDOFF.md yellow-light #2.'}
      </p>
    </div>
  );
}
