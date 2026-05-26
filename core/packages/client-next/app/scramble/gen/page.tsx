'use client';

/**
 * /scramble/gen — batch scramble generator (Next.js port).
 *
 * Three modes:
 *   - comp:   pick a WCA competition → fetch WCIF → generate per-round
 *             scrambles, with PDF export (tnoodle-style sheet).
 *   - batch:  pick one or more events + count → generate scrambles
 *   - paste:  paste your own scrambles per event
 *
 * Worker fix: cubing.js's search worker uses `import.meta.resolve(...)`
 * which Turbopack can't always follow. We flip on
 * `prioritizeEsbuildWorkaroundForWorkerInstantiation: true` BEFORE any
 * scramble call, which makes cubing use a bundler-friendly dynamic import
 * path instead. Side-effect: cubing logs one extra warning during init.
 *
 * Ported from packages/client/src/pages/gen/{GenPage,QuickMode,TNoodleMode}.tsx
 * with these intentional v1 reductions:
 *   - cstimer-only / shape-mod / m2p / 5x5-server-side engines not wired (cubing/scramble only)
 *   - high-order NxN (nxn8+) not exposed
 *   - MBLD `cubes-per-attempt` config not exposed (uses default 8)
 *   - clock color picker not exposed (uses default scheme)
 *   - FMC translations picker not exposed (PDF emits English only)
 */

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Shuffle, HelpCircle, RefreshCw, Loader2, Copy, Check, Download, X, Edit3,
  Image as ImageIcon, ImageOff,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import LangToggle from '@/components/LangToggle';
import ThemeToggle from '@/components/ThemeToggle';
import WcaEventSelector from '@/components/WcaEventSelector';
import { CompPicker } from '@/components/CompPicker';
import { EventIcon } from '@/components/EventIcon';
import { ScramblePreview2D, eventHasScramblePreview } from '@/components/ScramblePreview2D';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { eventDisplayName } from '@/lib/wca-events';
import { fetchCompRounds, fetchCompName } from '@/lib/comp-wcif';
import { localizeCompName } from '@/lib/comp-localize';
import type { Comp } from '@/lib/comp-search';
import {
  allowedFormats, FORMAT_LABEL, formatAttempts, DEFAULT_EXTRA_COUNT,
  defaultEventConfig, defaultRoundConfig, wcifFormatToWcaFormat,
  type EventConfig, type WcaFormat,
} from './_wca-round';
import type { RoundSheetInput, AttemptInput } from './_tnoodle-pdf';
import './gen.css';

const GENERATOR_TAG = 'TNoodle-WCA-1.2.3-port';

// Try to coax cubing.js's search-worker bootstrap onto a path Turbopack can
// statically follow (dynamic `import("./search-worker-entry.js")`).
let cubingWorkerHintApplied = false;
async function applyCubingWorkerHint(): Promise<void> {
  if (cubingWorkerHintApplied) return;
  cubingWorkerHintApplied = true;
  try {
    const { setSearchDebug } = await import('cubing/search');
    setSearchDebug({
      prioritizeEsbuildWorkaroundForWorkerInstantiation: true,
      showWorkerInstantiationWarnings: false,
    });
  } catch (err) {
    console.warn('[gen] setSearchDebug not available', err);
  }
}

const SUPPORTED_EVENTS: ReadonlyArray<string> = [
  '333', '222', '444', '555', '666', '777',
  '333bf', '333fm', '333oh', '333mbf',
  'clock', 'minx', 'pyram', 'skewb', 'sq1',
  '444bf', '555bf',
];
const SUPPORTED_EVENT_SET = new Set(SUPPORTED_EVENTS);

const COUNT_PRESETS = [1, 5, 12, 25, 50];
const COUNT_MAX = 200;

type Mode = 'comp' | 'batch' | 'paste';
const VALID_MODES: ReadonlySet<Mode> = new Set(['comp', 'batch', 'paste']);
const LEGACY_MODE_ALIAS: Record<string, Mode> = {
  mock: 'comp', wca: 'comp', tnoodle: 'comp', import: 'comp',
  gen: 'batch', practice: 'batch', quick: 'batch',
  text: 'paste',
};

function parsePastedScrambles(text: string): string[] {
  return text.split(/\r?\n/)
    .map((line) => line.replace(/^\s*\d+\s*[.)、:]\s*/, '').trim())
    .filter((line) => line.length > 0);
}

interface RoundSheet {
  event: string;
  roundIdx: number;
  groupIdx: number;
  format: WcaFormat;
  attemptNumber?: number;
  attempts: AttemptInput[];
  totalGroups?: number;
  copies?: number;
}

async function generateOne(event: string): Promise<string> {
  await applyCubingWorkerHint();
  const { randomScrambleForEvent } = await import('cubing/scramble');
  // cubing/scramble doesn't ship 333ft / 333mbo; map to 333 / 333bf.
  const cubingId = event === '333ft' ? '333'
    : event === '333mbo' ? '333bf'
    : event === '333mbf' ? '333bf'
    : event;
  const alg = await randomScrambleForEvent(cubingId);
  return alg.toString();
}

function GenPageInner() {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const t = (zh: string, en: string) => (isZh ? zh : en);
  useDocumentTitle('打乱生成器', 'Scramble Generator');

  const searchParams = useSearchParams();
  const router = useRouter();

  const rawParam = searchParams.get('mode') ?? '';
  const aliased = (LEGACY_MODE_ALIAS[rawParam] ?? rawParam) as Mode;
  const mode: Mode = VALID_MODES.has(aliased) ? aliased : 'comp';

  const setMode = (next: Mode) => {
    const p = new URLSearchParams(Array.from(searchParams.entries()));
    p.set('mode', next);
    router.replace(`?${p.toString()}`, { scroll: false });
  };

  useEffect(() => {
    if (rawParam && rawParam !== mode) {
      const p = new URLSearchParams(Array.from(searchParams.entries()));
      p.set('mode', mode);
      router.replace(`?${p.toString()}`, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="gen-page">
      <header className="gen-header">
        <div className="gen-title">
          <Shuffle size={20} className="gen-title-icon" />
          <h1>
            {t('打乱生成器', 'Scramble Generator')}
            <Link
              href="/scramble/gen-about"
              className="gen-title-help"
              title={t('生成器是怎么工作的?', 'How does the generator work?')}
              aria-label={t('查看打乱生成器说明', 'About the scramble generator')}
            >
              <HelpCircle size={18} strokeWidth={1.75} />
            </Link>
          </h1>
        </div>
        <div className="gen-mode-chips" role="tablist">
          {(['comp', 'batch', 'paste'] as Mode[]).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              className={`gen-mode-chip${mode === m ? ' is-active' : ''}`}
              onClick={() => setMode(m)}
            >
              {m === 'comp' ? t('比赛', 'Comp')
                : m === 'batch' ? t('批量', 'Batch')
                : t('输入', 'Paste')}
            </button>
          ))}
        </div>
        <LangToggle variant="inline" />
        <ThemeToggle />
      </header>

      <main className="gen-main" style={{ padding: '0 16px 32px', maxWidth: 980, margin: '0 auto' }}>
        {mode === 'comp' && <CompMode t={t} isZh={isZh} />}
        {mode === 'batch' && <BatchMode t={t} isZh={isZh} />}
        {mode === 'paste' && <PasteMode t={t} isZh={isZh} />}
      </main>
    </div>
  );
}

// ─── Comp mode (TNoodle) ──────────────────────────────────────────────
function CompMode({ t, isZh }: { t: (zh: string, en: string) => string; isZh: boolean }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const urlComp = searchParams.get('comp') ?? '';
  const autoLoadedRef = useRef<string | null>(null);

  const [compInput, setCompInput] = useState('');
  const [loadedCompId, setLoadedCompId] = useState<string | null>(null);
  const [loadedCompName, setLoadedCompName] = useState<string | null>(null);
  const [events, setEvents] = useState<Record<string, EventConfig>>({ '333': defaultEventConfig('333') });
  const [sheets, setSheets] = useState<RoundSheet[] | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState<{ done: number; total: number } | null>(null);
  const [pdfBuilding, setPdfBuilding] = useState(false);
  const [pdfProgress, setPdfProgress] = useState<{ done: number; total: number } | null>(null);
  const [showPreview, setShowPreview] = useState(true);
  const [activeView, setActiveView] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const generateAbortRef = useRef(false);

  const enabledEvents = useMemo(
    () => SUPPORTED_EVENTS.filter((e) => events[e]),
    [events],
  );

  const toggleEvent = (e: string) => {
    setEvents((prev) => {
      const next = { ...prev };
      if (next[e]) delete next[e];
      else next[e] = defaultEventConfig(e);
      return next;
    });
  };

  const setRoundCount = (e: string, count: number) => {
    setEvents((prev) => {
      const cfg = prev[e];
      if (!cfg) return prev;
      const rounds = [...cfg.rounds];
      while (rounds.length < count) rounds.push(defaultRoundConfig(e));
      while (rounds.length > count) rounds.pop();
      return { ...prev, [e]: { ...cfg, rounds } };
    });
  };

  const updateRound = (e: string, ri: number, patch: Partial<EventConfig['rounds'][number]>) => {
    setEvents((prev) => {
      const cfg = prev[e];
      if (!cfg) return prev;
      const rounds = cfg.rounds.map((r, i) => (i === ri ? { ...r, ...patch } : r));
      return { ...prev, [e]: { ...cfg, rounds } };
    });
  };

  const totalAttempts = useMemo(() => {
    let n = 0;
    for (const ev of enabledEvents) {
      const cfg = events[ev];
      for (const r of cfg.rounds) {
        const sets = Math.max(1, r.scrambleSets);
        if (ev === '333mbf' || ev === '333mbo') {
          n += formatAttempts(r.format) * (cfg.mbldCubes ?? 8) * sets;
        } else if (ev === '333fm') {
          n += formatAttempts(r.format) * sets;
        } else {
          n += (formatAttempts(r.format) + DEFAULT_EXTRA_COUNT) * sets;
        }
      }
    }
    return n;
  }, [enabledEvents, events]);

  const loaded = sheets && sheets.length > 0;

  // ── Load WCIF for a competition ─────────────────────────────────
  const loadWcif = useCallback(async (compId: string, nameOverride?: string) => {
    setError(null);
    try {
      const [rounds, name] = await Promise.all([
        fetchCompRounds(compId),
        nameOverride ? Promise.resolve(nameOverride) : fetchCompName(compId),
      ]);
      const next: Record<string, EventConfig> = {};
      for (const [evId, formats] of Object.entries(rounds)) {
        if (!SUPPORTED_EVENT_SET.has(evId)) continue;
        const cfg = defaultEventConfig(evId);
        cfg.rounds = formats.map((f) => ({
          format: wcifFormatToWcaFormat(f),
          scrambleSets: 1,
          copies: 1,
        }));
        next[evId] = cfg;
      }
      setEvents(next);
      setLoadedCompId(compId);
      setLoadedCompName(name);
      setCompInput(localizeCompName(compId, name ?? '', isZh));
      const p = new URLSearchParams(Array.from(searchParams.entries()));
      p.set('comp', compId);
      router.replace(`?${p.toString()}`, { scroll: false });
    } catch (err) {
      setError(`Failed to load competition: ${(err as Error).message}`);
    }
  }, [isZh, searchParams, router]);

  useEffect(() => {
    if (!urlComp || urlComp === loadedCompId || urlComp === autoLoadedRef.current) return;
    autoLoadedRef.current = urlComp;
    void loadWcif(urlComp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlComp]);

  const onPickComp = (c: Comp) => {
    void loadWcif(c.id, c.name);
  };

  const clearComp = () => {
    setLoadedCompId(null);
    setLoadedCompName(null);
    setCompInput('');
    setSheets(null);
    autoLoadedRef.current = null;
    const p = new URLSearchParams(Array.from(searchParams.entries()));
    p.delete('comp');
    router.replace(`?${p.toString()}`, { scroll: false });
  };

  // ── Generate scrambles ──────────────────────────────────────────
  const generate = async () => {
    generateAbortRef.current = false;
    setGenerating(true);
    setSheets(null);
    let done = 0;
    const total = totalAttempts;
    setGenProgress({ done: 0, total });
    const yieldToUi = () => new Promise<void>((r) => setTimeout(r, 0));
    const ABORT = {};
    const tick = async () => {
      if (generateAbortRef.current) throw ABORT;
      done += 1;
      setGenProgress({ done, total });
      if (done % 2 === 0) await yieldToUi();
    };

    try {
      const out: RoundSheet[] = [];
      for (const ev of enabledEvents) {
        if (generateAbortRef.current) break;
        const cfg = events[ev];
        for (let ri = 0; ri < cfg.rounds.length; ri++) {
          if (generateAbortRef.current) break;
          const round = cfg.rounds[ri];
          const mainCount = formatAttempts(round.format);
          for (let g = 0; g < Math.max(1, round.scrambleSets); g++) {
            if (generateAbortRef.current) break;
            if (ev === '333mbf' || ev === '333mbo') {
              const cubes = cfg.mbldCubes ?? 8;
              for (let a = 0; a < mainCount; a++) {
                const rows: AttemptInput[] = [];
                for (let c = 0; c < cubes; c++) {
                  const s = await generateOne('333bf');
                  rows.push({ label: String(c + 1), scramble: s, isExtra: false });
                  await tick();
                }
                out.push({
                  event: ev, roundIdx: ri, groupIdx: g, format: round.format,
                  attemptNumber: a, attempts: rows, copies: round.copies,
                  totalGroups: round.scrambleSets,
                });
              }
            } else if (ev === '333fm') {
              for (let a = 0; a < mainCount; a++) {
                const s = await generateOne(ev);
                await tick();
                out.push({
                  event: ev, roundIdx: ri, groupIdx: g, format: round.format,
                  attemptNumber: a,
                  attempts: [{ label: '1', scramble: s, isExtra: false }],
                  copies: round.copies, totalGroups: round.scrambleSets,
                });
              }
            } else {
              const attempts: AttemptInput[] = [];
              for (let i = 0; i < mainCount; i++) {
                const s = await generateOne(ev);
                attempts.push({ label: String(i + 1), scramble: s, isExtra: false });
                await tick();
              }
              for (let i = 0; i < DEFAULT_EXTRA_COUNT; i++) {
                const s = await generateOne(ev);
                attempts.push({ label: `E${i + 1}`, scramble: s, isExtra: true });
                await tick();
              }
              out.push({
                event: ev, roundIdx: ri, groupIdx: g, format: round.format,
                attempts, copies: round.copies, totalGroups: round.scrambleSets,
              });
            }
          }
        }
      }
      if (!generateAbortRef.current) {
        setSheets(out);
        setActiveView(null);
      }
    } catch (err) {
      if (err !== ABORT) {
        console.error('[gen/comp] generate failed', err);
        setError(`Generation failed: ${(err as Error).message}`);
      }
    } finally {
      setGenerating(false);
      setGenProgress(null);
    }
  };

  // ── PDF export ──────────────────────────────────────────────────
  const downloadPdf = async () => {
    if (!sheets || sheets.length === 0) return;
    setPdfBuilding(true);
    setPdfProgress({ done: 0, total: 1 });
    try {
      const { generateTnoodlePdf } = await import('./_tnoodle-pdf');
      const sheetInputs: RoundSheetInput[] = sheets.map((s) => ({
        event: s.event,
        roundIdx: s.roundIdx,
        groupIdx: s.groupIdx,
        format: s.format,
        attemptNumber: s.attemptNumber,
        attempts: s.attempts,
        copies: s.copies,
        totalGroups: s.totalGroups,
      }));
      const today = new Date().toISOString().slice(0, 10);
      const title = loadedCompId
        ? (loadedCompName ?? loadedCompId)
        : (compInput.trim() || `Scrambles for ${today}`);
      const blob = await generateTnoodlePdf(sheetInputs, {
        competitionTitle: title,
        generatorTag: GENERATOR_TAG,
        isZh,
        showPreview,
        onProgress: (done, total) => setPdfProgress({ done, total }),
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${title.replace(/[^\w一-龥-]+/g, '_')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (err) {
      console.error('[gen/comp] pdf failed', err);
      alert(`PDF generation failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setPdfBuilding(false);
      setPdfProgress(null);
    }
  };

  // ── View filter (which event's sheets to show) ──────────────────
  const eventsInSheets = useMemo(
    () => Array.from(new Set((sheets ?? []).map((s) => s.event))),
    [sheets],
  );
  const currentView = activeView && eventsInSheets.includes(activeView)
    ? activeView
    : (eventsInSheets.includes('333') ? '333' : eventsInSheets[0] ?? null);
  const visibleSheets = sheets ? sheets.filter((s) => s.event === currentView) : [];

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '16px 0', flexWrap: 'wrap' }}>
        {loadedCompId ? (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '6px 10px', border: '1px solid var(--gen-border-strong, #d4d4d4)', borderRadius: 4 }}>
            <Link
              href={`/wca/comp/${encodeURIComponent(loadedCompId)}`}
              style={{ color: 'var(--gen-text, #171717)', textDecoration: 'none' }}
            >
              {loadedCompName ?? loadedCompId}
            </Link>
            <button
              type="button"
              onClick={clearComp}
              className="gen-btn"
              style={{ marginLeft: 4 }}
              aria-label={t('取消比赛', 'Clear competition')}
              title={t('取消比赛', 'Clear competition')}
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <CompPicker
            className="gen-tn-comp-picker"
            value={compInput}
            onChange={setCompInput}
            onUrlPaste={(wcaId) => void loadWcif(wcaId)}
            onPick={onPickComp}
            isZh={isZh}
            placeholder={t('输入 WCA 比赛或链接,或自定义比赛名', 'WCA comp or link, or custom name')}
          />
        )}
      </div>

      {!loaded && (
        <>
          <div style={{ margin: '16px 0' }}>
            <WcaEventSelector
              availableEvents={SUPPORTED_EVENT_SET}
              selectedEvents={new Set(Object.keys(events))}
              badges={Object.fromEntries(Object.entries(events).map(([ev, cfg]) => [ev, cfg.rounds.length]))}
              onToggle={(ev) => {
                if (!events[ev]) toggleEvent(ev);
                else {
                  const cur = events[ev].rounds.length;
                  if (cur >= 4) toggleEvent(ev);
                  else setRoundCount(ev, cur + 1);
                }
              }}
              onRemove={toggleEvent}
              isZh={isZh}
              onlyAvailable
            />
          </div>

          {enabledEvents.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '16px 0' }}>
              {enabledEvents.map((ev) => {
                const cfg = events[ev];
                return (
                  <div key={ev} style={{ padding: 8, border: '1px solid var(--gen-border, #e5e5e5)', borderRadius: 6, background: 'var(--gen-surface, #fff)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <EventIcon event={ev} />
                      <span style={{ fontWeight: 600 }}>{eventDisplayName(ev, isZh)}</span>
                      <button
                        type="button"
                        onClick={() => toggleEvent(ev)}
                        style={{ marginLeft: 'auto', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--gen-text-sub, #737373)' }}
                        title={t('移除项目', 'Remove event')}
                      >
                        <X size={14} />
                      </button>
                    </div>
                    {cfg.rounds.map((r, ri) => (
                      <div key={ri} style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '4px 0', fontSize: 13 }}>
                        <span style={{ width: 28, color: 'var(--gen-text-sub, #737373)' }}>R{ri + 1}</span>
                        <select
                          value={r.format}
                          onChange={(e) => updateRound(ev, ri, { format: e.target.value as WcaFormat })}
                          style={{ padding: '2px 4px', fontSize: 13 }}
                        >
                          {allowedFormats(ev).map((f) => (
                            <option key={f} value={f}>{FORMAT_LABEL[f]}</option>
                          ))}
                        </select>
                        <label style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                          <span>{t('组', 'Sets')}</span>
                          <input
                            type="number" min={1} max={20} value={r.scrambleSets}
                            onChange={(e) => updateRound(ev, ri, { scrambleSets: parseInt(e.target.value, 10) || 1 })}
                            style={{ width: 48, padding: '2px 4px' }}
                          />
                        </label>
                        <label style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                          <span>{t('份', 'Copies')}</span>
                          <input
                            type="number" min={1} max={50} value={r.copies}
                            onChange={(e) => updateRound(ev, ri, { copies: parseInt(e.target.value, 10) || 1 })}
                            style={{ width: 48, padding: '2px 4px' }}
                          />
                        </label>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '16px 0', flexWrap: 'wrap' }}>
        {loaded ? (
          <button type="button" className="gen-btn" onClick={() => { setSheets(null); setActiveView(null); }} title={t('重新配置', 'Reconfigure')}>
            <Edit3 size={14} />
          </button>
        ) : (
          <button
            type="button"
            onClick={generate}
            disabled={enabledEvents.length === 0 || generating}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px',
              fontSize: 14, fontWeight: 600,
              border: '1px solid var(--gen-accent, #c15f3c)',
              background: generating ? 'var(--gen-accent-soft, rgba(193,95,60,0.08))' : 'var(--gen-accent, #c15f3c)',
              color: generating ? 'var(--gen-accent, #c15f3c)' : '#fff',
              borderRadius: 4, cursor: generating ? 'wait' : 'pointer',
            }}
          >
            {generating ? <Loader2 size={14} className="gen-spin" /> : <RefreshCw size={14} />}
            {generating ? `${genProgress?.done ?? 0}/${genProgress?.total ?? totalAttempts}` : t(`生成 (${totalAttempts})`, `Generate (${totalAttempts})`)}
          </button>
        )}
        <button
          type="button"
          className="gen-btn"
          onClick={() => setShowPreview((v) => !v)}
          title={showPreview ? t('隐藏打乱图', 'Hide preview') : t('显示打乱图', 'Show preview')}
        >
          {showPreview ? <ImageIcon size={14} /> : <ImageOff size={14} />}
        </button>
        {loaded && (
          <button
            type="button"
            onClick={downloadPdf}
            disabled={pdfBuilding}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px',
              fontSize: 14, fontWeight: 600,
              border: '1px solid var(--gen-border-strong, #d4d4d4)',
              background: 'var(--gen-surface, #fff)',
              color: 'var(--gen-text, #171717)',
              borderRadius: 4, cursor: pdfBuilding ? 'wait' : 'pointer',
            }}
            title={t('下载 PDF (tnoodle 风格)', 'Download PDF (tnoodle style)')}
          >
            {pdfBuilding ? <Loader2 size={14} className="gen-spin" /> : <Download size={14} />}
            {pdfBuilding ? `${pdfProgress?.done ?? 0}/${pdfProgress?.total ?? 1}` : 'PDF'}
          </button>
        )}
      </div>

      {error && <div style={{ color: 'var(--gen-accent, #c15f3c)', margin: '8px 0', fontSize: 13 }}>{error}</div>}

      {loaded && currentView && (
        <>
          <div style={{ margin: '8px 0' }}>
            <WcaEventSelector
              availableEvents={new Set(eventsInSheets)}
              selectedEvent={currentView}
              onSelect={setActiveView}
              isZh={isZh}
              onlyAvailable
            />
          </div>
          <div className="gen-tn-sheets">
            {visibleSheets.map((sh, i) => (
              <SheetCard key={`${sh.event}-${sh.roundIdx}-${sh.groupIdx}-${i}`} sheet={sh} isZh={isZh} t={t} showPreview={showPreview} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function SheetCard({
  sheet, isZh, t, showPreview,
}: { sheet: RoundSheet; isZh: boolean; t: (zh: string, en: string) => string; showPreview: boolean }) {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const groupSuffix = (sheet.totalGroups ?? 1) > 1
    ? (isZh ? ` ${String.fromCharCode(65 + sheet.groupIdx)} 组` : ` Group ${String.fromCharCode(65 + sheet.groupIdx)}`)
    : '';
  const roundLabel = sheet.roundIdx === 3
    ? t('决赛', 'Final')
    : `${t('第', 'Round')} ${sheet.roundIdx + 1}${t('轮', '')}`;
  const attemptSuffix = sheet.attemptNumber !== undefined
    ? ` ${t('第', 'Attempt')} ${sheet.attemptNumber + 1}${t('次', '')}`
    : '';
  const copyAttempt = async (i: number, scramble: string) => {
    if (!scramble) return;
    try {
      await navigator.clipboard.writeText(scramble);
      setCopiedIdx(i);
      setTimeout(() => setCopiedIdx((c) => (c === i ? null : c)), 1200);
    } catch { /* swallow */ }
  };
  return (
    <section style={{ margin: '12px 0', padding: 12, background: 'var(--gen-surface, #fff)', border: '1px solid var(--gen-border, #e5e5e5)', borderRadius: 6 }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <EventIcon event={sheet.event} />
        <span style={{ fontWeight: 600 }}>{eventDisplayName(sheet.event, isZh)} {roundLabel}{groupSuffix}{attemptSuffix}</span>
      </header>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          {sheet.attempts.map((a, i) => {
            const showDivider = a.isExtra && (i === 0 || !sheet.attempts[i - 1].isExtra);
            return (
              <>
                {showDivider && (
                  <tr key={`div-${i}`}>
                    <td colSpan={showPreview ? 3 : 2} style={{ textAlign: 'center', padding: '8px 0', fontWeight: 600, color: 'var(--gen-text-sub, #737373)', borderTop: '1px dashed var(--gen-border-strong, #d4d4d4)' }}>
                      {t('附加打乱', 'Extra Scrambles')}
                    </td>
                  </tr>
                )}
                <tr
                  key={i}
                  onClick={() => copyAttempt(i, a.scramble)}
                  style={{ cursor: 'pointer' }}
                  title={t('点击复制', 'Click to copy')}
                >
                  <td style={{ width: 32, padding: '4px 6px', textAlign: 'right', fontSize: 12, color: 'var(--gen-text-mute, #95938E)', verticalAlign: 'top' }}>
                    {a.label}.
                  </td>
                  <td style={{
                    padding: '4px 8px',
                    fontFamily: 'JetBrains Mono, Menlo, Consolas, monospace',
                    fontSize: 13, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    color: copiedIdx === i ? 'var(--gen-accent, #c15f3c)' : 'var(--gen-text, #171717)',
                  }}>
                    {a.scramble || '(empty)'}
                  </td>
                  {showPreview && (
                    <td style={{ padding: '4px 8px', width: 110 }} onClick={(e) => e.stopPropagation()}>
                      {eventHasScramblePreview(sheet.event) && a.scramble && (
                        <ScramblePreview2D event={sheet.event} scramble={a.scramble} size={sheet.event === 'sq1' ? 56 : 48} />
                      )}
                    </td>
                  )}
                </tr>
              </>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

// ─── Batch mode ───────────────────────────────────────────────────────
function BatchMode({ t, isZh }: { t: (zh: string, en: string) => string; isZh: boolean }) {
  const [events, setEvents] = useState<Set<string>>(() => new Set(['333']));
  const [count, setCount] = useState<number>(5);
  const [generated, setGenerated] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [showPreview, setShowPreview] = useState(true);

  const toggleEvent = useCallback((id: string) => {
    setEvents((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const eventsOrdered = useMemo(
    () => SUPPORTED_EVENTS.filter((id) => events.has(id)),
    [events],
  );
  const eventsKey = eventsOrdered.join(',');

  useEffect(() => {
    if (eventsOrdered.length === 0) {
      setGenerated({});
      return;
    }
    let cancelled = false;
    setLoading(true);
    setCopiedKey(null);
    const total = eventsOrdered.length * count;
    let done = 0;
    setProgress({ done: 0, total });
    const buckets: Record<string, string[]> = {};
    for (const ev of eventsOrdered) buckets[ev] = [];

    (async () => {
      try {
        const promises: Promise<void>[] = [];
        for (const ev of eventsOrdered) {
          for (let i = 0; i < count; i++) {
            promises.push(
              generateOne(ev).then((s) => {
                if (cancelled) return;
                buckets[ev].push(s);
                done++;
                setProgress({ done, total });
              }).catch((err) => {
                console.warn(`[gen] ${ev} scramble failed`, err);
                if (cancelled) return;
                buckets[ev].push(`(error: ${(err as Error).message})`);
                done++;
                setProgress({ done, total });
              }),
            );
          }
        }
        await Promise.all(promises);
        if (cancelled) return;
        setGenerated(buckets);
        setLoading(false);
        setProgress(null);
      } catch (err) {
        if (cancelled) return;
        console.error('[gen] batch failed', err);
        setLoading(false);
        setProgress(null);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventsKey, count, tick]);

  const regenerate = () => setTick((n) => n + 1);

  const copyOne = async (ev: string, idx: number, scramble: string) => {
    try {
      await navigator.clipboard.writeText(scramble);
      const key = `${ev}|${idx}`;
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((c) => (c === key ? null : c)), 1200);
    } catch { /* swallow */ }
  };
  const copyAll = async (ev: string) => {
    const arr = generated[ev];
    if (!arr || arr.length === 0) return;
    const text = arr.map((s, i) => `${i + 1}. ${s}`).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      const key = `${ev}|all`;
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((c) => (c === key ? null : c)), 1200);
    } catch { /* swallow */ }
  };

  return (
    <div>
      <div style={{ margin: '16px 0' }}>
        <WcaEventSelector
          availableEvents={SUPPORTED_EVENT_SET}
          selectedEvents={events}
          onToggle={toggleEvent}
          onRemove={toggleEvent}
          isZh={isZh}
          onlyAvailable
        />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, margin: '12px 0' }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
          <span>{t('每项', 'Per event')}</span>
          <input
            type="number" min={1} max={COUNT_MAX} value={count}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10);
              if (Number.isFinite(n) && n >= 1 && n <= COUNT_MAX) setCount(n);
            }}
            style={{ width: 70, padding: '4px 8px', borderRadius: 4, border: '1px solid var(--gen-border-strong, #d4d4d4)' }}
          />
        </label>
        {COUNT_PRESETS.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setCount(n)}
            style={{
              padding: '4px 10px',
              border: count === n ? '1px solid var(--gen-accent, #c15f3c)' : '1px solid var(--gen-border-strong, #d4d4d4)',
              background: count === n ? 'var(--gen-accent, #c15f3c)' : 'var(--gen-surface, #fff)',
              color: count === n ? '#fff' : 'var(--gen-text-sub, #737373)',
              borderRadius: 4, cursor: 'pointer', fontSize: 13,
            }}
          >
            {n}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setShowPreview((v) => !v)}
          className="gen-btn"
          title={showPreview ? t('隐藏打乱图', 'Hide preview') : t('显示打乱图', 'Show preview')}
        >
          {showPreview ? <ImageIcon size={14} /> : <ImageOff size={14} />}
        </button>
        <button
          type="button"
          onClick={regenerate}
          disabled={loading || eventsOrdered.length === 0}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px',
            fontSize: 14, fontWeight: 600,
            border: '1px solid var(--gen-accent, #c15f3c)',
            background: loading ? 'var(--gen-accent-soft, rgba(193,95,60,0.08))' : 'var(--gen-accent, #c15f3c)',
            color: loading ? 'var(--gen-accent, #c15f3c)' : '#fff',
            borderRadius: 4, cursor: loading ? 'wait' : 'pointer',
            marginLeft: 'auto',
          }}
        >
          {loading ? <Loader2 size={14} className="gen-spin" /> : <RefreshCw size={14} />}
          {loading ? `${progress?.done ?? 0}/${progress?.total ?? count}` : t(`生成 (${count}/项)`, `Generate (${count}/event)`)}
        </button>
      </div>

      {eventsOrdered.length === 0 && (
        <p style={{ fontSize: 14, color: 'var(--gen-text-mute, #95938E)', margin: '24px 0', textAlign: 'center' }}>
          {t('请先选择项目', 'Pick at least one event')}
        </p>
      )}

      <div className="gen-tn-sheets">
        {eventsOrdered.map((ev) => {
          const arr = generated[ev];
          if (!arr || arr.length === 0) return null;
          return (
            <section key={ev} style={{ margin: '16px 0', padding: 12, background: 'var(--gen-surface, #fff)', border: '1px solid var(--gen-border, #e5e5e5)', borderRadius: 6 }}>
              <header style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <EventIcon event={ev} />
                <span style={{ fontSize: 14, fontWeight: 600 }}>{eventDisplayName(ev, isZh)}</span>
                <span style={{ fontSize: 12, color: 'var(--gen-text-mute, #95938E)' }}>{arr.length}</span>
                <button
                  type="button"
                  onClick={() => copyAll(ev)}
                  style={{
                    marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '4px 8px', fontSize: 12,
                    border: '1px solid var(--gen-border-strong, #d4d4d4)',
                    background: copiedKey === `${ev}|all` ? 'var(--gen-accent, #c15f3c)' : 'var(--gen-surface, #fff)',
                    color: copiedKey === `${ev}|all` ? '#fff' : 'var(--gen-text-sub, #737373)',
                    borderRadius: 4, cursor: 'pointer',
                  }}
                >
                  {copiedKey === `${ev}|all` ? <Check size={12} /> : <Copy size={12} />}
                  {t('复制全部', 'Copy all')}
                </button>
              </header>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  {arr.map((s, i) => {
                    const key = `${ev}|${i}`;
                    return (
                      <tr
                        key={`${i}-${s.slice(0, 4)}`}
                        onClick={() => copyOne(ev, i, s)}
                        title={t('点击复制', 'Click to copy')}
                        style={{ cursor: 'pointer' }}
                      >
                        <td style={{ width: 32, padding: '4px 6px', fontVariantNumeric: 'tabular-nums', textAlign: 'right', fontSize: 12, color: 'var(--gen-text-mute, #95938E)', verticalAlign: 'top' }}>{i + 1}.</td>
                        <td style={{ padding: '4px 8px', fontFamily: 'JetBrains Mono, Menlo, Consolas, monospace', fontSize: 13, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: copiedKey === key ? 'var(--gen-accent, #c15f3c)' : 'var(--gen-text, #171717)' }}>{s}</td>
                        {showPreview && (
                          <td style={{ width: 110, padding: '4px 8px' }} onClick={(e) => e.stopPropagation()}>
                            {eventHasScramblePreview(ev) && s && !s.startsWith('(error') && (
                              <ScramblePreview2D event={ev} scramble={s} size={ev === 'sq1' ? 56 : 48} />
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          );
        })}
      </div>
    </div>
  );
}

// ─── Paste mode ───────────────────────────────────────────────────────
function PasteMode({ t, isZh }: { t: (zh: string, en: string) => string; isZh: boolean }) {
  const [events, setEvents] = useState<Set<string>>(() => new Set(['333']));
  const [pasteTexts, setPasteTexts] = useState<Record<string, string>>({});
  const [showPreview, setShowPreview] = useState(true);

  const toggleEvent = useCallback((id: string) => {
    setEvents((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const eventsOrdered = useMemo(
    () => SUPPORTED_EVENTS.filter((id) => events.has(id)),
    [events],
  );
  const parsed = useMemo(() => {
    const m: Record<string, string[]> = {};
    for (const ev of eventsOrdered) m[ev] = parsePastedScrambles(pasteTexts[ev] ?? '');
    return m;
  }, [eventsOrdered, pasteTexts]);

  return (
    <div>
      <div style={{ margin: '16px 0' }}>
        <WcaEventSelector
          availableEvents={SUPPORTED_EVENT_SET}
          selectedEvents={events}
          onToggle={toggleEvent}
          onRemove={toggleEvent}
          isZh={isZh}
          onlyAvailable
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '8px 0' }}>
        <button
          type="button"
          onClick={() => setShowPreview((v) => !v)}
          className="gen-btn"
          title={showPreview ? t('隐藏打乱图', 'Hide preview') : t('显示打乱图', 'Show preview')}
        >
          {showPreview ? <ImageIcon size={14} /> : <ImageOff size={14} />}
        </button>
      </div>

      <p style={{ fontSize: 14, color: 'var(--gen-text-sub, #737373)', margin: '8px 0' }}>
        {t('粘贴打乱: 每个项目一个文本框,每行一条。开头 "1. " / "1) " 等编号会自动去掉。',
           'Paste mode: one textarea per event, one scramble per line. Leading numbering is auto-stripped.')}
      </p>

      {eventsOrdered.map((ev) => (
        <section key={ev} style={{ margin: '16px 0', padding: 12, background: 'var(--gen-surface, #fff)', border: '1px solid var(--gen-border, #e5e5e5)', borderRadius: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <EventIcon event={ev} />
            <span style={{ fontSize: 14, fontWeight: 600 }}>{eventDisplayName(ev, isZh)}</span>
            <span style={{ fontSize: 12, color: 'var(--gen-text-mute, #95938E)' }}>{parsed[ev]?.length ?? 0}</span>
          </div>
          <textarea
            value={pasteTexts[ev] ?? ''}
            onChange={(e) => setPasteTexts((prev) => ({ ...prev, [ev]: e.target.value }))}
            placeholder={t('每行一条打乱', 'One scramble per line')}
            rows={5}
            spellCheck={false}
            style={{
              width: '100%', boxSizing: 'border-box',
              fontFamily: 'JetBrains Mono, Menlo, Consolas, monospace', fontSize: 13,
              padding: '6px 8px',
              border: '1px solid var(--gen-border-strong, #d4d4d4)', borderRadius: 4,
              background: 'var(--gen-bg, #fafafa)', color: 'var(--gen-text, #171717)',
              resize: 'vertical',
            }}
          />
          {parsed[ev] && parsed[ev].length > 0 && (
            <table style={{ width: '100%', marginTop: 8, borderCollapse: 'collapse' }}>
              <tbody>
                {parsed[ev].map((s, i) => (
                  <tr key={i}>
                    <td style={{ width: 32, padding: '4px 6px', textAlign: 'right', fontSize: 12, color: 'var(--gen-text-mute, #95938E)' }}>{i + 1}.</td>
                    <td style={{ padding: '4px 8px', fontFamily: 'JetBrains Mono, Menlo, Consolas, monospace', fontSize: 13, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{s}</td>
                    {showPreview && (
                      <td style={{ width: 110, padding: '4px 8px' }}>
                        {eventHasScramblePreview(ev) && (
                          <ScramblePreview2D event={ev} scramble={s} size={ev === 'sq1' ? 56 : 48} />
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ))}
    </div>
  );
}

export default function GenPage() {
  return (
    <Suspense fallback={<div style={{ padding: 16 }}>Loading…</div>}>
      <GenPageInner />
    </Suspense>
  );
}
