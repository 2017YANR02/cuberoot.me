/**
 * /scramble/gen — batch scramble generator. Three modes:
 *   - Comp:     WCA competition scramble sheet UX (multi-event, multi-round)
 *   - Practice: pick one event + count → flat list
 *   - Import:   pull real scrambles for a WCA competition by id/url
 *
 * Comp + Practice share `cubing/scramble` (Lucas Garron, WCA-spec output).
 */
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { Shuffle } from 'lucide-react';
import LangToggle from '../../components/LangToggle';
import QuickMode from './QuickMode';
import TNoodleMode from './TNoodleMode';
import ImportMode from './ImportMode';
import './gen.css';

type Mode = 'practice' | 'comp' | 'import';

const VALID_MODES: ReadonlySet<Mode> = new Set(['practice', 'comp', 'import']);
const LEGACY_MODE_ALIAS: Record<string, Mode> = { quick: 'practice', tnoodle: 'comp' };

export default function GenPage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const t = (zh: string, en: string) => (isZh ? zh : en);

  const [searchParams, setSearchParams] = useSearchParams();
  const rawParam = searchParams.get('mode') ?? '';
  const aliased = (LEGACY_MODE_ALIAS[rawParam] ?? rawParam) as Mode;
  const mode: Mode = VALID_MODES.has(aliased) ? aliased : 'comp';
  const setMode = (next: Mode) => {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      // 三个 mode 都显式写进 URL,保持一致(包括默认 comp)。
      p.set('mode', next);
      // ?comp= 不在这里清 —— ImportMode 永远挂载且保留已加载比赛,
      // URL 也保持 comp 同步,刷新或换 tab 再回都能秒回原状态。
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
            {t('比赛', 'Comp')}
          </button>
          <button
            type="button"
            className={`gen-mode-chip${mode === 'practice' ? ' is-active' : ''}`}
            onClick={() => setMode('practice')}
          >
            {t('练习', 'Practice')}
          </button>
          <button
            type="button"
            className={`gen-mode-chip${mode === 'import' ? ' is-active' : ''}`}
            onClick={() => setMode('import')}
          >
            {t('导入', 'Import')}
          </button>
        </div>
        <LangToggle variant="inline" />
      </header>

      <main className="gen-main">
        {mode === 'practice' && <QuickMode t={t} />}
        {mode === 'comp' && <TNoodleMode t={t} isZh={isZh} />}
        {/* ImportMode 永远挂载:切走再切回保留已加载比赛 + 已生成 sheets */}
        <div style={{ display: mode === 'import' ? 'block' : 'none' }}>
          <ImportMode t={t} isZh={isZh} />
        </div>
      </main>
    </div>
  );
}
