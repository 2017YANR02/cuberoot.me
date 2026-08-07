'use client';

/**
 * `/sim?puzzle=clock` 的画面层。
 *
 * 魔表没有立体形态,所以它是 /sim 里唯一一个**不走 Three.js 画面**的拼图 —— 与 NxN 的
 * 「平面图」(`_SimCubeNet`)同一套路子:SVG 盖在画布容器上,状态从 world 里那个引擎对象
 * (`engine/clock/clockBoard`)读,靠 `callbacks` 订阅重画。渲染本体直接复用求解页那份
 * `components/InteractiveClock`,一份 SVG 两处用。
 *
 * 三条数据流:
 *   引擎 → 画面   `board.callbacks` 触发重绘;动画期间另起 rAF 逐帧读指针偏转
 *   画面 → 引擎   涂色模式改状态 → `board.setState`(整段状态,不进解法框)
 *   画面 → 解法框 拧的模式转一次 → 追加 token 到 `?alg=`(与其它拼图的手势同一出口)
 */

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import InteractiveClock, { type ClockBoardMode } from '@/components/InteractiveClock';
import { useT } from '@/hooks/useT';
import { type ClockMove, type ClockState } from '@/lib/clock-solver';
import { clockGestureToken } from './engine/clock/clockBoard';
import type World from './engine/world';
import type ClockBoard from './engine/clock/clockBoard';
import type { TwistAction } from './engine/nxn/twister';
import './sim_clock_board.css';

interface Props {
  getWorld: () => World | null;
  /** Bumps when the world is (re)created — re-subscribe to the live board. */
  worldTick: number;
  userMoveRef: RefObject<((action: TwistAction | string) => void) | null>;
  /** 手拧(设置面板):false = 只看不动(涂色 / 拧都停掉)。 */
  pointerTurns?: boolean;
  coreOpacity?: number;
}

function clockBoardOf(world: World | null): ClockBoard | null {
  if (!world || world.puzzleKind !== 'clock') return null;
  return world.cube as ClockBoard;
}

export default function SimClockBoard({
  getWorld, worldTick, userMoveRef, pointerTurns = true, coreOpacity = 100,
}: Props) {
  const t = useT();
  const [, force] = useState(0);
  const rerender = useCallback(() => force((n) => (n + 1) & 0xffff), []);
  const [mode, setMode] = useState<ClockBoardMode>('turn');

  // 订阅要挂在**渲染期算出的 board** 上,不能只依赖 worldTick:魔表是页面一进来就选中的,
  // 这个组件会在 world 建好之前先挂载一轮,那时 getWorld() 还是 null;之后 worldTick 未必
  // 再变,effect 就再也不跑、一条回调都没注册(症状:引擎明明打乱了,SVG 还画着还原态)。
  // 把 board 本身当依赖,它从 null 变成实例的那一刻自然补订阅。
  const board = clockBoardOf(getWorld());

  // 引擎落定一步 / setup / reset → 重绘。
  useEffect(() => {
    if (!board) return;
    const cb = () => rerender();
    board.callbacks.push(cb);
    rerender();
    return () => {
      const i = board.callbacks.indexOf(cb);
      if (i >= 0) board.callbacks.splice(i, 1);
    };
  }, [board, worldTick, rerender]);

  // 指针扫动:tweener 自带 rAF 在推 pivot,这里只负责在动画期间把每帧的偏转读出来重绘。
  // 静止时不起环(魔表的一步最长也就半秒,常驻 rAF 不值当)。
  const rafRef = useRef(0);
  useEffect(() => {
    if (!board) return;
    let alive = true;
    const tick = () => {
      if (!alive) return;
      if (board.animating) { rerender(); rafRef.current = requestAnimationFrame(tick); }
      else rafRef.current = 0;
    };
    const kick = () => { if (alive && !rafRef.current) rafRef.current = requestAnimationFrame(tick); };
    // 每次状态变更都探一次:push/twist 之后动画才开始,回调恰好是它的前沿。
    board.callbacks.push(kick);
    kick();
    return () => {
      alive = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
      const i = board.callbacks.indexOf(kick);
      if (i >= 0) board.callbacks.splice(i, 1);
    };
  }, [board, worldTick, rerender]);

  /** 涂色模式:整段状态直接写进引擎(不是一步招式,所以不进解法框)。 */
  const handleChange = useCallback((next: ClockState) => {
    clockBoardOf(getWorld())?.setState(next);
  }, [getWorld]);

  /**
   * 转动模式:把这一步追加到解法框,由 SimPage 的重放把引擎带过去(与其它拼图的手势同一
   * 条路)。记号规则(左半区裸写 / 右半区成对 `y2 X y2`)在引擎里单一源 + 有测试锁,
   * 这里只管把它接到解法框上。嫌 `y2 X y2` 啰嗦按「消步」会收成规范形。
   */
  const handleMove = useCallback((move: ClockMove) => {
    userMoveRef.current?.(clockGestureToken(move));
  }, [userMoveRef]);

  if (!board) return <div className="sim-clock" aria-hidden />;

  return (
    <div className="sim-clock">
      <InteractiveClock
        state={board.state}
        onChange={handleChange}
        mode={pointerTurns ? mode : 'edit'}
        onModeChange={pointerTurns ? setMode : undefined}
        onMove={handleMove}
        animOffset={(dial) => board.animOffset(dial)}
        hideControls={!pointerTurns}
        coreOpacity={coreOpacity}
        maxWidth={520}
        className="sim-clock-svg"
      />
      {!pointerTurns && (
        <p className="sim-clock-locked">{t('手拧已关闭', 'Pointer turns are off')}</p>
      )}
    </div>
  );
}
