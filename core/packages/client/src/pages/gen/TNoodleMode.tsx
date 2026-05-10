/**
 * /scramble/gen — "TNoodle" mode: WCA competition scramble sheet UX.
 * Multi-event, multi-round, per-round Format/Sets/Copies, plus 2 extra
 * scrambles per round (E1/E2). Mirrors tnoodle's competition-level
 * generator but in pure TS via cubing/scramble.
 *
 * Phase 1: in-browser table view only. Phase 2 adds raw text export,
 * Phase 3 adds PDF.
 */
import { useMemo, useState } from 'react';
import { RefreshCw, Download, X, Trash2, Edit3 } from 'lucide-react';
import { EventIcon } from '../../components/EventIcon';
import WcaEventSelector from '../../components/WcaEventSelector';
import { eventDisplayName } from '../../utils/wca_events';
import { ScramblePreview2D, eventHasScramblePreview } from '../../components/ScramblePreview2D';
import { TNOODLE_WCA_EVENTS, tnoodleRandomScramble } from '../../utils/cubingScramble';

const TNOODLE_EVENT_SET = new Set<string>(TNOODLE_WCA_EVENTS);
import {
  ALLOWED_FORMATS, FORMAT_LABEL, formatAttempts, DEFAULT_EXTRA_COUNT,
  defaultEventConfig, defaultRoundConfig,
  type EventConfig, type WcaFormat,
} from './wca_round';
import type { RoundSheetInput } from './tnoodle_pdf';
import type { TnoodleLocale } from './tnoodle_translate';
import ClockColorPicker from './ClockColorPicker';
import ProgressButton from './ProgressButton';
import ScrambleLines from './ScrambleLines';
import TranslationsPicker from './TranslationsPicker';

const GENERATOR_TAG = 'TNoodle-WCA-1.2.3-port';

interface Props {
  t: (zh: string, en: string) => string;
  isZh: boolean;
}

interface AttemptScramble {
  /** Display label, e.g. "1", "2", "E1", "E2". For MBLD this is the cube number. */
  label: string;
  /** Single scramble move sequence (one row in the PDF). */
  scramble: string;
  /** Whether this is an extra-scramble (E1/E2 …); always false for MBLD. */
  isExtra: boolean;
}

interface RoundSheet {
  event: string;
  roundIdx: number;     // 0-based
  groupIdx: number;     // 0-based (for scrambleSets > 1)
  format: WcaFormat;
  /** MBLD/FMC — 0-based attempt index. Adds "Attempt N+1" / "Scramble X of Y" to the title. */
  attemptNumber?: number;
  attempts: AttemptScramble[];
  /** FMC only — locales for which to emit a translated solution sheet. */
  locales?: TnoodleLocale[];
  /** Print copies — same scrambles repeated N times in the PDF (per round.copies). */
  copies?: number;
  /** scrambleSets count for this round; used to render "Group A/B/..." only when >1. */
  totalGroups?: number;
}

const todayIso = () => new Date().toISOString().slice(0, 10);

export default function TNoodleMode({ t, isZh }: Props) {
  const [compName, setCompName] = useState<string>(`Scrambles for ${todayIso()}`);
  const [events, setEvents] = useState<Record<string, EventConfig>>({
    '333': defaultEventConfig('333'),
  });
  const [sheets, setSheets] = useState<RoundSheet[] | null>(null);
  const [viewedEvent, setViewedEvent] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState<{ done: number; total: number } | null>(null);
  const [pdfBuilding, setPdfBuilding] = useState(false);
  const [pdfProgress, setPdfProgress] = useState<{ done: number; total: number } | null>(null);

  const enabledEvents = useMemo(
    () => TNOODLE_WCA_EVENTS.filter((e) => events[e]),
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

  const setMbldCubes = (e: string, cubes: number) => {
    setEvents((prev) => {
      const cfg = prev[e];
      if (!cfg) return prev;
      return { ...prev, [e]: { ...cfg, mbldCubes: cubes } };
    });
  };

  const setEventColors = (e: string, colors: Record<string, string> | undefined) => {
    setEvents((prev) => {
      const cfg = prev[e];
      if (!cfg) return prev;
      return { ...prev, [e]: { ...cfg, colors } };
    });
  };

  const generate = async () => {
    setGenerating(true);
    let done = 0;
    const total = totalAttempts;
    setGenProgress({ done: 0, total });
    // Yield to React so the progress bar paints before the heavy loop starts.
    const yieldToUi = () => new Promise<void>((r) => setTimeout(r, 0));
    const tick = async () => {
      done += 1;
      setGenProgress({ done, total });
      // yield every few attempts so the UI can repaint
      if (done % 2 === 0) await yieldToUi();
    };
    try {
      const out: RoundSheet[] = [];
      for (const ev of enabledEvents) {
        const cfg = events[ev];
        for (let ri = 0; ri < cfg.rounds.length; ri++) {
          const round = cfg.rounds[ri];
          const mainCount = formatAttempts(round.format);
          for (let g = 0; g < Math.max(1, round.scrambleSets); g++) {
            if (ev === '333mbf') {
              // Tnoodle MBLD: each attempt becomes its OWN sheet, with N
              // separate cube scrambles as rows. No extras for MBLD.
              const cubesPerAttempt = cfg.mbldCubes ?? 8;
              for (let a = 0; a < mainCount; a++) {
                const cubeRows: AttemptScramble[] = [];
                for (let c = 0; c < cubesPerAttempt; c++) {
                  const s = await tnoodleRandomScramble('333bf');
                  cubeRows.push({
                    label: String(c + 1),
                    scramble: s ?? '',
                    isExtra: false,
                  });
                  await tick();
                }
                out.push({
                  event: ev, roundIdx: ri, groupIdx: g,
                  format: round.format,
                  attemptNumber: a,
                  attempts: cubeRows,
                  copies: round.copies,
                  totalGroups: round.scrambleSets,
                });
              }
            } else if (ev === '333fm') {
              // Tnoodle FMC: each attempt is its own sheet (Scramble 1 of N) with
              // a single scramble per page, no extras. WCA regs forbid extras for FMC.
              for (let a = 0; a < mainCount; a++) {
                const s = await tnoodleRandomScramble(ev);
                await tick();
                out.push({
                  event: ev, roundIdx: ri, groupIdx: g,
                  format: round.format,
                  attemptNumber: a,
                  attempts: [{ label: '1', scramble: s ?? '', isExtra: false }],
                  locales: round.locales,
                  copies: round.copies,
                  totalGroups: round.scrambleSets,
                });
              }
            } else {
              const attempts: AttemptScramble[] = [];
              for (let i = 0; i < mainCount; i++) {
                const s = await tnoodleRandomScramble(ev);
                attempts.push({ label: String(i + 1), scramble: s ?? '', isExtra: false });
                await tick();
              }
              for (let i = 0; i < DEFAULT_EXTRA_COUNT; i++) {
                const s = await tnoodleRandomScramble(ev);
                attempts.push({ label: `E${i + 1}`, scramble: s ?? '', isExtra: true });
                await tick();
              }
              out.push({
                event: ev, roundIdx: ri, groupIdx: g,
                format: round.format,
                attempts,
                copies: round.copies,
                totalGroups: round.scrambleSets,
              });
            }
          }
        }
      }
      setSheets(out);
      // Default the on-screen view filter to the first event we just generated.
      setViewedEvent(out[0]?.event ?? null);
    } catch (err) {
      console.error('[tnoodle] generate failed', err);
    } finally {
      setGenerating(false);
      setGenProgress(null);
    }
  };

  const downloadPdf = async () => {
    if (!sheets || sheets.length === 0) return;
    setPdfBuilding(true);
    setPdfProgress({ done: 0, total: 1 });
    try {
      const { generateTnoodlePdf } = await import('./tnoodle_pdf');
      const sheetInputs: RoundSheetInput[] = sheets.map((s) => ({
        event: s.event,
        roundIdx: s.roundIdx,
        groupIdx: s.groupIdx,
        format: s.format,
        attemptNumber: s.attemptNumber,
        attempts: s.attempts.map((a) => ({
          label: a.label,
          isExtra: a.isExtra,
          scramble: a.scramble,
        })),
        locales: s.locales,
        copies: s.copies,
        totalGroups: s.totalGroups,
      }));
      const eventColors: Record<string, Record<string, string>> = {};
      for (const ev of Object.keys(events)) {
        const c = events[ev].colors;
        if (c) eventColors[ev] = c;
      }
      const blob = await generateTnoodlePdf(sheetInputs, {
        competitionTitle: compName,
        generatorTag: GENERATOR_TAG,
        isZh,
        onProgress: (done, total) => setPdfProgress({ done, total }),
        eventColors,
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${compName.replace(/[^\w一-龥-]+/g, '_')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (err) {
      console.error('[tnoodle] pdf failed', err);
      alert(`PDF generation failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setPdfBuilding(false);
      setPdfProgress(null);
    }
  };

  const totalAttempts = useMemo(() => {
    let n = 0;
    for (const ev of enabledEvents) {
      const cfg = events[ev];
      for (const r of cfg.rounds) {
        const sets = Math.max(1, r.scrambleSets);
        if (ev === '333mbf') {
          // MBLD: per attempt = `cubesPerAttempt` rows, no extras
          n += formatAttempts(r.format) * (cfg.mbldCubes ?? 8) * sets;
        } else if (ev === '333fm') {
          // FMC: one scramble per attempt sheet, no extras
          n += formatAttempts(r.format) * sets;
        } else {
          n += (formatAttempts(r.format) + DEFAULT_EXTRA_COUNT) * sets;
        }
      }
    }
    return n;
  }, [enabledEvents, events]);

  return (
    <>
      <div className="gen-tn-controls">
        <div className="gen-control-group">
          <input
            type="text"
            className="gen-tn-comp-input"
            value={compName}
            onChange={(e) => setCompName(e.target.value)}
            readOnly={!!sheets && sheets.length > 0}
            placeholder={t('比赛名', 'Competition Name')}
          />
        </div>
        <div className="gen-control-group gen-control-actions">
          {sheets && sheets.length > 0 ? (
            <button
              type="button"
              className="gen-btn"
              onClick={() => {
                setSheets(null);
                setViewedEvent(null);
              }}
              title={t('重新配置', 'Reconfigure')}
              aria-label={t('重新配置', 'Reconfigure')}
            >
              <Edit3 size={14} />
            </button>
          ) : (
            <ProgressButton
              primary
              icon={<RefreshCw size={14} className={generating ? 'gen-spin' : ''} />}
              label={generating
                ? <span className="gen-btn-progress-num">{`${genProgress?.done ?? 0}/${genProgress?.total ?? totalAttempts}`}</span>
                : t(`生成 (${totalAttempts})`, `Generate (${totalAttempts})`)}
              progress={genProgress}
              onClick={generate}
              disabled={enabledEvents.length === 0 || generating}
              title={t('生成打乱', 'Generate scrambles')}
            />
          )}
          {sheets && sheets.length > 0 && (
            <ProgressButton
              icon={<Download size={14} className={pdfBuilding ? 'gen-spin' : ''} />}
              label={pdfBuilding
                ? <span className="gen-btn-progress-num">{`${pdfProgress?.done ?? 0}/${pdfProgress?.total ?? 1}`}</span>
                : ''}
              progress={pdfProgress}
              onClick={downloadPdf}
              disabled={pdfBuilding}
              title={t('下载 PDF (tnoodle 风格)', 'Download PDF (tnoodle style)')}
            />
          )}
          {!(sheets && sheets.length > 0) && Object.keys(events).length > 0 && (
            <button
              type="button"
              className="gen-btn"
              onClick={() => setEvents({})}
              title={t('清空所有项目', 'Clear all events')}
              aria-label={t('清空所有项目', 'Clear all events')}
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {sheets && sheets.length > 0 ? (
        // ── 视图模式:已生成,顶端 selector 单选,只能切视图;不允许增删项目 ──
        (() => {
          const eventsInSheets = Array.from(new Set(sheets.map((s) => s.event)));
          const activeView = viewedEvent && eventsInSheets.includes(viewedEvent)
            ? viewedEvent
            : eventsInSheets[0];
          return (
            <WcaEventSelector
              availableEvents={new Set(eventsInSheets)}
              selectedEvent={activeView}
              onSelect={setViewedEvent}
              onlyAvailable
              isZh={isZh}
            />
          );
        })()
      ) : (
        // ── 配置模式:多选 toggle + 点击循环轮数(清空按钮在顶部 actions 区) ──
        <WcaEventSelector
          availableEvents={TNOODLE_EVENT_SET}
          selectedEvents={new Set(Object.keys(events))}
          badges={Object.fromEntries(Object.entries(events).map(([ev, cfg]) => [ev, cfg.rounds.length]))}
          onToggle={(ev) => {
            // 循环:0(未启用) → 1 → 2 → 3 → 4 → 0
            if (!events[ev]) {
              toggleEvent(ev);                  // 0 → 1
            } else {
              const cur = events[ev].rounds.length;
              if (cur >= 4) toggleEvent(ev);    // 4 → 0(取消启用)
              else setRoundCount(ev, cur + 1);  // 1/2/3 → +1
            }
          }}
          isZh={isZh}
        />
      )}

      {sheets && sheets.length > 0 ? null : enabledEvents.length === 0 ? (
        <div className="gen-tn-empty">{t('点击上方图标添加项目', 'Tap an event icon above to add it')}</div>
      ) : (
        <div className="gen-tn-event-list">
          {enabledEvents.map((ev) => {
            const cfg = events[ev];
            return (
              <div key={ev} className="gen-tn-event-card is-on">
                <div className="gen-tn-event-header gen-tn-event-header--static">
                  <EventIcon event={ev} />
                  <span className="gen-tn-event-name">{eventDisplayName(ev, isZh)}</span>
                  <button
                    type="button"
                    className="gen-tn-event-remove"
                    onClick={() => toggleEvent(ev)}
                    title={t('移除项目', 'Remove event')}
                    aria-label={t('移除项目', 'Remove event')}
                  >
                    <X size={14} />
                  </button>
                </div>
                <div className="gen-tn-event-body">
                  {cfg.rounds.map((r, ri) => (
                    <div key={ri} className="gen-tn-round-row">
                      <span className="gen-tn-round-num">R{ri + 1}</span>
                      {ALLOWED_FORMATS[ev].length > 1 ? (
                        <select
                          className="gen-tn-format-select"
                          value={r.format}
                          onChange={(e) => updateRound(ev, ri, { format: e.target.value as WcaFormat })}
                        >
                          {ALLOWED_FORMATS[ev].map((f) => (
                            <option key={f} value={f}>{FORMAT_LABEL[f]}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="gen-tn-format-static">{FORMAT_LABEL[r.format]}</span>
                      )}
                      <label className="gen-tn-mini-num">
                        <span>{t('组', 'Sets')}</span>
                        <input
                          type="number" min={1} max={20}
                          value={r.scrambleSets}
                          onChange={(e) => updateRound(ev, ri, { scrambleSets: Math.max(1, Number(e.target.value) || 1) })}
                        />
                      </label>
                      <label className="gen-tn-mini-num">
                        <span>{t('份', 'Copies')}</span>
                        <input
                          type="number" min={1} max={50}
                          value={r.copies}
                          onChange={(e) => updateRound(ev, ri, { copies: Math.max(1, Number(e.target.value) || 1) })}
                        />
                      </label>
                    </div>
                  ))}
                  {ev === '333fm' && cfg.rounds.map((r, ri) => (
                    <TranslationsPicker
                      key={`tx-${ri}`}
                      selected={r.locales ?? ['en']}
                      onChange={(next) => updateRound(ev, ri, { locales: next })}
                      isZh={isZh}
                    />
                  ))}
                  {ev === '333mbf' && (
                    <div className="gen-tn-round-row">
                      <span className="gen-tn-round-num">{t('每次魔方数', 'Cubes/attempt')}</span>
                      <input
                        type="number" min={2} max={50}
                        className="gen-tn-mbld-cubes"
                        value={cfg.mbldCubes ?? 8}
                        onChange={(e) => setMbldCubes(ev, Math.max(2, Number(e.target.value) || 8))}
                      />
                    </div>
                  )}
                  {ev === 'clock' && (
                    <ClockColorPicker
                      colors={cfg.colors}
                      onChange={(c) => setEventColors(ev, c)}
                      t={t}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {sheets && sheets.length > 0 && (() => {
        const eventsInSheets = Array.from(new Set(sheets.map((s) => s.event)));
        const activeView = viewedEvent && eventsInSheets.includes(viewedEvent)
          ? viewedEvent
          : eventsInSheets[0];
        const visible = sheets.filter((s) => s.event === activeView);
        return (
          <div className="gen-tn-sheets">
            {visible.map((sh, i) => (
              <SheetView
                key={i}
                sheet={sh}
                isZh={isZh}
                t={t}
                clockColors={sh.event === 'clock' ? events[sh.event]?.colors : undefined}
                sq1Colors={sh.event === 'sq1' ? events[sh.event]?.colors : undefined}
                megaColors={sh.event === 'minx' ? events[sh.event]?.colors : undefined}
              />
            ))}
          </div>
        );
      })()}
    </>
  );
}

function SheetView({ sheet, isZh, t, clockColors, sq1Colors, megaColors }: { sheet: RoundSheet; isZh: boolean; t: Props['t']; clockColors?: Record<string, string>; sq1Colors?: Record<string, string>; megaColors?: Record<string, string> }) {
  const { event, roundIdx, groupIdx, attemptNumber, attempts, totalGroups } = sheet;
  // 多组(scrambleSets > 1)时所有组都标 A/B/...;只 1 组时不写组号
  const groupSuffix = (totalGroups ?? 1) > 1
    ? ` ${t('组', 'Group')} ${String.fromCharCode(65 + groupIdx)}`
    : '';
  const attemptSuffix = attemptNumber !== undefined
    ? ` ${t('第', 'Attempt')} ${attemptNumber + 1}${t('次', '')}`
    : '';
  const rows: React.ReactNode[] = [];
  attempts.forEach((a, i) => {
    const showExtraDivider = a.isExtra && (i === 0 || !attempts[i - 1].isExtra);
    if (showExtraDivider) {
      rows.push(
        <tr key={`div-${i}`} className="gen-tn-extras-divider">
          <td colSpan={3}>{t('Extra Scrambles', 'Extra Scrambles')}</td>
        </tr>,
      );
    }
    rows.push(
      <tr key={i} className={a.isExtra ? 'is-extra' : ''}>
        <td className="gen-tn-attempt-num">{a.label}</td>
        <td className="gen-tn-attempt-scramble">
          <ScrambleLines scramble={a.scramble} className="gen-tn-attempt-line" />
        </td>
        <td className="gen-tn-attempt-preview">
          {eventHasScramblePreview(event) && a.scramble && (
            <ScramblePreview2D event={event} scramble={a.scramble} size={48} clockColors={clockColors} sq1Colors={sq1Colors} megaColors={megaColors} />
          )}
        </td>
      </tr>,
    );
  });
  return (
    <div className="gen-tn-sheet">
      <div className="gen-tn-sheet-header">
        <EventIcon event={event} />
        <span>{eventDisplayName(event, isZh)} {t('第', 'Round')} {roundIdx + 1}{t('轮', '')}{groupSuffix}{attemptSuffix}</span>
      </div>
      <table className="gen-tn-sheet-table"><tbody>{rows}</tbody></table>
    </div>
  );
}

