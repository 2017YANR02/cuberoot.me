'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowDownToLine, ArrowLeft, ArrowRight, ArrowUp, ArrowUpFromLine, CloudSun, Copy, Crosshair, Footprints, Maximize, Move, Plus, Redo2, RotateCcw, RotateCw, Trash2, Undo2 } from 'lucide-react';
import AppLink from '@/components/AppLink';
import HeaderToggles from '@/components/HeaderToggles';
import BoolToggle from '@/components/BoolToggle';
import PuzzlePicker from '@/components/PuzzlePicker/PuzzlePicker';
import { CompactSelect } from '@/components/CompactSelect';
import { ClearButton } from '@/components/ClearButton';
import { persistItem } from '@/lib/safe-storage';
import { tr } from '@/i18n/tr';
import { SpaceScene, type Mode, type View } from './space-scene';
import { commitLayout, DESTINATIONS, INITIAL_LAYOUT, isPuzzleKind, MAX_OBJECTS, movePosition, parseLayout, PUZZLES, ROOMS, SPACE_KEY, travelHistory, WEATHER, type Weather, type Destination, type History, type PuzzleKind, type RoomStyle, type SpaceObject } from './space-state';
import './space.css';
import { turnButtons } from './space-turn';

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
  const [walking, setWalking] = useState(false);
  const [storage, setStorage] = useState<'saved' | 'blocked' | 'failed'>('saved');
  const [message, setMessage] = useState<'import' | 'limit' | 'weather' | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const objects = history.current.objects;
  const room = history.current.room ?? 'minimal';
  const weather = history.current.weather ?? 'sunny';
  const active = objects.find(o => o.id === selected);

  function change(object: SpaceObject) {
    setHistory(h => commitLayout(h, { ...h.current, objects: h.current.objects.map(o => o.id === object.id ? object : o) }));
  }
  function cancel() {
    scene.current?.setWalking(false);
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
    } catch { setMessage('import'); }
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
        walking: setWalking,
        weatherError: () => setMessage('weather'),
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
        if (active && !scene.current?.walking && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
          event.preventDefault();
          const step = event.shiftKey ? 1 : 0.5;
          change({ ...active, position: movePosition([active.position[0] + (event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0), active.position[1] + (event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0)], snap) });
        }
      }
    }
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });
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
        <div className="space-heading"><h1>{tr({ zh: '魔方空间', en: 'Cube space' })}</h1><CompactSelect label={tr(ROOMS[room])} ariaLabel={tr({ zh: '选择房间风格', en: 'Choose room style' })} value={room} valueText={tr(ROOMS[room])} items={(Object.keys(ROOMS) as RoomStyle[]).map(value => ({ value, label: tr(ROOMS[value]) }))} onChange={room => { cancel(); setHistory(h => commitLayout(h, { ...h.current, room })); }} />
          <CompactSelect label={<span className="space-weather-label"><CloudSun size={16} />{tr(WEATHER[weather])}</span>} ariaLabel={tr({ zh: '切换天气', en: 'Change weather' })} value={weather} valueText={tr(WEATHER[weather])} items={(Object.keys(WEATHER) as Weather[]).map(value => ({ value, label: tr(WEATHER[value]) }))} onChange={weather => { cancel(); setHistory(h => commitLayout(h, { ...h.current, weather })); }} />
          {weather !== 'sunny' && <BoolToggle value={history.current.weatherMotion ?? true} onChange={weatherMotion => setHistory(h => commitLayout(h, { ...h.current, weatherMotion }))} label={tr({ zh: '动态天气', en: 'Animate weather' })} />}
        </div>
        <div className="space-header-actions"><AppLink href="/sim">{tr({ zh: '模拟器', en: 'Simulator' })}</AppLink><HeaderToggles /></div>
      </header>
      <nav className="space-destinations" aria-label={tr({ zh: '前往房间', en: 'Go to a room' })}>
        {(room === 'company' ? ['interior', 'study', 'courtyard'] as const : Object.keys(DESTINATIONS) as Destination[]).map(destination => <button className="space-destination" key={destination} onClick={() => { cancel(); scene.current?.view(destination); }}>{tr(room === 'company' ? ({ interior: { zh: '办公室 406', en: 'Office 406' }, study: { zh: '公共休息区', en: 'Shared lounge' }, courtyard: { zh: '电话亭', en: 'Phone booths' } }[destination as 'interior' | 'study' | 'courtyard']) : DESTINATIONS[destination])}</button>)}
      </nav>
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
          <button className="space-control" aria-pressed={walking} disabled={!ready || unavailable} onClick={() => { if (!walking) { cancel(); setSelected(null); } scene.current?.setWalking(!walking); }}><Footprints size={17} />{tr({ zh: '漫游', en: 'Walk' })}</button>
          <CompactSelect label={tr({ zh: '视角', en: 'View' })} ariaLabel={tr({ zh: '切换视角', en: 'Change view' })} items={views} onChange={view => scene.current?.view(view)} />
          <button className="space-control" aria-label={tr({ zh: '回到全景', en: 'Reset view' })} onClick={() => scene.current?.view('home')}><Maximize size={17} /></button>
        </div>
        {walking && <div className="space-walk-pad" aria-label={tr({ zh: '漫游方向', en: 'Walking directions' })}>
          {([{ id: 'forward', icon: ArrowUp, label: { zh: '向前走', en: 'Walk forward' } }, { id: 'left', icon: ArrowLeft, label: { zh: '向左走', en: 'Walk left' } }, { id: 'back', icon: ArrowDown, label: { zh: '向后走', en: 'Walk backward' } }, { id: 'right', icon: ArrowRight, label: { zh: '向右走', en: 'Walk right' } }]).map(({ id, icon: Icon, label }) => <button className="space-control" key={id} aria-label={tr(label)} onPointerDown={e => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); scene.current?.walkInput(id, true); }} onPointerUp={() => scene.current?.walkInput(id, false)} onPointerCancel={() => scene.current?.walkInput(id, false)} onLostPointerCapture={() => scene.current?.walkInput(id, false)} onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); scene.current?.walkInput(id, true); } }} onKeyUp={() => scene.current?.walkInput(id, false)} onBlur={() => scene.current?.walkInput(id, false)}><Icon size={18} /></button>)}
        </div>}
        {placing && <div className="space-placement" role="status"><span>{tr({ zh: '点击地面、展台或桌面；桌上自动使用手持大小', en: 'Click a floor, plinth or tabletop. Tables use a handheld cube size.' })}</span><ClearButton variant="standalone" onClick={cancel} ariaLabel={tr({ zh: '取消摆放', en: 'Cancel placement' })} /></div>}
        {unavailable && <div className="space-unavailable" role="alert"><p>{tr({ zh: '3D 画面暂时不可用，请开启浏览器硬件加速后刷新。已有布局仍可导出。', en: 'The 3D view is unavailable. Enable browser hardware acceleration and reload. You can still export your layout.' })}</p><button className="space-control" onClick={exportLayout}><ArrowDownToLine size={16} />{tr({ zh: '导出布局', en: 'Export layout' })}</button></div>}
      </div>
      <footer className="space-footer">
        <span id="space-instructions">{walking ? tr({ zh: 'WASD、方向键或按住箭头行走；拖动画面环顾，Esc 退出漫游。', en: 'Walk with WASD, arrow keys or hold the arrows. Drag to look around; Esc exits walking.' }) : mode === 'twist' ? tr({ zh: '拖动魔方表面转层，也可点击转动按钮；拖动空白处环绕，双指或滚轮缩放。', en: 'Drag a puzzle face or use the move buttons to turn a layer. Drag empty space to orbit; pinch or scroll to zoom.' }) : tr({ zh: '选中后拖动魔方；拖动空白处环绕，双指或滚轮缩放。方向键也可移动。', en: 'Select, then drag a cube. Drag empty space to orbit; pinch or scroll to zoom. Arrow keys move the selected cube.' })}</span>
        <span role="status">{storage === 'saved' ? tr({ zh: '布局已保存在此浏览器', en: 'Layout saved in this browser' }) : storage === 'blocked' ? tr({ zh: '原有存档未覆盖；请导出当前布局保存', en: 'Existing save preserved; export to save this layout' }) : tr({ zh: '自动保存失败，请导出布局', en: 'Autosave failed; export your layout' })}</span>
      </footer>
      {message && <p className="space-message" role="alert">{message === 'weather' ? tr({ zh: '天气加载失败，请刷新重试。已保存的空间布局仍然保留。', en: 'Weather failed to load. Refresh to retry. Your saved layout is preserved.' }) : message === 'import' ? tr({ zh: '无法导入：请使用有效的魔方空间 JSON，最多 64 个物件。当前布局未更改。', en: 'Import failed. Use a valid Cube space JSON with up to 64 objects. Your layout has not changed.' }) : tr({ zh: '空间最多容纳 64 个魔方。', en: 'The space holds up to 64 cubes.' })}<ClearButton variant="standalone" onClick={() => setMessage(null)} ariaLabel={tr({ zh: '关闭提示', en: 'Dismiss message' })} /></p>}
    </main>
  );
}
