'use client';

/**
 * /scramble/solver?event=sia222 — Siamese 2×2×2(联体 2×2×2)整解最优在线求解器。TIER B(离线 PDB)。
 *
 * 纯 TS:sia222 = 两 3×3×3 沿共享 2×2×2 块联体,实测整群是直积 G = G_A × G_B(A/B 招式作用不相交块且对易),
 * 每半边 = 受限 ⟨U,R,F⟩ 3×3×3。解 = 按 cstimer 打乱里的 z2 y 拆成 A、B 两块 → 各半 IDA*(角 PDB 3,674,160 +
 * 两张互补 6 棱 PDB,max 启发)独立求最优 → 拼接 = 全局最优(直积结构,长度 = 两半最优之和)。三张 PDB 离线
 * BFS 一次、序列化成 ~4MB gz、首次求解时 fetch+inflate(DecompressionStream)→ 常驻 ~18.8MB 类型化数组,无现场
 * BFS。剪枝表较大 → 桌面优先(给「建议桌面端」提示)。打乱来源复用 cstimer 桥 cstimerScramble('sia222')。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryState, parseAsString } from 'nuqs';
import { LoaderCircle } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { tr } from '@/i18n/tr';
import { ScramblePreview2D } from '@/components/ScramblePreview2D';
import { cstimerScramble } from '@/lib/cstimer-scramble';
import { solveSia222, type Sia222Solution } from '@/lib/sia222-solver';
import SolveTabs from '../_components/SolveTabs';
import { SolvePanel, type BatchSpec } from '../_components/BatchSolvePanel';
import '../_components/puzzle_optimal_solver.css';
import './ivy_solver.css';

// quick batch validation: tokens are U/R/F·{"","2","'"} or the literal z2 / y separator pieces.
function badTokenIn(line: string): string | null {
  for (const tok of line.trim().split(/\s+/)) {
    if (!tok) continue;
    if (tok === 'z2' || tok === 'y') continue;
    if (!/^[URF](2|')?$/.test(tok)) return tok;
  }
  return null;
}

type SolveState =
  | { kind: 'idle' }
  | { kind: 'solving' }
  | { kind: 'done'; result: Sia222Solution }
  | { kind: 'error'; message: string; tableError?: boolean };

export default function Sia222SolverPage() {
  useDocumentTitle('联体 2×2×2 求解器', 'Siamese 2×2×2 Solver');

  const [scramble, setScramble] = useQueryState('scramble', parseAsString.withDefault(''));
  const [state, setState] = useState<SolveState>({ kind: 'idle' });

  const lines = useMemo(() => scramble.split('\n').map((s) => s.trim()).filter(Boolean), [scramble]);
  const lineCount = lines.length;
  const trimmed = lines[0] ?? '';

  const reqRef = useRef(0);
  useEffect(() => {
    if (!trimmed || lineCount > 1) { setState({ kind: 'idle' }); return; }
    const myReq = ++reqRef.current;
    setState({ kind: 'solving' });
    let cancelled = false;
    solveSia222(trimmed).then(
      (result) => { if (!cancelled && reqRef.current === myReq) setState({ kind: 'done', result }); },
      (e) => {
        if (cancelled || reqRef.current !== myReq) return;
        const message = String((e as Error)?.message ?? e);
        setState({ kind: 'error', message, tableError: !message.startsWith('bad:') });
      },
    );
    return () => { cancelled = true; };
  }, [trimmed, lineCount]);

  const batchSpec: BatchSpec = useMemo(() => ({
    event: 'sia222',
    metricLabel: 'moves',
    placeholder: { zh: "每行一条打乱,如 U R F' z2 y U2 R F", en: "one scramble per line, e.g. U R F' z2 y U2 R F" },
    validate: (line) => badTokenIn(line),
    solveOne: async (s) => { const o = await solveSia222(s); return { len: o.length, solution: o.solution }; },
    randomOne: () => cstimerScramble('sia222'),
    concurrency: 1,
  }), []);

  return (
    <div className="pos-page">
      <SolveTabs puzzle="sia222" mode="solve" />

      <SolvePanel
        spec={batchSpec}
        scramble={scramble}
        onScrambleChange={(v) => void setScramble(v)}
        renderSingle={() => (
          <>
            <p className="pos-lead">
              {tr({
                zh: '联体 2×2×2 在线求解:两 3×3×3 沿共享 2×2×2 块联体,整群是直积 → 按打乱里的 z2 y 拆半、各半受限 ⟨U,R,F⟩ 最优求解(角 + 双 6 棱剪枝表)、拼接得全局最优解。剪枝表约 18.8MB,建议桌面端。',
                en: 'Siamese 2×2×2 online solver: two 3×3×3 cubes glued at a shared 2×2×2 block (a direct-product group). Split the scramble at z2 y, solve each restricted ⟨U,R,F⟩ half optimally (corner + two 6-edge databases), concatenate → globally optimal. ~18.8MB databases — desktop recommended.',
              })}
            </p>

            {trimmed && (
              <div className="pos-result" aria-live="polite">
                {state.kind !== 'error' && (
                  <div className="ivy-preview">
                    <ScramblePreview2D event="sia222" scramble={trimmed} size={64} />
                  </div>
                )}
                {state.kind === 'solving' && (
                  <p className="pos-result-solved">
                    <LoaderCircle size={16} className="pos-spin" aria-hidden style={{ verticalAlign: '-3px', marginRight: 6 }} />
                    {tr({ zh: '求解中(首次会加载约 4MB 剪枝表)…', en: 'Solving (the first call loads the ~4MB databases)…' })}
                  </p>
                )}
                {state.kind === 'error' && state.tableError && (
                  <p className="pos-error">
                    {tr({ zh: '剪枝表加载失败,请检查网络后重试', en: 'Failed to load the pattern databases — check your connection and retry' })}: <code>{state.message}</code>
                  </p>
                )}
                {state.kind === 'error' && !state.tableError && (
                  <p className="pos-error">
                    {tr({ zh: '打乱记号无法识别(应为 U/R/F 招式,中间 z2 y 分隔两个立方)', en: 'Unrecognized notation (expected U/R/F moves with a z2 y separator)' })}: <code>{state.message}</code>
                  </p>
                )}
                {state.kind === 'done' && state.result.length === 0 && (
                  <p className="pos-result-solved">{tr({ zh: '已是还原态', en: 'Already solved' })}</p>
                )}
                {state.kind === 'done' && state.result.length > 0 && (
                  <>
                    <div className="ivy-metric">
                      <span className="ivy-metric-num">{state.result.length}</span>
                      <span className="ivy-metric-label">
                        {tr({ zh: '步 最优解', en: state.result.length === 1 ? 'move (optimal)' : 'moves (optimal)' })}
                      </span>
                      <span className="ivy-metric-god">
                        {tr({ zh: `A ${state.result.halfLengths[0]} + B ${state.result.halfLengths[1]}`, en: `A ${state.result.halfLengths[0]} + B ${state.result.halfLengths[1]}` })}
                      </span>
                    </div>
                    <div className="ivy-solbox">{state.result.solution}</div>
                  </>
                )}
              </div>
            )}

            <div className="ivy-caveat">
              <strong>{tr({ zh: '关于「最优」', en: 'About "optimal"' })}</strong>{' '}
              {tr({
                zh: '联体 2×2×2 是两个 3×3×3 沿共享 2×2×2 块粘成一体的魔方。实测整个群是直积 G = G_A × G_B —— 两个立方的招式作用在互不相交的块上、两两对易;共享块锁死每个立方各 3 个面,所以每半边都是受限 ⟨U,R,F⟩ 3×3×3(角轨道 3,674,160、棱轨道 92,897,280)。求解时把打乱按中间的 z2 y 拆成 A、B 两块,各半边用 IDA* + 模式数据库(角 3,674,160 + 两张互补 6 棱)独立求出最短解,再拼接。由直积结构,拼接的总步数 = 两半最优步数之和,而且没有更短的整体解,所以这里给出的是真正的全局最优解,不是近似。三张剪枝表约 18.8MB 常驻,首次求解时下载约 4MB 压缩表,建议桌面端使用。',
                en: 'The Siamese 2×2×2 is two 3×3×3 cubes fused along a shared 2×2×2 corner block. The whole group is a measured direct product G = G_A × G_B — the two cubes\' moves act on disjoint pieces and all commute; the shared block locks three faces of each cube, so each half is a restricted ⟨U,R,F⟩ 3×3×3 (corner orbit 3,674,160, edge orbit 92,897,280). To solve, split the scramble at the central z2 y into an A-block and a B-block, solve each half optimally with IDA* + pattern databases (corner 3,674,160 + two complementary 6-edge), and concatenate. By the direct-product structure the concatenation\'s length is the sum of the two half-optima and no shorter overall solution exists, so every solution here is a true GLOBAL optimum, not an approximation. The three databases are ~18.8MB resident; the first solve downloads ~4MB compressed — desktop recommended.',
              })}
            </div>
          </>
        )}
      />
    </div>
  );
}
