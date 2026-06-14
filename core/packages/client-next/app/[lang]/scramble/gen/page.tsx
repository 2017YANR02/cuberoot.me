'use client';

/**
 * /scramble/gen — batch scramble generator. Three modes:
 *   - Comp:     WCA competition scramble sheet UX (multi-event, multi-round)
 *   - Practice: pick one event + count → flat list
 *   - Import:   pull real scrambles for a WCA competition by id/url
 *
 * Comp + Practice share `cubing/scramble` (Lucas Garron, WCA-spec output).
 *
 * Next.js port of packages/client/src/pages/gen/GenPage.tsx (1:1 shell).
 */
import { Suspense, useEffect, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryState, parseAsString } from 'nuqs';
import Link from '@/components/AppLink';
import { Shuffle, HelpCircle } from 'lucide-react';
import LiquidGlassChips from '@/components/LiquidGlassChips';
import { prewarmScramble } from '@/lib/cubing-scramble';
import { get333Mode } from '@/lib/scramble-333-mode';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useT } from '@/hooks/useT';
import QuickMode from './QuickMode';
import { CUBE_FILL } from '@/lib/cube-colors';

// 把全站魔方配色注入 gen 的 --gen-cx-* 变量(swatch 选择器 + 步数徽标共用,单一来源)。
// cx-w/y/r/o/b/g = White/Yellow/Red/Orange/Blue/Green = U/D/R/L/B/F。
const GEN_CX_VARS = {
  '--gen-cx-w': CUBE_FILL.U,
  '--gen-cx-y': CUBE_FILL.D,
  '--gen-cx-r': CUBE_FILL.R,
  '--gen-cx-o': CUBE_FILL.L,
  '--gen-cx-b': CUBE_FILL.B,
  '--gen-cx-g': CUBE_FILL.F,
} as CSSProperties;
import TNoodleMode from './TNoodleMode';
import './gen.css';

const SHOW_PREVIEW_KEY = 'gen:showPreview';
function readShowPreview(): boolean {
  if (typeof localStorage === 'undefined') return true;
  return localStorage.getItem(SHOW_PREVIEW_KEY) !== '0';
}

// SQ1 打乱记号:简写 (4/-36/…，全站默认) vs WCA 官方 (x, y) / 完整形式。
// 仅 /scramble/gen 提供切换(选了 sq1 才显开关);默认简写,持久化。
const SQ1_COMPACT_KEY = 'gen:sq1Compact';
function readSq1Compact(): boolean {
  if (typeof localStorage === 'undefined') return true;
  return localStorage.getItem(SQ1_COMPACT_KEY) !== '0';
}

type Mode = 'comp' | 'batch' | 'paste';

const VALID_MODES: ReadonlySet<Mode> = new Set(['comp', 'batch', 'paste']);

const MODE_ORDER: Mode[] = ['comp', 'batch', 'paste'];
const MODE_LABELS: Record<Mode, { zh: string; en: string
 }> = {
  comp:  { zh: '比赛', en: 'Comp'
},
  batch: { zh: '批量', en: 'Batch'
},
  paste: { zh: '输入', en: 'Paste'
},
};

// 老链接兼容:URL 上 ?mode= 用过的别名都转到当前名。chip 字符串 = URL key。
const LEGACY_MODE_ALIAS: Record<string, Mode> = {
  // 历次重命名累积
  mock: 'comp',
  wca: 'comp',
  tnoodle: 'comp',
  import: 'comp',
  gen: 'batch',
  practice: 'batch',
  quick: 'batch',
  text: 'paste',
};

function GenPageInner() {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const t = useT();
  useDocumentTitle('打乱生成器', 'Scramble Generator');

  // Prewarm the heaviest random-state scramblers while the user is reading the
  // event selector. 444/555 each pay a ~3s pruning-table build on first call;
  // running that during page idle (rather than after the user clicks Generate)
  // is the single biggest win for perceived latency.
  useEffect(() => {
    prewarmScramble('333', '444', '555', '333fm');
    // If the user has opted into the m2p engine, also fetch + init it during
    // page idle so their first 3x3 Generate doesn't pay the 120KB + 100ms tax.
    if (get333Mode() === 'm2p') {
      void import('@/lib/m2p-scramble').then((m) => m.prewarmM2p());
    }
  }, []);

  // Shared 打乱图 visibility. Persisted to localStorage so the choice survives
  // page reloads and mode switches. Off ⇒ neither web sheet nor PDF includes
  // the per-attempt preview thumbnail.
  const [showPreview, setShowPreviewState] = useState<boolean>(readShowPreview);
  const setShowPreview = (v: boolean) => {
    setShowPreviewState(v);
    try { localStorage.setItem(SHOW_PREVIEW_KEY, v ? '1' : '0'); } catch { /* swallow */ }
  };

  const [sq1Compact, setSq1CompactState] = useState<boolean>(readSq1Compact);
  const setSq1Compact = (v: boolean) => {
    setSq1CompactState(v);
    try { localStorage.setItem(SQ1_COMPACT_KEY, v ? '1' : '0'); } catch { /* swallow */ }
  };

  // mode 走 nuqs(replace);raw 字符串读出后做 legacy alias 归一(parseAsStringEnum
  // 会在归一前就把旧别名丢成默认值,故用 parseAsString 自己归一)。default 'comp' 自动
  // 从 URL 省略;?comp= 等其它键由 TNoodleMode 各自的 nuqs hook 持有,互不干扰。
  // 切 mode 不入历史(后退跳过),与原 router.replace 语义一致。
  const [rawMode, setRawMode] = useQueryState(
    'mode',
    parseAsString.withDefault('').withOptions({ history: 'replace', scroll: false }),
  );
  const aliased = (LEGACY_MODE_ALIAS[rawMode] ?? rawMode) as Mode;
  const mode: Mode = VALID_MODES.has(aliased) ? aliased : 'comp';

  const setMode = (next: Mode) => {
    // default 'comp' → null 删键(clearOnDefault),非默认 → 写值;?comp= 保留。
    setRawMode(next === 'comp' ? null : next);
  };

  // 老链接(?mode=text / ?mode=wca 等)落到这里时 URL 还是旧值;静悄悄改写成 canonical 名
  // (comp 直接删键),这样书签/分享/复制 URL 都更新到当前别名。replace 避免污染历史。
  useEffect(() => {
    if (rawMode && rawMode !== mode) setMode(mode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawMode, mode]);

  // 比赛 chip 激活时,header 右上腾出一个槽给 TNoodleMode 的 CompPicker 用 portal 注入
  // (state 仍在 TNoodleMode,只是 DOM 出现在 header)。chip 不在 comp → slot 不渲染。
  const [compHeaderSlot, setCompHeaderSlot] = useState<HTMLDivElement | null>(null);

  return (
    <div className="gen-page" style={GEN_CX_VARS}>
      <header className="gen-header">
        <div className="gen-title">
          <Shuffle size={20} className="gen-title-icon" />
          <h1>
            {t('打乱生成器', 'Scramble Generator')}
            <Link
              href="/scramble/gen-about"
              className="gen-title-help"
              title={t('生成器是怎么工作的?', 'How does the generator work?')}
              aria-label={t('查看打乱生成器说明', 'About the scramble generator')}
            >
              <HelpCircle size={18} strokeWidth={1.75} />
            </Link>
          </h1>
        </div>
        {mode === 'comp' && (
          <div ref={setCompHeaderSlot} className="gen-comp-header-slot" />
        )}
        <LiquidGlassChips<Mode>
          className="gen-mode-chips"
          items={MODE_ORDER}
          value={mode}
          onChange={setMode}
          getLabel={(m) => t(MODE_LABELS[m].zh, MODE_LABELS[m].en)}
        />
      </header>

      <main className="gen-main">
        {/* Comp 永远挂载:切走再切回保留已加载/已生成 sheets */}
        <div style={{ display: mode === 'comp' ? 'block' : 'none' }}>
          <TNoodleMode t={t} isZh={isZh} showPreview={showPreview} onTogglePreview={() => setShowPreview(!showPreview)} compHeaderSlot={compHeaderSlot} sq1Compact={sq1Compact} onSq1CompactChange={setSq1Compact} />
        </div>
        {mode === 'batch' && <QuickMode t={t} subMode="batch" showPreview={showPreview} onTogglePreview={() => setShowPreview(!showPreview)} sq1Compact={sq1Compact} onSq1CompactChange={setSq1Compact} />}
        {mode === 'paste' && <QuickMode t={t} subMode="paste" showPreview={showPreview} onTogglePreview={() => setShowPreview(!showPreview)} sq1Compact={sq1Compact} onSq1CompactChange={setSq1Compact} />}
      </main>
    </div>
  );
}

export default function GenPage() {
  return (
    <Suspense fallback={<div className="gen-page" />}>
      <GenPageInner />
    </Suspense>
  );
}
