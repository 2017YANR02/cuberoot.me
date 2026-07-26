'use client';

/**
 * Square-1 的可拖立体转盘(`/scramble/solver?event=sq1` 的「立体」视图,默认视图)。
 *
 * 为什么不是平面涂色画板(斜转 / 金字塔 / 二阶那三块都是画板):SQ1 的状态是
 * **形状 + 排列**,不是 facelet 串。上下层各 12 个 30° 槽位由 6 个角(占 2 槽)和
 * 6 个棱(占 1 槽)填出来,合法性在于「块序 + 切割处不能劈开一个角」,而不在于
 * 颜色分布 —— 涂色根本表达不了它。所以这里不做画板,做**可拖的实物盘**:
 * 复用 /sim 的 sq1 引擎(`mountSimWorld`)与它的拖拽转动(`sq1Drag`),把每一次
 * 落定的层转 / 切片按 (a,b)/ 记号写回打乱框。**打乱框仍是唯一真值**,求解走
 * `cstimerSolveByKey('sqrs', …)`,盘只是输入法。
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
 * 外壳(等第一帧 → 动态 import three + 引擎 → 转圈 → 重置视角)走共享的 `<SimStage>`;
 * 指针走共享的 `attachOrbitTap`,拼图自己吃掉的那种拖动(层转)由 `onDragBegin`
 * 返回 true 接管,脱靶才 orbit。
 */

import { useEffect, useRef, useState } from 'react';
import { RotateCcw, Undo2 } from 'lucide-react';
import SimStage from '@/components/sim-embed/SimStage';
import { useT } from '@/hooks/useT';
import { parseSq1Tokens, simplifySq1Alg, type Sq1Token } from '@cuberoot/shared/sq1-notation';
import type Sq1Cube from '@/app/[lang]/sim/engine/sq1/Sq1Cube';
import type { SimMount } from '@/components/sim-embed/mountSimWorld';
import type { Sq1TurnDrag } from '@/app/[lang]/sim/engine/sq1/sq1Drag';

/** = mapTurnDragFactor(50):/sim 默认灵敏度那一档(orbit 那档在 viewControls.ORBIT_K)。 */
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
  parse: typeof import('@cuberoot/shared/sq1-notation').parseSq1Tokens;
  tweener: typeof import('@/app/[lang]/sim/engine/tweener').default;
  resetView: () => void;
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

  // ── 引擎挂载(SimStage 等过第一帧才调,只调一次)────────────────────────
  const mountEngine = async (host: HTMLElement): Promise<() => void> => {
    const [embed, drag, view, gesture, notation, tw] = await Promise.all([
      import('@/components/sim-embed/mountSimWorld'),
      import('@/app/[lang]/sim/engine/sq1/sq1Drag'),
      import('@/app/[lang]/sim/engine/viewControls'),
      import('@/components/sim-embed/orbitTapGesture'),
      import('@cuberoot/shared/sq1-notation'),
      import('@/app/[lang]/sim/engine/tweener'),
    ]);

    const mount = embed.mountSimWorld({ host, puzzle: 'sq1' });
    const world = mount.world;
    const cube = world.cube as Sq1Cube;
    engRef.current = {
      mount, cube, parse: notation.parseSq1Tokens, tweener: tw.default,
      resetView: () => { view.resetSceneView(world); mount.invalidate(); },
    };

    /** 层转拖动的活跃状态(只在拼图接管这次拖动时非空)。 */
    let turn: Sq1TurnDrag | null = null;
    let lastDelta = 0;

    const fireSlice = (dir: 1 | -1): void => {
      if (cube.twister.twist({ kind: 'slice' }, false, true, dir)) {
        movesRef.current.push({ kind: 'slice' });
        emit();
      }
    };

    const detach = gesture.attachOrbitTap({
      world,
      canvas: mount.renderer.domElement,
      // 起手就问引擎:抓到层了就我接管(拖着转),脱靶才交给 orbit。
      onDragBegin: (downX, downY, dx, dy) => {
        cube.twister.finish();
        tw.default.finish();
        const hit = drag.sq1DragStart(cube, world.scene, world.camera, downX, downY, world.width, world.height);
        if (hit === null) return false; // 脱靶 → 转视角
        if (hit.kind === 'slice') { fireSlice(dy < 0 ? -1 : 1); return true; }
        // 抓在切片那半边 + 竖向为主 → 也当切片(与 /sim 同一判据)。
        if (hit.startEastHalf && Math.abs(dy) > Math.abs(dx) * 1.5) {
          fireSlice(dy < 0 ? -1 : 1);
          return true;
        }
        turn = hit;
        return true;
      },
      onDragMove: (lx, ly) => {
        if (!turn) return;
        const d = drag.sq1DragDelta(turn, world.scene, world.camera, lx, ly, world.width, world.height);
        if (d == null) return;
        lastDelta = d * TURN_FACTOR;
        drag.sq1DragApply(turn, lastDelta);
        world.dirty = true;
      },
      onDragEnd: () => {
        if (turn) {
          const move = drag.sq1DragCommit(cube, turn, lastDelta);
          if (move) { movesRef.current.push(move); emit(); }
        }
        turn = null;
        lastDelta = 0;
      },
      // 点一下(没拖):命中中层 = 切片,命中层块什么也不做(避免误转)。
      onTap: (x, y) => {
        const hit = drag.sq1DragStart(cube, world.scene, world.camera, x, y, world.width, world.height);
        if (hit?.kind === 'slice') fireSlice(1);
      },
    });

    return () => {
      detach();
      mount.dispose();
      engRef.current = null;
    };
  };

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
      <SimStage
        size={pixelSize}
        mount={mountEngine}
        onReady={() => setReady(true)}
        onResetView={() => engRef.current?.resetView()}
        className="sq1b-stage"
        busyLabel={t('正在加载立体转盘', 'Loading the 3D board')}
      />

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
.sq1b-stage .sim-stage-canvas { cursor: grab; }
.sq1b-stage .sim-stage-canvas:active { cursor: grabbing; }
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
