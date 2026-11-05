'use client';

import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { Pause, Play } from 'lucide-react';
import { useT } from '@/hooks/useT';
import { customAccentColor } from '@/lib/accent-colors';
import history from './history.json';
import './history.css';

// GitHub Linguist 9.7.0 colors. Show every language whose share reaches 1%
// anywhere in this snapshot. Keep its identity and order stable across all days.
const LANGUAGES = [
  { name: 'TypeScript', color: '#3178c6' },
  { name: 'JavaScript', color: '#f1e05a' },
  { name: 'CSS', color: '#663399' },
  { name: 'HTML', color: '#e34c26' },
  { name: 'Rust', color: '#dea584' },
  { name: 'PLpgSQL', color: '#336790' },
  { name: 'C++', color: '#f34b7d' },
  { name: 'Python', color: '#3572A5' },
  { name: 'Ruby', color: '#701516' },
  { name: 'PHP', color: '#4F5D95' },
  { name: 'Other', color: 'var(--code-history-other)' },
];
const DAYS = history.rows.map(row => {
  const bytes: Record<string, number | undefined> = row.languages;
  const total = Object.values(bytes).reduce<number>((sum, value) => sum + (value ?? 0), 0);
  const values = LANGUAGES.slice(0, -1).map(({ name }) => bytes[name] ?? 0);
  values.push(total - values.reduce((sum, value) => sum + value, 0));
  return { date: row.date, shares: values.map(value => value / total * 100) };
});
const HEIGHT = 284;
const TOP = 12;
const LEFT = 76;
const RIGHT = 14;
const plotHeight = HEIGHT - TOP;
const y = (percentage: number) => TOP + (100 - percentage) / 100 * plotHeight;
const percent = (value: number) => `${Number(value.toFixed(1))}%`;
const SERIES = LANGUAGES.map((language, series) => {
  const lower = DAYS.map(point => point.shares.slice(0, series).reduce((sum, value) => sum + value, 0));
  const upper = DAYS.map((point, index) => lower[index] + point.shares[series]);
  return { language, lower, upper };
});

export default function CodeLanguageHistory() {
  const t = useT();
  const [day, setDay] = useState(DAYS.length - 1);
  const [playing, setPlaying] = useState(false);
  const [width, setWidth] = useState(800);
  const chart = useRef<HTMLDivElement>(null);
  const cursorDrag = useRef<number | null>(null);
  const labels = useMemo(() => SERIES.flatMap(({ language, lower, upper }) => {
    const plotWidth = width - LEFT - RIGHT;
    if (plotWidth <= 0) return [];
    // Find a continuous region wide and tall enough for the whole label.
    const radius = Math.ceil((language.name.length * 7 + 12) / 2 / plotWidth * (DAYS.length - 1));
    let runStart = radius;
    let best: { start: number; end: number } | null = null;
    const centers = new Map<number, number>();
    for (let index = radius; index < DAYS.length - radius; index++) {
      const top = y(Math.min(...upper.slice(index - radius, index + radius + 1)));
      const bottom = y(Math.max(...lower.slice(index - radius, index + radius + 1)));
      if (bottom - top < 20) { runStart = index + 1; continue; }
      centers.set(index, (top + bottom) / 2);
      if (!best || index - runStart > best.end - best.start) best = { start: runStart, end: index };
    }
    if (!best) return [];
    const index = Math.floor((best.start + best.end) / 2);
    return [{ language, index, y: centers.get(index)! }];
  }), [width]);
  useEffect(() => {
    const element = chart.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const next = Math.round(entry.contentRect.width);
      if (next > 0) setWidth(previous => previous === next ? previous : next);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!playing) return;
    if (day === DAYS.length - 1) { setPlaying(false); return; }
    const timer = window.setTimeout(() => setDay(value => Math.min(value + 1, DAYS.length - 1)), 160);
    return () => window.clearTimeout(timer);
  }, [day, playing]);
  const x = (index: number) => LEFT + index / (DAYS.length - 1) * (width - LEFT - RIGHT);
  const selectDay = (index: number) => { setPlaying(false); setDay(index); };
  const moveCursor = (event: PointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (cursorDrag.current !== event.pointerId || !bounds.width) return;
    const plotWidth = width - LEFT - RIGHT;
    if (plotWidth <= 0) return;
    const position = (event.clientX - bounds.left) * width / bounds.width;
    const next = (position - LEFT) / plotWidth * (DAYS.length - 1);
    selectDay(Math.max(0, Math.min(DAYS.length - 1, Math.round(next))));
  };
  const endCursorDrag = (event: PointerEvent<SVGSVGElement>) => {
    if (cursorDrag.current !== event.pointerId) return;
    cursorDrag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const selected = DAYS[day];
  // Round labels only; chart geometry and Other retain actual byte shares.
  const displayShares = selected.shares.map(value => Number(value.toFixed(1)));

  return <div className="code-history">
    <section aria-label={t('每日语言占比堆积面积图', 'Daily stacked area chart of language shares')}>
      <div className="code-history-chart" ref={chart}>
        <svg className="code-history-interactive" width="100%" height={HEIGHT} viewBox={`0 0 ${width} ${HEIGHT}`} role="img" aria-label={t('各语言占比随日期变化，总计 100%', 'Language shares over time, totaling 100%')}
          onPointerDown={event => {
            if (!event.isPrimary || event.button !== 0 || cursorDrag.current !== null) return;
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            cursorDrag.current = event.pointerId;
            moveCursor(event);
          }}
          onPointerMove={moveCursor}
          onPointerUp={endCursorDrag}
          onPointerCancel={endCursorDrag}
          onLostPointerCapture={endCursorDrag}
        >
          {[0, 25, 50, 75, 100].map(value => <g key={value} className="code-history-axis">
            <text x={LEFT - 8} y={y(value) + 4} textAnchor="end">{value}%</text>
            {value !== 0 && <line x1={LEFT} x2={width - RIGHT} y1={y(value)} y2={y(value)} />}
          </g>)}
          {SERIES.map(({ language, lower, upper }) => {
            // Step boundaries preserve actual daily snapshots instead of inventing gradual migrations.
            const forward = upper.map((value, index) => index === 0 ? `M${x(index)},${y(value)}` : `H${x(index)}V${y(value)}`).join('');
            const reverse = lower.map((_, index) => DAYS.length - 1 - index).map((index, offset) => offset === 0 ? `L${x(index)},${y(lower[index])}` : `V${y(lower[index])}H${x(index)}`).join('');
            return <path key={language.name} d={`${forward}${reverse}Z`} fill={language.color}><title>{language.name}</title></path>;
          })}
          {labels.map(label => <text key={label.language.name} className="code-history-area-label" x={x(label.index)} y={label.y} fill={customAccentColor(label.language.color)?.foreground ?? 'var(--foreground)'} textAnchor="middle" dominantBaseline="middle">{label.language.name}</text>)}
          <line className="code-history-cursor" x1={x(day)} x2={x(day)} y1={TOP} y2={HEIGHT} />
        </svg>
        <label className="sr-only" htmlFor="code-history-day">{t('日期', 'Date')}</label>
        <input className="code-history-slider" style={{ left: LEFT - 8, width: `calc(100% - ${LEFT + RIGHT - 16}px)` }} id="code-history-day" type="range" min={0} max={DAYS.length - 1} step={1} value={day} aria-valuetext={selected.date} onChange={event => selectDay(Number(event.target.value))} />
        <button className="code-history-play" type="button" aria-label={playing ? t('暂停', 'Pause') : t('播放', 'Play')} onClick={() => {
          if (playing) setPlaying(false);
          else { if (day === DAYS.length - 1) setDay(0); setPlaying(true); }
        }}>{playing ? <Pause size={18} /> : <Play size={18} />}</button>
        <output className="code-history-date" style={{ left: `clamp(5ch, ${x(day)}px, calc(100% - 5ch))` }} htmlFor="code-history-day">{selected.date}</output>
      </div>
    </section>
    <div className="code-history-bar" style={{ marginLeft: LEFT, marginRight: RIGHT }} role="img" aria-label={LANGUAGES.map((language, index) => `${language.name} ${percent(displayShares[index])}`).join(', ')}>
      {LANGUAGES.map((language, index) => <span key={language.name} style={{ width: `${selected.shares[index]}%`, background: language.color }} />)}
    </div>
    <ul className="code-history-legend">
      {LANGUAGES.map((language, index) => <li key={language.name}><span className="code-history-dot" style={{ background: language.color }} /><span>{language.name}</span><span className="code-history-percentage">{percent(displayShares[index])}</span></li>)}
    </ul>
    <p className="code-history-note code-history-source">
      <a href="https://github.com/github-linguist/linguist" target="_blank" rel="noreferrer">{history.engine}</a>
    </p>
  </div>;
}
