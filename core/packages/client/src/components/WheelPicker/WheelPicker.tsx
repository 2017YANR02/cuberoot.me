// NOTE: 通用 iOS 风格滚筒 — 从 /calc 的 Drum 抽离
// JSX 声明 DOM 结构 + Ref 命令式高频更新 + 单次 Effect
// 不耦合任何业务 store；值通过 props.value / props.onChange 传入/传出
import { useEffect, useRef } from 'react';
import './wheel_picker.css';

const MAX_DEG = 55;

export interface WheelPickerProps {
  /** 当前锚点值（中心 slot 显示的值） */
  value: number;
  /** 每 slot 对应的增量，默认 1 */
  step?: number;
  /** 夹边界（含），不填则不限制 */
  minValue?: number;
  maxValue?: number;
  /** 自定义 clamp（优先于 minValue/maxValue）；用于业务侧复杂规则（如按 event 动态上下限） */
  clamp?: (v: number) => number;
  /** 每个 slot 显示的文本；返回 '' 不显示（可视为越界占位） */
  renderSlot: (v: number) => string;
  /** 值变化时触发（拖拽中每跨一步就会触发一次） */
  onChange: (v: number) => void;
  /** 禁用态：半透明 + 不响应事件 */
  disabled?: boolean;
  /** 宽度（px 或 CSS 字符串），默认 72 */
  width?: number | string;
  /** 单格高度（px），默认 30；会被实测值覆盖 */
  itemHeight?: number;
  /** DOM slot 数（建议奇数，含上下缓冲各 1），默认 9 */
  slots?: number;
  /** 音效 + vibrate，默认 true */
  tick?: boolean;
  /** 附加 wrapper 类（用于主题覆盖） */
  className?: string;
  ariaLabel?: string;
}

export function WheelPicker({
  value,
  step = 1,
  minValue = Number.NEGATIVE_INFINITY,
  maxValue = Number.POSITIVE_INFINITY,
  clamp: clampProp,
  renderSlot,
  onChange,
  disabled = false,
  width = 72,
  itemHeight = 30,
  slots = 9,
  tick = true,
  className,
  ariaLabel,
}: WheelPickerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listWhiteRef = useRef<HTMLDivElement>(null);
  const slotRefs = useRef<(HTMLDivElement | null)[]>([]);
  const slotWhiteRefs = useRef<(HTMLDivElement | null)[]>([]);

  // NOTE: Ref 桥接 props — 避免 useEffect 依赖导致重入
  const propsRef = useRef({ step, minValue, maxValue, clampProp, renderSlot, onChange, tick });
  propsRef.current = { step, minValue, maxValue, clampProp, renderSlot, onChange, tick };

  // NOTE: 暴露主 effect 闭包里的同步函数，外部 value 变化时调
  const syncRef = useRef<((v: number) => void) | null>(null);

  // ── 单次 effect — mount 注册事件，unmount 清理 ──
  useEffect(() => {
    const root = rootRef.current;
    const list = listRef.current;
    const listWhite = listWhiteRef.current;
    if (!root || !list || !listWhite) return;

    const SLOTS = slots;
    const centerIdx = Math.floor(SLOTS / 2);
    let currentValue = value;
    let itemH = itemHeight;
    let isDragging = false;
    let animTimer: ReturnType<typeof setTimeout> | null = null;

    // ── Web Audio tick ──
    let audioCtx: AudioContext | null = null;
    function playTick() {
      if (!propsRef.current.tick) return;
      if (navigator.vibrate) navigator.vibrate(3);
      try {
        if (!audioCtx) {
          audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const ctx = audioCtx;
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

    // ── 工具 ──
    function setListStyle(prop: string, val: string) {
      (list!.style as unknown as Record<string, string>)[prop] = val;
      (listWhite!.style as unknown as Record<string, string>)[prop] = val;
    }

    function clamp(v: number): number {
      const { minValue, maxValue, clampProp } = propsRef.current;
      if (clampProp) return clampProp(v);
      if (v < minValue) return minValue;
      if (v > maxValue) return maxValue;
      return v;
    }

    function updateTransforms(scrollOffset: number) {
      if (!scrollOffset) scrollOffset = 0;
      const degPerPx = itemH > 0 ? (15 / itemH) : 0.5;
      for (let i = 0; i < SLOTS; i++) {
        const offsetPx = (i - centerIdx) * itemH + scrollOffset;
        let deg = offsetPx * degPerPx;
        deg = Math.max(-MAX_DEG, Math.min(MAX_DEG, deg));
        const absDeg = Math.abs(deg);
        const s = 1 - (absDeg / MAX_DEG) * 0.15;
        const tf = `scale(${s.toFixed(3)}) rotateX(${deg.toFixed(1)}deg)`;
        const slot = slotRefs.current[i];
        const slotW = slotWhiteRefs.current[i];
        if (slot) slot.style.transform = tf;
        if (slotW) slotW.style.transform = tf;
      }
    }

    function fillSlots(centerVal: number) {
      const { step, renderSlot } = propsRef.current;
      for (let i = 0; i < SLOTS; i++) {
        const v = centerVal + (i - centerIdx) * step;
        // NOTE: 空字符串会导致 item 行盒塌陷（高度比有字 item 小），破坏 flex center 对齐
        // 用 NBSP 占位保留完整 line-box，item 高度与有字 item 一致
        const text = renderSlot(v) || ' ';
        const slot = slotRefs.current[i];
        const slotW = slotWhiteRefs.current[i];
        if (slot) slot.textContent = text;
        if (slotW) slotW.textContent = text;
      }
      if (!isDragging) {
        setListStyle('transition', 'none');
        setListStyle('transform', 'translateY(0px)');
      }
      updateTransforms(0);
    }

    function animateStep(dir: number) {
      if (animTimer) { clearTimeout(animTimer); animTimer = null; }
      fillSlots(currentValue);
      const startOffset = dir * itemH;
      setListStyle('transition', 'none');
      setListStyle('transform', `translateY(${startOffset}px)`);
      updateTransforms(startOffset);
      void list!.offsetHeight;
      setListStyle('transition', 'transform 0.12s cubic-bezier(0.22, 1, 0.36, 1)');
      setListStyle('transform', 'translateY(0px)');
    }

    // NOTE: 单步调整（wheel / 惯性用），返回是否真的动了
    function adjustByStep(dir: number, animate: boolean): boolean {
      const { step } = propsRef.current;
      const newVal = clamp(currentValue + dir * step);
      if (newVal === currentValue) return false;
      currentValue = newVal;
      playTick();
      propsRef.current.onChange(newVal);
      if (animate) animateStep(dir);
      else fillSlots(newVal);
      return true;
    }

    // ── 外部 value 同步 ──
    syncRef.current = (newVal: number) => {
      if (isDragging) return; // 拖拽中不被外部打断
      currentValue = newVal;
      fillSlots(newVal);
    };

    // ── 初始化 ──
    fillSlots(currentValue);
    // NOTE: CSS 渲染后实测 slot 高度
    const firstSlot = slotRefs.current[0];
    if (firstSlot && firstSlot.offsetHeight > 0) itemH = firstSlot.offsetHeight;

    // ── 拖拽 ──
    let dragStartY = 0;
    let dragStartVal = 0;
    let lastMoveTime = 0;
    let lastMoveY = 0;
    let velocity = 0;
    let inertiaRaf: number | null = null;
    let lastStepIdx = 0;

    function onStart(e: MouseEvent | TouchEvent) {
      e.preventDefault();
      if (inertiaRaf) { cancelAnimationFrame(inertiaRaf); inertiaRaf = null; }
      if (animTimer) { clearTimeout(animTimer); animTimer = null; }
      isDragging = true;
      velocity = 0;
      const pt = 'touches' in e ? e.touches[0] : e;
      dragStartY = pt.clientY;
      dragStartVal = currentValue;
      lastStepIdx = 0;
      lastMoveY = pt.clientY;
      lastMoveTime = Date.now();
      setListStyle('transition', 'none');
      const slot0 = slotRefs.current[0];
      if (slot0 && slot0.offsetHeight > 0) itemH = slot0.offsetHeight;
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

      const totalDy = pt.clientY - dragStartY;
      const scrollPos = -totalDy;
      const stepIdx = Math.round(scrollPos / itemH);

      const { step } = propsRef.current;
      const newVal = clamp(dragStartVal + stepIdx * step);
      if (newVal !== currentValue) {
        currentValue = newVal;
        propsRef.current.onChange(newVal);
        if (stepIdx !== lastStepIdx) playTick();
        lastStepIdx = stepIdx;
        fillSlots(newVal);
      }

      // NOTE: sub-pixel 偏移
      const snappedPos = stepIdx * itemH;
      const fractional = scrollPos - snappedPos;
      setListStyle('transform', `translateY(${-fractional}px)`);
      updateTransforms(-fractional);
    }

    function onEnd() {
      if (!isDragging) return;
      isDragging = false;
      setListStyle('transition', 'transform 0.2s cubic-bezier(0.22, 1, 0.36, 1)');
      setListStyle('transform', 'translateY(0px)');
      updateTransforms(0);
      if (Math.abs(velocity) > 0.3) startInertia(velocity);
    }

    function startInertia(v: number) {
      const FRICTION = 0.93;
      let accum = 0;
      function loop() {
        v *= FRICTION;
        if (Math.abs(v) < 0.03) return;
        accum += v * 16;
        const steps = Math.round(-accum / itemH);
        if (steps !== 0) {
          for (let s = 0; s < Math.abs(steps); s++) {
            if (!adjustByStep(steps > 0 ? 1 : -1, true)) { v = 0; break; }
          }
          accum = 0;
        }
        inertiaRaf = requestAnimationFrame(loop);
      }
      inertiaRaf = requestAnimationFrame(loop);
    }

    function onWheel(e: WheelEvent) {
      e.preventDefault();
      adjustByStep(e.deltaY < 0 ? 1 : -1, true);
    }

    root.addEventListener('mousedown', onStart);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);
    root.addEventListener('touchstart', onStart, { passive: false });
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
    document.addEventListener('touchcancel', onEnd);
    root.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      syncRef.current = null;
      root.removeEventListener('mousedown', onStart);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onEnd);
      root.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      document.removeEventListener('touchcancel', onEnd);
      root.removeEventListener('wheel', onWheel);
      if (inertiaRaf) cancelAnimationFrame(inertiaRaf);
      if (animTimer) clearTimeout(animTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // NOTE: 空依赖 — 只挂载一次

  // NOTE: 外部 value / disabled / renderSlot 变化 → 重新居中 + 刷 slot 文本
  // renderSlot 加入依赖是为了处理 "value 不变但文本映射变了" 的场景（如枚举数组换内容但索引不变）
  // 消费方需用 useCallback 稳定 renderSlot 引用，否则每次 render 都会触发 refill
  useEffect(() => {
    syncRef.current?.(value);
  }, [value, disabled, renderSlot]);

  const rootClass = ['wheel-picker', disabled ? 'is-disabled' : '', className ?? ''].filter(Boolean).join(' ');
  const rootStyle = {
    width: typeof width === 'number' ? `${width}px` : width,
    ['--wp-item-h' as string]: `${itemHeight}px`,
  } as React.CSSProperties;

  return (
    <div
      ref={rootRef}
      className={rootClass}
      style={rootStyle}
      role="slider"
      aria-label={ariaLabel}
      aria-valuenow={value}
      aria-valuemin={Number.isFinite(minValue) ? minValue : undefined}
      aria-valuemax={Number.isFinite(maxValue) ? maxValue : undefined}
    >
      <div className="wheel-picker-list" ref={listRef}>
        {Array.from({ length: slots }, (_, i) => (
          <div key={i} className="wheel-picker-item"
               ref={(el) => { slotRefs.current[i] = el; }} />
        ))}
      </div>
      <div className="wheel-picker-white-window">
        <div className="wheel-picker-list wheel-picker-list-white" ref={listWhiteRef}>
          {Array.from({ length: slots }, (_, i) => (
            <div key={i} className="wheel-picker-item"
                 ref={(el) => { slotWhiteRefs.current[i] = el; }} />
          ))}
        </div>
      </div>
      <div className="wheel-picker-highlight" />
    </div>
  );
}

export default WheelPicker;
