/**
 * /gen — batch scramble generator. Pick event + count, get a labelled list with
 * copy buttons and visual previews where puzzleSize allows.
 */
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Shuffle, Copy, Check, RefreshCw, Eye, EyeOff } from 'lucide-react';
import LangToggle from '../../components/LangToggle';
import { EventSelect } from '../../components/EventSelect';
import { VisualCube } from '../../components/VisualCube';
import { PuzzleSVG, type PuzzleKind } from '../../components/PuzzleSVG';
import { randomScrambleForEvent } from '../../utils/scramble';
import './gen.css';

const EVENTS = [
  '3x3', '2x2', '4x4', '5x5', '6x6', '7x7',
  '3bld', '4bld', '5bld', 'fmc', 'oh',
  'pyra', 'skewb', 'sq1', 'mega', 'clock',
] as const;

const COUNT_PRESETS = [1, 5, 12, 25, 50];

type Preview = { kind: 'visualcube'; puzzleSize: number } | { kind: 'puzzle-svg'; pkind: PuzzleKind } | null;

function getPreview(event: string): Preview {
  switch (event) {
    case '2x2': return { kind: 'visualcube', puzzleSize: 2 };
    case '3x3': case 'oh': case '3bld': case 'fmc': return { kind: 'visualcube', puzzleSize: 3 };
    case '4x4': case '4bld': return { kind: 'visualcube', puzzleSize: 4 };
    case '5x5': case '5bld': return { kind: 'visualcube', puzzleSize: 5 };
    case '6x6': return { kind: 'visualcube', puzzleSize: 6 };
    case '7x7': return { kind: 'visualcube', puzzleSize: 7 };
    case 'pyra':  return { kind: 'puzzle-svg', pkind: 'pyraminx' };
    case 'skewb': return { kind: 'puzzle-svg', pkind: 'skewb' };
    case 'sq1':   return { kind: 'puzzle-svg', pkind: 'sq1' };
    case 'mega':  return { kind: 'puzzle-svg', pkind: 'megaminx' };
    default:      return null;
  }
}

function genBatch(event: string, n: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const s = randomScrambleForEvent(event);
    if (s) out.push(s);
  }
  return out;
}

export default function GenPage() {
  const { i18n } = useTranslation();
  const lang: 'zh' | 'en' = i18n.language.startsWith('zh') ? 'zh' : 'en';
  const t = (zh: string, en: string) => (lang === 'zh' ? zh : en);

  const [event, setEvent] = useState<string>('3x3');
  const [count, setCount] = useState<number>(5);
  const [showPreview, setShowPreview] = useState(true);
  const [scrambles, setScrambles] = useState<string[]>([]);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  // Initial generation + on event/count change
  useEffect(() => {
    setScrambles(genBatch(event, count));
    setCopiedIdx(null);
    setCopiedAll(false);
  }, [event, count]);

  const preview = useMemo(() => getPreview(event), [event]);
  const allText = useMemo(
    () => scrambles.map((s, i) => `${i + 1}. ${s}`).join('\n'),
    [scrambles],
  );

  const regenerate = () => {
    setScrambles(genBatch(event, count));
    setCopiedIdx(null);
    setCopiedAll(false);
  };

  const copyOne = async (idx: number) => {
    try {
      await navigator.clipboard.writeText(scrambles[idx]);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx((curr) => (curr === idx ? null : curr)), 1200);
    } catch { /* swallow */ }
  };

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(allText);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 1200);
    } catch { /* swallow */ }
  };

  return (
    <div className="gen-page">
      <header className="gen-header">
        <div className="gen-title">
          <Shuffle size={20} className="gen-title-icon" />
          <h1>{t('打乱生成器', 'Scramble Generator')}</h1>
          <span className="gen-title-sub">WCA · {EVENTS.length} {t('项目', 'events')}</span>
        </div>
        <LangToggle variant="inline" />
      </header>

      <main className="gen-main">
        <div className="gen-controls">
          <div className="gen-control-group">
            <label className="gen-label">{t('项目', 'Event')}</label>
            <EventSelect events={EVENTS as unknown as string[]} value={event} onChange={setEvent} />
          </div>

          <div className="gen-control-group">
            <label className="gen-label">{t('数量', 'Count')}</label>
            <div className="gen-count-row">
              {COUNT_PRESETS.map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`gen-count-chip${count === n ? ' is-active' : ''}`}
                  onClick={() => setCount(n)}
                >
                  {n}
                </button>
              ))}
              <input
                type="number"
                min={1}
                max={500}
                value={count}
                onChange={(e) => {
                  const v = Math.max(1, Math.min(500, Number(e.target.value) || 1));
                  setCount(v);
                }}
                className="gen-count-input"
              />
            </div>
          </div>

          <div className="gen-control-group gen-control-actions">
            <button type="button" className="gen-btn gen-btn-primary" onClick={regenerate}>
              <RefreshCw size={14} />
              <span>{t('重新生成', 'Regenerate')}</span>
            </button>
            <button type="button" className="gen-btn" onClick={copyAll} disabled={scrambles.length === 0}>
              {copiedAll ? <Check size={14} /> : <Copy size={14} />}
              <span>{copiedAll ? t('已复制', 'Copied') : t('全部复制', 'Copy all')}</span>
            </button>
            {preview && (
              <button
                type="button"
                className="gen-btn gen-btn-toggle"
                onClick={() => setShowPreview((s) => !s)}
                title={t('切换预览', 'Toggle preview')}
              >
                {showPreview ? <Eye size={14} /> : <EyeOff size={14} />}
                <span>{t('预览', 'Preview')}</span>
              </button>
            )}
          </div>
        </div>

        <ul className="gen-list">
          {scrambles.map((s, i) => (
            <li key={`${i}-${s.slice(0, 4)}`} className="gen-item">
              <span className="gen-num">{i + 1}</span>
              {preview && showPreview && (
                <div className="gen-preview">
                  {preview.kind === 'visualcube' ? (
                    <VisualCube algorithm={s} view="f2l" puzzleSize={preview.puzzleSize} size={56} />
                  ) : (
                    <PuzzleSVG kind={preview.pkind} alg={s} size={56} />
                  )}
                </div>
              )}
              <code className="gen-scramble">{s}</code>
              <button
                type="button"
                className="gen-copy-btn"
                onClick={() => copyOne(i)}
                title={t('复制', 'Copy')}
              >
                {copiedIdx === i ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
