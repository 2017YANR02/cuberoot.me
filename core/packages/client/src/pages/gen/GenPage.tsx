/**
 * /scramble/gen — batch scramble generator.
 *
 * Scrambles come from `cubing/scramble` (same author + WCA-compliant output
 * as tnoodle). All 17 WCA events covered: 2-7×, 3/4/5BLD, FMC, OH, MBLD,
 * pyra/sq1/mega/clock/skewb. Per-event WCA format (FMC `R' U' F` wrap, sq1
 * `(x,y)/`, clock notation, etc.) is produced by cubing.js itself.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Shuffle, Copy, Check, RefreshCw, Eye, EyeOff } from 'lucide-react';
import LangToggle from '../../components/LangToggle';
import { EventSelect } from '../../components/EventSelect';
import { VisualCube } from '../../components/VisualCube';
import { PuzzleSVG, type PuzzleKind } from '../../components/PuzzleSVG';
import { TNOODLE_WCA_EVENTS, tnoodleRandomScramble } from '../../utils/cubingScramble';
import './gen.css';

const COUNT_PRESETS = [1, 5, 12, 25, 50];

type Preview = { kind: 'visualcube'; puzzleSize: number } | { kind: 'puzzle-svg'; pkind: PuzzleKind } | null;

function getPreview(event: string): Preview {
  switch (event) {
    case '222': return { kind: 'visualcube', puzzleSize: 2 };
    case '333': case '333oh': case '333bf': case '333fm': case '333mbf':
      return { kind: 'visualcube', puzzleSize: 3 };
    case '444': case '444bf': return { kind: 'visualcube', puzzleSize: 4 };
    case '555': case '555bf': return { kind: 'visualcube', puzzleSize: 5 };
    case '666': return { kind: 'visualcube', puzzleSize: 6 };
    case '777': return { kind: 'visualcube', puzzleSize: 7 };
    case 'pyram':  return { kind: 'puzzle-svg', pkind: 'pyraminx' };
    case 'skewb': return { kind: 'puzzle-svg', pkind: 'skewb' };
    case 'sq1':   return { kind: 'puzzle-svg', pkind: 'sq1' };
    case 'minx':  return { kind: 'puzzle-svg', pkind: 'megaminx' };
    default:      return null;
  }
}

export default function GenPage() {
  const { i18n } = useTranslation();
  const lang: 'zh' | 'en' = i18n.language.startsWith('zh') ? 'zh' : 'en';
  const t = (zh: string, en: string) => (lang === 'zh' ? zh : en);

  const [event, setEvent] = useState<string>('333');
  const [count, setCount] = useState<number>(5);
  const [showPreview, setShowPreview] = useState(true);
  const [scrambles, setScrambles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  const reqIdRef = useRef(0);
  const [tick, setTick] = useState(0);

  // cubing.js is async (workers + wasm); guard against stale responses with reqIdRef.
  // tick bumps on manual regenerate so the same (event, count) re-triggers.
  useEffect(() => {
    const myId = ++reqIdRef.current;
    setLoading(true);
    setScrambles([]);
    setCopiedIdx(null);
    setCopiedAll(false);

    (async () => {
      const out = await Promise.all(
        Array.from({ length: count }, () => tnoodleRandomScramble(event)),
      );
      if (reqIdRef.current !== myId) return;
      setScrambles(out.filter((s): s is string => !!s));
      setLoading(false);
    })().catch((e) => {
      if (reqIdRef.current !== myId) return;
      console.error('[gen] scramble failed', e);
      setLoading(false);
    });
  }, [event, count, tick]);

  const preview = useMemo(() => getPreview(event), [event]);
  const allText = useMemo(
    () => scrambles.map((s, i) => `${i + 1}. ${s}`).join('\n'),
    [scrambles],
  );

  const regenerate = () => setTick((n) => n + 1);

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
          <span className="gen-title-sub">
            WCA · {TNOODLE_WCA_EVENTS.length} {t('项目', 'events')} · cubing.js (tnoodle)
          </span>
        </div>
        <LangToggle variant="inline" />
      </header>

      <main className="gen-main">
        <div className="gen-controls">
          <div className="gen-control-group">
            <label className="gen-label">{t('项目', 'Event')}</label>
            <EventSelect events={TNOODLE_WCA_EVENTS as unknown as string[]} value={event} onChange={setEvent} />
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
            <button type="button" className="gen-btn gen-btn-primary" onClick={regenerate} disabled={loading}>
              <RefreshCw size={14} className={loading ? 'gen-spin' : ''} />
              <span>{loading ? t('生成中…', 'Generating…') : t('重新生成', 'Regenerate')}</span>
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

        {loading && scrambles.length === 0 ? (
          <div className="gen-loading">{t('生成中…', 'Generating…')}</div>
        ) : (
          <ul className="gen-list">
            {scrambles.map((s, i) => (
              <li key={`${i}-${s.slice(0, 4)}`} className="gen-item">
                <span className="gen-num">{i + 1}</span>
                {preview && showPreview && (
                  <div className="gen-preview">
                    {preview.kind === 'visualcube' ? (
                      <VisualCube algorithm={s} view="iso" puzzleSize={preview.puzzleSize} size={56} />
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
        )}
      </main>
    </div>
  );
}
