'use client';

/**
 * Square-1 的可拖立体转盘(`/scramble/solver?event=sq1` 的「立体」视图)。
 *
 * 为什么不是平面涂色画板(斜转 / 金字塔 / 二阶那三块都是画板):SQ1 的状态是
 * **形状 + 排列**,不是 facelet 串。上下层各 12 个 30° 槽位由 6 个角(占 2 槽)和
 * 6 个棱(占 1 槽)填出来,合法性在于「块序 + 切割处不能劈开一个角」,而不在于
 * 颜色分布 —— 涂色根本表达不了它。所以这里不做画板,做**可拖的实物盘**:
 * 复用 /sim 的 sq1 引擎(`mountSimWorld`)与它的拖拽转动(`sq1Drag`),把每一次
 * 落定的层转 / 切片按 (a,b)/ 记号写回打乱框。**打乱框仍是唯一真值**,求解走原来
 * 那条 `solveSq1(scramble)`,盘只是输入法。
 *
 * 双向同步:框里的串变了(手输 / 随机生成 / 撤销)→ `reset` + `applyMovesInstant`
 * 重放到盘上;盘上转了 → 追加 token 回框。
 *
 * 写回前过一遍 `simplifySq1Alg`(shared 里全站唯一那份 SQ1 消步):连续层转合并进一个
 * 括号((1,0) 接 (0,-3) = (1,-3))、相邻两刀相消。上下层转互相可交换,合并前后同一
 * 状态;而 WCA 记号本来就是一对一个括号 —— 不合并会把 12c4 步数虚报成两步
 * (见 lib/sq1-metrics:非零 (x,y) 记 1)。撤销按**物理拖动**回退一步(不是记号步),
 * 所以内部留一份未合并的 raw 列表。
 *
 * three(~0.2MB over the wire)+ 引擎全部动态 import,所以默认「平面」视图的初始
 * 包不含它们;点到「立体」才拉,期间显示 Spinner。
 */

import { useEffect, useRef, useState } from 'react';
import { RotateCcw, Undo2 } from 'lucide-react';
import { Spinner } from '@/components/Spinner/Spinner';
import { useT } from '@/hooks/useT';
import { parseSq1Tokens, simplifySq1Alg, type Sq1Token } from '@cuberoot/shared/sq1-notation';
import type Sq1Cube from '@/app/[lang]/sim/engine/sq1/Sq1Cube';
import type { SimMount } from '@/components/sim-embed/mountSimWorld';
import type { Sq1TurnDrag } from '@/app/[lang]/sim/engine/sq1/sq1Drag';

/** 起手阈值:小于这点位移算「点一下」,不算拖。与 /sim 同值。 */
const DRAG_THRESHOLD_PX = 6;
/** = mapOrbitK(50) / mapTurnDragFactor(50):/sim 默认灵敏度那一档。求解器页不给
 *  灵敏度设置,钉死默认值即可(想调的人去 /sim)。 */
const ORBIT_K = 0.01;
const TURN_FACTOR = 2.13;

/** 一个 token 的规范文本。无分隔符拼接就是打乱串的样子:(1,0)/(-3,3)/(0,-3)/ */
function tokenText(m: Sq1Token): string {
  return m.kind === 'slice' ? '/' : `(${m.top},${m.bot})`;
}

/** 物理拖动序列 → 写回打乱框的串(过 shared 消步:层转合并 + 相邻两刀相消)。 */
function movesToScramble(moves: Sq1Token[]): string {
  const raw = moves.map(tokenText).join('');
  if (!raw) return '';
  // 'wca' 格式(带空格)再解析一次不会歧义,拿回 token 后按打乱串样式重拼。
  return parseSq1Tokens(simplifySq1Alg(raw, 'wca')).map(tokenText).join('');
}

interface Engine {
  mount: SimMount;
  cube: Sq1Cube;
  dragStart: typeof import('@/app/[lang]/sim/engine/sq1/sq1Drag').sq1DragStart;
  dragDelta: typeof import('@/app/[lang]/sim/engine/sq1/sq1Drag').sq1DragDelta;
  dragApply: typeof import('@/app/[lang]/sim/engine/sq1/sq1Drag').sq1DragApply;
  dragCommit: typeof import('@/app/[lang]/sim/engine/sq1/sq1Drag').sq1DragCommit;
  orbit: typeof import('@/app/[lang]/sim/engine/viewControls').orbitScene;
  parse: typeof import('@cuberoot/shared/sq1-notation').parseSq1Tokens;
  tweener: typeof import('@/app/[lang]/sim/engine/tweener').default;
}

export interface InteractiveSq1BoardProps {
  /** 打乱框内容(唯一真值)。多行时只重放第一行。 */
  scramble: string;
  onScrambleChange: (next: string) => void;
  /** 画布边长(px)。 */
  pixelSize: number;
}

export default function InteractiveSq1Board({
  scramble, onScrambleChange, pixelSize,
}: InteractiveSq1BoardProps) {
  const t = useT();
  const hostRef = useRef<HTMLDivElement>(null);
  const engRef = useRef<Engine | null>(null);
  const movesRef = useRef<Sq1Token[]>([]);
  /** 我们最后写回框里的串。框里的值 !== 它 = 外部改的,要重放。 */
  const lastEmittedRef = useRef<string | null>(null);
  const emitRef = useRef(onScrambleChange);
  emitRef.current = onScrambleChange;

  const [ready, setReady] = useState(false);
  const [count, setCount] = useState(0);

  const emit = (): void => {
    const s = movesToScramble(movesRef.current);
    lastEmittedRef.current = s;
    setCount(movesRef.current.length);
    emitRef.current(s);
  };

  // ── 引擎挂载(一次)+ 指针交互 ──────────────────────────────────────────
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let cleanupPointers: (() => void) | null = null;

    void (async () => {
      const [embed, drag, view, notation, tw] = await Promise.all([
        import('@/components/sim-embed/mountSimWorld'),
        import('@/app/[lang]/sim/engine/sq1/sq1Drag'),
        import('@/app/[lang]/sim/engine/viewControls'),
        import('@cuberoot/shared/sq1-notation'),
        import('@/app/[lang]/sim/engine/tweener'),
      ]);
      if (cancelled) return;

      const mount = embed.mountSimWorld({ host, puzzle: 'sq1' });
      const cube = mount.world.cube as Sq1Cube;
      const eng: Engine = {
        mount, cube,
        dragStart: drag.sq1DragStart, dragDelta: drag.sq1DragDelta,
        dragApply: drag.sq1DragApply, dragCommit: drag.sq1DragCommit,
        orbit: view.orbitScene, parse: notation.parseSq1Tokens, tweener: tw.default,
      };
      engRef.current = eng;

      // 手势状态。一次只有一种活跃:turn 拖 / orbit 转视角 / 待定(没过阈值)。
      let turn: Sq1TurnDrag | null = null;
      let lastDelta = 0;
      let orbiting = false;
      let pending = false;
      let moved = false;
      let downX = 0;
      let downY = 0;
      let lastX = 0;
      let lastY = 0;
      const canvas = mount.renderer.domElement;

      const fireSlice = (dir: 1 | -1): void => {
        if (cube.twister.twist({ kind: 'slice' }, false, true, dir)) {
          movesRef.current.push({ kind: 'slice' });
          emit();
        }
      };

      const onDown = (e: PointerEvent): void => {
        const r = canvas.getBoundingClientRect();
        downX = e.clientX - r.left;
        downY = e.clientY - r.top;
        lastX = e.clientX;
        lastY = e.clientY;
        pending = true;
        moved = false;
        try { canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      };

      const onMove = (e: PointerEvent): void => {
        const w = mount.world;
        const r = canvas.getBoundingClientRect();
        const localX = e.clientX - r.left;
        const localY = e.clientY - r.top;

        if (turn) {
          const d = eng.dragDelta(turn, w.scene, w.camera, localX, localY, w.width, w.height);
          if (d != null) {
            lastDelta = d * TURN_FACTOR;
            eng.dragApply(turn, lastDelta);
            w.dirty = true;
          }
          return;
        }
        if (orbiting) {
          eng.orbit(w, e.clientX - lastX, e.clientY - lastY, ORBIT_K);
          lastX = e.clientX;
          lastY = e.clientY;
          return;
        }
        if (!pending || moved) return;

        const dx = localX - downX;
        const dy = localY - downY;
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
        moved = true;

        cube.twister.finish();
        eng.tweener.finish();
        const hit = eng.dragStart(cube, w.scene, w.camera, downX, downY, w.width, w.height);
        if (hit === null) {
          // 脱靶 → 转视角(魔方上的拖拽一律转魔方,只有空白才转视角)。
          orbiting = true;
          eng.orbit(w, dx, dy, ORBIT_K);
          lastX = e.clientX;
          lastY = e.clientY;
          return;
        }
        if (hit.kind === 'slice') { fireSlice(dy < 0 ? -1 : 1); return; }
        // 抓在切片那半边 + 竖向为主 → 也当切片(与 /sim 同一判据)。
        if (hit.startEastHalf && Math.abs(dy) > Math.abs(dx) * 1.5) {
          fireSlice(dy < 0 ? -1 : 1);
          return;
        }
        turn = hit;
        const d = eng.dragDelta(turn, w.scene, w.camera, localX, localY, w.width, w.height);
        if (d != null) {
          lastDelta = d * TURN_FACTOR;
          eng.dragApply(turn, lastDelta);
          w.dirty = true;
        }
      };

      const onUp = (e: PointerEvent): void => {
        if (turn) {
          const move = eng.dragCommit(cube, turn, lastDelta);
          if (move) { movesRef.current.push(move); emit(); }
        } else if (pending && !moved) {
          // 点一下(没拖):命中中层 = 切片,命中层块什么也不做(避免误转)。
          const w = mount.world;
          const hit = eng.dragStart(cube, w.scene, w.camera, downX, downY, w.width, w.height);
          if (hit?.kind === 'slice') fireSlice(1);
        }
        turn = null;
        lastDelta = 0;
        orbiting = false;
        pending = false;
        moved = false;
        try { canvas.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
      };

      canvas.addEventListener('pointerdown', onDown);
      canvas.addEventListener('pointermove', onMove, { passive: false });
      canvas.addEventListener('pointerup', onUp);
      canvas.addEventListener('pointercancel', onUp);
      cleanupPointers = () => {
        canvas.removeEventListener('pointerdown', onDown);
        canvas.removeEventListener('pointermove', onMove);
        canvas.removeEventListener('pointerup', onUp);
        canvas.removeEventListener('pointercancel', onUp);
      };
      setReady(true);
    })();

    return () => {
      cancelled = true;
      cleanupPointers?.();
      engRef.current?.mount.dispose();
      engRef.current = null;
    };
  }, []);

  // ── 外部改了打乱框 → 重放到盘上 ────────────────────────────────────────
  useEffect(() => {
    const eng = engRef.current;
    if (!eng || !ready) return;
    const first = scramble.split('\n').map((s) => s.trim()).find(Boolean) ?? '';
    if (first === lastEmittedRef.current) return;
    let moves: Sq1Token[];
    try {
      moves = eng.parse(first);
    } catch {
      return; // 记号还没打完
    }
    eng.cube.twister.finish();
    eng.tweener.finish();
    eng.cube.reset();
    eng.cube.applyMovesInstant(moves);
    eng.mount.invalidate();
    movesRef.current = moves;
    lastEmittedRef.current = first;
    setCount(moves.length);
  }, [scramble, ready]);

  const replay = (moves: Sq1Token[]): void => {
    const eng = engRef.current;
    if (!eng) return;
    eng.cube.twister.finish();
    eng.tweener.finish();
    eng.cube.reset();
    eng.cube.applyMovesInstant(moves);
    eng.mount.invalidate();
    movesRef.current = moves;
    emit();
  };

  return (
    <div className="sq1b">
      <style>{INLINE_CSS}</style>
      <div
        className="sq1b-canvas"
        ref={hostRef}
        style={{ width: pixelSize, height: pixelSize }}
      >
        {!ready && (
          <div className="sq1b-loading">
            <Spinner size={18} />
          </div>
        )}
      </div>

      <p className="sq1b-hint">
        {t('拖上下层转动,拖中间(或点中间)切一刀 —— 每一步都写回打乱框;空白处拖动转视角。',
          'Drag a layer to turn it, drag (or tap) the middle slab to slice — every move is written back to the scramble box; drag empty space to orbit.')}
      </p>

      <div className="sq1b-actions">
        <button
          type="button"
          className="sq1b-btn"
          disabled={count === 0}
          onClick={() => replay(movesRef.current.slice(0, -1))}
        >
          <Undo2 size={14} />
          {t('撤销一步', 'Undo')}
        </button>
        <button
          type="button"
          className="sq1b-btn"
          disabled={count === 0}
          onClick={() => replay([])}
        >
          <RotateCcw size={14} />
          {t('复原', 'Reset')}
        </button>
      </div>
    </div>
  );
}

const INLINE_CSS = `
.sq1b { display: flex; flex-direction: column; align-items: center; gap: 0.6rem; }
.sq1b-canvas {
  position: relative; max-width: 100%; touch-action: none; cursor: grab;
}
.sq1b-canvas:active { cursor: grabbing; }
.sq1b-loading {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
}
.sq1b-hint {
  font-size: 0.8rem; color: var(--muted-foreground); text-align: center;
  max-width: 26rem; line-height: 1.5;
}
.sq1b-actions { display: flex; gap: 0.5rem; }
.sq1b-btn {
  display: inline-flex; align-items: center; gap: 0.3rem;
  font-size: 0.8rem; font-family: inherit;
  color: var(--foreground); background: var(--card);
  border: 1px solid var(--border-default); border-radius: 5px;
  padding: 0.3rem 0.6rem; cursor: pointer;
}
.sq1b-btn:hover:not(:disabled) { background: color-mix(in srgb, var(--foreground) 6%, var(--card)); }
.sq1b-btn:disabled { color: var(--faint-foreground); cursor: default; }
`;
