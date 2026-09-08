'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowDownToLine, ArrowLeft, ArrowRight, ArrowUp, ArrowUpFromLine, CloudSun, Copy, Crosshair, Drone, Footprints, Maximize, Move, Plus, Redo2, RotateCcw, RotateCw, Trash2, Undo2 } from 'lucide-react';
import AppLink from '@/components/AppLink';
import HeaderToggles from '@/components/HeaderToggles';
import BoolToggle from '@/components/BoolToggle';
import PuzzlePicker from '@/components/PuzzlePicker/PuzzlePicker';
import { CompactSelect } from '@/components/CompactSelect';
import { ClearButton } from '@/components/ClearButton';
import NumberCommitInput from '@/components/NumberCommitInput';
import { persistItem } from '@/lib/safe-storage';
import { tr } from '@/i18n/tr';
import { DRONE_MAX_HEIGHT, DRONE_MIN_SPEED, DRONE_MAX_SPEED, DRONE_DEFAULT_SPEED, DRONE_SPEEDS, SpaceScene, type Mode, type Navigation, type View } from './space-scene';
import { commitLayout, DESTINATIONS, ENVIRONMENTS, type Environment, INITIAL_LAYOUT, isPuzzleKind, layoutTime, validSceneTime, MAX_OBJECTS, movePosition, parseLayout, PUZZLES, RIVER_COLORS, type RiverColor, ROOMS, SPACE_KEY, travelHistory, WEATHER, type Weather, type Destination, type History, type PuzzleKind, type RoomStyle, type SpaceObject } from './space-state';
import './space.css';
import { turnButtons } from './space-turn';
import { SHANGHAI_VIEWS, type ShanghaiView } from './space-shanghai';
import CREDITS from '../about/credits_data.json';

const SPACE_CREDITS = CREDITS.filter(credit => 'space' in credit && credit.space);
const DIRECTION_BUTTONS = [
  { move: 'forward', look: 'look-up', key: 'W', arrow: '↑', icon: ArrowUp, label: { zh: '向前', en: 'Move forward' }, lookLabel: { zh: '镜头上仰', en: 'Tilt camera up' } },
  { move: 'left', look: 'look-left', key: 'A', arrow: '←', icon: ArrowLeft, label: { zh: '向左', en: 'Move left' }, lookLabel: { zh: '镜头左转', en: 'Turn camera left' } },
  { move: 'back', look: 'look-down', key: 'S', arrow: '↓', icon: ArrowDown, label: { zh: '向后', en: 'Move backward' }, lookLabel: { zh: '镜头下俯', en: 'Tilt camera down' } },
  { move: 'right', look: 'look-right', key: 'D', arrow: '→', icon: ArrowRight, label: { zh: '向右', en: 'Move right' }, lookLabel: { zh: '镜头右转', en: 'Turn camera right' } },
];

export default function SpacePage() {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<SpaceScene | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const pending = useRef<PuzzleKind | null>(null);
  const [history, setHistory] = useState<History>({ past: [], current: INITIAL_LAYOUT, future: [] });
  const [selected, setSelected] = useState<string | null>(null);
  const [kind, setKind] = useState<PuzzleKind>('333');
  const [placing, setPlacing] = useState(false);
  const [mode, setMode] = useState<Mode>('translate');
  const [snap, setSnap] = useState(false);
  const [inverse, setInverse] = useState(false);
  const [turnBlocked, setTurnBlocked] = useState(false);
  const [ready, setReady] = useState(false);
  const [navigation, setNavigation] = useState<Navigation>('orbit');
  const [altitude, setAltitude] = useState(0);
  const [droneSpeed, setDroneSpeed] = useState(DRONE_DEFAULT_SPEED);
  const navigating = navigation !== 'orbit';
  const [zoom, setZoom] = useState(50);
  const [cityState, setCityState] = useState<'loading' | 'ready' | 'error' | null>(null);
  const [cruising, setCruising] = useState(false);
  const [storage, setStorage] = useState<'saved' | 'blocked' | 'failed'>('saved');
  const [message, setMessage] = useState<'import' | 'time' | 'limit' | 'weather' | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const objects = history.current.objects;
  const room = history.current.room ?? 'minimal';
  const environment = history.current.environment ?? 'original';
  const weather = history.current.weather ?? 'sunny';
  const riverColor = history.current.riverColor ?? 'huangpu';
  const active = objects.find(o => o.id === selected);

  function changeDroneSpeed(speed: number) {
    setDroneSpeed(speed);
    scene.current?.setDroneSpeed(speed);
  }

  function change(object: SpaceObject) {
    setHistory(h => commitLayout(h, { ...h.current, objects: h.current.objects.map(o => o.id === object.id ? object : o) }));
  }
  function cancel() {
    scene.current?.setNavigation('orbit');
    scene.current?.cancel();
    pending.current = null;
    setPlacing(false);
  }
  function remove() {
    if (!active) return;
    setHistory(h => commitLayout(h, { ...h.current, objects: h.current.objects.filter(o => o.id !== active.id) }));
    setSelected(null);
  }
  function duplicate() {
    if (!active) return;
    if (objects.length >= MAX_OBJECTS) { setMessage('limit'); return; }
    const copy = { ...active, id: crypto.randomUUID(), position: movePosition([active.position[0] + 2, active.position[1] + 1], snap) };
    setHistory(h => commitLayout(h, { ...h.current, objects: [...h.current.objects, copy] }));
    setSelected(copy.id);
  }
  function travel(direction: 'undo' | 'redo') {
    cancel();
    setHistory(h => travelHistory(h, direction));
  }
  function exportLayout() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(history.current, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'cuberoot-space.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function importLayout(upload: File | undefined) {
    if (!upload) return;
    try {
      if (upload.size > 128_000) throw new Error('size');
      const next = parseLayout(await upload.text());
      cancel();
      setHistory(h => commitLayout(h, next));
      setSelected(null);
      setMessage(null);
    } catch (error) { setMessage(error instanceof Error && error.message === 'timeOfDay' ? 'time' : 'import'); }
    if (file.current) file.current.value = '';
  }

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SPACE_KEY);
      if (saved) setHistory({ past: [], current: parseLayout(saved), future: [] });
    } catch { setStorage('blocked'); }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready || storage === 'blocked') return;
    setStorage(persistItem(SPACE_KEY, JSON.stringify(history.current)) ? 'saved' : 'failed');
  }, [history.current, ready, storage]);
  useEffect(() => {
    if (!ready || !host.current) return;
    let world: SpaceScene;
    try {
      world = new SpaceScene(host.current, {
        select: setSelected,
        change,
        place: (position, level, scale) => {
          const puzzle = pending.current;
          if (!puzzle) return;
          const object: SpaceObject = { id: crypto.randomUUID(), kind: puzzle, position, level, rotation: [0, 0, 0], scale };
          setHistory(h => h.current.objects.length >= MAX_OBJECTS ? h : commitLayout(h, { ...h.current, objects: [...h.current.objects, object] }));
          setSelected(object.id);
          pending.current = null;
          setPlacing(false);
        },
        unavailable: () => setUnavailable(true),
        navigation: setNavigation,
        altitude: setAltitude,
        weatherError: () => setMessage('weather'),
        cityState: setCityState,
        cruising: setCruising,
        zoom: setZoom,
      });
      scene.current = world;
    } catch { setUnavailable(true); return; }
    return () => { scene.current = null; world.dispose(); };
  }, [ready]);
  useEffect(() => {
    scene.current?.sync(history.current, active?.id ?? null, mode, snap, placing);
  }, [history.current, active?.id, mode, snap, placing, ready]);
  useEffect(() => {
    function key(event: KeyboardEvent) {
      if (event.defaultPrevented) return;
      const element = event.target as HTMLElement;
      if (element.closest('input, textarea, select, [contenteditable="true"], [role="dialog"], [role="menu"], [role="listbox"]')) return;
      if (event.key === 'Escape') { cancel(); return; }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault(); travel(event.shiftKey ? 'redo' : 'undo');
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
        event.preventDefault(); travel('redo');
      } else if (element === host.current?.querySelector('canvas')) {
        if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); remove(); }
        if (event.key.toLowerCase() === 'f') scene.current?.focus();
        if (active && !scene.current?.navigating && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
          event.preventDefault();
          const step = event.shiftKey ? 1 : 0.5;
          change({ ...active, position: movePosition([active.position[0] + (event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0), active.position[1] + (event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0)], snap) });
        }
      }
    }
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });
  const navigationModes = [
    { value: 'orbit' as const, label: tr({ zh: '环绕', en: 'Orbit' }), icon: Move },
    { value: 'walk' as const, label: tr({ zh: '漫游', en: 'Walk' }), icon: Footprints },
    { value: 'drone' as const, label: tr({ zh: '无人机', en: 'Drone' }), icon: Drone },
  ];
  const navigationMode = navigationModes.find(item => item.value === navigation)!;
  const NavigationIcon = navigationMode.icon;
  const views: { value: View; label: string }[] = [
    { value: 'home', label: tr({ zh: '全景', en: 'Overview' }) },
    { value: 'interior', label: tr({ zh: '室内', en: 'Interior' }) },
    { value: 'exterior', label: tr({ zh: '建筑外观', en: 'Exterior' }) },
    { value: 'front', label: tr({ zh: '正面', en: 'Front' }) },
    { value: 'side', label: tr({ zh: '侧面', en: 'Side' }) },
    { value: 'top', label: tr({ zh: '俯视', en: 'Top' }) },
  ];
  const name = active ? tr(PUZZLES[active.kind]) : '';

  return (
    <main className="cube-space">
      <header className="space-header">
        <div className="space-heading"><h1>{tr({ zh: '魔方空间', en: 'Cube space' })}</h1><CompactSelect label={tr(ROOMS[room])} ariaLabel={tr({ zh: '选择房间风格', en: 'Choose room style' })} value={room} valueText={tr(ROOMS[room])} items={(Object.keys(ROOMS) as RoomStyle[]).map(value => ({ value, label: tr(ROOMS[value]) }))} onChange={room => { cancel(); setHistory(h => commitLayout(h, { ...h.current, timeOfDay: layoutTime(h.current), room })); }} />
          <CompactSelect label={tr(ENVIRONMENTS[environment])} ariaLabel={tr({ zh: '选择环境', en: 'Choose environment' })} value={environment} valueText={tr(ENVIRONMENTS[environment])} items={(Object.keys(ENVIRONMENTS) as Environment[]).map(value => ({ value, label: tr(ENVIRONMENTS[value]) }))} onChange={environment => { cancel(); setHistory(h => commitLayout(h, { ...h.current, environment })); }} />
          <CompactSelect label={<span className="space-weather-label"><CloudSun size={16} />{tr(WEATHER[weather])}</span>} ariaLabel={tr({ zh: '切换天气', en: 'Change weather' })} value={weather} valueText={tr(WEATHER[weather])} items={(Object.keys(WEATHER) as Weather[]).map(value => ({ value, label: tr(WEATHER[value]) }))} onChange={weather => { cancel(); setHistory(h => commitLayout(h, { ...h.current, weather })); }} />
          <label className="space-time">{tr({ zh: '时间', en: 'Time' })}<input className="space-time-input" type="time" aria-label={tr({ zh: '场景时间', en: 'Scene time' })} min="00:00" max="23:59" step={60} required value={layoutTime(history.current)} onChange={e => { const timeOfDay = e.currentTarget.value; if (validSceneTime(timeOfDay)) setHistory(h => commitLayout(h, { ...h.current, timeOfDay })); }} /></label>
          {environment === 'shanghai' && <CompactSelect label={<>{tr({ zh: '水色', en: 'Water' })}: {tr(RIVER_COLORS[riverColor])}</>} ariaLabel={tr({ zh: '江水颜色', en: 'River color' })} value={riverColor} valueText={tr(RIVER_COLORS[riverColor])} items={(Object.keys(RIVER_COLORS) as RiverColor[]).map(value => ({ value, label: tr(RIVER_COLORS[value]) }))} onChange={riverColor => setHistory(h => commitLayout(h, { ...h.current, riverColor }))} />}
          {(weather !== 'sunny' || environment !== 'original') && <BoolToggle value={history.current.weatherMotion ?? true} onChange={weatherMotion => setHistory(h => commitLayout(h, { ...h.current, weatherMotion }))} label={tr({ zh: '动态天气', en: 'Animate weather' })} />}
        </div>
        <div className="space-header-actions"><AppLink href="/sim">{tr({ zh: '模拟器', en: 'Simulator' })}</AppLink><HeaderToggles /></div>
      </header>
      <nav className="space-destinations" aria-label={tr({ zh: '前往房间', en: 'Go to a room' })}>
        {(room === 'company' ? ['interior', 'study', 'courtyard'] as const : Object.keys(DESTINATIONS) as Destination[]).map(destination => <button className="space-destination" key={destination} onClick={() => { cancel(); scene.current?.view(destination); }}>{tr(room === 'company' ? ({ interior: { zh: '办公室 406', en: 'Office 406' }, study: { zh: '公共休息区', en: 'Shared lounge' }, courtyard: { zh: '电话亭', en: 'Phone booths' } }[destination as 'interior' | 'study' | 'courtyard']) : DESTINATIONS[destination])}</button>)}
        {environment === 'island' && <>
          <button className="space-destination" onClick={() => { cancel(); scene.current?.view('island'); }}>{tr({ zh: '全岛鸟瞰', en: 'Island overview' })}</button>
          <button className="space-destination" onClick={() => { cancel(); scene.current?.view('shore'); }}>{tr({ zh: '海边观浪', en: 'Watch the waves' })}</button>
        </>}
      </nav>
      {environment === 'shanghai' && <nav className="space-destinations" aria-label={tr({ zh: '黄浦江沿岸', en: 'Huangpu waterfront' })}>
        {(Object.keys(SHANGHAI_VIEWS) as ShanghaiView[]).map(view => <button className="space-destination" key={view} disabled={cityState !== 'ready'} onClick={() => { cancel(); scene.current?.view(view); }}>{tr(SHANGHAI_VIEWS[view])}</button>)}
        <button className="space-destination" aria-pressed={cruising} disabled={cityState !== 'ready'} onClick={() => scene.current?.cruise(!cruising)}>{cruising ? tr({ zh: '暂停巡游', en: 'Pause cruise' }) : tr({ zh: '沿江巡游', en: 'Cruise the river' })}</button>
      </nav>}
      <div className="space-workspace">
        <div ref={host} className="space-canvas" role="region" aria-label={tr({ zh: '三维魔方空间', en: '3D cube space' })} />
        <div className="space-top-tools">
          <div className="space-row">
            <PuzzlePicker selectedEvent={kind} onSelect={id => { if (isPuzzleKind(id)) setKind(id); }} groups={[{ id: 'space', label: tr({ zh: '选择魔方', en: 'Choose a puzzle' }), items: Object.entries(PUZZLES).map(([id, p]) => ({ id, label: tr(p), iconClass: p.icon })) }]} />
            <button className="space-control space-add" disabled={!ready || unavailable || objects.length >= MAX_OBJECTS} onClick={() => { cancel(); pending.current = kind; setPlacing(true); setSelected(null); setMessage(null); }}><Plus size={16} />{tr({ zh: '放入空间', en: 'Place a cube' })}</button>
          </div>
          <div className="space-row">
            <button className="space-control" aria-label={tr({ zh: '撤销', en: 'Undo' })} title="Ctrl+Z" disabled={!history.past.length} onClick={() => travel('undo')}><Undo2 size={18} /></button>
            <button className="space-control" aria-label={tr({ zh: '重做', en: 'Redo' })} title="Ctrl+Shift+Z" disabled={!history.future.length} onClick={() => travel('redo')}><Redo2 size={18} /></button>
            <button className="space-control" aria-label={tr({ zh: '导入布局', en: 'Import layout' })} onClick={() => file.current?.click()}><ArrowUpFromLine size={18} /></button>
            <button className="space-control" aria-label={tr({ zh: '导出布局', en: 'Export layout' })} onClick={exportLayout}><ArrowDownToLine size={18} /></button>
            <input ref={file} type="file" accept=".json,application/json" hidden onChange={e => void importLayout(e.target.files?.[0])} />
          </div>
        </div>
        <aside className="space-inspector" aria-label={tr({ zh: '摆放工具', en: 'Placement tools' })}>
          <CompactSelect label={name || tr({ zh: '选择物件', en: 'Select object' })} ariaLabel={tr({ zh: '空间中的魔方', en: 'Cubes in the space' })} value={active?.id ?? ''} valueText={name || tr({ zh: '选择物件', en: 'Select object' })} items={objects.map((o, i) => ({ value: o.id, label: `${tr(PUZZLES[o.kind])} ${i + 1}` }))} onChange={id => { cancel(); setSelected(id); }} />
          {active ? <>
            <div className="space-modes space-row">
              <button className="space-control" aria-pressed={mode === 'translate'} onClick={() => setMode('translate')}><Move size={16} />{tr({ zh: '移动', en: 'Move' })}</button>
              <button className="space-control" aria-pressed={mode === 'rotate'} onClick={() => setMode('rotate')}><RotateCw size={16} />{tr({ zh: '摆放旋转', en: 'Rotate object' })}</button>
              <button className="space-control" aria-pressed={mode === 'twist'} onClick={() => { setMode('twist'); scene.current?.focus(); }}><RotateCcw size={16} />{tr({ zh: '拧魔方', en: 'Twist puzzle' })}</button>
            </div>
            {mode === 'twist' ? <div className="space-turns space-row">
              {active.kind !== 'sq1' && <button className="space-control" aria-pressed={inverse} onClick={() => setInverse(v => !v)}>{tr({ zh: '逆时针', en: 'Inverse' })}</button>}
              {turnButtons(active.kind).map(move => <button className="space-control" key={move} onClick={() => setTurnBlocked(!scene.current?.twist(move + (inverse && active.kind !== 'sq1' ? "'" : '')))}>{move}{inverse && active.kind !== 'sq1' ? "'" : ''}</button>)}
              <button className="space-control" onClick={() => { change({ ...active, moves: [] }); setTurnBlocked(false); }}>{tr({ zh: '还原魔方', en: 'Reset puzzle' })}</button>
              {turnBlocked && <span role="status">{tr({ zh: '请等当前转动结束；Square-1 切缝对齐后才能斜切。', en: 'Wait for the turn to finish. Square-1 slices require aligned cuts.' })}</span>}
            </div> : null}
            <CompactSelect label={`${Math.round(active.scale * 100)}%`} ariaLabel={tr({ zh: '魔方大小', en: 'Cube size' })} value={active.scale} valueText={`${Math.round(active.scale * 100)}%`} items={[0.04, 0.06, 0.1, 0.2, 0.4, 0.6, 0.85, 1, 1.15, 1.5, 2, 2.5].map(value => ({ value, label: `${Math.round(value * 100)}%` }))} onChange={scale => change({ ...active, scale })} />
            <div className="space-row">
              <button className="space-control" aria-label={tr({ zh: '向左旋转 15°', en: 'Rotate left 15°' })} onClick={() => change({ ...active, rotation: [active.rotation[0], (active.rotation[1] - Math.PI / 12) % (Math.PI * 2), active.rotation[2]] })}><RotateCcw size={17} /></button>
              <button className="space-control" aria-label={tr({ zh: '向右旋转 15°', en: 'Rotate right 15°' })} onClick={() => change({ ...active, rotation: [active.rotation[0], (active.rotation[1] + Math.PI / 12) % (Math.PI * 2), active.rotation[2]] })}><RotateCw size={17} /></button>
              <button className="space-control" aria-label={tr({ zh: '聚焦魔方', en: 'Focus cube' })} onClick={() => scene.current?.focus()}><Crosshair size={17} /></button>
            </div>
            <div className="space-row"><button className="space-control" onClick={duplicate} disabled={objects.length >= MAX_OBJECTS}><Copy size={16} />{tr({ zh: '复制', en: 'Duplicate' })}</button><button className="space-control" onClick={remove}><Trash2 size={16} />{tr({ zh: '删除', en: 'Delete' })}</button></div>
          </> : null}
          <BoolToggle value={snap} onChange={setSnap} label={tr({ zh: '网格吸附', en: 'Snap to grid' })} />
        </aside>
        <div className="space-view-tools space-row">
          <label className="space-zoom">{tr({ zh: '缩放', en: 'Zoom' })}<span aria-hidden="true">−</span><input className="space-zoom-input" type="range" min={0} max={100} step={0.1} value={zoom} disabled={!ready || unavailable} aria-label={tr({ zh: '画面缩放', en: 'Scene zoom' })} title={tr({ zh: '也可将鼠标移到画面上，滚动滚轮缩放', en: 'You can also scroll over the scene to zoom' })} onChange={e => scene.current?.setZoom(Number(e.currentTarget.value))} /><span aria-hidden="true">+</span></label>
          <CompactSelect label={<span className="space-weather-label"><NavigationIcon size={17} />{navigationMode.label}</span>} ariaLabel={tr({ zh: '镜头控制模式', en: 'Camera controls' })} value={navigation} items={navigationModes.map(item => ({ ...item, disabled: !ready || unavailable }))} onChange={value => {
            if (value !== 'orbit') { pending.current = null; setPlacing(false); setSelected(null); }
            scene.current?.setDroneSpeed(droneSpeed);
            scene.current?.setNavigation(value);
          }} />
          <CompactSelect label={tr({ zh: '视角', en: 'View' })} ariaLabel={tr({ zh: '切换视角', en: 'Change view' })} items={views} onChange={view => scene.current?.view(view)} />
          <button className="space-control" aria-label={tr({ zh: '回到全景', en: 'Reset view' })} onClick={() => scene.current?.view(environment === 'shanghai' ? 'huangpu' : 'home')}><Maximize size={17} /></button>
        </div>
        {navigating && !unavailable && <div className="space-navigation" aria-label={tr({ zh: '镜头操作', en: 'Camera navigation' })}>
          {navigation === 'drone' && <div className="space-flight-settings space-row">
            <label className="space-altitude">{tr({ zh: '高度', en: 'Height' })}<NumberCommitInput className="space-flight-input" value={altitude} min={scene.current?.droneMinHeight ?? 1} max={DRONE_MAX_HEIGHT} step={1} aria-label={tr({ zh: '无人机高度（米）', en: 'Drone height in metres' })} title={tr({ zh: '相对场景基准面，输入后按回车确认', en: 'Relative to the scene datum. Press Enter to apply.' })} onFocus={() => scene.current?.cancel()} onCommit={height => scene.current?.setDroneHeight(height)} /><span>m</span></label>
            <div className="space-flight-speed">
              <NumberCommitInput className="space-flight-input" value={droneSpeed} min={DRONE_MIN_SPEED} max={DRONE_MAX_SPEED} allowDecimal step="any" inputMode="decimal" aria-label={tr({ zh: '飞行速度（米/秒）', en: 'Flight speed in metres per second' })} title={tr({ zh: `自定义速度 ${DRONE_MIN_SPEED}–${DRONE_MAX_SPEED} m/s，按回车确认`, en: `Custom speed ${DRONE_MIN_SPEED}–${DRONE_MAX_SPEED} m/s. Press Enter to apply.` })} onFocus={() => scene.current?.cancel()} onCommit={changeDroneSpeed} />
              <CompactSelect variant="plain" label="m/s" value={droneSpeed} valueText={`${droneSpeed} m/s`} ariaLabel={tr({ zh: '快捷飞行速度', en: 'Preset flight speed' })} items={DRONE_SPEEDS.map(value => ({ value, label: `${value} m/s` }))} onChange={changeDroneSpeed} />
            </div>
          </div>}
          <div className="space-direction-pad" data-navigation={navigation}>
            {[
              ...DIRECTION_BUTTONS.map(direction => ({
                id: navigation === 'drone' ? direction.look : direction.move,
                icon: direction.icon,
                label: navigation === 'drone' ? direction.lookLabel : direction.label,
                shortcut: navigation === 'drone' ? direction.arrow : `${direction.key} / ${direction.arrow}`,
              })),
              ...(navigation === 'drone' ? [
                { id: 'up', icon: ArrowUpFromLine, label: { zh: '上升', en: 'Ascend' }, shortcut: 'R / E' },
                { id: 'down', icon: ArrowDownToLine, label: { zh: '下降', en: 'Descend' }, shortcut: 'F / Q' },
                ...DIRECTION_BUTTONS.map(direction => ({ id: direction.move, icon: null, label: direction.label, shortcut: direction.key })),
              ] : []),
            ].map(({ id, icon: Icon, label, shortcut }) => <button className="space-control space-direction" data-direction={id} key={id} aria-label={tr(label)} title={`${tr(label)} (${shortcut})`}
              onPointerDown={e => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); scene.current?.navigationInput(id, true, `pointer:${e.pointerId}`); }}
              onPointerUp={e => scene.current?.navigationInput(id, false, `pointer:${e.pointerId}`)}
              onPointerCancel={e => scene.current?.navigationInput(id, false, `pointer:${e.pointerId}`)}
              onLostPointerCapture={e => scene.current?.navigationInput(id, false, `pointer:${e.pointerId}`)}
              onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); scene.current?.navigationInput(id, true, `button:${id}`); } }}
              onKeyUp={() => scene.current?.navigationInput(id, false, `button:${id}`)}
              onBlur={() => scene.current?.navigationInput(id, false, `button:${id}`)}
            >{Icon ? <Icon size={18} /> : shortcut}{(id === 'up' || id === 'down') && <span>{tr(label)}</span>}</button>)}
          </div>
        </div>}
        {placing && <div className="space-placement" role="status"><span>{tr({ zh: '点击地面、展台或桌面；桌上自动使用手持大小', en: 'Click a floor, plinth or tabletop. Tables use a handheld cube size.' })}</span><ClearButton variant="standalone" onClick={cancel} ariaLabel={tr({ zh: '取消摆放', en: 'Cancel placement' })} /></div>}
        {unavailable && <div className="space-unavailable" role="alert"><p>{tr({ zh: '3D 画面暂时不可用，请开启浏览器硬件加速后刷新。已有布局仍可导出。', en: 'The 3D view is unavailable. Enable browser hardware acceleration and reload. You can still export your layout.' })}</p><button className="space-control" onClick={exportLayout}><ArrowDownToLine size={16} />{tr({ zh: '导出布局', en: 'Export layout' })}</button></div>}
      </div>
      <footer className="space-footer">
        {environment === 'shanghai' && <span role="status">{cityState === 'loading' ? tr({ zh: '正在载入黄浦江两岸…', en: 'Loading both banks of the Huangpu…' }) : cityState === 'error' ? tr({ zh: '上海场景加载失败，请切换环境后重试。', en: 'Shanghai failed to load. Switch environments to retry.' }) : tr({ zh: '部分建筑和桥梁已单独重建，仍有估算尺寸；其余多为简化底模。', en: 'Selected buildings and bridges have individual reconstructions with estimated dimensions; much of the city remains simplified.' })} <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a></span>}
        <span id="space-instructions">{navigation === 'drone' ? tr({ zh: '键盘与屏幕箭头均原地转镜头：↑ ↓ 俯仰，← → 转向；WASD 平移，R / E 上升、F / Q 下降。屏幕按钮可长按，拖动画面环顾、滚轮缩放。点击速度数字自定义，Esc 退出无人机。', en: 'Keyboard and onscreen arrows look in place: ↑ ↓ tilt, ← → turn. WASD moves; R / E ascends, F / Q descends. Hold onscreen buttons, drag to look, scroll to zoom. Click the speed to customize; Esc exits Drone.' }) : navigation === 'walk' ? tr({ zh: 'WASD、方向键或按住箭头行走；拖动画面环顾、滚轮缩放，Esc 退出漫游。', en: 'Walk with WASD, arrow keys or hold the arrows. Drag to look, scroll to zoom; Esc exits walking.' }) : mode === 'twist' ? tr({ zh: '拖动魔方表面转层，也可点击转动按钮；拖动空白处环绕，双指或滚轮缩放。', en: 'Drag a puzzle face or use the move buttons to turn a layer. Drag empty space to orbit; pinch or scroll to zoom.' }) : tr({ zh: '选中后拖动魔方；拖动空白处环绕，双指或滚轮缩放。方向键也可移动。', en: 'Select, then drag a cube. Drag empty space to orbit; pinch or scroll to zoom. Arrow keys move the selected cube.' })}</span>
        {weather === 'rainbow' && <span>{tr({ zh: '彩虹出现在太阳的相反方向，清晨或傍晚更容易看到；夜间不显示。', en: 'Look away from the sun for the rainbow, best seen in the morning or late afternoon. It is hidden at night.' })}</span>}
        <span role="status">{storage === 'saved' ? tr({ zh: '布局已保存在此浏览器', en: 'Layout saved in this browser' }) : storage === 'blocked' ? tr({ zh: '原有存档未覆盖；请导出当前布局保存', en: 'Existing save preserved; export to save this layout' }) : tr({ zh: '自动保存失败，请导出布局', en: 'Autosave failed; export your layout' })}</span>
      </footer>
      <details className="space-sources" open>
        <summary>{tr({ zh: '本页来源与建模说明', en: 'Sources and modeling notes' })}</summary>
        <ul>
          {SPACE_CREDITS.map(credit => <li key={credit.url}>
            <a href={credit.url} target="_blank" rel="noopener noreferrer">{credit.name}</a>
            <span>{tr(credit)}</span>
          </li>)}
        </ul>
        <AppLink href="/about" prefetch={false}>{tr({ zh: '查看全站致谢', en: 'All site credits' })}</AppLink>
      </details>
      {message && <p className="space-message" role="alert">{message === 'weather' ? tr({ zh: '天气加载失败，请刷新重试。已保存的空间布局仍然保留。', en: 'Weather failed to load. Refresh to retry. Your saved layout is preserved.' }) : message === 'time' ? tr({ zh: '无法导入：时间必须为 00:00 至 23:59，格式为 HH:mm。当前布局未更改。', en: 'Import failed. Time must be HH:mm from 00:00 to 23:59. Your layout has not changed.' }) : message === 'import' ? tr({ zh: '无法导入：请使用有效的魔方空间 JSON，最多 64 个物件。当前布局未更改。', en: 'Import failed. Use a valid Cube space JSON with up to 64 objects. Your layout has not changed.' }) : tr({ zh: '空间最多容纳 64 个魔方。', en: 'The space holds up to 64 cubes.' })}<ClearButton variant="standalone" onClick={() => setMessage(null)} ariaLabel={tr({ zh: '关闭提示', en: 'Dismiss message' })} /></p>}
    </main>
  );
}
