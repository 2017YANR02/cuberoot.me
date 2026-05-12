/**
 * /scramble/gen — "Practice" mode. Pick one OR MORE events, then either
 *   - 生成: auto-generate N scrambles per event via cubing/scramble, or
 *   - 文本: paste your own scrambles per event (one per line).
 * Both sub-modes stack per-event sheets and share the same PDF download.
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

/** 每行一条打乱;容忍开头 "1. " / "1) " / "1、" / "1:" 之类编号前缀。 */
function parsePastedScrambles(text: string): string[] {
  return text.split(/\r?\n/)
    .map((line) => line.replace(/^\s*\d+\s*[.)、:]\s*/, '').trim())
    .filter((line) => line.length > 0);
}

interface Props {
  t: (zh: string, en: string) => string;
}

type SubMode = 'gen' | 'text';

export default function QuickMode({ t }: Props) {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const [subMode, setSubMode] = useState<SubMode>('gen');
  const [events, setEvents] = useState<Set<string>>(() => new Set(['333']));
  const [count, setCount] = useState<number>(5);
  const [generated, setGenerated] = useState<Record<string, string[]>>({});
  const [pasteTexts, setPasteTexts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [genProgress, setGenProgress] = useState<{ done: number; total: number } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [pdfBuilding, setPdfBuilding] = useState(false);
  const [pdfProgress, setPdfProgress] = useState<{ done: number; total: number } | null>(null);

  const reqIdRef = useRef(0);
  const [tick, setTick] = useState(0);

  // 选中项目按 WCA 顺序固定展示
  const eventsOrdered = useMemo(
    () => TNOODLE_WCA_EVENTS.filter((id) => events.has(id)),
    [events],
  );
  const eventsKey = eventsOrdered.join(',');

  const toggleEvent = (id: string) => {
    setEvents((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size > 1) next.delete(id); // 至少保留 1 个
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // 生成模式: events/count/tick 任一变化 → 重新生成全部
  useEffect(() => {
    if (subMode !== 'gen') return;
    const myId = ++reqIdRef.current;
    setLoading(true);
    setGenerated({});
    setCopiedKey(null);
    const total = eventsOrdered.length * count;
    let done = 0;
    setGenProgress({ done: 0, total });

    const buckets: Record<string, string[]> = {};
    for (const ev of eventsOrdered) buckets[ev] = [];

    const promises: Promise<void>[] = [];
    for (const ev of eventsOrdered) {
      for (let i = 0; i < count; i++) {
        promises.push(
          tnoodleRandomScramble(ev).then((s) => {
            if (reqIdRef.current !== myId) return;
            if (s) buckets[ev].push(s);
            done += 1;
            setGenProgress({ done, total });
          }),
        );
      }
    }

    (async () => {
      await Promise.all(promises);
      if (reqIdRef.current !== myId) return;
      setGenerated(buckets);
      setLoading(false);
      setGenProgress(null);
    })().catch((e) => {
      if (reqIdRef.current !== myId) return;
      console.error('[gen/practice] scramble failed', e);
      setLoading(false);
      setGenProgress(null);
    });
  }, [subMode, eventsKey, count, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  const regenerate = () => setTick((n) => n + 1);

  // 每个项目对应的"当前可见 scrambles":gen 模式来自 generated,text 模式来自 pasteTexts 解析
  const scramblesByEvent = useMemo(() => {
    const m: Record<string, string[]> = {};
    if (subMode === 'gen') {
      for (const ev of eventsOrdered) m[ev] = generated[ev] ?? [];
    } else {
      for (const ev of eventsOrdered) m[ev] = parsePastedScrambles(pasteTexts[ev] ?? '');
    }
    return m;
  }, [subMode, eventsOrdered, generated, pasteTexts]);

  const totalScrambles = useMemo(
    () => Object.values(scramblesByEvent).reduce((sum, arr) => sum + arr.length, 0),
    [scramblesByEvent],
  );

  const downloadPdf = async () => {
    if (totalScrambles === 0) return;
    setPdfBuilding(true);
    setPdfProgress({ done: 0, total: 1 });
    try {
      const { generateTnoodlePdf } = await import('./tnoodle_pdf');
      const today = new Date().toISOString().slice(0, 10);
      const sheetInputs: RoundSheetInput[] = eventsOrdered
        .filter((ev) => scramblesByEvent[ev].length > 0)
        .map((ev) => ({
          event: ev,
          roundIdx: 0,
          groupIdx: 0,
          // 多个独立 Bo1 打乱(无 Ao5/Mo3 概念) → format='1';PDF 不会因此印 "Bo1" 标题
          format: '1',
          attempts: scramblesByEvent[ev].map((s, i) => ({
            label: String(i + 1),
            scramble: s,
            isExtra: false,
          })),
        }));
      const titleStem = sheetInputs.length === 1
        ? eventDisplayName(sheetInputs[0].event, false)
        : `${sheetInputs.length}-events`;
      const blob = await generateTnoodlePdf(sheetInputs, {
        competitionTitle: `Scrambles for ${today}`,
        generatorTag: GENERATOR_TAG,
        isZh,
        onProgress: (done, total) => setPdfProgress({ done, total }),
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${titleStem}-${today}.pdf`.replace(/[^\w一-龥-]+/g, '_');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (err) {
      console.error('[gen/practice] pdf failed', err);
      alert(`PDF generation failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setPdfBuilding(false);
      setPdfProgress(null);
    }
  };

  const copyOne = async (ev: string, idx: number, scramble: string) => {
    try {
      await navigator.clipboard.writeText(scramble);
      const key = `${ev}|${idx}`;
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((curr) => (curr === key ? null : curr)), 1200);
    } catch { /* swallow */ }
  };

  return (
    <>
      {/* 生成 / 文本 子模式切换 */}
      <div className="gen-tn-round-chips" role="tablist" style={{ marginTop: 0, marginBottom: '0.75rem' }}>
        <button
          type="button"
          role="tab"
          aria-selected={subMode === 'gen'}
          className={`gen-tn-round-chip${subMode === 'gen' ? ' is-active' : ''}`}
          onClick={() => setSubMode('gen')}
        >
          {t('生成', 'Generate')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={subMode === 'text'}
          className={`gen-tn-round-chip${subMode === 'text' ? ' is-active' : ''}`}
          onClick={() => setSubMode('text')}
        >
          {t('文本', 'Paste')}
        </button>
      </div>

      <WcaEventSelector
        availableEvents={TNOODLE_EVENT_SET}
        selectedEvents={events}
        onToggle={toggleEvent}
        isZh={isZh}
      />

      <div className="gen-tn-controls" style={{ marginTop: '1rem' }}>
        <div className="gen-control-group gen-control-actions">
          {subMode === 'gen' ? (
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
          ) : (
            <div className="gen-tn-paste-hint">
              {t(
                '在下方每个项目下粘贴打乱(每行一条),自动生成预览。可识别 "1. " / "1) " 编号前缀。',
                'Paste scrambles (one per line) under each event below — preview is live. Leading "1. " / "1) " numbering is auto-stripped.',
              )}
            </div>
          )}
        </div>
        <div className="gen-control-group gen-control-actions">
          {subMode === 'gen' && (
            <ProgressButton
              primary
              icon={<RefreshCw size={14} className={loading ? 'gen-spin' : ''} />}
              label={loading
                ? <span className="gen-btn-progress-num">{`${genProgress?.done ?? 0}/${genProgress?.total ?? count}`}</span>
                : t(`生成 (${count}/项)`, `Generate (${count}/event)`)}
              progress={genProgress}
              onClick={regenerate}
              disabled={loading}
              title={t('重新生成', 'Regenerate')}
            />
          )}
          {totalScrambles > 0 && (
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

      {/* text 模式:每个选中项目一块输入区 */}
      {subMode === 'text' && (
        <div className="gen-tn-paste-blocks">
          {eventsOrdered.map((ev) => (
            <div key={ev} className="gen-tn-paste-block">
              <div className="gen-tn-paste-block-header">
                <EventIcon event={ev} />
                <span>{eventDisplayName(ev, isZh)}</span>
              </div>
              <textarea
                className="gen-tn-paste-area"
                value={pasteTexts[ev] ?? ''}
                onChange={(e) => setPasteTexts((prev) => ({ ...prev, [ev]: e.target.value }))}
                placeholder={t('每行一条打乱', 'One scramble per line')}
                rows={5}
                spellCheck={false}
              />
            </div>
          ))}
        </div>
      )}

      {/* 每个项目一个 sheet — gen 模式显示生成结果,text 模式显示已粘贴打乱的预览 */}
      {totalScrambles > 0 && (
        <div className="gen-tn-sheets">
          {eventsOrdered.map((ev) => {
            const arr = scramblesByEvent[ev];
            if (arr.length === 0) return null;
            const hasPreview = eventHasScramblePreview(ev);
            return (
              <div key={ev} className="gen-tn-sheet">
                <div className="gen-tn-sheet-header">
                  <EventIcon event={ev} />
                  <span>{eventDisplayName(ev, isZh)} {arr.length} {t('个打乱', 'scrambles')}</span>
                </div>
                <table className="gen-tn-sheet-table"><tbody>
                  {arr.map((s, i) => {
                    const key = `${ev}|${i}`;
                    return (
                      <tr
                        key={`${i}-${s.slice(0, 4)}`}
                        className={copiedKey === key ? 'is-copied' : ''}
                        onClick={() => copyOne(ev, i, s)}
                        title={t('点击复制', 'Click to copy')}
                        style={{ cursor: 'pointer' }}
                      >
                        <td className="gen-tn-attempt-num">{i + 1}</td>
                        <td className="gen-tn-attempt-scramble">
                          <ScrambleLines scramble={s} className="gen-tn-attempt-line" />
                        </td>
                        <td className="gen-tn-attempt-preview">
                          {hasPreview && (
                            <ScramblePreview2D event={ev} scramble={s} size={48} />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody></table>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
