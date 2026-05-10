/**
 * /scramble/gen — "Quick" mode: pick one event, pick a count, get a list.
 * Extracted from the original GenPage when TNoodle mode was added.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Copy, Check, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { EventSelect } from '../../components/EventSelect';
import { ScramblePreview2D, eventHasScramblePreview } from '../../components/ScramblePreview2D';
import { TNOODLE_WCA_EVENTS, tnoodleRandomScramble } from '../../utils/cubingScramble';
import ProgressButton from './ProgressButton';
import ScrambleLines from './ScrambleLines';

const COUNT_PRESETS = [1, 5, 12, 25, 50];

interface Props {
  t: (zh: string, en: string) => string;
}

export default function QuickMode({ t }: Props) {
  const [event, setEvent] = useState<string>('333');
  const [count, setCount] = useState<number>(5);
  const [showPreview, setShowPreview] = useState(true);
  const [scrambles, setScrambles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [genProgress, setGenProgress] = useState<{ done: number; total: number } | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  const reqIdRef = useRef(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const myId = ++reqIdRef.current;
    setLoading(true);
    setScrambles([]);
    setCopiedIdx(null);
    setCopiedAll(false);
    let done = 0;
    setGenProgress({ done: 0, total: count });

    // Per-promise tick so the progress bar advances as each scramble lands
    // (random-state generators for big NxN are not uniformly fast).
    const promises = Array.from({ length: count }, () =>
      tnoodleRandomScramble(event).then((s) => {
        if (reqIdRef.current === myId) {
          done += 1;
          setGenProgress({ done, total: count });
        }
        return s;
      }),
    );

    (async () => {
      const out = await Promise.all(promises);
      if (reqIdRef.current !== myId) return;
      setScrambles(out.filter((s): s is string => !!s));
      setLoading(false);
      setGenProgress(null);
    })().catch((e) => {
      if (reqIdRef.current !== myId) return;
      console.error('[gen/quick] scramble failed', e);
      setLoading(false);
      setGenProgress(null);
    });
  }, [event, count, tick]);

  const hasPreview = useMemo(() => eventHasScramblePreview(event), [event]);
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
    <>
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
          <ProgressButton
            primary
            icon={<RefreshCw size={14} className={loading ? 'gen-spin' : ''} />}
            label={loading
              ? t(`生成中 (${genProgress?.done ?? 0}/${genProgress?.total ?? count})`,
                  `Generating (${genProgress?.done ?? 0}/${genProgress?.total ?? count})`)
              : t('重新生成', 'Regenerate')}
            progress={genProgress}
            onClick={regenerate}
            disabled={loading}
          />
          <button type="button" className="gen-btn" onClick={copyAll} disabled={scrambles.length === 0}>
            {copiedAll ? <Check size={14} /> : <Copy size={14} />}
            <span>{copiedAll ? t('已复制', 'Copied') : t('全部复制', 'Copy all')}</span>
          </button>
          {hasPreview && (
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
            <li
              key={`${i}-${s.slice(0, 4)}`}
              className={`gen-item gen-item-clickable${copiedIdx === i ? ' is-copied' : ''}`}
              onClick={() => copyOne(i)}
              title={t('点击复制', 'Click to copy')}
            >
              <span className="gen-num">{i + 1}</span>
              <ScrambleLines scramble={s} className="gen-scramble" />
              {hasPreview && showPreview && (
                <div className="gen-preview">
                  <ScramblePreview2D event={event} scramble={s} size={48} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
