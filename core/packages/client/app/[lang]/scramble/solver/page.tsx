'use client';

/**
 * /scramble/solver — 统一「求解」路由,按 ?event= 分发到对应求解器:
 *   event=333(或缺省) → 3×3 cubeopt 最优解(_Cube3Solver,全站唯一发 COOP/COEP 的文档,
 *                        需 SharedArrayBuffer)
 *   event=222/pyram/skewb → PuzzleOptimalSolver(Rust WASM 全空间精确表,无 COEP)
 *   event=sq1 → SQ1 两阶段近最优解(_Sq1Solver,纯 TS,无 worker)
 *   event=ivy → 枫叶魔方整解最优(_IvySolver,纯 TS,29,160 态全图 BFS,无 worker)
 *   event=133 → 1×3×3 花型整解最优(_FloppySolver,纯 TS,192 态全图 BFS,无 worker)
 *   event=223 → 2×2×3 整解最优(_Cuboid223Solver,纯 TS,241,920 态全图 BFS,无 worker)
 *   event=8p → 八数码整解最优(_Slide8Solver,纯 TS,181,440 态全图 BFS,无 worker)
 *   event=15p → 数字华容道整解最优(_Slide15Solver,纯 TS,IDA*+Walking-Distance 单实例最优,无 worker)
 *   event=sfl → Super Floppy 整解最优(_SuperFloppySolver,纯 TS,3,041,280 态全图 BFS,无 worker)
 *   event=ufo → UFO 整解最优(_UfoSolver,纯 TS,60,480 态全图 BFS,无 worker)
 *   event=cm2 → Cmetrick Mini 整解最优(_Cm2Solver,纯 TS,165,888 态全图 BFS,无 worker)
 *   event=dmd → 钻石(八面体)整解最优(_DiamondSolver,纯 TS,138,240 态全图 BFS,无 worker)
 *   event=gear → 齿轮魔方整解最优(_GearSolver,纯 TS,41,472 态全图 BFS,无 worker)
 *   event=mpyrso → 大金字塔(随态)近最优(_MpyrSolver,wrap cstimer 两阶段 solver via worker,采样分布)
 *   event=crz3a → 疯狂 3×3 近最优(_Crz3aSolver,复用站内 kociemba 两阶段 solver,标准三阶,采样分布)
 *
 * COEP 只在 ?event=333(或缺省 event)时下发,见 next.config.ts headers() 的 has/missing
 * 条件匹配 —— 其余 event 是普通文档,rust-cross worker + 跨域表照常工作。COEP 是文档级的,
 * 软导航不换头,所以**跨 333 边界**的项目切换由 SolveTabs 用原生 <a> 硬导航(整页重载)
 * 触发,文档才会拿到/卸掉 COEP;非 333 之间(222↔pyram↔skewb↔sq1)是同一个无 COEP 文档,
 * 软导航即可。各求解器 next/dynamic 懒载,保持分包(进 222 不拉 cubeopt 大 bundle)。
 *
 * URL 与分布 /scramble/stats?event= 完全对称;裸 /scramble/solver = 默认 3×3(向后兼容旧链接)。
 */

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { SPEC_BY_EVENT } from './_puzzle-specs';

const Loading = () => <div style={{ padding: 16 }}>Loading…</div>;

const Cube3Solver = dynamic(() => import('./_Cube3Solver'), { ssr: false, loading: Loading });
const Sq1Solver = dynamic(() => import('./_Sq1Solver'), { ssr: false, loading: Loading });
const IvySolver = dynamic(() => import('./_IvySolver'), { ssr: false, loading: Loading });
const FloppySolver = dynamic(() => import('./_FloppySolver'), { ssr: false, loading: Loading });
const Cuboid223Solver = dynamic(() => import('./_Cuboid223Solver'), { ssr: false, loading: Loading });
const Slide8Solver = dynamic(() => import('./_Slide8Solver'), { ssr: false, loading: Loading });
const Slide15Solver = dynamic(() => import('./_Slide15Solver'), { ssr: false, loading: Loading });
const SuperFloppySolver = dynamic(() => import('./_SuperFloppySolver'), { ssr: false, loading: Loading });
const UfoSolver = dynamic(() => import('./_UfoSolver'), { ssr: false, loading: Loading });
const Cm2Solver = dynamic(() => import('./_Cm2Solver'), { ssr: false, loading: Loading });
const DiamondSolver = dynamic(() => import('./_DiamondSolver'), { ssr: false, loading: Loading });
const GearSolver = dynamic(() => import('./_GearSolver'), { ssr: false, loading: Loading });
const MpyrSolver = dynamic(() => import('./_MpyrSolver'), { ssr: false, loading: Loading });
const Crz3aSolver = dynamic(() => import('./_Crz3aSolver'), { ssr: false, loading: Loading });
const PuzzleOptimalSolver = dynamic(
  () => import('../_components/PuzzleOptimalSolver').then((m) => ({ default: m.PuzzleOptimalSolver })),
  { ssr: false, loading: Loading },
);

function SolverDispatch() {
  const event = useSearchParams().get('event') ?? '333';
  if (event === 'sq1') return <Sq1Solver />;
  if (event === 'ivy') return <IvySolver />;
  if (event === '133') return <FloppySolver />;
  if (event === '223') return <Cuboid223Solver />;
  if (event === '8p') return <Slide8Solver />;
  if (event === '15p') return <Slide15Solver />;
  if (event === 'sfl') return <SuperFloppySolver />;
  if (event === 'ufo') return <UfoSolver />;
  if (event === 'cm2') return <Cm2Solver />;
  if (event === 'dmd') return <DiamondSolver />;
  if (event === 'gear') return <GearSolver />;
  if (event === 'mpyrso') return <MpyrSolver />;
  if (event === 'crz3a') return <Crz3aSolver />;
  const spec = SPEC_BY_EVENT[event];
  // key={event} 让非 333 之间软切换时干净 remount(换 spec/池,不留旧状态)。
  if (spec) return <PuzzleOptimalSolver key={event} spec={spec} />;
  // 333 或未知 event → 3×3 cubeopt(COEP / SAB)
  return <Cube3Solver />;
}

export default function ScrambleSolverPage() {
  return (
    <Suspense fallback={<Loading />}>
      <SolverDispatch />
    </Suspense>
  );
}
