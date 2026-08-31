'use client';

import {
  TIMER_PRINT_DOCUMENT_COPY,
  formatSolveResult,
  summarize,
  timerEventPickerName,
  type EventId,
  type Solve,
} from '@cuberoot/shared/timer';

export interface TimerPrintDocumentProps {
  className?: string;
  currentResult: string;
  currentScramble: string;
  currentScrambleSource?: string;
  event: EventId;
  generatedAt: number;
  language: 'en' | 'zh';
  sessionName?: string;
  solves: readonly Solve[];
}

const DATE_LOCALES: Record<'en' | 'zh', string> = {
  en: 'en-US',
  zh: 'zh-CN',
};

function formatPrintDate(timestamp: number, language: 'en' | 'zh'): string {
  return new Intl.DateTimeFormat(DATE_LOCALES[language], {
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(timestamp);
}

function formatPrintResult(solve: Solve): string {
  const result = formatSolveResult(solve);
  return solve.penalty === '+2' ? `${result} (+2)` : result;
}

/**
 * Canonical printable timer report. Web and both native shells render this
 * exact DOM; platform code only opens the system print/PDF transport.
 */
export function TimerPrintDocument({
  className,
  currentResult,
  currentScramble,
  currentScrambleSource,
  event,
  generatedAt,
  language,
  sessionName,
  solves,
}: TimerPrintDocumentProps) {
  const copy = TIMER_PRINT_DOCUMENT_COPY[language];
  const eventName = timerEventPickerName(event, language);
  const stats = summarize([...solves], event);
  const rows = solves.map((solve, index) => ({
    index: index + 1,
    solve,
  })).reverse();
  const summaryRows = [
    [copy.solves, String(stats.count)],
    [copy.solved, `${stats.solved}/${stats.count}`],
    [copy.best, stats.best],
    [copy.worst, stats.worst],
    [copy.mean, stats.mean],
    [`${copy.current} bo3`, stats.bo3],
    [`${copy.best} bo3`, stats.bestBo3],
    [`${copy.current} mo3`, stats.mo3],
    [`${copy.best} mo3`, stats.bestMo3],
    [`${copy.current} ao5`, stats.ao5],
    [`${copy.best} ao5`, stats.bestAo5],
    [`${copy.current} ao12`, stats.ao12],
    [`${copy.best} ao12`, stats.bestAo12],
    [`${copy.current} ao50`, stats.ao50],
    [`${copy.best} ao50`, stats.bestAo50],
    [`${copy.current} ao100`, stats.ao100],
    [`${copy.best} ao100`, stats.bestAo100],
    [`${copy.current} ao1000`, stats.ao1000],
    [`${copy.best} ao1000`, stats.bestAo1000],
  ] as const;

  return (
    <article
      className={`timer-print-document${className ? ` ${className}` : ''}`}
      lang={language === 'zh' ? 'zh-Hans' : 'en'}
    >
      <header className="timer-print-header">
        <p className="timer-print-brand">CubeRoot</p>
        <h1>{copy.timer}: {eventName}</h1>
        <div className="timer-print-meta">
          <span>{copy.solves}: {stats.count}</span>
          {sessionName && <span>{copy.session}: {sessionName}</span>}
          <span>{copy.generated}: {formatPrintDate(generatedAt, language)}</span>
        </div>
      </header>

      <section className="timer-print-current" aria-label={copy.current}>
        <div>
          <span>{copy.result}</span>
          <strong>{currentResult}</strong>
        </div>
        <div>
          <span>{copy.scramble}</span>
          <strong>{currentScramble || '-'}</strong>
          {currentScrambleSource && (
            <small>{copy.source}: {currentScrambleSource}</small>
          )}
        </div>
      </section>

      <section className="timer-print-summary" aria-labelledby="timer-print-summary-title">
        <h2 id="timer-print-summary-title">{copy.summary}</h2>
        <dl>
          {summaryRows.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="timer-print-results" aria-labelledby="timer-print-results-title">
        <h2 id="timer-print-results-title">{copy.results}</h2>
        {rows.length === 0 ? (
          <p className="timer-print-empty">{copy.empty}</p>
        ) : (
          <table>
            <colgroup>
              <col className="timer-print-col-number" />
              <col className="timer-print-col-result" />
              <col className="timer-print-col-date" />
              <col className="timer-print-col-scramble" />
              <col className="timer-print-col-comment" />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">{copy.number}</th>
                <th scope="col">{copy.result}</th>
                <th scope="col">{copy.date}</th>
                <th scope="col">{copy.scramble}</th>
                <th scope="col">{copy.comment}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ index, solve }) => (
                <tr key={solve.id}>
                  <td>{index}</td>
                  <td className="timer-print-result">{formatPrintResult(solve)}</td>
                  <td>{formatPrintDate(solve.ts, language)}</td>
                  <td className="timer-print-scramble">{solve.scramble || '-'}</td>
                  <td className="timer-print-comment">{solve.comment || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </article>
  );
}
