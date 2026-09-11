'use client';

import { memo, useRef, useState, useEffect, useCallback, type RefObject } from 'react';
import { parseAsStringLiteral, useQueryState } from 'nuqs';
import { ArrowLeft, ArrowRight, ArrowUp, ArrowUpRight, MoveHorizontal, BookOpen, Pause, Play, Sun, Moon, Sparkles, Download, RotateCcw, Gamepad2 } from 'lucide-react';
import AppLink from '@/components/AppLink';
import { ClearButton } from '@/components/ClearButton';
import { CompactSelect } from '@/components/CompactSelect';
import { DateInput } from '@/components/DateInput';
import { ClientLoadStatus } from '@/components/StartupStatus';
import PlaybackScrubber from '@/components/PlaybackScrubber';
import { tr } from '@/i18n/tr';
import { TIMELINE } from '../_lib/arch-data';
import DAYS from '../timeline_commits.json';
import { HISTORY_PLACES, HISTORY_LAST, HISTORY_GAITS, type HistoryGait, clampHistoryPosition } from '../history/history-days';
import type { HistoryScene } from '../history/history-scene';
import { EMPTY_HISTORY_SCORE, type HistoryPlayScore } from '../history/history-play';
import { HISTORY_ENVIRONMENTS, WEATHER_LABELS, DAYLIGHT_LABELS, historyDaylight, journeyWeather } from '../history/history-environment';
import { HISTORY_LANDFORMS, LANDFORMS, type HistoryLandform } from '../history/history-landforms';
import { ANIMALS, HISTORY_FAUNA, type AnimalSpecies } from '../history/history-fauna';
import { HISTORY_SECRETS, type HistorySecret } from '../history/history-secrets';
import HistoryArchive from './HistoryView';
import HistoryVideoExport from './HistoryVideoExport';

const DATES = HISTORY_PLACES.map(place => place.date);
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
  const [mode, setMode] = useQueryState('mode', parseAsStringLiteral(['play'] as const).withOptions({ history: 'push', scroll: false }));
  const isGame = mode === 'play';
  const [started, setStarted] = useState(false);
  const [requested, setDay] = useQueryState('day', parseAsStringLiteral(DATES).withDefault(DATES[0]).withOptions({ history: 'push', scroll: false }));
  const initial = Math.max(0, DATES.indexOf(requested));
  const [position, setPosition] = useState(initial);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [retry, setRetry] = useState(0);
  const [reading, setReading] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [weatherVariation, setWeatherVariation] = useState(0);
  const [motion, setMotion] = useState(!isGame);
  const [gait, setGait] = useState<HistoryGait>(isGame ? 'glide' : 'walk');
  const [playScore, setPlayScore] = useState<HistoryPlayScore>(EMPTY_HISTORY_SCORE);
  const [openedSecret, setOpenedSecret] = useState<HistorySecret | null>(null);
  const host = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const secretRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const secretLink = useRef<HTMLAnchorElement>(null);
  const engine = useRef<HistoryScene | null>(null);
  const appliedMotion = useRef<boolean | null>(null);
  const latestPlayback = useRef({ gait, motion, isGame, weatherVariation });
  latestPlayback.current = { gait, motion, isGame, weatherVariation };
  const latestRequested = useRef(requested);
  const initialPosition = useRef(initial);
  const reader = useRef<HTMLElement>(null);
  const readButton = useRef<HTMLButtonElement>(null);
  const exportButton = useRef<HTMLButtonElement>(null);
  const startButton = useRef<HTMLButtonElement>(null);
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
        value => settled.current(value), () => setStatus('failed'), secretRefs.current, undefined, setPlayScore);
      const playback = latestPlayback.current;
      engine.current.setGait(playback.gait);
      engine.current.setWeather(playback.weatherVariation);
      engine.current.setGameMode(playback.isGame);
      engine.current.setMotion(playback.motion);
      appliedMotion.current = playback.motion;
      setStatus('ready');
    }).catch(error => {
      if (!cancelled) { console.error('History landscape failed to start', error); setStatus('failed'); }
    });
    return () => { cancelled = true; engine.current?.dispose(); engine.current = null; appliedMotion.current = null; };
  }, [retry]);

  useEffect(() => {
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setMotion(!latestPlayback.current.isGame && !preference.matches);
    update(); preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (!engine.current || appliedMotion.current === motion) return;
    engine.current.setMotion(motion); appliedMotion.current = motion;
  }, [motion, status]);
  useEffect(() => { engine.current?.setGait(gait); }, [gait, status]);
  useEffect(() => { engine.current?.setWeather(weatherVariation); }, [weatherVariation, status]);
  useEffect(() => { engine.current?.setGameMode(isGame); }, [isGame, status]);
  useEffect(() => {
    if (isGame) { setGait('glide'); setMotion(false); setStarted(false); setReading(false); setExportOpen(false); }
  }, [isGame]);
  useEffect(() => { if (isGame && !started && status === 'ready') startButton.current?.focus({ preventScroll: true }); }, [isGame, started, status]);
  useEffect(() => {
    const release = () => engine.current?.hold(false);
    window.addEventListener('blur', release);
    return () => window.removeEventListener('blur', release);
  }, []);

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
    setStarted(true);
    setOpenedSecret(null);
    if (!motion) { setReading(false); if (position === HISTORY_LAST) { engine.current?.resetPlay(); visit(0); } }
    setMotion(value => !value);
  }
  function jump() {
    if (!engine.current?.jump()) return;
    setStarted(true);
    setOpenedSecret(null); setReading(false);
    engine.current.setMotion(true); appliedMotion.current = true; setMotion(true);
  }
  function closeSecret() {
    const index = HISTORY_SECRETS.findIndex(item => item.id === openedSecret?.id);
    setOpenedSecret(null); secretRefs.current[index]?.focus({ preventScroll: true });
  }

  return (
    <main className={`history-journey${isGame ? ' is-game' : ''}`}>
      <header className="journey-heading">
        <div><p className="journey-eyebrow">CUBEROOT / {tr({ zh: '生长纪', en: 'A living history' })}</p><h1>{tr({ zh: '把时间，走成风景。', en: 'Time becomes a landscape.' })}</h1></div>
        <p className="journey-edition">{tr({ zh: `${DATES.length} 日山河`, en: `${DATES.length} days of landscapes` })}<span>{DATES[0]} — {DATES[HISTORY_LAST]}</span></p>
      </header>
      <section className="journey-scroll" aria-label={tr({ zh: '项目历程交互画卷', en: 'Interactive project landscape' })}>
        <div className="journey-stage" tabIndex={0} role="region" aria-label={tr({ zh: '左右键切换日期，空格起跳，滑行时按住空翻，P 暂停', en: 'Left and right change dates; Space jumps, hold to flip while gliding; P pauses' })}
          onPointerDown={event => {
            if (!isGame || !(event.target instanceof HTMLCanvasElement) || event.button !== 0) return;
            event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); jump(); engine.current?.hold(true);
          }}
          onPointerUp={() => engine.current?.hold(false)} onPointerCancel={() => engine.current?.hold(false)} onLostPointerCapture={() => engine.current?.hold(false)}
          onKeyUp={event => { if (event.key === ' ' || event.key === 'ArrowUp') engine.current?.hold(false); }}
          onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) engine.current?.hold(false); }}
          onKeyDown={event => {
            if (event.key === 'Escape' && secret) { event.preventDefault(); closeSecret(); return; }
            if (event.key.toLowerCase() === 'p' && (event.target === event.currentTarget || (event.target instanceof Element && event.target.closest('.journey-jump')))) { event.preventDefault(); if (!event.repeat) togglePlayback(); return; }
            if ((event.key === ' ' || event.key === 'ArrowUp') && (event.target === event.currentTarget || (event.target instanceof Element && event.target.closest('.journey-jump')))) { event.preventDefault(); if (!event.repeat) { jump(); engine.current?.hold(true); } return; }
            if (event.target !== event.currentTarget) return;
            if (event.key === 'ArrowRight') { event.preventDefault(); visit(current + 1); }
            if (event.key === 'ArrowLeft') { event.preventDefault(); visit(current - 1); }
            if (event.key === 'Home') { event.preventDefault(); visit(0); }
            if (event.key === 'End') { event.preventDefault(); visit(HISTORY_LAST); }
          }}>
          <div className="journey-scene" ref={host} />
          {status === 'ready' && <div className="journey-overlay"><div className={`journey-place-copy${current === 0 && !secret ? ' is-opening' : ''}`} aria-live="polite">
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
          {status === 'ready' && <div className="journey-play-hud">
            <div className="journey-play-score" aria-label={tr({ zh: `已拾 ${playScore.lights} 枚光点，${playScore.score} 分`, en: `${playScore.lights} lights collected, ${playScore.score} points` })}>
              <Sparkles size={15} aria-hidden="true" /><span>{tr({ zh: '拾光', en: 'Light trail' })} <strong>{playScore.score}</strong></span>
              {playScore.combo > 1 && <span className="journey-play-combo">{tr({ zh: `连收 ${playScore.combo}`, en: `${playScore.combo} in a row` })}</span>}
              {playScore.flips > 0 && <span>{tr({ zh: `空翻 ${playScore.flips}`, en: `${playScore.flips} flips` })}</span>}
              {playScore.score > 0 && <button type="button" className="journey-button journey-play-reset" onClick={() => engine.current?.resetPlay()} aria-label={tr({ zh: '重置本次得分', en: 'Reset this run’s score' })} title={tr({ zh: '重置本次得分', en: 'Reset this run’s score' })}><RotateCcw size={14} /></button>}
            </div>
            <button className="journey-button journey-jump" type="button"
              onPointerDown={event => { if (event.button !== 0) return; event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); jump(); engine.current?.hold(true); }}
              onPointerUp={() => engine.current?.hold(false)} onPointerCancel={() => engine.current?.hold(false)} onLostPointerCapture={() => engine.current?.hold(false)}
              onClick={event => { if (event.detail === 0) jump(); }} disabled={position === HISTORY_LAST}
              aria-label={tr({ zh: '轻点跳跃，滑行时按住空翻，空中再按可二段跳', en: 'Tap to jump, hold to flip while gliding; tap again to double jump' })}
              title={tr({ zh: '轻点跳跃，滑行时按住空翻', en: 'Tap to jump; hold to flip while gliding' })}><ArrowUp size={23} aria-hidden="true" /><span>{tr({ zh: '跳跃', en: 'Jump' })}</span></button>
          </div>}
          <div className={`journey-trick-feedback is-${playScore.status}`} role="status">{playScore.status === 'boost' ? tr({ zh: '漂亮落地！顺风加速', en: 'Clean landing! A tailwind boost' }) : playScore.status === 'stumble' ? tr({ zh: '稳住，再来一次', en: 'Find your balance. Try again' }) : ''}</div>
          <div className="journey-landing-cue">{tr({ zh: '松手，准备落地', en: 'Release to land' })}</div>
          {isGame && <>
            <div className="journey-game-bar"><h1>{tr({ zh: '山河滑行', en: 'Paper Odyssey' })}</h1><ClearButton variant="standalone" ariaLabel={tr({ zh: '退出游戏，返回画卷', en: 'Leave game and return to the landscape' })} onClick={() => { pauseWalking(); void setMode(null); }} /></div>
            {started && position !== HISTORY_LAST && <p className="journey-game-mission">{playScore.lights < 12 ? tr({ zh: `沿途拾光 ${playScore.lights} / 12`, en: `Gather light ${playScore.lights} / 12` }) : playScore.flips < 3 ? tr({ zh: `乘风空翻 ${playScore.flips} / 3`, en: `Ride the wind ${playScore.flips} / 3 flips` }) : tr({ zh: '拾光成章，继续探索山河', en: 'A chapter of light. Keep exploring' })}</p>}
            {(!started || position === HISTORY_LAST) && status === 'ready' && <div className="journey-game-welcome">
              <p className="journey-eyebrow">CUBEROOT / PAPER ODYSSEY</p>
              <h2>{tr(position === HISTORY_LAST ? { zh: '山河尽处，还有下一程。', en: 'Every horizon is a new beginning.' } : { zh: '借一阵风，越过山河。', en: 'Catch the wind. Follow the horizon.' })}</h2>
              <p>{tr(position === HISTORY_LAST ? { zh: `收获 ${playScore.score} 分，完成 ${playScore.flips} 次空翻。`, en: `${playScore.score} points and ${playScore.flips} flips along the way.` } : { zh: '从雪岭到沙海，在极光与骤雨间拾光。', en: 'Gather light through snowy peaks, dunes, auroras and rain.' })}</p>
              <button ref={startButton} className="journey-button journey-game-start" type="button" onClick={() => { if (position === HISTORY_LAST) { engine.current?.resetPlay(); visit(0); } setStarted(true); setMotion(true); host.current?.parentElement?.focus({ preventScroll: true }); }}><Play size={18} />{tr(position === HISTORY_LAST ? { zh: '再出发', en: 'Ride again' } : { zh: '乘风出发', en: 'Begin the ride' })}<ArrowRight size={19} /></button>
              <p className="journey-game-instructions">{tr({ zh: '轻点起跳，按住空翻，松开准备落地。空中再点可二段跳。', en: 'Tap to jump, hold to flip, release to land. Tap again for a double jump.' })}<span className="journey-keyboard-hint">{tr({ zh: '空格 / ↑ 起跳，P 暂停', en: 'Space / ↑ to jump, P to pause' })}</span></p>
            </div>}
          </>}
          <div className="journey-stage-hint"><MoveHorizontal size={15} /><span>{tr({ zh: '拖动画卷', en: 'Drag to explore' })}<span className="journey-keyboard-hint">{tr({ zh: '空格跳跃 / P 暂停', en: 'Space to jump / P to pause' })}</span><span className="journey-touch-hint">{tr({ zh: '空中再按可二段跳', en: 'Tap again in the air to double jump' })}</span></span></div>
          {(current === 0 || current === HISTORY_LAST) && <span className="journey-seal" aria-hidden="true">魔<br />方<br />根</span>}
        </div>
        <nav className="journey-controls" aria-label={tr({ zh: '画卷日期导航', en: 'Landscape date navigation' })}>
          <div className="journey-transport">
          <div className="journey-playback-controls">
          {!isGame && <button className="journey-button journey-game-launch" type="button" onClick={() => void setMode('play')}><Gamepad2 size={18} />{tr({ zh: '山河滑行', en: 'Play' })}</button>}
          <button className="journey-button journey-playback" type="button" disabled={status !== 'ready'} onClick={togglePlayback} aria-label={tr(motion ? { zh: '暂停行进', en: 'Pause travel' } : { zh: '继续行进', en: 'Resume travel' })}>{motion ? <Pause size={17} /> : <Play size={17} />}<span>{tr(motion ? { zh: '暂停', en: 'Pause' } : { zh: '继续', en: 'Resume' })}</span></button>
          <CompactSelect variant="plain" label={tr(HISTORY_GAITS[gait])} value={gait} valueText={tr(HISTORY_GAITS[gait])}
            items={(Object.keys(HISTORY_GAITS) as HistoryGait[]).map(value => ({ value, label: tr(HISTORY_GAITS[value]) }))}
            onChange={setGait} ariaLabel={tr({ zh: '行进方式', en: 'Travel style' })} title={tr({ zh: '从漫步到滑行，速度逐档加快', en: 'From strolling to gliding, each style travels faster' })} />
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
        {exportOpen && <HistoryVideoExport source={host} current={current} initialGait={gait} weatherVariation={weatherVariation} onClose={() => { setExportOpen(false); exportButton.current?.focus({ preventScroll: true }); }} />}
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
