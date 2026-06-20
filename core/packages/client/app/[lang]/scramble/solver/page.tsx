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
