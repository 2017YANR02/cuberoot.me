/**
 * /scramble/gen — batch scramble generator. Three modes:
 *   - Comp:     WCA competition scramble sheet UX (multi-event, multi-round)
 *   - Practice: pick one event + count → flat list
 *   - Import:   pull real scrambles for a WCA competition by id/url
 *
 * Comp + Practice share `cubing/scramble` (Lucas Garron, WCA-spec output).
 */
import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { Shuffle } from 'lucide-react';
import LiquidGlass from 'liquid-glass-react';
import LangToggle from '../../components/LangToggle';
import ThemeToggle from '../../components/ThemeToggle';
import { prewarmScramble } from '../../utils/cubingScramble';
import QuickMode from './QuickMode';
import TNoodleMode from './TNoodleMode';
import ImportMode from './ImportMode';
import './gen.css';

const SHOW_PREVIEW_KEY = 'gen:showPreview';
function readShowPreview(): boolean {
  if (typeof localStorage === 'undefined') return true;
  return localStorage.getItem(SHOW_PREVIEW_KEY) !== '0';
}

type Mode = 'mock' | 'batch' | 'paste' | 'wca';

const VALID_MODES: ReadonlySet<Mode> = new Set(['mock', 'batch', 'paste', 'wca']);

const MODE_ORDER: Mode[] = ['mock', 'batch', 'paste', 'wca'];
const MODE_LABELS: Record<Mode, { zh: string; en: string }> = {
  mock:  { zh: '模拟', en: 'Mock' },
  batch: { zh: '批量', en: 'Batch' },
  paste: { zh: '输入', en: 'Paste' },
  wca:   { zh: 'WCA',  en: 'WCA' },
};

/** Safari (desktop + iOS,任何 iOS 浏览器都是 WebKit) 不能正确合成 SVG
 *  `feDisplacementMap` 跟 `backdrop-filter` 这一对,liquid-glass-react 只特判
 *  了 Firefox,Safari 上 thumb 会渲染成不透明黑块。检测到 → 退一档 CSS
 *  frosted thumb,iOS 26 native 那一档放弃但至少不丑。 */
const needsCssGlassFallback = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return true;
  return /Safari/.test(ua) && !/Chrome|Chromium|Edg/.test(ua);
};

/** iOS UISegmentedControl-style chips: 一个吸附 thumb 在玻璃胶囊上滑,
 *  手指按下 + 横滑过 chip 边界即切换 (不用抬手)。Pointer Events 同时
 *  覆盖触摸 / 鼠标 / 触控笔。 */
function ModeChips({
  mode, setMode, t,
}: {
  mode: Mode;
  setMode: (m: Mode) => void;
  t: (zh: string, en: string) => string;
}) {
  // 一次性 detect,挂载后不变 (用户不会中途换浏览器)
  const [useFallback] = useState<boolean>(() => needsCssGlassFallback());
  const containerRef = useRef<HTMLDivElement>(null);
  const chipRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const draggingRef = useRef(false);
  // chip 几何:中心 (centerX/Y) 喂给 LiquidGlass 的 style.top/left
  // (lib 内部 translate(-50%,-50%) 居中);w/h 给内部 content 占位让 glass 自然撑到 chip 大小。
  const [chipBox, setChipBox] = useState<{ centerX: number; centerY: number; w: number; h: number }>(
    { centerX: 0, centerY: 0, w: 0, h: 0 },
  );

  const syncBox = () => {
    const idx = MODE_ORDER.indexOf(mode);
    const chip = chipRefs.current[idx];
    if (!chip) return;
    setChipBox({
      centerX: chip.offsetLeft + chip.offsetWidth / 2,
      centerY: chip.offsetTop + chip.offsetHeight / 2,
      w: chip.offsetWidth,
      h: chip.offsetHeight,
    });
  };
  // 字体加载完 / 语言切换 / 视口宽度变化都会改变 chip 宽度 → 重测。
  useLayoutEffect(syncBox, [mode, t]);
  useEffect(() => {
    const onResize = () => syncBox();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const idxAtX = (clientX: number): number => {
    const rects = chipRefs.current.map((el) => el?.getBoundingClientRect() ?? null);
    for (let i = 0; i < rects.length; i++) {
      const r = rects[i];
      if (r && clientX >= r.left && clientX <= r.right) return i;
    }
    if (rects[0] && clientX < rects[0].left) return 0;
    return rects.length - 1;
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    draggingRef.current = true;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const next = MODE_ORDER[idxAtX(e.clientX)];
    if (next !== mode) setMode(next);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    const next = MODE_ORDER[idxAtX(e.clientX)];
    if (next !== mode) setMode(next);
  };
  const onPointerEnd = (e: ReactPointerEvent<HTMLDivElement>) => {
    draggingRef.current = false;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };

  return (
    <div
      ref={containerRef}
      className="gen-mode-chips"
      role="tablist"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
    >
      {/* LiquidGlass thumb:位置由 chip 中心驱动,lib 自带 0.2s ease-out transition
          所以 mode 切换时 glass 自动滑过去。多个 sibling layers (border / hover /
          overLight) 全在 .gen-mode-thumb-layer 这个 z-index:0 锚定 div 下,不会
          叠到 chip 文字之上。 */}
      <div className="gen-mode-thumb-layer">
        {chipBox.w > 0 && (useFallback ? (
          // Safari / iOS:CSS frosted thumb, top/left 跟 LiquidGlass 一样取 chip 中心,
          // translate(-50%,-50%) 自己模拟 lib 的居中机制,transition 模仿其内部 0.2s ease-out。
          <div
            className="gen-mode-thumb-fallback"
            aria-hidden="true"
            style={{
              top: chipBox.centerY,
              left: chipBox.centerX,
              width: chipBox.w,
              height: chipBox.h,
            }}
          />
        ) : (
          <LiquidGlass
            mouseContainer={containerRef}
            padding="0"
            cornerRadius={999}
            style={{
              position: 'absolute',
              top: chipBox.centerY,
              left: chipBox.centerX,
            }}
          >
            <div style={{ width: chipBox.w, height: chipBox.h }} aria-hidden="true" />
          </LiquidGlass>
        ))}
      </div>
      {MODE_ORDER.map((m, i) => (
        <button
          key={m}
          ref={(el) => { chipRefs.current[i] = el; }}
          type="button"
          role="tab"
          aria-selected={m === mode}
          className={`gen-mode-chip${m === mode ? ' is-active' : ''}`}
          onClick={() => setMode(m)}
        >
          {t(MODE_LABELS[m].zh, MODE_LABELS[m].en)}
        </button>
      ))}
    </div>
  );
}
// 老链接兼容:URL 上 ?mode= 用过的别名都转到当前名。chip 字符串 = URL key。
const LEGACY_MODE_ALIAS: Record<string, Mode> = {
  // 历次重命名累积
  comp: 'mock',
  tnoodle: 'mock',
  gen: 'batch',
  practice: 'batch',
  quick: 'batch',
  text: 'paste',
  import: 'wca',
};

export default function GenPage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const t = (zh: string, en: string) => (isZh ? zh : en);

  // Prewarm the heaviest random-state scramblers while the user is reading the
  // event selector. 444/555 each pay a ~3s pruning-table build on first call;
  // running that during page idle (rather than after the user clicks Generate)
  // is the single biggest win for perceived latency.
  useEffect(() => {
    prewarmScramble('333', '444', '555');
  }, []);

  // Shared 打乱图 visibility. Persisted to localStorage so the choice survives
  // page reloads and mode switches. Off ⇒ neither web sheet nor PDF includes
  // the per-attempt preview thumbnail.
  const [showPreview, setShowPreviewState] = useState<boolean>(readShowPreview);
  const setShowPreview = (v: boolean) => {
    setShowPreviewState(v);
    try { localStorage.setItem(SHOW_PREVIEW_KEY, v ? '1' : '0'); } catch { /* swallow */ }
  };

  const [searchParams, setSearchParams] = useSearchParams();
  const rawParam = searchParams.get('mode') ?? '';
  const aliased = (LEGACY_MODE_ALIAS[rawParam] ?? rawParam) as Mode;
  const mode: Mode = VALID_MODES.has(aliased) ? aliased : 'mock';

  // 老链接(?mode=text 等)落到这里时 URL 还是旧值;静悄悄改写成 canonical 名,
  // 这样书签/分享/复制 URL 都更新到当前别名。replace:true 避免污染历史。
  useEffect(() => {
    if (rawParam && rawParam !== mode) {
      setSearchParams((prev) => {
        const p = new URLSearchParams(prev);
        p.set('mode', mode);
        return p;
      }, { replace: true });
    }
  }, [rawParam, mode, setSearchParams]);
  const setMode = (next: Mode) => {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.set('mode', next);
      // ?comp= 不在这里清 —— WCA tab 永远挂载且保留已加载比赛,
      // URL 也保持同步,刷新或换 tab 再回都能秒回原状态。
      return p;
    }, { replace: true });
  };

  return (
    <div className="gen-page">
      <header className="gen-header">
        <div className="gen-title">
          <Shuffle size={20} className="gen-title-icon" />
          <h1>{t('打乱生成器', 'Scramble Generator')}</h1>
        </div>
        <ModeChips mode={mode} setMode={setMode} t={t} />
        <LangToggle variant="inline" />
        <ThemeToggle />
      </header>

      <main className="gen-main">
        {mode === 'mock' && <TNoodleMode t={t} isZh={isZh} showPreview={showPreview} onTogglePreview={() => setShowPreview(!showPreview)} />}
        {mode === 'batch' && <QuickMode t={t} subMode="batch" showPreview={showPreview} onTogglePreview={() => setShowPreview(!showPreview)} />}
        {mode === 'paste' && <QuickMode t={t} subMode="paste" showPreview={showPreview} onTogglePreview={() => setShowPreview(!showPreview)} />}
        {/* ImportMode 永远挂载:切走再切回保留已加载比赛 + 已生成 sheets */}
        <div style={{ display: mode === 'wca' ? 'block' : 'none' }}>
          <ImportMode t={t} isZh={isZh} showPreview={showPreview} onTogglePreview={() => setShowPreview(!showPreview)} />
        </div>
      </main>
    </div>
  );
}
