'use client';

import { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { useT } from '@/hooks/useT';
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
const HEIGHT = 320;
const TOP = 12;
const BOTTOM = 36;
const LEFT = 44;
const RIGHT = 14;
const plotHeight = HEIGHT - TOP - BOTTOM;
const y = (percentage: number) => TOP + (100 - percentage) / 100 * plotHeight;
const percent = (value: number) => `${Number(value.toFixed(1))}%`;

export default function CodeHistoryPage() {
  const t = useT();
  const [day, setDay] = useState(DAYS.length - 1);
  const [playing, setPlaying] = useState(false);
  const [width, setWidth] = useState(800);
  const chart = useRef<HTMLDivElement>(null);
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
  const selected = DAYS[day];
  // Round labels only; chart geometry and Other retain actual byte shares.
  const displayShares = selected.shares.map(value => Number(value.toFixed(1)));
  const tickIndices = width < 500 ? [0, DAYS.length - 1] : [0, 80, 160, 240, DAYS.length - 1];

  return <main className="code-history">
    <header>
      <h1>{t('代码语言历史', 'Code language history')}</h1>
    </header>
    <section aria-label={t('每日语言占比堆积面积图', 'Daily stacked area chart of language shares')}>
      <div className="code-history-chart" ref={chart}>
        <svg width="100%" height={HEIGHT} viewBox={`0 0 ${width} ${HEIGHT}`} role="img" aria-label={t('各语言占比随日期变化，总计 100%', 'Language shares over time, totaling 100%')}>
          {[0, 25, 50, 75, 100].map(value => <g key={value} className="code-history-axis">
            <text x={LEFT - 8} y={y(value) + 4} textAnchor="end">{value}%</text>
            <line x1={LEFT} x2={width - RIGHT} y1={y(value)} y2={y(value)} />
          </g>)}
          {LANGUAGES.map((language, series) => {
            const lower = DAYS.map(point => point.shares.slice(0, series).reduce((sum, value) => sum + value, 0));
            const upper = DAYS.map((point, index) => lower[index] + point.shares[series]);
            // Step boundaries preserve actual daily snapshots instead of inventing gradual migrations.
            const forward = upper.map((value, index) => index === 0 ? `M${x(index)},${y(value)}` : `H${x(index)}V${y(value)}`).join('');
            const reverse = lower.map((_, index) => DAYS.length - 1 - index).map((index, offset) => offset === 0 ? `L${x(index)},${y(lower[index])}` : `V${y(lower[index])}H${x(index)}`).join('');
            return <path key={language.name} d={`${forward}${reverse}Z`} fill={language.color}><title>{language.name}</title></path>;
          })}
          <line className="code-history-cursor" x1={x(day)} x2={x(day)} y1={TOP} y2={HEIGHT - BOTTOM} />
          {tickIndices.map(index => <text className="code-history-tick" key={index} x={x(index)} y={HEIGHT - 10} textAnchor={index === 0 ? 'start' : index === DAYS.length - 1 ? 'end' : 'middle'}>{DAYS[index].date}</text>)}
        </svg>
      </div>
    </section>
    <div className="code-history-controls">
      <button className="code-history-play" type="button" aria-label={playing ? t('暂停', 'Pause') : t('播放', 'Play')} onClick={() => {
        if (playing) setPlaying(false);
        else { if (day === DAYS.length - 1) setDay(0); setPlaying(true); }
      }}>{playing ? <Pause size={18} /> : <Play size={18} />}</button>
      <label className="sr-only" htmlFor="code-history-day">{t('日期', 'Date')}</label>
      <input className="code-history-slider" id="code-history-day" type="range" min={0} max={DAYS.length - 1} step={1} value={day} aria-valuetext={selected.date} onChange={event => selectDay(Number(event.target.value))} />
      <output htmlFor="code-history-day">{selected.date}</output>
    </div>
    <div className="code-history-bar" role="img" aria-label={LANGUAGES.map((language, index) => `${language.name} ${percent(displayShares[index])}`).join(', ')}>
      {LANGUAGES.map((language, index) => <span key={language.name} style={{ width: `${selected.shares[index]}%`, background: language.color }} />)}
    </div>
    <ul className="code-history-legend">
      {LANGUAGES.map((language, index) => <li key={language.name}><span className="code-history-dot" style={{ background: language.color }} /><span>{language.name}</span><span className="code-history-percentage">{percent(displayShares[index])}</span></li>)}
    </ul>
    <p className="code-history-note code-history-source">
      <a href="https://github.com/github-linguist/linguist" target="_blank" rel="noreferrer">{history.engine}</a>
      {' · '}{t('main 历史快照', 'main snapshots')}
      {' '}{t('按 America/Los_Angeles 划分日期。', 'Dates use America/Los_Angeles.')}
    </p>
  </main>;
}
