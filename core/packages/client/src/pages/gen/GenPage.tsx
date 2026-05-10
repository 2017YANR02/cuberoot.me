/**
 * /scramble/gen — batch scramble generator. Two modes:
 *   - Quick: pick one event + count → flat list (default)
 *   - TNoodle: WCA competition scramble sheet UX (multi-event, multi-round,
 *     E1/E2 extras, on-screen sheet view; PDF export added later)
 *
 * Both modes share `cubing/scramble` (Lucas Garron, same author + WCA-spec
 * output as tnoodle).
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Shuffle } from 'lucide-react';
import LangToggle from '../../components/LangToggle';
import QuickMode from './QuickMode';
import TNoodleMode from './TNoodleMode';
import './gen.css';

type Mode = 'quick' | 'tnoodle';

export default function GenPage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const t = (zh: string, en: string) => (isZh ? zh : en);

  const [mode, setMode] = useState<Mode>('tnoodle');

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
            className={`gen-mode-chip${mode === 'tnoodle' ? ' is-active' : ''}`}
            onClick={() => setMode('tnoodle')}
          >
            {t('比赛', 'Comp')}
          </button>
          <button
            type="button"
            className={`gen-mode-chip${mode === 'quick' ? ' is-active' : ''}`}
            onClick={() => setMode('quick')}
          >
            {t('练习', 'Practice')}
          </button>
        </div>
        <LangToggle variant="inline" />
      </header>

      <main className="gen-main">
        {mode === 'quick' ? <QuickMode t={t} /> : <TNoodleMode t={t} isZh={isZh} />}
      </main>
    </div>
  );
}
