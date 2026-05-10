/**
 * /scramble/gen — "Quick" mode: pick one event, pick a count, get a list.
 * Renders a single tnoodle-style sheet (EventIcon header + scramble/preview
 * table) so the visual matches TNoodle mode; no extra scrambles, no rounds.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, Download } from 'lucide-react';
import WcaEventSelector from '../../components/WcaEventSelector';
import { EventIcon } from '../../components/EventIcon';
import { ScramblePreview2D, eventHasScramblePreview } from '../../components/ScramblePreview2D';
import { eventDisplayName } from '../../utils/wca_events';
import { TNOODLE_WCA_EVENTS, tnoodleRandomScramble } from '../../utils/cubingScramble';
import type { RoundSheetInput } from './tnoodle_pdf';
import ProgressButton from './ProgressButton';
import ScrambleLines from './ScrambleLines';

const GENERATOR_TAG = 'TNoodle-WCA-1.2.3-port';

const TNOODLE_EVENT_SET = new Set<string>(TNOODLE_WCA_EVENTS);
const COUNT_PRESETS = [1, 5, 12, 25, 50];

interface Props {
  t: (zh: string, en: string) => string;
}

export default function QuickMode({ t }: Props) {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const [event, setEvent] = useState<string>('333');
  const [count, setCount] = useState<number>(5);
  const [scrambles, setScrambles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [genProgress, setGenProgress] = useState<{ done: number; total: number } | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [pdfBuilding, setPdfBuilding] = useState(false);
  const [pdfProgress, setPdfProgress] = useState<{ done: number; total: number } | null>(null);

  const reqIdRef = useRef(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const myId = ++reqIdRef.current;
    setLoading(true);
    setScrambles([]);
    setCopiedIdx(null);
    let done = 0;
    setGenProgress({ done: 0, total: count });

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
  const regenerate = () => setTick((n) => n + 1);

  const downloadPdf = async () => {
    if (scrambles.length === 0) return;
    setPdfBuilding(true);
    setPdfProgress({ done: 0, total: 1 });
    try {
      const { generateTnoodlePdf } = await import('./tnoodle_pdf');
      const today = new Date().toISOString().slice(0, 10);
      const sheet: RoundSheetInput = {
        event,
        roundIdx: 0,
        groupIdx: 0,
        // 多个独立 Bo1 打乱(无 Ao5/Mo3 概念) → format='1';PDF 不会因此印 "Bo1" 标题
        // 因为我们不传 attemptNumber 也不分轮,header 只显示项目名 + Round 1
        format: '1',
        attempts: scrambles.map((s, i) => ({
          label: String(i + 1),
          scramble: s,
          isExtra: false,
        })),
      };
      const blob = await generateTnoodlePdf([sheet], {
        competitionTitle: `Scrambles for ${today}`,
        generatorTag: GENERATOR_TAG,
        isZh,
        onProgress: (done, total) => setPdfProgress({ done, total }),
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${eventDisplayName(event, false)}-${today}.pdf`.replace(/[^\w一-龥-]+/g, '_');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (err) {
      console.error('[gen/quick] pdf failed', err);
      alert(`PDF generation failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setPdfBuilding(false);
      setPdfProgress(null);
    }
  };

  const copyOne = async (idx: number) => {
    try {
      await navigator.clipboard.writeText(scrambles[idx]);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx((curr) => (curr === idx ? null : curr)), 1200);
    } catch { /* swallow */ }
  };

  return (
    <>
      <div className="gen-tn-controls">
        <div className="gen-control-group gen-control-actions">
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
              ? <span className="gen-btn-progress-num">{`${genProgress?.done ?? 0}/${genProgress?.total ?? count}`}</span>
              : t(`生成 (${count})`, `Generate (${count})`)}
            progress={genProgress}
            onClick={regenerate}
            disabled={loading}
            title={t('重新生成', 'Regenerate')}
          />
          {scrambles.length > 0 && (
            <ProgressButton
              icon={<Download size={14} className={pdfBuilding ? 'gen-spin' : ''} />}
              label={pdfBuilding
                ? <span className="gen-btn-progress-num">{`${pdfProgress?.done ?? 0}/${pdfProgress?.total ?? 1}`}</span>
                : ''}
              progress={pdfProgress}
              onClick={downloadPdf}
              disabled={pdfBuilding}
              title={t('下载 PDF', 'Download PDF')}
            />
          )}
        </div>
      </div>

      <WcaEventSelector
        availableEvents={TNOODLE_EVENT_SET}
        selectedEvent={event}
        onSelect={setEvent}
        isZh={isZh}
      />

      {scrambles.length > 0 && (
        <div className="gen-tn-sheets">
          <div className="gen-tn-sheet">
            <div className="gen-tn-sheet-header">
              <EventIcon event={event} />
              <span>{eventDisplayName(event, isZh)} {scrambles.length} {t('个打乱', 'scrambles')}</span>
            </div>
            <table className="gen-tn-sheet-table"><tbody>
              {scrambles.map((s, i) => (
                <tr
                  key={`${i}-${s.slice(0, 4)}`}
                  className={copiedIdx === i ? 'is-copied' : ''}
                  onClick={() => copyOne(i)}
                  title={t('点击复制', 'Click to copy')}
                  style={{ cursor: 'pointer' }}
                >
                  <td className="gen-tn-attempt-num">{i + 1}</td>
                  <td className="gen-tn-attempt-scramble">
                    <ScrambleLines scramble={s} className="gen-tn-attempt-line" />
                  </td>
                  <td className="gen-tn-attempt-preview">
                    {hasPreview && (
                      <ScramblePreview2D event={event} scramble={s} size={48} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody></table>
          </div>
        </div>
      )}
    </>
  );
}
