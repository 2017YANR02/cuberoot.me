'use client';

/**
 * 交互式 2D 魔表 —— `/scramble/solver?event=clock` 的「平面」视图 与 `/sim` 的魔表模拟器共用这一份。
 *
 * 为什么自己写:cubing.js / twizzle 的魔表只有 2D 且**只能播放** —— 拖不动指针、点不了针脚
 * (`VisualizationStrategyProp` 把 clock 硬编码成 "2D",没有任何 3D 模型)。要真「模拟器」这段
 * 交互无论如何得自己写,所以写一份、用两处。
 *
 * 几何常量全部从 `clock_svg.ts`(tnoodle `ClockPuzzle.java` 的移植)取,不重抄 → 本板与站内
 * 打乱图逐像素同格。角位 ↔ 表盘下标的镜像关系从 `lib/clock-solver` 的四张表取,同样不重抄。
 *
 * 两种模式:
 *   edit —— 直接拖指针改状态。**角盘正反联动**(front + back ≡ 0)由组件维持,所以用户画不出非法态。
 *   turn —— 真拧:点针脚切上下,再在任一半区里拖 = 一次 WCA 招式(招式 = 该面朝上的针脚组合 × 幅度)。
 *            两个半区同屏,所以不翻面也能拧背面;`y2` 按钮保留真实翻面(交换两块 + 针脚上下互换)。
 */

import { useCallback, useRef, useState } from 'react';
import PillToggle from '@/components/PillToggle/PillToggle';
import { useT } from '@/hooks/useT';
import {
  ARROW_RADIUS, CLOCK_ARROW_PATH, CLOCK_OUTER_RADIUS, CLOCK_RADIUS, DEFAULT_CLOCK_COLORS,
  FACE_STROKE_WIDTH, H, PIN_RADIUS, POINT_RADIUS, RADIUS, STROKE_WIDTH,
  TICK_R, TOP_TICK_R, W, clockDialCenter, clockPanelCenter,
} from '@/app/[lang]/scramble/gen/_svg/clock_svg';
import {
  CLOCK_BACK_CORNER_DIAL, CLOCK_BACK_QUAD, CLOCK_FRONT_CORNER_DIAL, CLOCK_FRONT_QUAD,
  applyClockMove, clockPinName, type ClockMove, type ClockState,
} from '@/lib/clock-solver';
import './interactive_clock.css';

export type ClockBoardMode = 'edit' | 'turn';

const mod12 = (x: number) => ((x % 12) + 12) % 12;
const QUADS = [CLOCK_FRONT_QUAD, CLOCK_BACK_QUAD] as const;
const CORNER_DIALS = [CLOCK_FRONT_CORNER_DIAL, CLOCK_BACK_CORNER_DIAL] as const;
const STEP = Math.PI / 6; // 一格 = 30°

/** 角 c 的针脚在半区 side 的位置 = 该象限 4 个表盘圆心的重心(所以镜像关系不用另写)。 */
function pinCenter(side: 0 | 1, corner: number): { x: number; y: number } {
  const dials = QUADS[side][corner];
  let x = 0;
  let y = 0;
  for (const d of dials) {
    const p = clockDialCenter(d);
    x += p.x;
    y += p.y;
  }
  return { x: x / dials.length, y: y / dials.length };
}

/** 以 12 点为 0、顺时针为正的角度。 */
function angleFrom(px: number, py: number, cx: number, cy: number): number {
  return Math.atan2(px - cx, -(py - cy));
}

/** 把角度差折进 (-π, π],这样连续累加能跨过 ±180° 不跳。 */
function wrapSigned(a: number): number {
  let v = a;
  while (v > Math.PI) v -= 2 * Math.PI;
  while (v <= -Math.PI) v += 2 * Math.PI;
  return v;
}

/** 设某个表盘的值,并自动把联动的角盘设成相反数(所以状态恒合法)。 */
export function setClockDial(state: ClockState, dial: number, value: number): ClockState {
  const posit = state.posit.slice();
  posit[dial] = mod12(value);
  for (let s = 0; s < 2; s++) {
    const idx = CORNER_DIALS[s].indexOf(dial);
    if (idx >= 0) posit[CORNER_DIALS[1 - s][idx]] = mod12(-posit[dial]);
  }
  return { posit, rightSideUp: state.rightSideUp };
}

type Drag =
  | { kind: 'dial'; dial: number }
  | { kind: 'turn'; side: 0 | 1; mask: number; base: ClockState; prev: number; acc: number; k: number };

export interface InteractiveClockProps {
  state: ClockState;
  onChange: (next: ClockState) => void;
  mode?: ClockBoardMode;
  onModeChange?: (m: ClockBoardMode) => void;
  /** turn 模式每落一步招式回调一次(`/sim` 记录用)。 */
  onMove?: (move: ClockMove) => void;
  /** 针脚(可受控):`pinsUp[c]` = 角 c 的针脚朝向**左半区**那一面。 */
  pinsUp?: readonly boolean[];
  onPinsUpChange?: (pins: boolean[]) => void;
  /** 半区配色,默认 tnoodle 官方色(与打乱图一致)。 */
  colors?: Record<string, string>;
  /** 画板最大宽度(px),默认 560。 */
  maxWidth?: number;
  /** 隐藏组件自带的模式切换 + y2 按钮(宿主自己摆时用)。 */
  hideControls?: boolean;
  className?: string;
}

export default function InteractiveClock({
  state, onChange, mode = 'edit', onModeChange, onMove,
  pinsUp: pinsUpProp, onPinsUpChange, colors, maxWidth = 560, hideControls, className,
}: InteractiveClockProps) {
  const t = useT();
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const [uncontrolledPins, setUncontrolledPins] = useState<boolean[]>([true, true, true, true]);
  const [flash, setFlash] = useState<string | null>(null);
  const flashTimer = useRef<number | null>(null);

  const pinsUp = pinsUpProp ?? uncontrolledPins;
  const setPins = useCallback((next: boolean[]) => {
    if (onPinsUpChange) onPinsUpChange(next);
    else setUncontrolledPins(next);
  }, [onPinsUpChange]);

  const say = useCallback((msg: string) => {
    setFlash(msg);
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlash(null), 1600);
  }, []);

  const get = useCallback(
    (k: string) => colors?.[k] ?? DEFAULT_CLOCK_COLORS[k as keyof typeof DEFAULT_CLOCK_COLORS] ?? '#000',
    [colors],
  );
  // tnoodle 口径:左半区画 posit[0..8],配色按 rightSideUp 决定它当"正面"还是"反面"。
  const sideKeys = state.rightSideUp ? (['Front', 'Back'] as const) : (['Back', 'Front'] as const);

  /** 当前半区可拧的针脚组合:左半区 = 朝上的那些,右半区 = 朝下的那些。 */
  const maskFor = useCallback((side: 0 | 1): number => {
    let m = 0;
    for (let c = 0; c < 4; c++) if (pinsUp[c] === (side === 0)) m |= 1 << c;
    return m;
  }, [pinsUp]);

  const toViewBox = useCallback((clientX: number, clientY: number) => {
    const el = svgRef.current;
    if (!el) return { x: 0, y: 0 };
    const r = el.getBoundingClientRect();
    return { x: ((clientX - r.left) / r.width) * W, y: ((clientY - r.top) / r.height) * H };
  }, []);

  // ─── 指针 ──────────────────────────────────────────────────────────────────

  const capture = (e: React.PointerEvent) => {
    try { svgRef.current?.setPointerCapture(e.pointerId); } catch { /* 老浏览器 / 已释放 */ }
  };

  const onDialDown = (e: React.PointerEvent, dial: number) => {
    if (mode !== 'edit') return;
    e.preventDefault();
    capture(e);
    dragRef.current = { kind: 'dial', dial };
    applyDial(e.clientX, e.clientY, dial);
  };

  const applyDial = (clientX: number, clientY: number, dial: number) => {
    const p = toViewBox(clientX, clientY);
    const c = clockDialCenter(dial);
    const dist = Math.hypot(p.x - c.x, p.y - c.y);
    if (dist < 3) return; // 正中心 → 方向无意义,忽略
    onChange(setClockDial(state, dial, Math.round(angleFrom(p.x, p.y, c.x, c.y) / STEP)));
  };

  const onPanelDown = (e: React.PointerEvent, side: 0 | 1) => {
    if (mode !== 'turn') return;
    const mask = maskFor(side);
    if (mask === 0) {
      say(t('这一面没有朝上的针脚,拧不动 —— 先点针脚切上下。',
        'No pin is up on this side, so nothing turns — tap a pin to flip it first.'));
      return;
    }
    e.preventDefault();
    capture(e);
    const c = clockPanelCenter(side);
    const p = toViewBox(e.clientX, e.clientY);
    dragRef.current = {
      kind: 'turn', side, mask, base: state, prev: angleFrom(p.x, p.y, c.x, c.y), acc: 0, k: 0,
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    if (d.kind === 'dial') { applyDial(e.clientX, e.clientY, d.dial); return; }
    const c = clockPanelCenter(d.side);
    const p = toViewBox(e.clientX, e.clientY);
    const ang = angleFrom(p.x, p.y, c.x, c.y);
    d.acc += wrapSigned(ang - d.prev);
    d.prev = ang;
    const k = Math.round(d.acc / STEP);
    if (k === d.k) return;
    d.k = k;
    onChange(mod12(k) === 0 ? d.base : applyClockMove(d.base, { side: d.side, mask: d.mask, amount: mod12(k) }));
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const d = dragRef.current;
    dragRef.current = null;
    try { svgRef.current?.releasePointerCapture(e.pointerId); } catch { /* 已释放 */ }
    if (d?.kind === 'turn' && mod12(d.k) !== 0) {
      onMove?.({ side: d.side, mask: d.mask, amount: mod12(d.k) });
    }
  };

  const togglePin = (e: React.PointerEvent, corner: number) => {
    if (mode !== 'turn') return;
    e.preventDefault();
    e.stopPropagation();
    const next = pinsUp.slice();
    next[corner] = !next[corner];
    setPins(next);
  };

  /** y2:交换两块 + 针脚上下互换(物理上翻过来,原本朝你的针脚就朝外了)。 */
  const flip = () => {
    const p = state.posit;
    onChange({ posit: [...p.slice(9), ...p.slice(0, 9)], rightSideUp: !state.rightSideUp });
    setPins(pinsUp.map((x) => !x));
    dragRef.current = null;
  };

  // ─── 绘制 ──────────────────────────────────────────────────────────────────

  const panels = ([0, 1] as const).map((side) => {
    const c = clockPanelCenter(side);
    const off = 2 * CLOCK_OUTER_RADIUS;
    const bulges: { x: number; y: number }[] = [];
    for (const dx of [-off, off]) for (const dy of [-off, off]) bulges.push({ x: c.x + dx, y: c.y + dy });
    return { side, c, face: get(sideKeys[side]), bulges };
  });

  return (
    <div className={`iclock${className ? ` ${className}` : ''}`} style={{ maxWidth }}>
      <svg
        ref={svgRef}
        className={`iclock-svg is-${mode}`}
        viewBox={`0 0 ${W} ${H}`}
        strokeLinecap="round"
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* 半区外形:先画 4 个凸角环(只描边),再盖大圆,最后用面色补回环内那圈 */}
        {panels.map(({ side, c, face, bulges }) => (
          <g key={`face-${side}`}>
            {bulges.map((b, i) => (
              <circle key={`ring-${i}`} cx={b.x} cy={b.y} r={CLOCK_OUTER_RADIUS} stroke="#000" strokeWidth={STROKE_WIDTH} fill="none" />
            ))}
            <circle cx={c.x} cy={c.y} r={RADIUS} stroke="#000" strokeWidth={STROKE_WIDTH} fill={face} />
            {bulges.map((b, i) => (
              <circle key={`bulge-${i}`} cx={b.x} cy={b.y} r={CLOCK_OUTER_RADIUS - STROKE_WIDTH / 2} fill={face} />
            ))}
          </g>
        ))}

        {/* 18 个表盘面 + 刻度 */}
        {Array.from({ length: 18 }, (_, i) => {
          const side = (i < 9 ? 0 : 1) as 0 | 1;
          const key = sideKeys[side];
          const c = clockDialCenter(i);
          return (
            <g key={`dial-${i}`}>
              <circle cx={c.x} cy={c.y} r={CLOCK_RADIUS} stroke="#000" strokeWidth={FACE_STROKE_WIDTH} fill={get(`${key}Clock`)} />
              {Array.from({ length: 12 }, (_, k) => {
                const rad = k * STEP;
                return (
                  <circle
                    key={k}
                    cx={c.x + Math.sin(rad) * POINT_RADIUS}
                    cy={c.y - Math.cos(rad) * POINT_RADIUS}
                    r={k === 0 ? TOP_TICK_R : TICK_R}
                    fill={get(`${key}${k === 0 ? 'Top' : ''}Clock`)}
                  />
                );
              })}
            </g>
          );
        })}

        {/* 18 根指针 */}
        {Array.from({ length: 18 }, (_, i) => {
          const key = sideKeys[i < 9 ? 0 : 1];
          const c = clockDialCenter(i);
          const border = get(`${key}HandBorder`);
          const hand = get(`${key}Hand`);
          return (
            <g key={`hand-${i}`} transform={`translate(${c.x},${c.y}) rotate(${state.posit[i] * 30})`}>
              <path d={CLOCK_ARROW_PATH} stroke={border} strokeWidth={STROKE_WIDTH} fill={border} strokeLinejoin="round" />
              <circle cx={0} cy={0} r={ARROW_RADIUS} stroke={border} strokeWidth={STROKE_WIDTH} fill={border} />
              <path d={CLOCK_ARROW_PATH} fill={hand} />
              <circle cx={0} cy={0} r={ARROW_RADIUS} fill={hand} />
            </g>
          );
        })}

        {/* 拧的热区:整个半区(在针脚下面,针脚才能优先吃到点击) */}
        {mode === 'turn' && panels.map(({ side, c }) => (
          <circle
            key={`grab-${side}`}
            className="iclock-grab"
            cx={c.x}
            cy={c.y}
            r={RADIUS}
            fill="transparent"
            onPointerDown={(e) => onPanelDown(e, side)}
          />
        ))}

        {/* 编辑的热区:每个表盘一个(比表盘略大,好点) */}
        {mode === 'edit' && Array.from({ length: 18 }, (_, i) => {
          const c = clockDialCenter(i);
          return (
            <circle
              key={`hit-${i}`}
              className="iclock-hit"
              cx={c.x}
              cy={c.y}
              r={CLOCK_OUTER_RADIUS - 1}
              fill="transparent"
              onPointerDown={(e) => onDialDown(e, i)}
            />
          );
        })}

        {/* 8 个针脚(4 个物理针脚 × 两面)。turn 模式下可点,朝上的高亮。 */}
        {([0, 1] as const).map((side) => [0, 1, 2, 3].map((corner) => {
          const p = pinCenter(side, corner);
          const up = side === 0 ? pinsUp[corner] : !pinsUp[corner];
          if (mode !== 'turn') {
            const flat = get(side === 0 ? (state.rightSideUp ? 'BackPin' : 'FrontPin') : (state.rightSideUp ? 'FrontPin' : 'BackPin'));
            return <circle key={`pin-${side}-${corner}`} cx={p.x} cy={p.y} r={PIN_RADIUS} fill={flat} />;
          }
          return (
            <g key={`pin-${side}-${corner}`} className={`iclock-pin${up ? ' is-up' : ''}`}>
              <circle cx={p.x} cy={p.y} r={up ? PIN_RADIUS * 1.7 : PIN_RADIUS} className="iclock-pin-dot" />
              <circle
                cx={p.x}
                cy={p.y}
                r={CLOCK_OUTER_RADIUS * 0.55}
                fill="transparent"
                onPointerDown={(e) => togglePin(e, corner)}
              />
            </g>
          );
        }))}
      </svg>

      {!hideControls && (
        <div className="iclock-bar">
          {onModeChange && (
            <PillToggle
              value={mode === 'turn'}
              onChange={(v) => onModeChange(v ? 'turn' : 'edit')}
              offLabel={t('编辑', 'Edit')}
              onLabel={t('拧', 'Turn')}
              ariaLabel={t('画板模式', 'Board mode')}
            />
          )}
          {mode === 'turn' && (
            <button type="button" className="iclock-btn" onClick={flip} title={t('把魔表翻过来(y2)', 'Turn the clock over (y2)')}>
              y2
            </button>
          )}
        </div>
      )}

      <p className="iclock-hint" aria-live="polite">
        {flash ?? (mode === 'edit'
          ? t('点或拖任意表盘设指针方向;角上的表盘正反联动,所以画出来的状态一定合法。',
            'Tap or drag any dial to set its hand. Corner dials are linked front-to-back, so whatever you draw is always a legal state.')
          : turnHint(maskFor(0), maskFor(1), t))}
      </p>
    </div>
  );
}

function turnHint(maskLeft: number, maskRight: number, t: (zh: string, en: string) => string): string {
  const left = maskLeft ? clockPinName(maskLeft) : null;
  const right = maskRight ? clockPinName(maskRight) : null;
  if (!left && !right) return t('四个针脚都在同一面 —— 不可能,先点一个。', 'All four pins are on one side — tap one to flip it.');
  const parts = [
    left ? t(`左半区拧 = ${left}`, `drag the left side = ${left}`) : null,
    right ? t(`右半区拧 = ${right}`, `drag the right side = ${right}`) : null,
  ].filter(Boolean);
  return `${t('点针脚切上下;', 'Tap a pin to flip it up or down; ')}${parts.join(t('、', ', '))}`;
}
