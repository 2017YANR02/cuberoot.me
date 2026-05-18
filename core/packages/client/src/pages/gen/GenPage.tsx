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

type Mode = 'comp' | 'gen' | 'text' | 'wca';

const VALID_MODES: ReadonlySet<Mode> = new Set(['comp', 'gen', 'text', 'wca']);
// 老链接兼容:practice/quick → gen(原 practice 默认子模式),tnoodle → comp,import → wca。
const LEGACY_MODE_ALIAS: Record<string, Mode> = {
  practice: 'gen',
  quick: 'gen',
  tnoodle: 'comp',
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
  const mode: Mode = VALID_MODES.has(aliased) ? aliased : 'comp';
  const setMode = (next: Mode) => {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.set('mode', next);
      // ?comp= 不在这里清 —— ImportMode (WCA tab) 永远挂载且保留已加载比赛,
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
        <div className="gen-mode-chips">
          <button
            type="button"
            className={`gen-mode-chip${mode === 'comp' ? ' is-active' : ''}`}
            onClick={() => setMode('comp')}
          >
            {t('模拟', 'Mock')}
          </button>
          <button
            type="button"
            className={`gen-mode-chip${mode === 'gen' ? ' is-active' : ''}`}
            onClick={() => setMode('gen')}
          >
            {t('批量', 'Batch')}
          </button>
          <button
            type="button"
            className={`gen-mode-chip${mode === 'text' ? ' is-active' : ''}`}
            onClick={() => setMode('text')}
          >
            {t('输入', 'Paste')}
          </button>
          <button
            type="button"
            className={`gen-mode-chip${mode === 'wca' ? ' is-active' : ''}`}
            onClick={() => setMode('wca')}
          >
            {t('WCA', 'WCA')}
          </button>
        </div>
        <LangToggle variant="inline" />
        <ThemeToggle />
      </header>

      <main className="gen-main">
        {mode === 'comp' && <TNoodleMode t={t} isZh={isZh} showPreview={showPreview} onTogglePreview={() => setShowPreview(!showPreview)} />}
        {mode === 'gen' && <QuickMode t={t} subMode="gen" showPreview={showPreview} onTogglePreview={() => setShowPreview(!showPreview)} />}
        {mode === 'text' && <QuickMode t={t} subMode="text" showPreview={showPreview} onTogglePreview={() => setShowPreview(!showPreview)} />}
        {/* ImportMode 永远挂载:切走再切回保留已加载比赛 + 已生成 sheets */}
        <div style={{ display: mode === 'wca' ? 'block' : 'none' }}>
          <ImportMode t={t} isZh={isZh} showPreview={showPreview} onTogglePreview={() => setShowPreview(!showPreview)} />
        </div>
      </main>
    </div>
  );
}
