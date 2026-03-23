// NOTE: iOS 风格滚筒精调组件 — 从 input_grid.js#965-1360 1:1 迁移
// 命令式触控操作（drag/inertia/wheel），通过 ref + useEffect 驱动
// 职责：微调当前聚焦的成绩值（centiseconds ±1 或 FMC/MBF ±100）

import { useEffect, useRef } from 'react';
import { useCalcStore, isMbfForEvent } from '../stores/calc_store';
import { DNF_VALUE, formatTime, clampValue } from '../engine/calc_engine';

// NOTE: 滚筒常量 — 原版 input_grid.js#973
const DRUM_SLOTS = 9;        // DOM slot 数（7 可见 + 上下各 1 缓冲）
const MAX_DEG = 55;          // 3D 圆柱最大旋转角

interface DrumProps {
  /** 当前聚焦的 [playerIdx, solveIdx]，[-1,-1] 表示无聚焦 */
  activeCell: [number, number];
  /** 设置聚焦格子的值 */
  onCellValueChange?: (p: number, t: number, val: number) => void;
}

export function Drum({ activeCell, onCellValueChange }: DrumProps) {
  const drumRef = useRef<HTMLDivElement>(null);
  // NOTE: 命令式清理函数引用
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const drumEl = drumRef.current;
    if (!drumEl) return;

    // ── 模块状态 — 原版 input_grid.js#968-978 ──
    let drumList: HTMLDivElement | null = null;
    let drumListWhite: HTMLDivElement | null = null;
    let drumValue = 0;
    let drumItemH = 30;
    let drumStep = 1;
    const drumSlots: HTMLDivElement[] = [];
    const drumSlotsWhite: HTMLDivElement[] = [];
    let drumAnimTimer: ReturnType<typeof setTimeout> | null = null;
    let drumIsDragging = false;

    // ── Web Audio tick — 原版 input_grid.js#980-1010 ──
    let drumAudioCtx: AudioContext | null = null;

    function drumTick() {
      if (navigator.vibrate) navigator.vibrate(3);
      try {
        if (!drumAudioCtx) {
          drumAudioCtx = new (window.AudioContext || (window as /* eslint-disable */ any).webkitAudioContext)();
        }
        if (drumAudioCtx.state === 'suspended') drumAudioCtx.resume();
        const ctx = drumAudioCtx;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 1200;
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.008);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.01);
      } catch {
        // HACK: 部分浏览器限制 AudioContext，静默忽略
      }
    }

    // ── 辅助函数 ──

    function setDrumStyle(prop: string, val: string) {
      if (drumList) (drumList.style as any)[prop] = val;
      if (drumListWhite) (drumListWhite.style as any)[prop] = val;
    }

    function createDrumSlots() {
      if (!drumList || !drumListWhite) return;
      drumList.innerHTML = '';
      drumListWhite.innerHTML = '';
      drumSlots.length = 0;
      drumSlotsWhite.length = 0;
      for (let i = 0; i < DRUM_SLOTS; i++) {
        const item = document.createElement('div');
        item.className = 'np-drum-item';
        drumList.appendChild(item);
        drumSlots.push(item);
        const itemW = document.createElement('div');
        itemW.className = 'np-drum-item';
        drumListWhite.appendChild(itemW);
        drumSlotsWhite.push(itemW);
      }
    }

    function updateDrumTransforms(scrollOffset: number) {
      if (!scrollOffset) scrollOffset = 0;
      const centerIdx = Math.floor(DRUM_SLOTS / 2);
      const degPerPx = drumItemH > 0 ? (15 / drumItemH) : 0.5;
      for (let i = 0; i < DRUM_SLOTS; i++) {
        const offsetPx = (i - centerIdx) * drumItemH + scrollOffset;
        let deg = offsetPx * degPerPx;
        deg = Math.max(-MAX_DEG, Math.min(MAX_DEG, deg));
        const absDeg = Math.abs(deg);
        const s = 1 - (absDeg / MAX_DEG) * 0.15;
        const tf = `scale(${s.toFixed(3)}) rotateX(${deg.toFixed(1)}deg)`;
        drumSlots[i].style.transform = tf;
        if (drumSlotsWhite[i]) drumSlotsWhite[i].style.transform = tf;
      }
    }

    function fillDrumSlots(centerVal: number) {
      const centerIdx = Math.floor(DRUM_SLOTS / 2);
      const state = useCalcStore.getState();
      const isMove = state.event === '333fm';
      for (let i = 0; i < DRUM_SLOTS; i++) {
        const v = centerVal + (i - centerIdx) * drumStep;
        const text = (v > 0 && v < DNF_VALUE && centerVal > 0) ? formatTime(v, false, isMove) : '';
        drumSlots[i].textContent = text;
        drumSlotsWhite[i].textContent = text;
      }
      if (!drumIsDragging) {
        setDrumStyle('transition', 'none');
        setDrumStyle('transform', 'translateY(0px)');
      }
      updateDrumTransforms(0);
    }

    function drumAnimateStep(dir: number) {
      if (drumAnimTimer) { clearTimeout(drumAnimTimer); drumAnimTimer = null; }
      fillDrumSlots(drumValue);
      const startOffset = dir * drumItemH;
      setDrumStyle('transition', 'none');
      setDrumStyle('transform', `translateY(${startOffset}px)`);
      updateDrumTransforms(startOffset);
      void drumList!.offsetHeight;
      setDrumStyle('transition', 'transform 0.12s cubic-bezier(0.22, 1, 0.36, 1)');
      setDrumStyle('transform', 'translateY(0px)');
    }

    // NOTE: 同步滚筒显示 — 原版 input_grid.js#1013-1037
    function syncDrum() {
      if (!drumEl) return;
      const state = useCalcStore.getState();
      let val = 0;
      const [p, t] = activeCell;
      if (p >= 0 && t >= 0) {
        val = state.times[state.seedOn + p]?.[t] ?? 0;
      }
      if (val <= 0 || val >= DNF_VALUE) {
        drumEl.classList.add('empty');
        fillDrumSlots(0);
        return;
      }
      drumEl.classList.remove('empty');
      drumValue = val;
      drumStep = (state.event === '333fm' || isMbfForEvent(state.event)) ? 100 : 1;
      fillDrumSlots(val);
    }

    // NOTE: 调整值 — 原版 input_grid.js#1126-1162
    function drumAdjust(dir: number, animate: boolean) {
      const [p, t] = activeCell;
      if (p >= 0 && t >= 0) {
        const state = useCalcStore.getState();
        const rawVal = state.times[state.seedOn + p]?.[t] ?? 0;
        if (rawVal <= 0 || rawVal >= DNF_VALUE) return;
        const newVal = clampValue(rawVal + dir * drumStep);
        if (newVal === rawVal) return;
        drumValue = newVal;
        drumTick();
        // NOTE: 更新 store
        state.updateTime(state.seedOn + p, t, newVal);
        if (onCellValueChange) onCellValueChange(p, t, newVal);
        if (animate) {
          drumAnimateStep(dir);
        } else {
          fillDrumSlots(newVal);
        }
      }
    }

    // ── 初始化 DOM — 原版 input_grid.js#1164-1186 ──

    drumList = drumEl.querySelector('#np-drum-list') as HTMLDivElement;
    if (!drumList) {
      drumList = document.createElement('div');
      drumList.id = 'np-drum-list';
      drumEl.appendChild(drumList);
    }

    const drumWhiteWindow = document.createElement('div');
    drumWhiteWindow.className = 'np-drum-white-window';
    drumEl.appendChild(drumWhiteWindow);

    drumListWhite = document.createElement('div');
    drumListWhite.id = 'np-drum-list-white';
    drumListWhite.className = 'np-drum-list-white';
    drumWhiteWindow.appendChild(drumListWhite);

    // NOTE: 高亮条
    const highlight = document.createElement('div');
    highlight.className = 'np-drum-highlight';
    drumEl.appendChild(highlight);

    createDrumSlots();
    drumEl!.classList.add('empty');
    fillDrumSlots(0);
    if (drumSlots[0] && drumSlots[0].offsetHeight > 0) drumItemH = drumSlots[0].offsetHeight;

    // ── 触控拖拽 — 原版 input_grid.js#1229-1351 ──

    let dragStartY = 0;
    let dragStartVal = 0;
    let isDragging = false;
    let lastMoveTime = 0;
    let lastMoveY = 0;
    let velocity = 0;
    let inertiaRaf: number | null = null;
    let lastBarStepIdx = 0;

    function onStart(e: MouseEvent | TouchEvent) {
      e.preventDefault();
      if (inertiaRaf) { cancelAnimationFrame(inertiaRaf); inertiaRaf = null; }
      if (drumAnimTimer) { clearTimeout(drumAnimTimer); drumAnimTimer = null; }
      isDragging = true;
      drumIsDragging = true;
      velocity = 0;
      const pt = 'touches' in e ? e.touches[0] : e;
      dragStartY = pt.clientY;
      dragStartVal = drumValue;
      lastBarStepIdx = 0;
      lastMoveY = pt.clientY;
      lastMoveTime = Date.now();
      setDrumStyle('transition', 'none');
      if (drumSlots[0] && drumSlots[0].offsetHeight > 0) {
        drumItemH = drumSlots[0].offsetHeight;
      }
    }

    function onMove(e: MouseEvent | TouchEvent) {
      if (!isDragging) return;
      e.preventDefault();
      const pt = 'touches' in e ? e.touches[0] : e;

      const now = Date.now();
      const dt = now - lastMoveTime;
      if (dt > 0) velocity = (pt.clientY - lastMoveY) / dt;
      lastMoveY = pt.clientY;
      lastMoveTime = now;

      const [p, t] = activeCell;
      const totalDy = pt.clientY - dragStartY;
      const scrollPos = -totalDy;
      const stepIdx = Math.round(scrollPos / drumItemH);

      if (p >= 0 && t >= 0) {
        // NOTE: 输入格模式 — 直接设值
        const newVal = clampValue(dragStartVal + stepIdx * drumStep);
        if (newVal !== drumValue) {
          drumValue = newVal;
          const state = useCalcStore.getState();
          state.updateTime(state.seedOn + p, t, newVal);
          if (onCellValueChange) onCellValueChange(p, t, newVal);
          drumTick();
        }
        fillDrumSlots(newVal);
      } else {
        // NOTE: 柱子模式 — 增量调用
        if (stepIdx !== lastBarStepIdx) {
          const delta = stepIdx - lastBarStepIdx;
          for (let s = 0; s < Math.abs(delta); s++) {
            drumAdjust(delta > 0 ? 1 : -1, false);
          }
          lastBarStepIdx = stepIdx;
          drumTick();
        }
      }

      // NOTE: sub-pixel 偏移 → 像素级丝滑
      const snappedPos = stepIdx * drumItemH;
      const fractional = scrollPos - snappedPos;
      setDrumStyle('transform', `translateY(${-fractional}px)`);
      updateDrumTransforms(-fractional);
    }

    function onEnd() {
      if (!isDragging) return;
      isDragging = false;
      drumIsDragging = false;
      setDrumStyle('transition', 'transform 0.2s cubic-bezier(0.22, 1, 0.36, 1)');
      setDrumStyle('transform', 'translateY(0px)');
      updateDrumTransforms(0);
      if (Math.abs(velocity) > 0.3) {
        startInertia(velocity);
      }
    }

    function startInertia(v: number) {
      const FRICTION = 0.93;
      let accum = 0;
      function tick() {
        v *= FRICTION;
        if (Math.abs(v) < 0.03) return;
        accum += v * 16;
        const steps = Math.round(-accum / drumItemH);
        if (steps !== 0) {
          for (let s = 0; s < Math.abs(steps); s++) {
            drumAdjust(steps > 0 ? 1 : -1, true);
          }
          accum = 0;
        }
        inertiaRaf = requestAnimationFrame(tick);
      }
      inertiaRaf = requestAnimationFrame(tick);
    }

    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const dir = e.deltaY < 0 ? 1 : -1;
      drumAdjust(dir, true);
    }

    // ── 注册事件 ──
    drumEl.addEventListener('mousedown', onStart);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);
    drumEl.addEventListener('touchstart', onStart, { passive: false });
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
    document.addEventListener('touchcancel', onEnd);
    drumEl.addEventListener('wheel', onWheel, { passive: false });

    // NOTE: 初始同步
    syncDrum();

    // NOTE: 订阅 store 变更 → 自动同步滚筒
    const unsub = useCalcStore.subscribe(() => syncDrum());

    // ── 清理 ──
    cleanupRef.current = () => {
      unsub();
      drumEl.removeEventListener('mousedown', onStart);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onEnd);
      drumEl.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      document.removeEventListener('touchcancel', onEnd);
      drumEl.removeEventListener('wheel', onWheel);
      if (inertiaRaf) cancelAnimationFrame(inertiaRaf);
      if (drumAnimTimer) clearTimeout(drumAnimTimer);
    };

    return () => {
      if (cleanupRef.current) cleanupRef.current();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCell[0], activeCell[1]]);

  return (
    <div id="np-drum" ref={drumRef}>
      <div id="np-drum-list" />
    </div>
  );
}

export default Drum;
