'use client';

import { memo, useRef, useState, useEffect, useCallback, type RefObject } from 'react';
import { parseAsStringLiteral, useQueryState } from 'nuqs';
import { ArrowLeft, ArrowRight, ArrowUpRight, MoveHorizontal, BookOpen, Pause, Play, Sun, Moon, Sparkles, Download } from 'lucide-react';
import AppLink from '@/components/AppLink';
import { ClearButton } from '@/components/ClearButton';
import { CompactSelect } from '@/components/CompactSelect';
import { DateInput } from '@/components/DateInput';
import { ClientLoadStatus } from '@/components/StartupStatus';
import PlaybackScrubber from '@/components/PlaybackScrubber';
import { tr } from '@/i18n/tr';
import { TIMELINE } from '../_lib/arch-data';
import DAYS from '../timeline_commits.json';
import { HISTORY_PLACES, HISTORY_LAST, clampHistoryPosition } from '../history/history-days';
import type { HistoryScene } from '../history/history-scene';
import { HISTORY_ENVIRONMENTS, WEATHER_LABELS, DAYLIGHT_LABELS, historyDaylight, journeyWeather } from '../history/history-environment';
import { HISTORY_LANDFORMS, LANDFORMS, type HistoryLandform } from '../history/history-landforms';
import { ANIMALS, HISTORY_FAUNA, type AnimalSpecies } from '../history/history-fauna';
import { HISTORY_SECRETS, type HistorySecret } from '../history/history-secrets';
import HistoryArchive from './HistoryView';
import HistoryVideoExport from './HistoryVideoExport';

const DATES = HISTORY_PLACES.map(place => place.date);
const PLAYBACK_SPEEDS = [1, 2, 5, 10].map(value => ({ value, label: `${value}×` }));
const MemoHistoryArchive = memo(HistoryArchive);
const JourneyNodes = memo(function JourneyNodes({ current, ready, nodes, onVisit }: {
  current: number; ready: boolean; nodes: RefObject<(HTMLButtonElement | null)[]>;
  onVisit: (value: number, read?: boolean) => void;
}) {
  return <div className="journey-node-layer" hidden={!ready}>{HISTORY_PLACES.map((place, i) => {
    const note = tr<{ title: string; detail: string }>(place.note);
    return <button key={place.date} ref={node => { nodes.current[i] = node; }} type="button" className={`journey-button journey-date-node${current === i ? ' is-current' : ''}`} onClick={() => onVisit(i, true)} aria-label={`${place.date} ${note.title} ${note.detail}`} aria-pressed={current === i} aria-controls="journey-reader">
      <span className="journey-date-dot" /><time dateTime={place.date}>{place.date}</time>
      <span className="journey-node-note"><strong>{note.title}</strong>{note.detail && <span>{note.detail}</span>}</span>
    </button>;
  })}</div>;
});

export default function HistoryJourney() {
  const [requested, setDay] = useQueryState('day', parseAsStringLiteral(DATES).withDefault(DATES[0]).withOptions({ history: 'push', scroll: false }));
  const initial = Math.max(0, DATES.indexOf(requested));
  const [position, setPosition] = useState(initial);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [retry, setRetry] = useState(0);
  const [reading, setReading] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [weatherVariation, setWeatherVariation] = useState(0);
  const [motion, setMotion] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [openedSecret, setOpenedSecret] = useState<HistorySecret | null>(null);
  const host = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const secretRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const secretLink = useRef<HTMLAnchorElement>(null);
  const engine = useRef<HistoryScene | null>(null);
  const appliedMotion = useRef<boolean | null>(null);
  const latestRequested = useRef(requested);
  const initialPosition = useRef(initial);
  const reader = useRef<HTMLElement>(null);
  const readButton = useRef<HTMLButtonElement>(null);
  const exportButton = useRef<HTMLButtonElement>(null);
  const current = Math.round(clampHistoryPosition(position));
  const place = HISTORY_PLACES[current];
  const secret = openedSecret;
  const environment = HISTORY_ENVIRONMENTS[current];
  const weather = journeyWeather(current, weatherVariation);
  const daylight = historyDaylight(position);
  const events = TIMELINE.filter(event => event.date === place.date);
  const settled = useRef<(value: number) => void>(() => {});
  settled.current = (value: number) => {
    if (value === HISTORY_LAST) setMotion(false);
    const date = DATES[Math.round(value)];
    // Explicit visits already wrote this date; only free travel needs a URL update.
    if (date === latestRequested.current) return;
    latestRequested.current = date;
    void setDay(date, { history: 'replace' });
  };

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    import('../history/history-scene').then(({ mountHistoryScene }) => {
      if (cancelled || !host.current) return;
      engine.current = mountHistoryScene(host.current, nodeRefs.current, initialPosition.current,
        value => { setPosition(value); setOpenedSecret(previous => previous && Math.abs(previous.day - value) > 1.5 ? null : previous); },
        value => settled.current(value), () => setStatus('failed'), secretRefs.current);
      setStatus('ready');
    }).catch(error => {
      if (!cancelled) { console.error('History landscape failed to start', error); setStatus('failed'); }
    });
    return () => { cancelled = true; engine.current?.dispose(); engine.current = null; appliedMotion.current = null; };
  }, [retry]);

  useEffect(() => {
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setMotion(!preference.matches);
    update(); preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (!engine.current || appliedMotion.current === motion) return;
    engine.current.setMotion(motion); appliedMotion.current = motion;
  }, [motion, status]);
  useEffect(() => { engine.current?.setSpeed(speed); }, [speed, status]);
  useEffect(() => { engine.current?.setWeather(weatherVariation); }, [weatherVariation, status]);

  useEffect(() => {
    if (requested === latestRequested.current) return;
    // nuqs can briefly replay an older optimistic value while Next commits the URL.
    // Only a value that matches the actual address bar may steer the camera back.
    const raw = new URLSearchParams(window.location.search).get('day');
    const addressDate = DATES.find(date => date === raw) ?? DATES[0];
    if (requested !== addressDate) return;
    latestRequested.current = requested;
    const value = Math.max(0, DATES.indexOf(requested));
    initialPosition.current = value;
    engine.current?.seek(value);
    setPosition(value);
  }, [requested]);

  useEffect(() => {
    if (reading) { reader.current?.scrollIntoView({ block: 'nearest', behavior: 'instant' }); reader.current?.focus({ preventScroll: true }); }
  }, [reading]);
  useEffect(() => { if (secret) secretLink.current?.focus({ preventScroll: true }); }, [secret]);

  const visit = useCallback((value: number, read = false) => {
    const index = Math.round(clampHistoryPosition(value));
    latestRequested.current = DATES[index]; initialPosition.current = index;
    void setDay(DATES[index]);
    engine.current?.seek(index, read);
    if (status !== 'ready') setPosition(index);
    if (read) setReading(true);
  }, [setDay, status]);

  const pauseWalking = useCallback(() => {
    engine.current?.setMotion(false);
    appliedMotion.current = engine.current ? false : null;
    setMotion(false);
  }, []);
  const pauseAndVisit = useCallback((value: number, read = false) => {
    // Apply pause before seek; the later React effect must not erase the new target.
    pauseWalking(); visit(value, read);
  }, [pauseWalking, visit]);

  function togglePlayback() {
    setOpenedSecret(null);
    if (!motion) { setReading(false); if (position === HISTORY_LAST) visit(0); }
    setMotion(value => !value);
  }
  function closeSecret() {
    const index = HISTORY_SECRETS.findIndex(item => item.id === openedSecret?.id);
    setOpenedSecret(null); secretRefs.current[index]?.focus({ preventScroll: true });
  }

  return (
    <main className="history-journey">
      <header className="journey-heading">
        <div><p className="journey-eyebrow">CUBEROOT / {tr({ zh: '生长纪', en: 'A living history' })}</p><h1>{tr({ zh: '把时间，走成风景。', en: 'Time becomes a landscape.' })}</h1></div>
        <p className="journey-edition">{tr({ zh: `${DATES.length} 日山河`, en: `${DATES.length} days of landscapes` })}<span>{DATES[0]} — {DATES[HISTORY_LAST]}</span></p>
      </header>
      <section className="journey-scroll" aria-label={tr({ zh: '项目历程交互画卷', en: 'Interactive project landscape' })}>
        <div className="journey-stage" tabIndex={0} role="region" aria-label={tr({ zh: '拖动画卷或滚动鼠标前后移动，方向键切换日期', en: 'Drag or scroll to travel; use arrow keys to change dates' })}
          onKeyDown={event => {
            if (event.key === 'Escape' && secret) { event.preventDefault(); closeSecret(); return; }
            if (event.target !== event.currentTarget) return;
            if (event.key === 'ArrowRight') { event.preventDefault(); visit(current + 1); }
            if (event.key === 'ArrowLeft') { event.preventDefault(); visit(current - 1); }
            if (event.key === 'Home') { event.preventDefault(); visit(0); }
            if (event.key === 'End') { event.preventDefault(); visit(HISTORY_LAST); }
            if (event.key === ' ') { event.preventDefault(); togglePlayback(); }
          }}>
          <div className="journey-scene" ref={host} />
          {status === 'ready' && <div className="journey-overlay"><div className="journey-place-copy" aria-live="polite">
            {secret ? <div className="journey-secret-story" id="journey-secret-story">
              <p className="journey-place-number">{tr({ zh: '你发现了一枚彩蛋', en: 'A small discovery' })}</p>
              <h2>{tr(secret)}</h2><p>{tr(secret.description)}</p>
              <div className="journey-secret-actions"><AppLink ref={secretLink} href={secret.href} prefetch={false}>{tr({ zh: '去看看', en: 'Explore' })}<ArrowUpRight size={15} /></AppLink><ClearButton variant="standalone" onClick={closeSecret} ariaLabel={tr({ zh: '收起彩蛋', en: 'Close discovery' })} /></div>
            </div> : <>
            <p className="journey-place-number">{String(current + 1).padStart(2, '0')} / {String(DATES.length).padStart(2, '0')}</p>
            <h2>{tr(place)}</h2>{place.caption && <p>{tr(place.caption)}</p>}
            <div className="journey-nature"><CompactSelect className="journey-biome" variant="plain" label={tr(environment)} value={HISTORY_LANDFORMS[current]} valueText={tr(environment)}
              items={(Object.keys(LANDFORMS) as HistoryLandform[]).map(value => ({ value, label: tr(LANDFORMS[value]) }))}
              ariaLabel={tr({ zh: '选择地貌', en: 'Choose a landform' })} title={tr({ zh: '选择地貌，跳转到相应日期', en: 'Choose a landform to visit its date' })}
              onChange={id => { const next = HISTORY_LANDFORMS.findIndex((value, i) => value === id && i >= current); pauseAndVisit(next < 0 ? HISTORY_LANDFORMS.indexOf(id) : next); }} />
            <CompactSelect className="journey-biome" variant="plain" label={tr({ zh: '寻找动物', en: 'Find wildlife' })}
              items={(Object.keys(ANIMALS) as AnimalSpecies[]).map(value => ({ value, label: tr(ANIMALS[value]) }))}
              ariaLabel={tr({ zh: '寻找动物', en: 'Find wildlife' })} title={tr({ zh: '选择动物，前往它的栖息地', en: 'Choose an animal to visit its habitat' })}
              onChange={species => { const matches = (index: number) => HISTORY_FAUNA[index].some(animal => animal.species === species); const next = HISTORY_FAUNA.findIndex((_, index) => index >= current && matches(index)); pauseAndVisit(next < 0 ? HISTORY_FAUNA.findIndex((_, index) => matches(index)) : next); }} /></div>
            </>}
          </div>
          <div className="journey-atmosphere" aria-label={tr({ zh: '画卷天气与动画', en: 'Landscape weather and motion' })}>
            <span className="journey-daylight" title={tr({ zh: '晨昼暮夜随行进变化，每八站走过一天', en: 'Dawn to moonlight unfolds over every eight stops' })}>{daylight.phase === 'night' ? <Moon size={13} /> : <Sun size={13} />}<span>{tr(DAYLIGHT_LABELS[daylight.phase])}</span></span>
            <CompactSelect variant="plain" label={tr(WEATHER_LABELS[weather])} value={environment.weather.indexOf(weather)} valueText={tr(WEATHER_LABELS[weather])}
              items={environment.weather.map((key, value) => ({ value, label: tr(WEATHER_LABELS[key]) }))}
              ariaLabel={tr({ zh: '选择这一站的天气', en: 'Choose this landscape’s weather' })}
              title={tr({ zh: '选择这一站的天气', en: 'Choose this landscape’s weather' })} onChange={setWeatherVariation} />
          </div></div>}
          <JourneyNodes current={current} ready={status === 'ready'} nodes={nodeRefs} onVisit={pauseAndVisit} />
          <div className="journey-node-layer" hidden={status !== 'ready'}>{HISTORY_SECRETS.map((item, index) => <button key={item.id} ref={node => { secretRefs.current[index] = node; }} type="button" className="journey-button journey-secret" data-secret={item.id} aria-label={tr({ zh: '查看这件闪光的小物件', en: 'Inspect this little glimmering object' })} aria-expanded={secret?.id === item.id} aria-controls="journey-secret-story" onClick={() => { pauseWalking(); setOpenedSecret(item); }}><Sparkles size={17} aria-hidden="true" /></button>)}</div>
          {status === 'loading' && <div className="journey-load"><ClientLoadStatus label={{ zh: '山河正在展开…', en: 'Unfolding the landscape…' }} /></div>}
          {status === 'failed' && <div className="journey-load" role="alert"><p>{tr({ zh: '画卷暂时未能展开，完整记录仍可在下方阅读。', en: 'The landscape could not load. The full archive is available below.' })}</p><button className="journey-button" type="button" onClick={() => { initialPosition.current = current; setRetry(n => n + 1); }}>{tr({ zh: '重新展开', en: 'Try again' })}</button></div>}
          <div className="journey-stage-hint"><MoveHorizontal size={15} /><span>{tr({ zh: '拖动画卷，或轻滚鼠标', en: 'Drag the landscape, or gently scroll' })}</span></div>
          {(current === 0 || current === HISTORY_LAST) && <span className="journey-seal" aria-hidden="true">立<br />方<br />根</span>}
        </div>
        <nav className="journey-controls" aria-label={tr({ zh: '画卷日期导航', en: 'Landscape date navigation' })}>
          <div className="journey-transport">
          <div className="journey-playback-controls">
          <button className="journey-button journey-playback" type="button" disabled={status !== 'ready'} onClick={togglePlayback} aria-label={tr(motion ? { zh: '暂停行走', en: 'Pause walking' } : { zh: '继续行走', en: 'Resume walking' })}>{motion ? <Pause size={17} /> : <Play size={17} />}<span>{tr(motion ? { zh: '暂停行走', en: 'Pause walking' } : { zh: '继续行走', en: 'Resume walking' })}</span></button>
          <CompactSelect className="journey-speed" variant="plain" label={`${speed}×`} value={speed} valueText={`${speed}×`} items={PLAYBACK_SPEEDS} onChange={setSpeed} ariaLabel={tr({ zh: '行走速度', en: 'Walking speed' })} title={tr({ zh: '调整自动行走速度，天气保持自然速度', en: 'Adjust automatic walking speed; weather keeps its natural pace' })} />
          </div>
          <div className="journey-date-controls">
          <button className="journey-button journey-arrow" type="button" disabled={current === 0} onClick={() => visit(current - 1)} aria-label={tr({ zh: '前一天', en: 'Previous day' })}><ArrowLeft size={19} /></button>
          <DateInput className="journey-current-date" size="compact" value={place.date} min={DATES[0]} max={DATES[HISTORY_LAST]} clearable={false} aria-label={tr({ zh: '跳转日期', en: 'Jump to date' })} title={tr({ zh: '选择日期，前往这天或之后的首次更新', en: 'Visit this date or the next recorded update' })} onFocus={pauseWalking} onChange={date => { if (!date) return; const index = DATES.findIndex(value => value >= date); pauseAndVisit(index < 0 ? HISTORY_LAST : index); }} />
          <button className="journey-button journey-arrow" type="button" disabled={current === HISTORY_LAST} onClick={() => visit(current + 1)} aria-label={tr({ zh: '后一天', en: 'Next day' })}><ArrowRight size={19} /></button>
          </div>
          </div>
          <PlaybackScrubber className="journey-scrubber" step={Math.round(position * 100)} total={HISTORY_LAST * 100} disabled={status !== 'ready'} ariaLabel={tr({ zh: '在画卷中移动', en: 'Travel through the landscape' })} onScrub={value => engine.current?.seek(value / 100, true)} />
          <button ref={readButton} type="button" className="journey-button journey-read" onClick={() => { if (!reading) pauseWalking(); setReading(!reading); }} aria-expanded={reading} aria-controls="journey-reader"><BookOpen size={16} />{tr({ zh: '阅读这一天', en: 'Read this day' })}<ArrowUpRight size={15} /></button>
          <button ref={exportButton} type="button" className="journey-button journey-download" disabled={status !== 'ready'} aria-label={tr({ zh: '下载视频', en: 'Download video' })} title={tr({ zh: '下载视频', en: 'Download video' })} aria-expanded={exportOpen} aria-controls="journey-video-export" onClick={() => { pauseWalking(); setExportOpen(!exportOpen); }}><Download size={18} aria-hidden="true" /></button>
        </nav>
        {exportOpen && <HistoryVideoExport source={host} current={current} initialSpeed={speed} weatherVariation={weatherVariation} onClose={() => { setExportOpen(false); exportButton.current?.focus({ preventScroll: true }); }} />}
      </section>
      <p className="journey-art-note">{tr({ zh: '每八站走过晨昼暮夜。37 种地貌与 36 种野生动物沿途相伴，留意闪光的小物件。自然景观为艺术化演绎，日期与更新内容来自真实记录。', en: 'Dawn to moonlight unfolds over every eight stops, with 37 landforms and 36 wildlife species. Look out for little glimmering objects. Imagined nature accompanies real dates and updates.' })}</p>
      <section id="journey-reader" ref={reader} tabIndex={-1} className={`journey-reader${reading ? ' is-open' : ''}`} aria-label={tr({ zh: '这一天的故事', en: 'The story of this day' })}>
        {reading && <>
          <header className="journey-reader-heading"><div><time dateTime={place.date}>{place.date}</time><h2>{tr(place)}</h2></div><ClearButton variant="standalone" onClick={() => { setReading(false); readButton.current?.focus(); }} ariaLabel={tr({ zh: '收起故事', en: 'Close story' })} /></header>
          <p className="journey-daily-summary">{tr(place.day)}</p>
          {events.map(event => <article className="journey-story" key={`${event.date}-${event.en.title}`}><h3>{tr(event).title}</h3><p>{tr(event).body}</p><p>{tr(event).expand}</p></article>)}
        </>}
      </section>
      <details className="journey-archive" onToggle={event => setArchiveOpen(event.currentTarget.open)}><summary>{tr({ zh: '翻阅完整记录', en: 'Browse the complete archive' })}<span>{tr({ zh: `${TIMELINE.length} 项关键改动，${DAYS.length} 天更新`, en: `${TIMELINE.length} milestones, ${DAYS.length} days of updates` })}</span></summary>{archiveOpen && <MemoHistoryArchive />}</details>
    </main>
  );
}
