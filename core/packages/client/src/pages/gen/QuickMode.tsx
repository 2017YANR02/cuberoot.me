/**
 * /scramble/gen — "Practice" mode. Pick one OR MORE events, then either
 *   - 生成: auto-generate N scrambles per event via cubing/scramble, or
 *   - 文本: paste your own scrambles per event (one per line).
 * Both sub-modes stack per-event sheets and share the same PDF download.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, Download, Image as ImageIcon, ImageOff } from 'lucide-react';
import WcaEventSelector from '../../components/WcaEventSelector';
import Scramble555ModePicker from '../../components/Scramble555ModePicker';
import { EventIcon } from '../../components/EventIcon';
import { ScramblePreview2D, eventHasScramblePreview } from '../../components/ScramblePreview2D';
import { visualcubeApiHref } from '../../utils/visualcube_link';
import { eventDisplayName } from '../../utils/wca_events';
import { TNOODLE_WCA_EVENTS, tnoodleRandomScramble } from '../../utils/cubingScramble';
import type { RoundSheetInput } from './tnoodle_pdf';
import ProgressButton from './ProgressButton';
import ScrambleLines from './ScrambleLines';

const GENERATOR_TAG = 'TNoodle-WCA-1.2.3-port';

const TNOODLE_EVENT_SET = new Set<string>(TNOODLE_WCA_EVENTS);
const COUNT_PRESETS = [1, 5, 12, 25, 50, 100, 200, 1000];
const COUNT_MAX = 1000;

/** 每行一条打乱;容忍开头 "1. " / "1) " / "1、" / "1:" 之类编号前缀。 */
function parsePastedScrambles(text: string): string[] {
  return text.split(/\r?\n/)
    .map((line) => line.replace(/^\s*\d+\s*[.)、:]\s*/, '').trim())
    .filter((line) => line.length > 0);
}

/** ms → "1234ms" / "1.2s" / "12.3s" — keep narrow for inline sheet headers. */
function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 10000) return `${(ms / 1000).toFixed(2)}s`;
  return `${(ms / 1000).toFixed(1)}s`;
}

type SubMode = 'batch' | 'paste';

interface Props {
  t: (zh: string, en: string) => string;
  /** 由 GenPage 的顶层 tab 决定:'gen' = 批量, 'text' = 输入 */
  subMode: SubMode;
  /** 是否在每行右侧渲染打乱图(2D net SVG)。off ⇒ 网页 + PDF 都不出。 */
  showPreview: boolean;
  onTogglePreview: () => void;
}

export default function QuickMode({ t, subMode, showPreview, onTogglePreview }: Props) {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const [events, setEvents] = useState<Set<string>>(() => new Set(['333']));
  const [count, setCount] = useState<number>(5);
  const [generated, setGenerated] = useState<Record<string, string[]>>({});
  const [pasteTexts, setPasteTexts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [genProgress, setGenProgress] = useState<{ done: number; total: number } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [pdfBuilding, setPdfBuilding] = useState(false);
  const [pdfProgress, setPdfProgress] = useState<{ done: number; total: number } | null>(null);
  /** 每个 event 的批次计时 — wall = 该 event 第一个 scramble 开始到最后一个完成的实际墙钟。 */
  const [timing, setTiming] = useState<Record<string, { wallMs: number; avgMs: number; firstMs: number; count: number }>>({});
  const [batchWallMs, setBatchWallMs] = useState<number | null>(null);

  const reqIdRef = useRef(0);
  const [tick, setTick] = useState(0);

  // 高阶 NxN(8-50)合成 event id `nxn<N>`,排在 WCA 21 项之后。
  const customNxN = useMemo(
    () => Array.from(events)
      .filter((id) => /^nxn\d+$/.test(id))
      .sort((a, b) => parseInt(a.slice(3), 10) - parseInt(b.slice(3), 10)),
    [events],
  );
  // 选中项目按 WCA 顺序固定展示 + 高阶 NxN 拼在后面
  const eventsOrdered = useMemo(
    () => [...TNOODLE_WCA_EVENTS.filter((id) => events.has(id)), ...customNxN],
    [events, customNxN],
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

  // 高阶 NxN 输入:仅 8-50 有效(2-7 已在事件选择器里)。输入即作为额外 event 加入选择集。
  const [highNxNInput, setHighNxNInput] = useState<string>('');
  const addHighNxN = (raw: string) => {
    const n = parseInt(raw, 10);
    if (!isFinite(n) || n < 8 || n > 50) return;
    const id = `nxn${n}`;
    setEvents((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    setHighNxNInput('');
  };

  // 生成模式: events/count/tick 任一变化 → 重新生成全部
  useEffect(() => {
    if (subMode !== 'batch') return;
    const myId = ++reqIdRef.current;
    setLoading(true);
    setGenerated({});
    setTiming({});
    setBatchWallMs(null);
    setCopiedKey(null);
    const total = eventsOrdered.length * count;
    let done = 0;
    setGenProgress({ done: 0, total });

    const buckets: Record<string, string[]> = {};
    for (const ev of eventsOrdered) buckets[ev] = [];

    // Per-event timing accumulators.
    const evWallStart: Record<string, number> = {};
    const evWallEnd: Record<string, number> = {};
    const evDurations: Record<string, number[]> = {};
    for (const ev of eventsOrdered) evDurations[ev] = [];

    const batchStart = performance.now();
    const promises: Promise<void>[] = [];
    for (const ev of eventsOrdered) {
      for (let i = 0; i < count; i++) {
        const t0 = performance.now();
        if (!(ev in evWallStart) || t0 < evWallStart[ev]) evWallStart[ev] = t0;
        promises.push(
          tnoodleRandomScramble(ev).then((s) => {
            const t1 = performance.now();
            evWallEnd[ev] = !(ev in evWallEnd) || t1 > evWallEnd[ev] ? t1 : evWallEnd[ev];
            evDurations[ev].push(t1 - t0);
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
      const nextTiming: Record<string, { wallMs: number; avgMs: number; firstMs: number; count: number }> = {};
      for (const ev of eventsOrdered) {
        const durs = evDurations[ev];
        const wall = (evWallEnd[ev] ?? 0) - (evWallStart[ev] ?? 0);
        const avg = durs.length > 0 ? durs.reduce((a, b) => a + b, 0) / durs.length : 0;
        const first = durs[0] ?? 0;
        nextTiming[ev] = { wallMs: wall, avgMs: avg, firstMs: first, count: durs.length };
      }
      setGenerated(buckets);
      setTiming(nextTiming);
      setBatchWallMs(performance.now() - batchStart);
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
    if (subMode === 'batch') {
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
        showPreview,
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
      <WcaEventSelector
        availableEvents={TNOODLE_EVENT_SET}
        selectedEvents={events}
        onToggle={toggleEvent}
        isZh={isZh}
        onlyAvailable
      />

      {/* 高阶 NxN(8-50)输入。回车 / blur 即添加为额外 event chip 出现在下方 sheet。 */}
      <div className="gen-tn-highn-row" style={{ margin: '12px 0 20px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <label style={{ fontSize: '13px', color: 'var(--muted-foreground, #888)' }}>
          {t('高阶 NxN', 'High-order NxN')}
        </label>
        <input
          type="number"
          min={8}
          max={50}
          value={highNxNInput}
          placeholder="8-50"
          onChange={(e) => setHighNxNInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') addHighNxN(highNxNInput); }}
          onBlur={() => { if (highNxNInput) addHighNxN(highNxNInput); }}
          className="gen-count-input"
          style={{ width: '72px' }}
        />
        {customNxN.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            {customNxN.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => toggleEvent(id)}
                className="gen-count-chip is-active"
                title={t('点击移除', 'Click to remove')}
              >
                {eventDisplayName(id, isZh)}
              </button>
            ))}
          </div>
        )}
      </div>

      <Scramble555ModePicker active555={events.has('555')} isZh={isZh} />

      <div className="gen-tn-controls" style={{ marginTop: '1rem' }}>
        <div className="gen-control-group gen-control-actions">
          {subMode === 'batch' ? (
            <div className="gen-count-row">
              <input
                type="number"
                list="gen-count-presets"
                min={1}
                max={COUNT_MAX}
                value={count}
                onChange={(e) => {
                  const v = Math.max(1, Math.min(COUNT_MAX, Number(e.target.value) || 1));
                  setCount(v);
                }}
                className="gen-count-input gen-count-input--combo"
                aria-label={t('每项打乱数', 'Scrambles per event')}
              />
              <datalist id="gen-count-presets">
                {COUNT_PRESETS.map((n) => <option key={n} value={n} />)}
              </datalist>
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
          {subMode === 'batch' && (
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
          <button
            type="button"
            className="gen-btn"
            onClick={onTogglePreview}
            title={showPreview ? t('隐藏打乱图', 'Hide preview') : t('显示打乱图', 'Show preview')}
            aria-label={showPreview ? t('隐藏打乱图', 'Hide preview') : t('显示打乱图', 'Show preview')}
            aria-pressed={!showPreview}
          >
            {showPreview ? <ImageIcon size={14} /> : <ImageOff size={14} />}
          </button>
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
      {subMode === 'paste' && (
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

      {/* 批次总耗时(gen 模式才显示) */}
      {subMode === 'batch' && batchWallMs !== null && totalScrambles > 0 && (
        <div className="gen-tn-bench-total">
          {t('总耗时', 'Batch')} {formatMs(batchWallMs)}    {totalScrambles} {t('个打乱', 'scrambles')}
        </div>
      )}

      {/* 每个项目一个 sheet — gen 模式显示生成结果,text 模式显示已粘贴打乱的预览 */}
      {totalScrambles > 0 && (
        <div className="gen-tn-sheets">
          {eventsOrdered.map((ev) => {
            const arr = scramblesByEvent[ev];
            if (arr.length === 0) return null;
            const hasPreview = eventHasScramblePreview(ev);
            const ti = timing[ev];
            return (
              <div key={ev} className="gen-tn-sheet">
                <div className="gen-tn-sheet-header">
                  <EventIcon event={ev} />
                  <span>{eventDisplayName(ev, isZh)} {arr.length} {t('个打乱', 'scrambles')}</span>
                  {ti && ti.count > 0 && (
                    <span className="gen-tn-bench">
                      {formatMs(ti.wallMs)}    {t('平均', 'avg')} {formatMs(ti.avgMs)}    {t('首条', 'first')} {formatMs(ti.firstMs)}
                    </span>
                  )}
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
                          {copiedKey === key && (
                            <span className="gen-tn-copy-toast" aria-live="polite">{t('已复制', 'Copied')}</span>
                          )}
                        </td>
                        {showPreview && (
                          <td className="gen-tn-attempt-preview">
                            {hasPreview && (() => {
                              const preview = <ScramblePreview2D event={ev} scramble={s} size={48} />;
                              const href = visualcubeApiHref(ev, s);
                              return href ? (
                                <a
                                  href={href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  title={t('打开大图', 'Open full-size image')}
                                >{preview}</a>
                              ) : preview;
                            })()}
                          </td>
                        )}
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
