'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AlgInput, { type AlgInputHandle } from '@/components/AlgInput';
import AlgPlayer from '@/components/AlgPlayer';
import { ClearButton } from '@/components/ClearButton';
import HeaderToggles from '@/components/HeaderToggles';
import Link from '@/components/AppLink';
import { useT } from '@/hooks/useT';
import { normalizeWcaScramble } from '@cuberoot/shared/normalize-wca-scramble';
import { createRustCrossPool, type RustCrossPool, type SolItem } from '@cuberoot/timer-ui/stage-solver/rust-cross-client';
import { inspectXCrossSolution, rankXCrossSolutions, xcrossEffort, XCROSS_EFFORT_WEIGHTS } from '@cuberoot/timer-ui/stage-solver/xcross-ranking';
import examples from './examples.json';
import './ranking.css';

type Result = { scramble: string; stage: number; min: number; candidates: number; old: SolItem; current: SolItem; live?: boolean };
type Metric = keyof typeof XCROSS_EFFORT_WEIGHTS;
const METRICS: { key: Metric; zh: string; en: string; detailZh: string; detailEn: string }[] = [
  { key: 'moves', zh: '步数', en: 'Moves', detailZh: 'HTM：半转算一步，前导转体不计。', detailEn: 'HTM: a half turn counts once; leading rotations are excluded.' },
  { key: 'anchorDelay', zh: '首次结构延迟', en: 'First-structure delay', detailZh: '每个目标槽首次出现可用结构的步数减 1，下限为 0，再相加；初始和一步成形都不加罚。', detailEn: 'Sum max(0, first structure step − 1) across target slots. Existing and one-move structures receive no penalty.' },
  { key: 'anchorRework', zh: '起手结构丢失', en: 'Loss of an anchor', detailZh: '某个目标槽原本有可用结构，随后所有可用结构都消失时计入。', detailEn: 'Charged when a target slot loses all of its previously available anchors.' },
  { key: 'pairRework', zh: '棱角对拆组', en: 'Pair disruption', detailZh: '已连接的目标棱角对被拆开；初始就有的非目标棱角对按一半计入。', detailEn: 'Breaking a connected target pair; an initially connected non-target pair contributes at half weight.' },
  { key: 'blockRework', zh: '组块拆开', en: 'Block disruption', detailZh: '目标角与相邻目标十字棱的正确连接被拆开。', detailEn: 'Breaking a correct bond between a target corner and an adjacent target cross edge.' },
  { key: 'tracking', zh: '追踪负担', en: 'Tracking load', detailZh: '每步将前后都保持连接的目标块视为一组，累计 max(0, 当步移动组数 − 2)²。XXC 两个槽一起计算。', detailEn: 'For each move, keep continuously bonded target pieces in one group and sum max(0, moving groups − 2)². XXC is evaluated jointly.' },
  { key: 'crossRework', zh: '十字棱移出', en: 'Cross-edge displacement', detailZh: '已经归位的十字棱再次离开原位。', detailEn: 'A solved cross edge moves out of its home position.' },
  { key: 'execution', zh: '转动附加项', en: 'Turn tie-breaker', detailZh: '0.1 × 额外四分之一转数 + 0.08 × 转动轴切换次数。它不是实际指法耗时。', detailEn: '0.1 × extra quarter turns + 0.08 × axis changes. This is not a finger-trick time estimate.' },
];
const number = (n: number) => Number(n.toFixed(2)).toString();

export default function XCrossRankingExperiment() {
  const t = useT();
  const [draft, setDraft] = useState(examples[0].scramble);
  const [stage, setStage] = useState(1);
  const [result, setResult] = useState<Result | null>(examples[0]);
  const [version, setVersion] = useState<'old' | 'current'>('current');
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const input = useRef<AlgInputHandle>(null);
  const pool = useRef<RustCrossPool | null>(null);
  const request = useRef(0);
  useEffect(() => () => { request.current++; pool.current?.terminate(); }, []);
  const onStep = useCallback((n: number) => setStep(n), []);
  const selected = result?.[version];
  const analysis = useMemo(() => result && selected ? inspectXCrossSolution(result.scramble, selected) : null, [result, selected]);
  const scores = useMemo(() => result ? { old: xcrossEffort(result.scramble, result.old), current: xcrossEffort(result.scramble, result.current) } : null, [result]);
  const frame = analysis?.frames[Math.min(step, analysis.frames.length - 1)];
  const sampleIndex = examples.findIndex(x => x.scramble === draft && x.stage === stage);

  function loadExample(index: number, nextStage = stage) {
    const example = examples.find(x => x.index === index && x.stage === nextStage)!;
    input.current?.setText(example.scramble);
    setDraft(example.scramble); setStage(nextStage); setResult(example); setError(''); setVersion('current'); setStep(0);
  }
  function cancel() {
    request.current++; pool.current?.terminate(); pool.current = null; setBusy(false);
  }
  async function compare() {
    const scramble = normalizeWcaScramble(draft)?.trim() ?? '';
    const tokens = scramble.split(/\s+/);
    if (!scramble || tokens.length > 60 || tokens.some(m => !/^[URFDLB](?:2|')?$/.test(m))) {
      setError(t('请输入 1–60 步三阶外层打乱（U R F D L B，可带 2 或撇号）。', 'Enter 1–60 outer-layer moves: U R F D L B, optionally followed by 2 or a prime.')); return;
    }
    const id = ++request.current;
    setBusy(true); setError(''); setResult(null);
    try {
      const engine = pool.current ?? (pool.current = createRustCrossPool(1));
      await engine.ready;
      await engine.ensureXCross();
      if (id !== request.current) return;
      const baseline = await engine.solveMoves(scramble, stage, 0, { extra: 2, cap: 10 });
      if (id !== request.current) return;
      const expanded = await engine.solveMoves(scramble, stage, 0, { extra: 2, cap: 10, practical: true });
      if (id !== request.current) return;
      const old = baseline.sols.map(sol => ({ sol, effort: xcrossEffort(scramble, sol) }))
        .filter(x => x.effort.valid).sort((a, b) => a.effort.moves - b.effort.moves || a.effort.qtm - b.effort.qtm)[0]?.sol;
      const current = rankXCrossSolutions(scramble, expanded.sols, 1)[0];
      if (!old || !current || baseline.len !== expanded.len) throw new Error('No verified comparison');
      setResult({ scramble, stage, min: baseline.len, candidates: expanded.sols.length, old, current, live: true });
      setVersion('current'); setStep(0);
    } catch {
      if (id === request.current) {
        pool.current?.terminate(); pool.current = null;
        setError(t('未能完成对照，请重试。', 'The comparison could not be completed. Please retry.'));
      }
    } finally { if (id === request.current) setBusy(false); }
  }

  return <main className="xcr-exp">
    <header>
      <div className="xcr-top"><span className="xcr-badge">{t('实验 v0.1', 'Experiment v0.1')}</span><HeaderToggles /></div>
      <h1>{t('XC / XXC 结构排序', 'XC / XXC structural ranking')}</h1>
      <p>{t('目标是让容易观察、结构连续的解法排在前面。本页用于比较实验算法；普通计时器仍使用原排序。', 'The aim is to prioritize solutions with visible starting structures and continuous piece relationships. This page compares the experiment; the regular timer retains its original ranking.')}</p>
    </header>

    <section aria-labelledby="xcr-compare">
      <h2 id="xcr-compare">{t('同一打乱，比较首条推荐', 'Compare the first recommendation')}</h2>
      <div className="xcr-controls">
        <label>{t('示例', 'Example')}<select className="xcr-select" aria-label={t('示例', 'Example')} disabled={busy} value={sampleIndex < 0 ? '' : examples[sampleIndex].index} onChange={e => loadExample(Number(e.target.value))}>
          <option value="" disabled>{t('自定义', 'Custom')}</option>
          {[0, 1, 2].map(n => <option key={n} value={n}>{t('测试打乱', 'Test scramble')} {n + 1}</option>)}
        </select></label>
        <label>{t('阶段', 'Stage')}<select className="xcr-select" aria-label={t('阶段', 'Stage')} disabled={busy} value={stage} onChange={e => {
          const value = Number(e.target.value); setStage(value); setStep(0);
          if (sampleIndex >= 0) loadExample(examples[sampleIndex].index, value); else setResult(null);
        }}><option value={1}>XCross</option><option value={2}>XXCross</option></select></label>
        <span className="xcr-muted">{t('D 底 · 外层转动 · 最短 + 2 步', 'D cross · outer turns · optimum + 2 moves')}</span>
      </div>
      <label htmlFor="xcr-scramble">{t('打乱', 'Scramble')}</label>
      <div className="xcr-input">
        <AlgInput ref={input} id="xcr-scramble" className="xcr-scramble-field" initialText={examples[0].scramble} rows={2} inputMode="text" autoResize
          onChange={text => { if (busy) cancel(); setDraft(text); setResult(null); }} />
        {draft && <ClearButton onClick={() => { if (busy) cancel(); input.current?.setText(''); setDraft(''); setResult(null); }} />}
      </div>
      <div className="xcr-actions">
        <button className="xcr-button" type="button" disabled={busy} onClick={() => void compare()}>{t('现场计算对照', 'Compute comparison')}</button>
        {busy && <><span role="status">{t('加载求解器并计算…', 'Loading solver and computing…')}</span><button className="xcr-button" type="button" onClick={cancel}>{t('取消', 'Cancel')}</button></>}
      </div>
      {error && <p className="xcr-error" role="alert">{error}</p>}
      {result && scores && <>
        <p className="xcr-muted">{result.live ? t('现场计算', 'Live result') : t('2026-10-24 结果快照', '2026-10-24 result snapshot')} · {t('最短', 'Optimum')} {result.min} HTM · {t('实验候选', 'Experimental candidates')} {result.candidates}</p>
        <div className="xcr-solutions">
          {(['old', 'current'] as const).map(v => <button className="xcr-button xcr-solution" type="button" key={v} aria-pressed={version === v} onClick={() => { setVersion(v); setStep(0); }}>
            <span>{v === 'old' ? t('原排序首选', 'Baseline first') : t('实验排序首选', 'Experimental first')}</span>
            <code>{result[v].m || t('无需转动', 'No moves')}</code>
            <span className="xcr-muted">{scores[v].moves} HTM · {result[v].c} · {t('结构代价', 'Cost')} {number(scores[v].score)}</span>
          </button>)}
        </div>
        <div className="xcr-player"><AlgPlayer key={`${result.scramble}|${selected?.m}|${selected?.c}`} puzzle="3x3" set="" setup={result.scramble} alg={selected?.m ?? ''}
          size={300} engine="sim" onStepChange={onStep} /></div>
        {frame && <p className="xcr-frame" aria-live="polite">{t('第', 'Step')} {frame.step} · {frame.slots.map(s => {
          const facts = [s.pair && t('棱角成对', 'paired'), s.blockLinks > 0 && t('连接十字棱', 'bonded to cross edge'), s.edgeHome && t('棱归位', 'edge home'), s.cornerHome && t('角归位', 'corner home')].filter(Boolean);
          return `${s.name}: ${facts.join(' / ') || t('暂无可用结构', 'no anchor')}`;
        }).join('；')} · {t('十字', 'Cross')} {frame.crossSolved}/4</p>}
        <div className="xcr-table"><table><caption>{t('原始指标 → 加权代价', 'Raw feature → weighted cost')}</caption><thead><tr><th>{t('代价分解', 'Cost breakdown')}</th><th>{t('权重', 'Weight')}</th><th>{t('原排序首选', 'Baseline first')}</th><th>{t('实验排序首选', 'Experimental first')}</th></tr></thead><tbody>
          {METRICS.map(m => <tr key={m.key}><th scope="row">{t(m.zh, m.en)}</th><td>× {XCROSS_EFFORT_WEIGHTS[m.key]}</td>{(['old', 'current'] as const).map(v => <td key={v}>{number(scores[v][m.key])} → {number(scores[v][m.key] * XCROSS_EFFORT_WEIGHTS[m.key])}</td>)}</tr>)}
          <tr><th>{t('合计（越低越优先）', 'Total (lower ranks first)')}</th><td></td><td>{number(scores.old.score)}</td><td>{number(scores.current.score)}</td></tr>
        </tbody></table></div>
      </>}
    </section>

    <section>
      <h2>{t('具体改了什么', 'What changed')}</h2>
      <p>{t('原流程在全局最短的槽位组合里枚举，收够显示条数就停止，再按 HTM、QTM 排列。这样即使允许多两步，更易理解的其他槽位路线也可能根本没进入候选。', 'The baseline enumerates globally shortest slot combinations, stops when the display cap is reached, then orders by HTM and QTM. Even with two extra moves allowed, easier routes through other slots may never enter the candidate pool.')}</p>
      <ol>
        <li>{t('保留原来的精确最短距离 d。已有枚举先取最多 32 条，再增加有界候选搜索。', 'Keep the exact minimum distance d. Retain up to 32 baseline candidates, then add a bounded candidate search.')}</li>
        <li>{t('本页搜索 d 到 d+2：XC 覆盖 4 个槽，XXC 覆盖 6 个双槽组合；每个深度、槽组合和首步分别分配预算。每桶最多取 4 条，最多尝试 8,000 次转动扩展。', 'This page searches d through d+2: all four XC slots or all six XXC slot pairs. Each depth, slot combination and first move gets a separate budget: at most four solutions and 8,000 attempted move expansions per bucket.')}</li>
        <li>{t('合并去重后，使用独立的块状态模型重放每条候选。只有确实完成十字和目标槽的解法才进入排序。', 'Merge and deduplicate candidates, then replay them using a separate cubie-state model. Only solutions that actually solve the cross and target slots are ranked.')}</li>
        <li>{t('按下表的固定结构代价排序；同分再按 HTM、QTM 和稳定的文本顺序排列。权重不会根据当前打乱或用户评分调整。', 'Rank by the fixed structural cost below, then break ties by HTM, QTM and stable text order. Weights do not adapt to the current scramble or user ratings.')}</li>
      </ol>
      <p>{t('“可用结构”在这一版中的精确定义：目标棱归位、目标角归位、目标棱角已正确配对，或目标角与相邻目标十字棱形成正确连接。它是几何关系检测，还不是完整的 F2L 标态识别。', 'In this version, an anchor means a home target edge, a home target corner, a correctly connected target pair, or a correct bond between the target corner and an adjacent target cross edge. These are geometric checks, not a complete F2L case recognizer.')}</p>
      <div className="xcr-table"><table><thead><tr><th>{t('指标 / 权重', 'Metric / weight')}</th><th>{t('计算方式', 'Definition')}</th></tr></thead><tbody>
        {METRICS.map(m => <tr key={m.key}><th scope="row">{t(m.zh, m.en)} × {XCROSS_EFFORT_WEIGHTS[m.key]}</th><td>{t(m.detailZh, m.detailEn)}</td></tr>)}
      </tbody></table></div>
      <p>{t('拆组类指标按每次丢失计 1 + 0.5 × 连续丢失状态数。若恰好由“侧面转动 → U/D → 同侧逆转”三步恢复该关系，本次只计 0.25，避免把常见暂时拆开一律重罚。多个指标可能同时命中，代价会相加。', 'Each disruption costs 1 + 0.5 × consecutive missing states. If a side turn → U/D → inverse side turn restores that relationship in exactly three moves, it costs only 0.25. Features can overlap and their costs add together.')}</p>
    </section>

    <section>
      <h2>{t('实验结论与边界', 'Evidence and limitations')}</h2>
      <p>{t('已经实现：候选跨槽覆盖、逐步结构检测、固定代价排序、独立验解。已有自动检查覆盖连接关系、24 种整体朝向、六个底面，以及 XC/XXC 候选的目标正确性。这里的三个示例取自仓库测试语料的前三条打乱，各展示两个阶段，不是成功率统计。', 'Implemented: candidates across slots, stepwise structure detection, fixed-cost ranking and independent solution replay. Automated checks cover piece bonds, all 24 cube orientations, six cross faces and XC/XXC goal correctness. The three examples are the first three scrambles in the repository fixture, each shown for two stages; they are not a success-rate study.')}</p>
      <ul>
        <li>{t('优化目标是观察与规划的结构代价；没有证明实际观察时间、执行时间或顶尖选手接受率改善。分数不是秒数，也不是质量概率。', 'The objective is a structural proxy for inspection and planning. Improvements in actual inspection time, execution time or elite acceptance have not been demonstrated. Scores are neither seconds nor quality probabilities.')}</li>
        <li>{t('这是人工设计的固定启发式，没有训练模型，没有向用户收集评分。使用通用特征不能自动保证泛化；尚未完成独立大样本评估或权重敏感性分析。', 'This is a manually designed fixed heuristic, with no trained model or user ratings. General features do not guarantee generalization; an independent large-sample evaluation and weight-sensitivity analysis remain unfinished.')}</li>
        <li>{t('候选搜索受预算限制，并非把 d+2 内所有解都找全；仍可能漏掉更自然的路线。低分也可能来自几何关系巧合，不一定真能一眼看出。', 'Candidate search is budget-limited, not exhaustive through d+2, and can miss more natural routes. A low score may reflect incidental geometric relationships that are not obvious to a human.')}</li>
        <li>{t('目前没有完整标态目录、遮挡与可见性模型、真实指法与换手模型，也没有准确模拟选手如何把多步合成一个思考单元。XXC 的同时追踪成本只是近似。', 'There is no complete F2L case catalog, visibility model, real finger-trick/regrip model or accurate model of mental move chunks. Simultaneous XXC tracking cost is only an approximation.')}</li>
      </ul>
      <p className="xcr-muted">{t('实现与复现入口', 'Implementation and reproduction')}: <a href="https://github.com/2017YANR02/cuberoot.me/blob/main/core/packages/timer-ui/src/stage-solver/xcross-ranking.ts" target="_blank" rel="noreferrer">{t('排序与诊断', 'Ranking and diagnostics')}</a> · <a href="https://github.com/2017YANR02/cuberoot.me/blob/main/solver/src/xcross_solver.rs" target="_blank" rel="noreferrer">{t('候选搜索', 'Candidate search')}</a> · <a href="https://github.com/2017YANR02/cuberoot.me/blob/main/core/packages/client/tests/xcross-ranking.test.ts" target="_blank" rel="noreferrer">{t('回归检查', 'Regression checks')}</a></p>
      <Link href="/dev/solvers" prefetch={false}>{t('求解器总览', 'Solver overview')}</Link>
    </section>
  </main>;
}
