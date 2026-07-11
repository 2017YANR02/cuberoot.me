'use client';
/**
 * /scramble/gen — "Practice" mode. Pick one OR MORE events, then either
 *   - 生成: auto-generate N scrambles per event via cubing/scramble, or
 *   - 文本: paste your own scrambles per event (one per line).
 * Both sub-modes stack per-event sheets and share the same PDF download.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, Download, Image as ImageIcon, ImageOff, ChevronDown } from 'lucide-react';
import WcaEventSelector from '@/components/WcaEventSelector';
import NumberCommitInput from '@/components/NumberCommitInput';
import Scramble555ModePicker from '@/components/Scramble555ModePicker';
import Scramble333ModePicker from '@/components/Scramble333ModePicker';
import HighOrderNxNInput from '@/components/HighOrderNxNInput';
import { EventIcon } from '@/components/EventIcon';
import { ScramblePreview2D, eventHasScramblePreview } from '@/components/ScramblePreview2D';
import { eventDisplayName } from '@/lib/wca-events';
import { TNOODLE_WCA_EVENTS, TWIZZLE_NONWCA_EVENTS, TWIZZLE_NONWCA_APPEND, tnoodleRandomScramble } from '@/lib/cubing-scramble';
import { activeEventOf } from './_active-view';
import { CSTIMER_NONWCA_APPEND, CSTIMER_EVENT_IDS, CSTIMER_EVENTS, cstimerScramble, isCstimerEvent } from '@/lib/cstimer-scramble';
import { SHAPE_MOD_APPEND, SHAPE_MOD_EVENT_IDS, SHAPE_MOD_EVENTS, isShapeModEvent, shapeModSourceEvent } from '@/lib/shape-mod-scramble';
import type { RoundSheetInput } from './_tnoodle-pdf';
import ProgressButton from './ProgressButton';
import ScrambleLines from './ScrambleLines';
import PillToggle from '@/components/PillToggle/PillToggle';
import { displaySq1ForEvent } from './_svg/sq1_svg';

const GENERATOR_TAG = 'TNoodle-WCA-1.2.3-port';

// `onlyAvailable` 模式下 selector 用这个 set 过滤;含 WCA + twizzle 非 WCA + cstimer + shape-mod 四套。
const TNOODLE_EVENT_SET = new Set<string>([...TNOODLE_WCA_EVENTS, ...TWIZZLE_NONWCA_EVENTS, ...CSTIMER_EVENT_IDS, ...SHAPE_MOD_EVENT_IDS]);
const APPEND_EVENTS = [...TWIZZLE_NONWCA_APPEND, ...CSTIMER_NONWCA_APPEND, ...SHAPE_MOD_APPEND];
const CSTIMER_EVENT_ORDER: ReadonlyArray<string> = CSTIMER_EVENTS.map((e) => e.id);
const SHAPE_MOD_EVENT_ORDER: ReadonlyArray<string> = SHAPE_MOD_EVENTS.map((e) => e.id);
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
  /** SQ1 打乱记号:true=简写(默认),false=WCA 官方完整 (x, y) /。选了 sq1 才显开关。 */
  sq1Compact: boolean;
  onSq1CompactChange: (v: boolean) => void;
}

export default function QuickMode({ t, subMode, showPreview, onTogglePreview, sq1Compact, onSq1CompactChange }: Props) {
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
  // 多事件同选时,sheet 区只展示一个 — 跟比赛模式一致。stored 记最后一次手动选,
  // activeEventOf 在 events 变化时自动回退到 eventsOrdered[0]。
  const [viewedEvent, setViewedEvent] = useState<string | null>(null);

  const reqIdRef = useRef(0);
  const [tick, setTick] = useState(0);

  // Count combobox 自带 dropdown — datalist 会按输入过滤 option,无法关闭这个行为,
  // 所以放弃 datalist 用自己写的 popover。点输入框旁的 ▼ 切换显隐,click-outside 关。
  const [countOpen, setCountOpen] = useState(false);
  const countComboRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!countOpen) return;
    const onDown = (e: MouseEvent) => {
      if (countComboRef.current && !countComboRef.current.contains(e.target as Node)) {
        setCountOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [countOpen]);

  // 高阶 NxN(8-50)合成 event id `nxn<N>`,排在 WCA 21 项之后。
  const customNxN = useMemo(
    () => Array.from(events)
      .filter((id) => /^nxn\d+$/.test(id))
      .sort((a, b) => parseInt(a.slice(3), 10) - parseInt(b.slice(3), 10)),
    [events],
  );
  // 选中项目按 WCA 顺序固定展示 + 非 WCA twizzle + cstimer + 高阶 NxN 拼在后面
  const eventsOrdered = useMemo(
    () => [
      ...TNOODLE_WCA_EVENTS.filter((id) => events.has(id)),
      ...TWIZZLE_NONWCA_EVENTS.filter((id) => events.has(id)),
      ...CSTIMER_EVENT_ORDER.filter((id) => events.has(id)),
      ...SHAPE_MOD_EVENT_ORDER.filter((id) => events.has(id)),
      ...customNxN,
    ],
    [events, customNxN],
  );
  const eventsKey = eventsOrdered.join(',');
  const activeView = activeEventOf(viewedEvent, eventsOrdered);

  const toggleEvent = (id: string) => {
    setEvents((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // 「其他」展开态由 WcaEventSelector 回调;控制高阶 NxN 输入框的显隐。
  // 已有 customNxN chip 时也保持显示(否则用户看不到已选的高阶项无法移除)。
  const [otherExpanded, setOtherExpanded] = useState(false);
  const addHighNxN = (n: number) => {
    const id = `nxn${n}`;
    setEvents((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  // 生成模式:增量更新而非每次清空重生。
  //   - count / tick 变化 → 全量重新生成
  //   - 仅 event 增减 → 删掉移除的、为新增的现生(已有项目的打乱原样保留)
  // lastCount/lastTick 用 ref 跨 effect 持久,跟 state 一同变更时不冲突。
  const lastCountRef = useRef(count);
  const lastTickRef = useRef(tick);
  useEffect(() => {
    if (subMode !== 'batch') return;
    const fullRegen = count !== lastCountRef.current || tick !== lastTickRef.current;
    lastCountRef.current = count;
    lastTickRef.current = tick;

    const existing = generated;
    const toGenerate = fullRegen
      ? eventsOrdered
      : eventsOrdered.filter((ev) => !(ev in existing));
    const toKeep = fullRegen
      ? new Set<string>()
      : new Set(eventsOrdered.filter((ev) => ev in existing));

    // 移除已经不在 eventsOrdered 里的旧项目(用户点 ×) — 同步更新 generated/timing。
    const removedKeys = Object.keys(existing).filter((ev) => !eventsOrdered.includes(ev));
    if (toGenerate.length === 0 && removedKeys.length > 0) {
      // 纯移除:同步更新 state 即可,不发起生成。
      setGenerated((prev) => {
        const next: Record<string, string[]> = {};
        for (const ev of eventsOrdered) if (ev in prev) next[ev] = prev[ev];
        return next;
      });
      setTiming((prev) => {
        const next: typeof prev = {};
        for (const ev of eventsOrdered) if (ev in prev) next[ev] = prev[ev];
        return next;
      });
      return;
    }
    if (toGenerate.length === 0) return; // 啥也没变

    const myId = ++reqIdRef.current;
    setLoading(true);
    setCopiedKey(null);
    if (fullRegen) {
      setGenerated({});
      setTiming({});
      setBatchWallMs(null);
    }
    const total = toGenerate.length * count;
    let done = 0;
    setGenProgress({ done: 0, total });

    const buckets: Record<string, string[]> = {};
    for (const ev of toGenerate) buckets[ev] = [];

    const evWallStart: Record<string, number> = {};
    const evWallEnd: Record<string, number> = {};
    const evDurations: Record<string, number[]> = {};
    for (const ev of toGenerate) evDurations[ev] = [];

    const batchStart = performance.now();
    const promises: Promise<void>[] = [];
    for (const ev of toGenerate) {
      for (let i = 0; i < count; i++) {
        const t0 = performance.now();
        if (!(ev in evWallStart) || t0 < evWallStart[ev]) evWallStart[ev] = t0;
        promises.push(
          (isCstimerEvent(ev)
            ? cstimerScramble(ev)
            : isShapeModEvent(ev)
              ? tnoodleRandomScramble(shapeModSourceEvent(ev)!)
              : tnoodleRandomScramble(ev)).then((s) => {
            const t1 = performance.now();
            evWallEnd[ev] = !(ev in evWallEnd) || t1 > evWallEnd[ev] ? t1 : evWallEnd[ev];
            evDurations[ev].push(t1 - t0);
            if (reqIdRef.current !== myId) return;
            if (s) buckets[ev].push(s); // store raw; sq1 formatting applied at display (scramblesByEvent)
            done += 1;
            setGenProgress({ done, total });
          }),
        );
      }
    }

    (async () => {
      await Promise.all(promises);
      if (reqIdRef.current !== myId) return;
      const nextTimingDelta: Record<string, { wallMs: number; avgMs: number; firstMs: number; count: number }> = {};
      for (const ev of toGenerate) {
        const durs = evDurations[ev];
        const wall = (evWallEnd[ev] ?? 0) - (evWallStart[ev] ?? 0);
        const avg = durs.length > 0 ? durs.reduce((a, b) => a + b, 0) / durs.length : 0;
        const first = durs[0] ?? 0;
        nextTimingDelta[ev] = { wallMs: wall, avgMs: avg, firstMs: first, count: durs.length };
      }
      // 增量合并:保留 toKeep 里的旧数据,叠上新生成的 buckets,丢掉已删除的。
      setGenerated((prev) => {
        const next: Record<string, string[]> = {};
        for (const ev of eventsOrdered) {
          if (ev in buckets) next[ev] = buckets[ev];
          else if (toKeep.has(ev)) next[ev] = prev[ev];
        }
        return next;
      });
      setTiming((prev) => {
        const next: typeof prev = {};
        for (const ev of eventsOrdered) {
          if (ev in nextTimingDelta) next[ev] = nextTimingDelta[ev];
          else if (toKeep.has(ev) && prev[ev]) next[ev] = prev[ev];
        }
        return next;
      });
      // 增量时 batchWallMs 反映的是本批 wall;全量时反映整批 wall。
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
      // Generated scrambles stored raw; sq1 rendered as compact/full per the toggle.
      for (const ev of eventsOrdered) m[ev] = (generated[ev] ?? []).map((s) => displaySq1ForEvent(ev, s, sq1Compact));
    } else {
      for (const ev of eventsOrdered) m[ev] = parsePastedScrambles(pasteTexts[ev] ?? '');
    }
    return m;
  }, [subMode, eventsOrdered, generated, pasteTexts, sq1Compact]);

  const totalScrambles = useMemo(
    () => Object.values(scramblesByEvent).reduce((sum, arr) => sum + arr.length, 0),
    [scramblesByEvent],
  );

  const downloadPdf = async () => {
    if (totalScrambles === 0) return;
    setPdfBuilding(true);
    setPdfProgress({ done: 0, total: 1 });
    try {
      const { generateTnoodlePdf } = await import('./_tnoodle-pdf');
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
        onRemove={toggleEvent}
        appendEvents={APPEND_EVENTS}
        collapsibleAppend
        onExpandedChange={setOtherExpanded}
        isZh={isZh}
        onlyAvailable
        searchable
      />

      {/* 配置条:高阶 NxN(随「其他」展开) + 5x5 打乱模式(选了 5x5 才显) */}
      <div className="gen-tn-config-row">
        {(otherExpanded || customNxN.length > 0) && (
          <HighOrderNxNInput isZh={isZh} onAdd={addHighNxN}>
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
          </HighOrderNxNInput>
        )}
        <Scramble555ModePicker active555={events.has('555')} isZh={isZh} />
        <Scramble333ModePicker active333={events.has('333')} isZh={isZh} />
        {events.has('sq1') && (
          <div className="gen-sq1-format">
            <span className="gen-sq1-format-label">{t('SQ1', 'SQ1')}</span>
            <PillToggle
              value={sq1Compact}
              onChange={onSq1CompactChange}
              onLabel={t('简写', 'Compact')}
              offLabel={t('完整', 'Full')}
              ariaLabel={t('SQ1 打乱记号:简写或完整', 'SQ1 scramble notation: compact or full')}
            />
          </div>
        )}
      </div>

      <div className="gen-tn-controls" style={{ marginTop: '8px' }}>
        <div className="gen-control-group gen-control-actions">
          {subMode === 'batch' ? (
            <div className="gen-count-row">
              <div ref={countComboRef} className="gen-count-combo">
                <NumberCommitInput
                  min={1}
                  max={COUNT_MAX}
                  value={count}
                  onCommit={setCount}
                  className="gen-count-input gen-count-input--combo"
                  aria-label={t('每项打乱数', 'Scrambles per event')}
                />
                <button
                  type="button"
                  className="gen-count-combo-trigger"
                  onClick={() => setCountOpen((o) => !o)}
                  aria-label={t('打开预设', 'Open presets')}
                  aria-expanded={countOpen}
                >
                  <ChevronDown size={14} />
                </button>
                {countOpen && (
                  <ul className="gen-count-combo-list" role="listbox">
                    {COUNT_PRESETS.map((n) => (
                      <li
                        key={n}
                        role="option"
                        aria-selected={count === n}
                        className={`gen-count-combo-option${count === n ? ' is-active' : ''}`}
                        onClick={() => { setCount(n); setCountOpen(false); }}
                      >
                        {n}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : null /* paste 模式的提示语已合并到 textarea placeholder */}
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

      {/* 多项目时,view-selector 同比赛模式 — 切换当前展示哪个 sheet/paste 块 */}
      {eventsOrdered.length >= 2 && activeView && (
        <WcaEventSelector
          availableEvents={new Set(eventsOrdered)}
          selectedEvent={activeView}
          onSelect={setViewedEvent}
          appendEvents={APPEND_EVENTS}
          onlyAvailable
          isZh={isZh}
        />
      )}

      {/* text 模式:每个选中项目一块输入区(只渲染 activeView 那块) */}
      {subMode === 'paste' && activeView && (
        <div className="gen-tn-paste-blocks">
          {eventsOrdered.filter((ev) => ev === activeView).map((ev) => (
            <div key={ev} className="gen-tn-paste-block">
              <div className="gen-tn-paste-block-header">
                <EventIcon event={ev} />
                <span>{eventDisplayName(ev, isZh)}</span>
              </div>
              <textarea
                className="gen-tn-paste-area"
                value={pasteTexts[ev] ?? ''}
                onChange={(e) => setPasteTexts((prev) => ({ ...prev, [ev]: e.target.value }))}
                placeholder={t('每行一条打乱;开头 "1. " / "1) " 编号会自动去掉', 'One scramble per line; leading "1. " / "1) " numbering is auto-stripped')}
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

      {/* 当前 activeView 一个 sheet — gen 模式显示生成结果,text 模式显示已粘贴打乱的预览 */}
      {totalScrambles > 0 && activeView && (
        <div className="gen-tn-sheets">
          {eventsOrdered.filter((ev) => ev === activeView).map((ev) => {
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
                            {hasPreview && (
                              <ScramblePreview2D
                                event={ev}
                                scramble={s}
                                size={48}
                                fullSizeLink
                                linkTitle={t('打开大图', 'Open full-size image')}
                              />
                            )}
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
