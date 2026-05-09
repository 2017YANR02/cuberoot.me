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
import { Plus, Minus, RefreshCw, Download } from 'lucide-react';
import { EventIcon } from '../../components/EventIcon';
import { eventDisplayName } from '../../utils/wca_events';
import { ScramblePreview2D, eventHasScramblePreview } from '../../components/ScramblePreview2D';
import { TNOODLE_WCA_EVENTS, tnoodleRandomScramble } from '../../utils/cubingScramble';
import {
  ALLOWED_FORMATS, FORMAT_LABEL, formatAttempts, DEFAULT_EXTRA_COUNT,
  defaultEventConfig, defaultRoundConfig,
  type EventConfig, type WcaFormat,
} from './wca_round';
import type { RoundSheetInput } from './tnoodle_pdf';

const GENERATOR_TAG = 'TNoodle-WCA-1.2.3-port';

interface Props {
  t: (zh: string, en: string) => string;
  isZh: boolean;
}

interface AttemptScramble {
  /** Display label, e.g. "1", "2", "E1", "E2" or "Attempt 1 of 8" for MBLD lines */
  label: string;
  /** Scramble move sequence(s). For MBLD an attempt has N lines (one per cube). */
  lines: string[];
  /** Whether this is an extra-scramble (E1/E2 …) */
  isExtra: boolean;
}

interface RoundSheet {
  event: string;
  roundIdx: number;     // 0-based
  groupIdx: number;     // 0-based (for scrambleSets > 1)
  format: WcaFormat;
  attempts: AttemptScramble[];
}

const todayIso = () => new Date().toISOString().slice(0, 10);

export default function TNoodleMode({ t, isZh }: Props) {
  const [compName, setCompName] = useState<string>(`Scrambles for ${todayIso()}`);
  const [events, setEvents] = useState<Record<string, EventConfig>>({
    '333': defaultEventConfig('333'),
  });
  const [sheets, setSheets] = useState<RoundSheet[] | null>(null);
  const [generating, setGenerating] = useState(false);
  const [pdfBuilding, setPdfBuilding] = useState(false);

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

  const generate = async () => {
    setGenerating(true);
    try {
      const out: RoundSheet[] = [];
      for (const ev of enabledEvents) {
        const cfg = events[ev];
        for (let ri = 0; ri < cfg.rounds.length; ri++) {
          const round = cfg.rounds[ri];
          const mainCount = formatAttempts(round.format);
          for (let g = 0; g < Math.max(1, round.scrambleSets); g++) {
            const attempts: AttemptScramble[] = [];
            for (let i = 0; i < mainCount; i++) {
              attempts.push({
                label: String(i + 1),
                lines: await genAttempt(ev, cfg.mbldCubes),
                isExtra: false,
              });
            }
            for (let i = 0; i < DEFAULT_EXTRA_COUNT; i++) {
              attempts.push({
                label: `E${i + 1}`,
                lines: await genAttempt(ev, cfg.mbldCubes),
                isExtra: true,
              });
            }
            out.push({
              event: ev,
              roundIdx: ri,
              groupIdx: g,
              format: round.format,
              attempts,
            });
          }
        }
      }
      setSheets(out);
    } catch (err) {
      console.error('[tnoodle] generate failed', err);
    } finally {
      setGenerating(false);
    }
  };

  const downloadPdf = async () => {
    if (!sheets || sheets.length === 0) return;
    setPdfBuilding(true);
    try {
      const { generateTnoodlePdf } = await import('./tnoodle_pdf');
      const sheetInputs: RoundSheetInput[] = sheets.map((s) => ({
        event: s.event,
        roundIdx: s.roundIdx,
        groupIdx: s.groupIdx,
        format: s.format,
        attempts: s.attempts.map((a) => ({
          label: a.label,
          isExtra: a.isExtra,
          scramble: a.lines.length === 1 ? a.lines[0] : '',
          mbldLines: a.lines.length > 1 ? a.lines : undefined,
        })),
      }));
      const blob = await generateTnoodlePdf(sheetInputs, {
        competitionTitle: compName,
        generatorTag: GENERATOR_TAG,
        isZh,
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
    }
  };

  const totalAttempts = useMemo(() => {
    let n = 0;
    for (const ev of enabledEvents) {
      const cfg = events[ev];
      for (const r of cfg.rounds) {
        n += (formatAttempts(r.format) + DEFAULT_EXTRA_COUNT) * Math.max(1, r.scrambleSets);
      }
    }
    return n;
  }, [enabledEvents, events]);

  return (
    <>
      <div className="gen-tn-controls">
        <div className="gen-control-group">
          <label className="gen-label">{t('比赛名', 'Competition Name')}</label>
          <input
            type="text"
            className="gen-tn-comp-input"
            value={compName}
            onChange={(e) => setCompName(e.target.value)}
          />
        </div>
        <div className="gen-control-group gen-control-actions">
          <button
            type="button"
            className="gen-btn gen-btn-primary"
            onClick={generate}
            disabled={enabledEvents.length === 0 || generating}
          >
            <RefreshCw size={14} className={generating ? 'gen-spin' : ''} />
            <span>
              {generating
                ? t('生成中…', 'Generating…')
                : t(`生成打乱 (${totalAttempts})`, `Generate (${totalAttempts})`)}
            </span>
          </button>
          <button
            type="button"
            className="gen-btn"
            onClick={downloadPdf}
            disabled={!sheets || sheets.length === 0 || pdfBuilding}
            title={t('下载 PDF (tnoodle 风格)', 'Download PDF (tnoodle style)')}
          >
            <Download size={14} className={pdfBuilding ? 'gen-spin' : ''} />
            <span>{pdfBuilding ? t('PDF 生成中…', 'Building PDF…') : 'PDF'}</span>
          </button>
        </div>
      </div>

      <div className="gen-tn-event-grid">
        {TNOODLE_WCA_EVENTS.map((ev) => {
          const cfg = events[ev];
          const enabled = !!cfg;
          return (
            <div key={ev} className={`gen-tn-event-card${enabled ? ' is-on' : ''}`}>
              <button
                type="button"
                className="gen-tn-event-header"
                onClick={() => toggleEvent(ev)}
              >
                <EventIcon event={ev} />
                <span className="gen-tn-event-name">{eventDisplayName(ev, isZh)}</span>
                <span className="gen-tn-event-toggle">{enabled ? <Minus size={14} /> : <Plus size={14} />}</span>
              </button>
              {enabled && (
                <div className="gen-tn-event-body">
                  <div className="gen-tn-rounds-row">
                    <span className="gen-tn-rounds-label">{t('轮数', 'Rounds')}</span>
                    {[1, 2, 3, 4].map((n) => (
                      <button
                        key={n}
                        type="button"
                        className={`gen-tn-round-chip${cfg.rounds.length === n ? ' is-active' : ''}`}
                        onClick={() => setRoundCount(ev, n)}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  {cfg.rounds.map((r, ri) => (
                    <div key={ri} className="gen-tn-round-row">
                      <span className="gen-tn-round-num">R{ri + 1}</span>
                      <select
                        className="gen-tn-format-select"
                        value={r.format}
                        onChange={(e) => updateRound(ev, ri, { format: e.target.value as WcaFormat })}
                      >
                        {ALLOWED_FORMATS[ev].map((f) => (
                          <option key={f} value={f}>{FORMAT_LABEL[f]}</option>
                        ))}
                      </select>
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
                </div>
              )}
            </div>
          );
        })}
      </div>

      {sheets && sheets.length > 0 && (
        <div className="gen-tn-sheets">
          <h2 className="gen-tn-sheet-title">{compName}</h2>
          {sheets.map((sh, i) => (
            <SheetView key={i} sheet={sh} isZh={isZh} t={t} />
          ))}
        </div>
      )}
    </>
  );
}

async function genAttempt(event: string, mbldCubes?: number): Promise<string[]> {
  if (event === '333mbf') {
    const n = mbldCubes ?? 8;
    const lines: string[] = [];
    for (let i = 0; i < n; i++) {
      const s = await tnoodleRandomScramble('333bf');
      if (s) lines.push(s);
    }
    return lines;
  }
  const s = await tnoodleRandomScramble(event);
  return s ? [s] : [];
}

function SheetView({ sheet, isZh, t }: { sheet: RoundSheet; isZh: boolean; t: Props['t'] }) {
  const { event, roundIdx, groupIdx, format, attempts } = sheet;
  const groupSuffix = groupIdx > 0 ? ` · ${t('组', 'Group')} ${String.fromCharCode(65 + groupIdx)}` : '';
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
          {a.lines.map((line, li) => (
            <code key={li} className="gen-tn-attempt-line">{line}</code>
          ))}
        </td>
        <td className="gen-tn-attempt-preview">
          {eventHasScramblePreview(event) && a.lines.length > 0 && (
            <ScramblePreview2D event={event} scramble={a.lines[0]} size={48} />
          )}
        </td>
      </tr>,
    );
  });
  return (
    <div className="gen-tn-sheet">
      <div className="gen-tn-sheet-header">
        <EventIcon event={event} />
        <span>{eventDisplayName(event, isZh)} · {t('第', 'Round')} {roundIdx + 1}{t('轮', '')} · {FORMAT_LABEL[format]}{groupSuffix}</span>
      </div>
      <table className="gen-tn-sheet-table"><tbody>{rows}</tbody></table>
    </div>
  );
}
