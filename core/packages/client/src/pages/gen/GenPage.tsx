/**
 * /scramble/gen — batch scramble generator. Three modes:
 *   - Comp:     WCA competition scramble sheet UX (multi-event, multi-round)
 *   - Practice: pick one event + count → flat list
 *   - Import:   pull real scrambles for a WCA competition by id/url
 *
 * Comp + Practice share `cubing/scramble` (Lucas Garron, WCA-spec output).
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { Shuffle } from 'lucide-react';
import LangToggle from '../../components/LangToggle';
import ThemeToggle from '../../components/ThemeToggle';
import LiquidGlassChips from '../../components/LiquidGlassChips';
import { prewarmScramble } from '../../utils/cubingScramble';
import QuickMode from './QuickMode';
import TNoodleMode from './TNoodleMode';
import './gen.css';

const SHOW_PREVIEW_KEY = 'gen:showPreview';
function readShowPreview(): boolean {
  if (typeof localStorage === 'undefined') return true;
  return localStorage.getItem(SHOW_PREVIEW_KEY) !== '0';
}

type Mode = 'comp' | 'batch' | 'paste';

const VALID_MODES: ReadonlySet<Mode> = new Set(['comp', 'batch', 'paste']);

const MODE_ORDER: Mode[] = ['comp', 'batch', 'paste'];
const MODE_LABELS: Record<Mode, { zh: string; en: string }> = {
  comp:  { zh: '比赛', en: 'Comp' },
  batch: { zh: '批量', en: 'Batch' },
  paste: { zh: '输入', en: 'Paste' },
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
  const mode: Mode = VALID_MODES.has(aliased) ? aliased : 'comp';

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
      // ?comp= 保留 —— comp tab 切走再切回能秒回已加载比赛。
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
        <LiquidGlassChips<Mode>
          className="gen-mode-chips"
          items={MODE_ORDER}
          value={mode}
          onChange={setMode}
          getLabel={(m) => t(MODE_LABELS[m].zh, MODE_LABELS[m].en)}
        />
        <LangToggle variant="inline" />
        <ThemeToggle />
      </header>

      <main className="gen-main">
        {/* Comp 永远挂载:切走再切回保留已加载/已生成 sheets */}
        <div style={{ display: mode === 'comp' ? 'block' : 'none' }}>
          <TNoodleMode t={t} isZh={isZh} showPreview={showPreview} onTogglePreview={() => setShowPreview(!showPreview)} />
        </div>
        {mode === 'batch' && <QuickMode t={t} subMode="batch" showPreview={showPreview} onTogglePreview={() => setShowPreview(!showPreview)} />}
        {mode === 'paste' && <QuickMode t={t} subMode="paste" showPreview={showPreview} onTogglePreview={() => setShowPreview(!showPreview)} />}
      </main>
    </div>
  );
}
